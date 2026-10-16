import { describe, expect, it } from "vitest";
import {
  engagementReport,
  reportWindow,
  type ReportEvent,
  type ReportSession,
} from "../src/lib/report";

const time = (day = 15, hour = 12) =>
  `2026-10-${day}T${String(hour).padStart(2, "0")}:00:00Z`;
const sessions: ReportSession[] = [
  { id: "old", visitor_id: "a", started_at: time(14), is_test: false },
  { id: "a", visitor_id: "a", started_at: time(), is_test: false },
  { id: "b", visitor_id: "b", started_at: time(), is_test: false },
  { id: "test", visitor_id: "robot", started_at: time(), is_test: true },
];
function event(
  id: string,
  name: string,
  properties: Record<string, unknown> = {},
  session = "a",
  entity: string | null = "campaign",
  created_at = time(),
): ReportEvent {
  return {
    id,
    name,
    properties,
    session_id: session,
    visitor_id: sessions.find((s) => s.id === session)!.visitor_id,
    entity_id: entity,
    created_at,
  };
}
const window = { from: time(15, 0), to: time(16, 0) };
describe("engagement report: fixed event fixtures, not measured engagement", () => {
  it("uses visitor denominators and requires a community entry, card open and matching arrival", () => {
    const events = [
      event("a-view", "page_view", { pageType: "communities" }),
      event("b-view", "page_view", { pageType: "communities" }, "b"),
      event("open", "discovery_card_open"),
      event("open-again", "discovery_card_open"),
      event("arrival", "page_view", { pageType: "fundraisers" }),
      event("other-arrival", "page_view", { pageType: "fundraisers" }, "b"),
      event("follow", "follow_changed", { active: true }),
      event("follow-again", "follow_changed", { active: true }),
      event("unfollow", "follow_changed", { active: false }),
    ];
    const result = engagementReport([...events, events[0]], sessions, window);
    expect(result.discovery.campaignArrival).toEqual({
      numerator: 1,
      denominator: 2,
      rate: 0.5,
    });
    expect(result.discovery.cardOpenEvents).toBe(2);
    expect(result.follows.visitorFollow).toEqual({
      numerator: 1,
      denominator: 2,
      rate: 0.5,
    });
    expect(result.follows.savedFollowEvents).toBe(2);
    expect(result.follows.savedUnfollowEvents).toBe(1);
    expect(result.counts.events).toBe(events.length);
    expect(
      engagementReport(
        events.filter((e) => e.id !== "arrival"),
        sessions,
        window,
      ).discovery.campaignArrival.numerator,
    ).toBe(0);
  });
  it("deduplicates donation attempt IDs and matches visitor, campaign, ordering and in-window starts", () => {
    const events = [
      event("start", "donation_started", { attemptId: "one" }),
      event("retry-start", "donation_started", { attemptId: "one" }),
      event("done", "donation_completed", { attemptId: "one", cents: 2500 }),
      event("retry-done", "donation_completed", {
        attemptId: "one",
        cents: 2500,
      }),
      event(
        "cross-visitor",
        "donation_completed",
        { attemptId: "one", cents: 100 },
        "b",
      ),
      event(
        "cross-campaign",
        "donation_completed",
        { attemptId: "one", cents: 200 },
        "a",
        "different",
      ),
      event("orphan", "donation_completed", {
        attemptId: "outside",
        cents: 300,
      }),
      event(
        "old-start",
        "donation_started",
        { attemptId: "outside" },
        "old",
        "campaign",
        time(14),
      ),
      event("missing-id", "donation_started"),
    ];
    const result = engagementReport(events, sessions, window);
    expect(result.donations).toMatchObject({
      startedAttempts: 1,
      completedAttempts: 4,
      completedCents: 3100,
      unmatchedCompletedAttempts: 3,
      startsMissingAttemptId: 1,
    });
    expect(result.donations.completion).toEqual({
      numerator: 1,
      denominator: 1,
      rate: 1,
    });
    expect(
      engagementReport(
        [
          event(
            "s",
            "donation_started",
            { attemptId: "early" },
            "a",
            "campaign",
            time(15, 13),
          ),
          event("c", "donation_completed", { attemptId: "early" }),
        ],
        sessions,
        window,
      ).donations.completion.numerator,
    ).toBe(0);
  });
  it("uses half-open windows, excludes tests by default, and recognizes prior-session returns", () => {
    const events = [
      event(
        "boundary-in",
        "page_view",
        { pageType: "communities" },
        "a",
        null,
        window.from,
      ),
      event(
        "boundary-out",
        "page_view",
        { pageType: "communities" },
        "b",
        null,
        window.to,
      ),
      event("test-view", "page_view", { pageType: "communities" }, "test"),
      event(
        "reload",
        "page_view",
        { pageType: "communities" },
        "a",
        null,
        time(15, 13),
      ),
    ];
    const result = engagementReport(events, sessions, window);
    expect(result.counts).toEqual({
      events: 2,
      pageViews: 2,
      pageVisitors: 1,
      activeSessions: 1,
    });
    expect(result.returns).toEqual({
      sessionsStarted: 2,
      returningVisitors: 1,
      returningSession: { numerator: 1, denominator: 2, rate: 0.5 },
    });
    expect(
      engagementReport(events, sessions, { ...window, includeTest: true })
        .counts.pageVisitors,
    ).toBe(2);
    expect(result.window).toMatchObject({
      from: "2026-10-15T00:00:00.000Z",
      to: "2026-10-16T00:00:00.000Z",
    });
    expect(
      engagementReport(
        [],
        [{ ...sessions[0], is_test: true }, sessions[1]],
        window,
      ).returns.returningSession.numerator,
    ).toBe(0);
  });
  it("separates no exposure from observed zero and emits only aggregates", () => {
    const empty = engagementReport([], [], window);
    expect(empty.discovery.campaignArrival).toEqual({
      numerator: 0,
      denominator: 0,
      rate: null,
    });
    expect(empty.donations.completion.rate).toBeNull();
    expect(empty.ai.meanLatencyMs).toBeNull();
    const seen = engagementReport(
      [
        event("view", "page_view", {
          pageType: "communities",
          question: "PRIVATE TEXT",
        }),
      ],
      sessions,
      window,
    );
    expect(seen.discovery.campaignArrival).toEqual({
      numerator: 0,
      denominator: 1,
      rate: 0,
    });
    expect(JSON.stringify(seen)).not.toContain("PRIVATE TEXT");
    expect(JSON.stringify(seen)).not.toContain("visitor_id");
  });
  it("keeps share outcomes distinct and counts supported, missing, failed and cited AI requests", () => {
    const events = [
      "share_opened",
      "share_copied",
      "native_share_completed",
      "share_cancelled",
      "share_failed",
    ].map((name, i) => event("share" + i, name));
    events.push(
      event("q1", "ai_question_submitted", { requestId: "r1" }),
      event("q2", "ai_question_submitted", { requestId: "r2" }),
      event("q3", "ai_question_submitted", { requestId: "r3" }),
      event("q4", "ai_question_submitted", { requestId: "pending" }),
      event("supported", "ai_answer_completed", {
        requestId: "r1",
        latencyMs: 100,
      }),
      event("duplicate-supported", "ai_answer_completed", {
        requestId: "r1",
        latencyMs: 100,
      }),
      event("missing", "ai_answer_abstained", {
        requestId: "r2",
        latencyMs: 200,
      }),
      event("failed", "ai_answer_failed", { requestId: "r3", latencyMs: 300 }),
      event("rejected", "ai_answer_failed", {
        requestId: "not-submitted",
        latencyMs: 0,
      }),
      event("cite", "ai_citation_opened", {
        requestId: "r1",
        sourceId: "story",
      }),
      event("cite-repeat", "ai_citation_opened", {
        requestId: "r1",
        sourceId: "story",
      }),
      event("old-cite", "ai_citation_opened", { sourceId: "story" }),
    );
    const result = engagementReport(events, sessions, window);
    for (const share of Object.values(result.sharing))
      expect(share).toEqual({ events: 1, visitors: 1 });
    expect(result.ai).toMatchObject({
      submittedRequests: 4,
      supported: 1,
      abstained: 1,
      failed: 2,
      pendingSubmittedRequests: 1,
      outcomesWithoutInWindowSubmission: 1,
      citationOpens: 3,
      citationVisitors: 1,
      latencySamples: 4,
      meanLatencyMs: 150,
      citationOpensWithoutMatchedAnswer: 1,
    });
    expect(result.ai.observedOutcome).toEqual({
      numerator: 3,
      denominator: 4,
      rate: 0.75,
    });
    expect(result.ai.answeredRequestCitationUse).toEqual({
      numerator: 1,
      denominator: 2,
      rate: 0.5,
    });
  });
  it("rejects ambiguous or inverted time windows", () => {
    expect(() => reportWindow({ from: "2026-10-15" })).toThrow("ISO");
    expect(() => reportWindow({ from: "2026-10-15T12:00:00" })).toThrow("ISO");
    expect(() => reportWindow({ from: window.to, to: window.from })).toThrow(
      "precede",
    );
    expect(reportWindow({ from: "2026-10-15T05:00:00-07:00" }).from).toBe(
      Date.parse(time()),
    );
  });
});
