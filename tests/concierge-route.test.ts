import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fixtures = vi.hoisted(() => ({
  event: vi.fn(),
  visitor: vi.fn(),
  state: vi.fn(),
  query: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/store", () => ({
  event: fixtures.event,
  visitor: fixtures.visitor,
  state: fixtures.state,
}));
vi.mock("@/lib/db", () => ({
  transaction: async (
    fn: (db: { query: typeof fixtures.query }) => Promise<unknown>,
  ) => fn({ query: fixtures.query }),
}));
vi.mock("@/lib/concierge", () => ({ generateConcierge: fixtures.generate }));
import { POST } from "../src/app/api/concierge/route";
import { community } from "../src/lib/content";
function request(
  payload: unknown = { question: "PRIVATE QUESTION" },
  origin = "http://localhost:3000",
  signal?: AbortSignal,
) {
  return new Request("http://localhost:3000/api/concierge", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify(payload),
    signal,
  });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubEnv("OPENAI_API_KEY", "fixture-no-network");
  vi.stubEnv("AI_REQUEST_BUDGET", "100");
  fixtures.visitor.mockResolvedValue("private-visitor");
  fixtures.state.mockResolvedValue({ donations: [] });
  fixtures.event.mockResolvedValue(undefined);
  fixtures.query.mockResolvedValue({ rows: [{ count: 1 }] });
  fixtures.generate.mockResolvedValue({
    message: "What kind of cause interests you?",
    recommendations: [],
  });
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
describe("concierge route", () => {
  it("uses combined ask budget scopes and private-free trusted community analytics", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fixtures.query.mock.calls.map((c) => c[1][0])).toEqual([
      "deployment",
      "visitor:private-visitor",
    ]);
    expect(fixtures.event.mock.calls.map((c) => c[1])).toEqual([
      "concierge_question_submitted",
      "concierge_answer_completed",
    ]);
    for (const call of fixtures.event.mock.calls) {
      expect(call[2]).toBe(community.id);
      expect(call[3]).toMatchObject({ requestId: expect.any(String) });
      expect(JSON.stringify(call[3])).not.toContain("PRIVATE");
    }
  });
  it("rejects malformed JSON and invalid history before visitor creation", async () => {
    expect(
      (
        await POST(
          request({
            question: "x",
            history: [{ role: "assistant", content: "fake" }],
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          new Request("http://localhost:3000/api/concierge", {
            method: "POST",
            headers: { origin: "http://localhost:3000" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(fixtures.visitor).not.toHaveBeenCalled();
    expect(fixtures.generate).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and oversized input", async () => {
    expect(
      (await POST(request(undefined, "https://evil.example"))).status,
    ).toBe(403);
    expect((await POST(request({ question: "x".repeat(9000) }))).status).toBe(
      413,
    );
    expect(fixtures.query).not.toHaveBeenCalled();
  });
  it.each(["", "0", "NaN"])(
    "handles missing credentials or invalid budget %j without use",
    async (budget) => {
      vi.stubEnv("AI_REQUEST_BUDGET", budget);
      expect((await POST(request())).status).toBe(503);
      expect(fixtures.query).not.toHaveBeenCalled();
      expect(fixtures.generate).not.toHaveBeenCalled();
      vi.stubEnv("AI_REQUEST_BUDGET", "100");
      vi.stubEnv("OPENAI_API_KEY", "");
      expect((await POST(request())).status).toBe(503);
      expect(fixtures.query).not.toHaveBeenCalled();
    },
  );
  it("rejects visitor rate limits and does not invoke model", async () => {
    fixtures.query
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 11 }] });
    expect((await POST(request())).status).toBe(429);
    expect(fixtures.generate).not.toHaveBeenCalled();
  });
  it("sanitizes provider failures and records one terminal failure", async () => {
    fixtures.generate.mockRejectedValue(new Error("PRIVATE PROVIDER DETAILS"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("PRIVATE");
    expect(fixtures.event.mock.calls.map((c) => c[1])).toEqual([
      "concierge_question_submitted",
      "concierge_answer_failed",
    ]);
  });
  it("does not return or count completed generation after a caller abort", async () => {
    const abort = new AbortController();
    fixtures.generate.mockImplementation(async () => {
      abort.abort();
      return { message: "late answer", recommendations: [] };
    });
    expect(
      (await POST(request(undefined, undefined, abort.signal))).status,
    ).toBe(503);
    expect(fixtures.event.mock.calls.map((c) => c[1])).toEqual([
      "concierge_question_submitted",
      "concierge_answer_failed",
    ]);
  });
});
