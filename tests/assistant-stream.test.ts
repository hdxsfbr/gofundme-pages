import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { campaigns } from "../src/lib/content";
import { generateStreaming } from "../src/lib/assistant-stream";
const c = campaigns[0];
const claim = {
  text: "The raised amount is {raised}.",
  sourceIds: ["funding"],
};
const raw = {
  status: "supported",
  claims: [claim],
  missing: "",
  fundingFacts: [],
};
function upstream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancelled = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel: cancelled,
  });
  const frame = (event: object, crlf = false) => {
    const text = "data: " + JSON.stringify(event) + "\n\n";
    const bytes = new TextEncoder().encode(
      crlf ? text.replaceAll("\n", "\r\n") : text,
    );
    // Exercise framing and UTF-8 boundaries, independently of provider token boundaries.
    for (let cursor = 0; cursor < bytes.length; cursor += 7)
      controller.enqueue(bytes.slice(cursor, cursor + 7));
  };
  return {
    response: new Response(body, {
      headers: { "Content-Type": "text/event-stream" },
    }),
    frame,
    cancelled,
    close: () => controller.close(),
  };
}
function complete(
  frame: ReturnType<typeof upstream>["frame"],
  text: string,
  answer: unknown = raw,
) {
  frame({ type: "response.output_text.done", text });
  frame({
    type: "response.completed",
    response: {
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(answer) }] },
      ],
    },
  });
}
describe("real provider SSE adapter with deterministic streamed fixtures", () => {
  const fetchFixture = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "fixture-not-a-real-key");
    vi.stubGlobal("fetch", fetchFixture);
    fetchFixture.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("emits a validated sentence while the upstream response is still open, with one frozen funding snapshot", async () => {
    const source = upstream();
    fetchFixture.mockResolvedValue(source.response);
    const stream = generateStreaming(c, "What is the progress?", []);
    const first = stream.next();
    const prefix = '{"status":"supported","claims":[' + JSON.stringify(claim);
    source.frame(
      { type: "response.output_text.delta", delta: prefix.slice(0, -1) },
      true,
    );
    source.frame({ type: "response.output_text.delta", delta: "}" }, true);
    const partial = await first;
    expect(partial.value).toMatchObject({
      type: "partial",
      answer: {
        claims: [
          {
            text: "The raised amount is $11,850.00.",
            citations: [{ id: "funding" }],
          },
        ],
        facts: [],
      },
    });
    expect(source.cancelled).not.toHaveBeenCalled();
    const request = JSON.parse(fetchFixture.mock.calls[0][1]!.body as string);
    expect(request).toMatchObject({ stream: true, store: false });
    expect(request.text.format.schema.properties.fundingFacts.maxItems).toBe(0);
    const suffix = '],"missing":"","fundingFacts":[]}';
    source.frame({ type: "response.output_text.delta", delta: suffix });
    complete(source.frame, prefix + suffix);
    const final = await stream.next();
    expect(final.value).toMatchObject({
      type: "done",
      answer: {
        snapshot: partial.value!.answer.snapshot,
        claims: partial.value!.answer.claims,
      },
    });
    expect((await stream.next()).done).toBe(true);
    expect(fetchFixture).toHaveBeenCalledTimes(1);
    expect(source.cancelled).toHaveBeenCalled();
  });
  it("waits for source IDs and safely handles escaped quotes, braces, and UTF-8 text", async () => {
    const source = upstream();
    fetchFixture.mockResolvedValue(source.response);
    const sentence = {
      text: 'The organizer’s plan is called "a little good".',
      sourceIds: ["story"],
    };
    const answer = { ...raw, claims: [sentence] };
    const text = JSON.stringify(answer);
    for (const delta of [
      text.slice(0, 35),
      text.slice(35, -30),
      text.slice(-30),
    ])
      source.frame({ type: "response.output_text.delta", delta });
    complete(source.frame, text, answer);
    const events = [];
    for await (const event of generateStreaming(c, "Explain the plan", []))
      events.push(event);
    expect(events[0].answer.claims[0].text).toBe(sentence.text);
    expect(events.at(-1)?.type).toBe("done");
  });
  it.each([
    { text: "The amount is {invented}.", sourceIds: ["funding"] },
    { text: "The raised amount is {raised}.", sourceIds: ["another-campaign"] },
    { text: "The raised amount is $999999.", sourceIds: ["funding"] },
  ])(
    "rejects unsafe completed claims before publishing any partial (%j)",
    async (unsafe) => {
      const source = upstream();
      fetchFixture.mockResolvedValue(source.response);
      source.frame({
        type: "response.output_text.delta",
        delta: '{"status":"supported","claims":[' + JSON.stringify(unsafe),
      });
      await expect(
        generateStreaming(c, "Question", []).next(),
      ).rejects.toThrow();
      expect(source.cancelled).toHaveBeenCalled();
    },
  );
  it.each([
    "truncated",
    "failed",
    "incomplete",
    "error",
    "refusal",
    "contradiction",
    "different-final",
  ])("fails safely after provisional content on %s", async (mode) => {
    const source = upstream();
    fetchFixture.mockResolvedValue(source.response);
    const stream = generateStreaming(c, "Question", []);
    const prefix = '{"status":"supported","claims":[' + JSON.stringify(claim);
    source.frame({ type: "response.output_text.delta", delta: prefix });
    expect((await stream.next()).value?.type).toBe("partial");
    if (mode === "truncated") source.close();
    else if (mode === "contradiction") {
      const suffix = '],"missing":"Not known","fundingFacts":[]}';
      source.frame({ type: "response.output_text.delta", delta: suffix });
      complete(source.frame, prefix + suffix, { ...raw, missing: "Not known" });
    } else if (mode === "different-final")
      source.frame({
        type: "response.completed",
        response: {
          status: "completed",
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({ ...raw, claims: [] }),
                },
              ],
            },
          ],
        },
      });
    else
      source.frame({
        type:
          mode === "refusal"
            ? "response.refusal.delta"
            : mode === "error"
              ? "error"
              : "response." + mode,
      });
    await expect(stream.next()).rejects.toThrow();
  });
  it("propagates cancellation and cancels a blocked upstream reader", async () => {
    const source = upstream();
    fetchFixture.mockResolvedValue(source.response);
    const abort = new AbortController();
    const stream = generateStreaming(c, "Question", [], abort.signal);
    const waiting = stream.next();
    await vi.waitFor(() => expect(fetchFixture).toHaveBeenCalledTimes(1));
    abort.abort();
    await expect(waiting).rejects.toThrow();
    expect(fetchFixture.mock.calls[0][1]!.signal?.aborted).toBe(true);
    expect(source.cancelled).toHaveBeenCalled();
  });
  it("keeps the 18-second deadline while waiting for another provider event", async () => {
    vi.useFakeTimers();
    try {
      const source = upstream();
      fetchFixture.mockResolvedValue(source.response);
      const deadline = new AbortController();
      vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
        expect(ms).toBe(18000);
        setTimeout(() => deadline.abort(), ms);
        return deadline.signal;
      });
      const waiting = generateStreaming(c, "Question", []).next();
      const rejected = expect(waiting).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(18000);
      await rejected;
      expect(source.cancelled).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
