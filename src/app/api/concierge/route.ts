import { randomUUID } from "node:crypto";
import { body, RequestError } from "@/lib/http";
import { conciergeRequestSchema } from "@/lib/concierge-view";
import { generateConcierge } from "@/lib/concierge";
import { community } from "@/lib/content";
import { visitor, event, state } from "@/lib/store";
import { transaction } from "@/lib/db";

export async function POST(req: Request) {
  const requestId = randomUUID(),
    started = Date.now();
  let id: string | undefined;
  try {
    const parsed = conciergeRequestSchema.safeParse(await body(req));
    if (!parsed.success)
      throw new RequestError(
        "Enter a question between 1 and 1,000 characters with at most two completed exchanges.",
      );
    req.signal.throwIfAborted();
    id = await visitor();
    if (!process.env.OPENAI_API_KEY)
      throw new RequestError(
        "The concierge is not configured. You can still explore all campaigns.",
        503,
      );
    const budget = Number(process.env.AI_REQUEST_BUDGET ?? 100);
    if (!Number.isSafeInteger(budget) || budget < 1)
      throw new RequestError(
        "The concierge is temporarily unavailable. Please explore the campaigns.",
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
    await event(id, "concierge_question_submitted", community.id, {
      requestId,
    });
    const donations = (await state(id)).donations;
    req.signal.throwIfAborted();
    const answer = await generateConcierge(parsed.data, donations, req.signal);
    req.signal.throwIfAborted();
    await event(id, "concierge_answer_completed", community.id, {
      requestId,
      latencyMs: Date.now() - started,
    });
    return Response.json(
      { ...answer, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (id)
      await event(id, "concierge_answer_failed", community.id, {
        requestId,
        latencyMs: Date.now() - started,
      }).catch(() => {});
    return Response.json(
      {
        requestId,
        error:
          error instanceof RequestError
            ? error.message
            : "We couldn’t find a reliable answer in time. Please try again or explore the campaigns.",
      },
      {
        status: error instanceof RequestError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
