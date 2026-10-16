import { z } from "zod";
import { randomUUID } from "node:crypto";
import { body, RequestError } from "@/lib/http";
import { campaignById } from "@/lib/content";
import { conversationSchema, generate } from "@/lib/assistant";
import { generateStreaming } from "@/lib/assistant-stream";
import { event, state, visitor } from "@/lib/store";
import { transaction } from "@/lib/db";
const schema = z
  .object({
    campaignId: z.string(),
    question: z.string().trim().min(1).max(1000),
    history: conversationSchema.optional(),
  })
  .strict();
export async function POST(req: Request) {
  let id: string | undefined, campaignId: string | undefined;
  const requestId = randomUUID(),
    started = Date.now();
  let failed = false;
  async function recordFailure(error: unknown) {
    if (failed || !id) return;
    failed = true;
    await event(id, "ai_answer_failed", campaignId || null, {
      requestId,
      latencyMs: Date.now() - started,
      status:
        error instanceof RequestError ? String(error.status) : "provider_error",
    }).catch(() => {});
  }
  try {
    const p = schema.safeParse(await body(req));
    if (!p.success)
      throw new RequestError(
        "Enter a question between 1 and 1,000 characters with at most two recent conversation exchanges.",
      );
    if (p.data.history && p.data.history.campaignId !== p.data.campaignId)
      throw new RequestError(
        "Conversation history must belong to this fundraiser.",
      );
    const c = campaignById(p.data.campaignId);
    if (!c) throw new RequestError("That fundraiser could not be found.", 404);
    campaignId = c.id;
    id = await visitor();
    if (!process.env.OPENAI_API_KEY)
      throw new RequestError(
        "AI is not configured. You can still read the campaign story and updates.",
        503,
      );
    const budget = Number(process.env.AI_REQUEST_BUDGET ?? 100);
    if (!Number.isSafeInteger(budget) || budget < 1)
      throw new RequestError(
        "AI is temporarily unavailable. You can still read the campaign story and updates.",
        503,
      );
    await transaction(async (db) => {
      const window = new Date(Math.floor(Date.now() / 600000) * 600000);
      for (const [scope, limit] of [
        ["deployment", budget],
        ["visitor:" + id, 10],
      ] as const) {
        const result = await db.query(
          "INSERT INTO ai_usage(scope,window_start,count) VALUES($1,$2,1) ON CONFLICT(scope,window_start) DO UPDATE SET count=ai_usage.count+1 RETURNING count",
          [scope, window],
        );
        if (result.rows[0].count > limit)
          throw new RequestError(
            "The question limit has been reached. Please try again in ten minutes.",
            429,
          );
      }
    });
    await event(id, "ai_question_submitted", c.id, { requestId });
    const donations = (await state(id)).donations;
    if (
      req.headers
        .get("accept")
        ?.split(",")
        .some((type) => type.trim().split(";")[0] === "text/event-stream")
    ) {
      const abort = new AbortController();
      const signal = AbortSignal.any([req.signal, abort.signal]);
      const encoder = new TextEncoder();
      let cancelled = false;
      let terminalRecorded = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (type: string, data: unknown) => {
            if (!cancelled)
              controller.enqueue(
                encoder.encode(
                  `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
                ),
              );
          };
          send("start", { requestId, campaignId: c.id });
          void (async () => {
            try {
              for await (const update of generateStreaming(
                c,
                p.data.question,
                donations,
                signal,
                p.data.history,
              )) {
                signal.throwIfAborted();
                if (update.type === "done") {
                  await event(
                    id!,
                    update.answer.status === "missing"
                      ? "ai_answer_abstained"
                      : "ai_answer_completed",
                    c.id,
                    { requestId, latencyMs: Date.now() - started },
                  );
                  terminalRecorded = true;
                }
                signal.throwIfAborted();
                send(update.type, { ...update.answer, requestId });
              }
            } catch (error) {
              if (!terminalRecorded) await recordFailure(error);
              send("error", { requestId, error: safeMessage(error) });
            } finally {
              if (!cancelled) controller.close();
            }
          })();
        },
        cancel(reason) {
          cancelled = true;
          abort.abort(reason);
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-store, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
    const answer = await generate(
      c,
      p.data.question,
      donations,
      req.signal,
      p.data.history,
    );
    await event(
      id,
      answer.status === "missing"
        ? "ai_answer_abstained"
        : "ai_answer_completed",
      c.id,
      { requestId, latencyMs: Date.now() - started },
    );
    return Response.json({ ...answer, requestId });
  } catch (e) {
    await recordFailure(e);
    return Response.json(
      { error: safeMessage(e) },
      { status: e instanceof RequestError ? e.status : 503 },
    );
  }
}
function safeMessage(e: unknown) {
  const safeProviderMessages = [
    "The AI service is temporarily unavailable. Please try again or read the original sources.",
    "The AI could not finish a supported answer. Please try again.",
  ];
  return e instanceof RequestError
    ? e.message
    : e instanceof Error && safeProviderMessages.includes(e.message)
      ? e.message
      : "We couldn’t get a reliable answer in time. Please try again or read the original sources.";
}
