import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  engagementReport,
  type ReportEvent,
  type ReportSession,
} from "../src/lib/report";
import { validClientEventAssociation } from "../src/app/api/events/route";
import { sanitizeProperties } from "../src/lib/events";
import { community, campaigns } from "../src/lib/content";
const time = "2026-10-18T12:00:00Z";
const requestId = "fc89a9c9-3c73-4f9f-9837-ddf857303346";
const sessions: ReportSession[] = [
  { id: "s", visitor_id: "v", started_at: time, is_test: false },
  { id: "other", visitor_id: "other", started_at: time, is_test: false },
  { id: "test", visitor_id: "test", started_at: time, is_test: true },
];
function event(id: string, name: string, session = "s"): ReportEvent {
  return {
    id,
    name,
    session_id: session,
    visitor_id: sessions.find((s) => s.id === session)!.visitor_id,
    entity_id:
      name === "concierge_campaign_opened" ? campaigns[0].id : community.id,
    properties: { requestId },
    created_at: time,
  };
}
describe("concierge measurement", () => {
  it("deduplicates events and request IDs, separates AI, and excludes test traffic", () => {
    const started = event("start", "concierge_question_submitted");
    const data = [
      event("open", "concierge_opened"),
      started,
      started,
      event("duplicate-request", "concierge_question_submitted"),
      event("done", "concierge_answer_completed"),
      event("click", "concierge_campaign_opened"),
      event("repeat-click", "concierge_campaign_opened"),
      event("test-start", "concierge_question_submitted", "test"),
    ];
    const r = engagementReport(data, sessions);
    expect(r.concierge).toMatchObject({
      dialogOpens: 1,
      submittedRequests: 1,
      completedRequests: 1,
      campaignOpenEvents: 2,
      pendingSubmittedRequests: 0,
      answeredRequestCampaignOpen: { numerator: 1, denominator: 1, rate: 1 },
    });
    expect(r.ai.submittedRequests).toBe(0);
  });
  it("keeps absent denominators null and does not join another visitor's click", () => {
    const empty = engagementReport([], sessions).concierge;
    expect(empty.answeredRequestCampaignOpen.rate).toBeNull();
    const r = engagementReport(
      [
        event("s", "concierge_question_submitted"),
        event("d", "concierge_answer_completed"),
        event("x", "concierge_campaign_opened", "other"),
      ],
      sessions,
    ).concierge;
    expect(r.answeredRequestCampaignOpen.numerator).toBe(0);
    expect(r.campaignOpensWithoutMatchedAnswer).toBe(1);
  });
  it("checks public associations and drops conversational analytics fields", () => {
    expect(
      validClientEventAssociation({
        name: "concierge_opened",
        entityId: community.id,
      }),
    ).toBe(true);
    expect(
      validClientEventAssociation({
        name: "concierge_opened",
        entityId: "invented",
      }),
    ).toBe(false);
    expect(
      validClientEventAssociation({
        name: "concierge_campaign_opened",
        entityId: campaigns[0].id,
        properties: { requestId, targetType: "campaign" },
      }),
    ).toBe(true);
    expect(
      validClientEventAssociation({
        name: "concierge_campaign_opened",
        entityId: "invented",
        properties: { requestId, targetType: "campaign" },
      }),
    ).toBe(false);
    expect(
      sanitizeProperties({
        requestId,
        question: "private interests",
        answer: "private answer",
        reason: "private reason",
        history: [],
      }),
    ).toEqual({ requestId });
  });
});
