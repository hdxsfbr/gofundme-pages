import type { Campaign } from "./content";
import type { Donation } from "./domain";
import {
  prepareGeneration,
  resolveAnswer,
  type Conversation,
} from "./assistant";

type Answer = ReturnType<typeof resolveAnswer>;
export type AnswerStreamEvent = { type: "partial" | "done"; answer: Answer };
const unavailable = () =>
  new Error("The AI could not finish a supported answer. Please try again.");

/** Read only closed claim objects from the schema's ordered claims array. */
function completedClaims(text: string): unknown[] {
  const prefix =
    /^\s*\{\s*"status"\s*:\s*"(?:supported|missing)"\s*,\s*"claims"\s*:\s*\[/.exec(
      text,
    );
  if (!prefix) return [];
  const claims: unknown[] = [];
  let cursor = prefix[0].length;
  while (cursor < text.length) {
    while (/\s/.test(text[cursor] ?? "") && cursor < text.length) cursor++;
    if (cursor === text.length || text[cursor] === "]") break;
    if (text[cursor] !== "{") throw unavailable();
    const start = cursor;
    let depth = 0,
      quoted = false,
      escaped = false,
      closed = false;
    for (; cursor < text.length; cursor++) {
      const char = text[cursor];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        claims.push(JSON.parse(text.slice(start, cursor + 1)));
        cursor++;
        closed = true;
        break;
      }
    }
    if (!closed) break;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
    if (cursor === text.length || text[cursor] === "]") break;
    if (text[cursor++] !== ",") throw unavailable();
  }
  return claims;
}

async function* providerEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal | null,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "",
    received = 0;
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => {});
  };
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > 2 * 1024 * 1024) throw unavailable();
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(
        /\r\n/g,
        "\n",
      );
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data && data !== "[DONE]")
          yield JSON.parse(data) as Record<string, unknown>;
      }
      if (buffer.length > 128 * 1024) throw unavailable();
    }
    decoder.decode();
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function* generateStreaming(
  c: Campaign,
  question: string,
  donations: Donation[],
  signal?: AbortSignal,
  history?: Conversation,
): AsyncGenerator<AnswerStreamEvent> {
  signal?.throwIfAborted();
  const { now, request } = prepareGeneration(
    c,
    question,
    donations,
    signal,
    history,
    true,
  );
  const response = await fetch("https://api.openai.com/v1/responses", request);
  if (!response.ok || !response.body) throw unavailable();
  let text = "",
    emitted: Answer["claims"] = [],
    channel: string | undefined;
  try {
    for await (const event of providerEvents(response.body, request.signal)) {
      request.signal?.throwIfAborted();
      if (event.type === "response.output_text.delta") {
        if (typeof event.delta !== "string") throw unavailable();
        const nextChannel = JSON.stringify([
          event.item_id ?? null,
          event.output_index ?? null,
          event.content_index ?? null,
        ]);
        if (channel && channel !== nextChannel) throw unavailable();
        channel = nextChannel;
        text += event.delta;
        if (text.length > 32768) throw unavailable();
        const claims = completedClaims(text);
        if (claims.length > emitted.length) {
          const partial = resolveAnswer(
            { status: "supported", claims, missing: "", fundingFacts: [] },
            c,
            donations,
            now,
          );
          emitted = partial.claims;
          yield { type: "partial", answer: partial };
        }
      } else if (event.type === "response.output_text.done") {
        if (typeof event.text !== "string" || event.text !== text)
          throw unavailable();
      } else if (event.type === "response.completed") {
        const final = event.response as
          | {
              status?: string;
              output?: { content?: { type: string; text?: string }[] }[];
            }
          | undefined;
        if (final?.status !== "completed") throw unavailable();
        const finalText = final.output
          ?.flatMap((output) => output.content ?? [])
          .filter((part) => part.type === "output_text")
          .map((part) => part.text ?? "")
          .join("");
        if (
          !finalText ||
          (text && finalText !== text) ||
          finalText.length > 32768
        )
          throw unavailable();
        const answer = resolveAnswer(JSON.parse(finalText), c, donations, now);
        if (
          JSON.stringify(answer.claims.slice(0, emitted.length)) !==
          JSON.stringify(emitted)
        )
          throw unavailable();
        yield { type: "done", answer };
        return;
      } else if (
        [
          "error",
          "response.failed",
          "response.incomplete",
          "response.refusal.delta",
          "response.refusal.done",
        ].includes(String(event.type))
      )
        throw unavailable();
    }
    throw unavailable();
  } finally {
    await response.body.cancel().catch(() => {});
  }
}
