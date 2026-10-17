import { describe, expect, it } from "vitest";
import { campaignClips } from "../src/lib/video-content";
import {
  engagementReport,
  type ReportEvent,
  type ReportSession,
} from "../src/lib/report";

const clip = campaignClips[0];
const other = campaignClips.find(
  (item) => item.campaignId !== clip.campaignId,
)!;
const window = { from: "2026-10-16T00:00:00Z", to: "2026-10-17T00:00:00Z" };
const sessions: ReportSession[] = [
  {
    id: "s1",
    visitor_id: "v1",
    started_at: "2026-10-16T12:00:00Z",
    is_test: false,
  },
  {
    id: "s2",
    visitor_id: "v2",
    started_at: "2026-10-16T12:00:00Z",
    is_test: false,
  },
  {
    id: "test",
    visitor_id: "robot",
    started_at: "2026-10-16T12:00:00Z",
    is_test: true,
  },
];
let sequence = 0;
function e(
  name: string,
  second: number,
  options: {
    session?: string;
    campaign?: string | null;
    sourceId?: string;
    properties?: Record<string, unknown>;
  } = {},
): ReportEvent {
  const session = options.session ?? "s1";
  return {
    id: `event-${++sequence}`,
    visitor_id: sessions.find((item) => item.id === session)!.visitor_id,
    session_id: session,
    name,
    entity_id:
      options.campaign === undefined ? clip.campaignId : options.campaign,
    properties: {
      source: "watch",
      sourceId: options.sourceId ?? clip.id,
      ...options.properties,
    },
    created_at: `2026-10-16T12:00:${String(second).padStart(2, "0")}Z`,
  };
}
const row = (events: ReportEvent[], includeTest = false) =>
  engagementReport(events, sessions, {
    ...window,
    includeTest,
  }).video.byClip.find((item) => item.clipId === clip.id)!;

describe("Watch aggregate attribution", () => {
  it("deduplicates replay and delivery, joins actual arrivals, and separates share outcomes", () => {
    const impression = e("video_clip_impression", 1);
    const events = [
      impression,
      impression,
      e("video_clip_impression", 2),
      e("video_play_started", 3),
      e("video_play_started", 4),
      e("video_campaign_opened", 5),
      e("page_view", 6, { properties: { pageType: "fundraisers" } }),
      e("share_opened", 7),
      e("share_cancelled", 8),
      e("share_copied", 9),
      e("native_share_completed", 10),
      e("follow_changed", 11, {
        properties: { targetType: "fundraiser", active: true },
      }),
      e("follow_changed", 12, {
        properties: { targetType: "fundraiser", active: false },
      }),
      e("video_clip_impression", 1, { session: "test" }),
    ];
    const result = row(events);
    expect(result.qualifiedExposures).toBe(1);
    expect(result.playStarts).toBe(1);
    expect(result.playRate).toEqual({ numerator: 1, denominator: 1, rate: 1 });
    expect(result.campaignArrivalRate).toEqual({
      numerator: 1,
      denominator: 1,
      rate: 1,
    });
    expect(result.savedFollowEvents).toBe(1);
    expect(result.savedUnfollowEvents).toBe(1);
    expect(result.sharing).toMatchObject({
      share_cancelled: 1,
      share_copied: 1,
      native_share_completed: 1,
    });
    expect(result.successfulShareRate).toEqual({
      numerator: 1,
      denominator: 1,
      rate: 1,
    });
    expect(row(events, true).qualifiedExposures).toBe(2);
  });
  it("requires the matching campaign arrival and ignores invalid source associations", () => {
    const events = [
      e("video_clip_impression", 1),
      e("video_campaign_opened", 2),
      e("page_view", 3, {
        campaign: other.campaignId,
        properties: { pageType: "fundraisers" },
      }),
      e("video_clip_impression", 4, { campaign: other.campaignId }),
      e("share_copied", 5, { sourceId: other.id }),
    ];
    expect(row(events)).toMatchObject({
      qualifiedExposures: 1,
      campaignOpenEvents: 1,
      confirmedArrivals: 0,
      exposedSuccessfulShares: 0,
    });
    expect(row(events).campaignArrivalRate.rate).toBe(0);
  });
  it("keeps trusted completion visible when client start or exposure is missing", () => {
    const events = [
      e("donation_completed", 4, {
        properties: { attemptId: "lost", cents: 2500 },
      }),
      e("donation_started", 5, { properties: { attemptId: "matched" } }),
      e("donation_completed", 6, {
        properties: { attemptId: "matched", cents: 1000 },
      }),
      e("donation_completed", 7, {
        properties: { attemptId: "matched", cents: 1000 },
      }),
    ];
    const result = row(events);
    expect(result.donations).toMatchObject({
      startedAttempts: 1,
      completedAttempts: 2,
      matchedCompletedAttempts: 1,
      unmatchedCompletedAttempts: 1,
      completionsWithoutExposure: 2,
      completedCents: 3500,
      completionRate: { numerator: 1, denominator: 1, rate: 1 },
    });
    expect(result.qualifiedExposures).toBe(0);
    expect(result.followRate.rate).toBeNull();
  });
  it("shows zero denominators as null and does not count a later unattributed donation", () => {
    const unrelated = e("donation_completed", 10, {
      properties: {
        source: undefined,
        sourceId: undefined,
        attemptId: "ordinary",
        cents: 1000,
      },
    });
    expect(row([unrelated])).toMatchObject({
      qualifiedExposures: 0,
      playRate: { numerator: 0, denominator: 0, rate: null },
      donations: {
        completedAttempts: 0,
        completionRate: { numerator: 0, denominator: 0, rate: null },
      },
    });
  });
});
