/** Aggregate-only analytics. Inputs may contain historical sessions for return detection. */
import { campaignClips, clipById } from "./video-content";
export interface ReportSession {
  id: string;
  visitor_id: string;
  started_at: string | Date;
  is_test: boolean;
}
export interface ReportEvent {
  id: string;
  visitor_id: string;
  session_id: string;
  name: string;
  entity_id: string | null;
  properties: Record<string, unknown>;
  created_at: string | Date;
}
export interface ReportOptions {
  from?: string;
  to?: string;
  includeTest?: boolean;
}
function instant(value: string | Date): number {
  const n = new Date(value).getTime();
  if (!Number.isFinite(n)) throw new Error("Invalid analytics timestamp.");
  return n;
}
function bound(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(
      value,
    )
  ) {
    throw new Error(
      "Time bounds must be ISO timestamps with an explicit timezone.",
    );
  }
  return instant(value);
}
export function reportWindow(options: ReportOptions = {}) {
  const from = bound(options.from),
    to = bound(options.to);
  if (from !== undefined && to !== undefined && from >= to)
    throw new Error("The start must precede the end.");
  return { from, to };
}
const rate = (numerator: number, denominator: number) => ({
  numerator,
  denominator,
  rate: denominator ? numerator / denominator : null,
});
const visitors = (events: ReportEvent[]) =>
  new Set(events.map((e) => e.visitor_id));
const identifier = (e: ReportEvent, property: string) => {
  const value = e.properties[property];
  return typeof value === "string" && value.length ? value : undefined;
};
const key = (e: ReportEvent, property: string) => {
  const value = identifier(e, property);
  return value ? JSON.stringify([e.visitor_id, e.entity_id, value]) : undefined;
};
const videoShareNames = [
  "share_opened",
  "share_copied",
  "native_share_completed",
  "share_cancelled",
  "share_failed",
] as const;

function conciergeReport(events: ReportEvent[]) {
  const named = (name: string) => events.filter((e) => e.name === name);
  const requestKey = (e: ReportEvent) =>
    identifier(e, "requestId")
      ? JSON.stringify([e.visitor_id, e.session_id, e.properties.requestId])
      : undefined;
  const requests = new Map<string, ReportEvent>();
  const outcomes = new Map<string, ReportEvent>();
  for (const e of named("concierge_question_submitted")) {
    const id = requestKey(e);
    if (id && !requests.has(id)) requests.set(id, e);
  }
  for (const e of events.filter((e) =>
    ["concierge_answer_completed", "concierge_answer_failed"].includes(e.name),
  )) {
    const id = requestKey(e);
    if (id && !outcomes.has(id)) outcomes.set(id, e);
  }
  const matched = [...outcomes].filter(
    ([id, e]) =>
      requests.has(id) &&
      instant(e.created_at) >= instant(requests.get(id)!.created_at),
  );
  const completed = matched.filter(
    ([, e]) => e.name === "concierge_answer_completed",
  );
  const opens = named("concierge_campaign_opened");
  const matches = (id: string, e: ReportEvent, open: ReportEvent) =>
    requestKey(open) === id &&
    instant(open.created_at) >= instant(e.created_at);
  return {
    dialogOpens: named("concierge_opened").length,
    dialogVisitors: visitors(named("concierge_opened")).size,
    submittedRequests: requests.size,
    completedRequests: completed.length,
    failedRequests: matched.length - completed.length,
    pendingSubmittedRequests: requests.size - matched.length,
    outcomesWithoutSubmission: outcomes.size - matched.length,
    campaignOpenEvents: opens.length,
    answeredRequestCampaignOpen: rate(
      completed.filter(([id, e]) => opens.some((open) => matches(id, e, open)))
        .length,
      completed.length,
    ),
    campaignOpensWithoutMatchedAnswer: opens.filter(
      (open) => !completed.some(([id, e]) => matches(id, e, open)),
    ).length,
  };
}

function videoReport(events: ReportEvent[]) {
  const videoEventNames = new Set([
    "video_clip_impression",
    "video_play_started",
    "video_campaign_opened",
    "follow_changed",
    "donation_started",
    "donation_completed",
    ...videoShareNames,
  ]);
  const byClip = campaignClips.map((clip) => {
    const sourceEvents = events.filter(
      (e) =>
        videoEventNames.has(e.name) &&
        e.properties.source === "watch" &&
        e.properties.sourceId === clip.id &&
        e.entity_id === clip.campaignId &&
        clipById(clip.id)?.campaignId === clip.campaignId,
    );
    const named = (name: string) => sourceEvents.filter((e) => e.name === name);
    const combination = (e: ReportEvent) =>
      JSON.stringify([e.visitor_id, e.session_id, clip.id]);
    const exposures = new Map<string, ReportEvent>();
    for (const e of named("video_clip_impression")) {
      const id = combination(e);
      if (!exposures.has(id)) exposures.set(id, e);
    }
    const plays = new Set(named("video_play_started").map(combination));
    const exposedPlays = [...plays].filter((id) => exposures.has(id)).length;
    const opens = named("video_campaign_opened");
    const arrived = new Set<string>();
    for (const open of opens) {
      const id = combination(open);
      const exposure = exposures.get(id);
      if (
        exposure &&
        instant(exposure.created_at) <= instant(open.created_at) &&
        events.some(
          (view) =>
            view.name === "page_view" &&
            view.visitor_id === open.visitor_id &&
            view.session_id === open.session_id &&
            view.entity_id === clip.campaignId &&
            ["fundraisers", "fundraiser"].includes(
              String(view.properties.pageType),
            ) &&
            instant(view.created_at) >= instant(open.created_at),
        )
      )
        arrived.add(id);
    }
    const follows = named("follow_changed").filter(
      (e) =>
        e.properties.targetType === "fundraiser" &&
        e.properties.active === true,
    );
    const unfollows = named("follow_changed").filter(
      (e) =>
        e.properties.targetType === "fundraiser" &&
        e.properties.active === false,
    );
    const exposedFollows = new Set(
      follows.map(combination).filter((id) => exposures.has(id)),
    );
    const sharing = Object.fromEntries(
      videoShareNames.map((name) => [name, named(name).length]),
    ) as Record<(typeof videoShareNames)[number], number>;
    const shared = new Set(
      [...named("share_copied"), ...named("native_share_completed")]
        .map(combination)
        .filter((id) => exposures.has(id)),
    );
    const attemptKey = (e: ReportEvent) => {
      const attemptId = identifier(e, "attemptId");
      return attemptId
        ? JSON.stringify([e.visitor_id, clip.campaignId, clip.id, attemptId])
        : undefined;
    };
    const starts = new Map<string, ReportEvent>();
    for (const e of named("donation_started")) {
      const id = attemptKey(e);
      if (id && !starts.has(id)) starts.set(id, e);
    }
    const completions = new Map<string, ReportEvent>();
    for (const e of named("donation_completed")) {
      const id = attemptKey(e);
      if (id && !completions.has(id)) completions.set(id, e);
    }
    const matched = [...completions].filter(
      ([id, completed]) =>
        starts.has(id) &&
        instant(completed.created_at) >= instant(starts.get(id)!.created_at),
    );
    const completedCents = [...completions.values()].reduce((sum, e) => {
      const cents = e.properties.cents;
      return (
        sum +
        (typeof cents === "number" && Number.isSafeInteger(cents) && cents > 0
          ? cents
          : 0)
      );
    }, 0);
    return {
      clipId: clip.id,
      campaignId: clip.campaignId,
      qualifiedExposures: exposures.size,
      playStarts: plays.size,
      playsAfterExposure: exposedPlays,
      playRate: rate(exposedPlays, exposures.size),
      campaignOpenEvents: opens.length,
      confirmedArrivals: arrived.size,
      campaignArrivalRate: rate(arrived.size, exposures.size),
      savedFollowEvents: follows.length,
      savedUnfollowEvents: unfollows.length,
      exposedFollows: exposedFollows.size,
      followRate: rate(exposedFollows.size, exposures.size),
      sharing,
      exposedSuccessfulShares: shared.size,
      successfulShareRate: rate(shared.size, exposures.size),
      donations: {
        startedAttempts: starts.size,
        completedAttempts: completions.size,
        matchedCompletedAttempts: matched.length,
        unmatchedCompletedAttempts: completions.size - matched.length,
        completionsWithoutExposure: [...completions.values()].filter(
          (e) => !exposures.has(combination(e)),
        ).length,
        completedCents,
        completionRate: rate(matched.length, starts.size),
      },
    };
  });
  return {
    attribution: "observed Watch source association; not causal impact",
    qualification:
      "Client impression after one continuously visible active second; reported unique visitor/session/clip combinations",
    byClip,
  };
}

export function engagementReport(
  inputEvents: ReportEvent[],
  inputSessions: ReportSession[],
  options: ReportOptions = {},
) {
  const { from, to } = reportWindow(options);
  const inWindow = (time: number) =>
    (from === undefined || time >= from) && (to === undefined || time < to);
  const sessions = [
    ...new Map(inputSessions.map((s) => [s.id, s])).values(),
  ].filter((s) => options.includeTest || !s.is_test);
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const events = [...new Map(inputEvents.map((e) => [e.id, e])).values()]
    .filter(
      (e) =>
        sessionMap.get(e.session_id)?.visitor_id === e.visitor_id &&
        inWindow(instant(e.created_at)),
    )
    .sort(
      (a, b) =>
        instant(a.created_at) - instant(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  const named = (name: string) => events.filter((e) => e.name === name);
  const pageViews = named("page_view");
  const pageVisitors = visitors(pageViews);
  const communityViews = pageViews.filter((e) =>
    ["communities", "community"].includes(String(e.properties.pageType)),
  );
  const communityVisitors = visitors(communityViews);
  const opens = named("discovery_card_open");
  const arrived = new Set<string>();
  for (const e of opens) {
    if (!e.entity_id || !communityVisitors.has(e.visitor_id)) continue;
    const entered = communityViews.some(
      (v) =>
        v.session_id === e.session_id &&
        instant(v.created_at) <= instant(e.created_at),
    );
    if (
      entered &&
      pageViews.some(
        (v) =>
          v.session_id === e.session_id &&
          v.entity_id === e.entity_id &&
          ["fundraisers", "fundraiser"].includes(
            String(v.properties.pageType),
          ) &&
          instant(v.created_at) >= instant(e.created_at),
      )
    )
      arrived.add(e.visitor_id);
  }
  const follows = named("follow_changed").filter(
    (e) => e.properties.active === true,
  );
  const followed = new Set(
    follows
      .filter((e) => pageVisitors.has(e.visitor_id))
      .map((e) => e.visitor_id),
  );
  const starts = new Map<string, ReportEvent>();
  for (const e of named("donation_started")) {
    const id = key(e, "attemptId");
    if (id && !starts.has(id)) starts.set(id, e);
  }
  const completions = new Map<string, ReportEvent>();
  for (const e of named("donation_completed")) {
    const id = key(e, "attemptId");
    if (id && !completions.has(id)) completions.set(id, e);
  }
  const matched = [...completions].filter(
    ([id, e]) =>
      starts.has(id) &&
      instant(e.created_at) >= instant(starts.get(id)!.created_at),
  );
  const completedCents = [...completions.values()].reduce(
    (sum, e) =>
      sum +
      (typeof e.properties.cents === "number" &&
      Number.isSafeInteger(e.properties.cents) &&
      e.properties.cents > 0
        ? e.properties.cents
        : 0),
    0,
  );
  const begun = sessions.filter((s) => inWindow(instant(s.started_at)));
  const returning = begun.filter((s) =>
    sessions.some(
      (previous) =>
        previous.visitor_id === s.visitor_id &&
        instant(previous.started_at) < instant(s.started_at),
    ),
  );
  const submitted = new Map<string, ReportEvent>();
  for (const e of named("ai_question_submitted")) {
    const id = key(e, "requestId");
    if (id && !submitted.has(id)) submitted.set(id, e);
  }
  const terminalNames = [
    "ai_answer_completed",
    "ai_answer_abstained",
    "ai_answer_failed",
  ];
  const outcomes = new Map<string, ReportEvent>();
  for (const e of events.filter((e) => terminalNames.includes(e.name))) {
    const id = key(e, "requestId");
    if (id && !outcomes.has(id)) outcomes.set(id, e);
  }
  const aiMatched = [...outcomes].filter(
    ([id, e]) =>
      submitted.has(id) &&
      instant(e.created_at) >= instant(submitted.get(id)!.created_at),
  );
  const outcomeCount = (name: string) =>
    [...outcomes.values()].filter((e) => e.name === name).length;
  const aiVisitors = visitors([...submitted.values(), ...outcomes.values()]);
  const citations = named("ai_citation_opened");
  const citationVisitors = new Set(
    citations
      .filter((e) => aiVisitors.has(e.visitor_id))
      .map((e) => e.visitor_id),
  );
  const answers = [...outcomes].filter(
    ([, e]) => e.name !== "ai_answer_failed",
  );
  const citedAnswers = answers.filter(([id, e]) =>
    citations.some(
      (c) =>
        key(c, "requestId") === id &&
        instant(c.created_at) >= instant(e.created_at),
    ),
  );
  const latencies = [...outcomes.values()]
    .map((e) => e.properties.latencyMs)
    .filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0,
    );
  const shareNames = [
    "share_opened",
    "share_copied",
    "native_share_completed",
    "share_cancelled",
    "share_failed",
  ];
  const sharing = Object.fromEntries(
    shareNames.map((name) => [
      name,
      { events: named(name).length, visitors: visitors(named(name)).size },
    ]),
  );
  return {
    version: 1,
    window: {
      from: from === undefined ? null : new Date(from).toISOString(),
      to: to === undefined ? null : new Date(to).toISOString(),
      bounds: "[from, to)",
    },
    population: options.includeTest
      ? "all recorded sessions including tests"
      : "non-test recorded sessions; not verified human traffic",
    simulatedDonations: true,
    counts: {
      events: events.length,
      pageViews: pageViews.length,
      pageVisitors: pageVisitors.size,
      activeSessions: new Set(events.map((e) => e.session_id)).size,
    },
    discovery: {
      communityVisitors: communityVisitors.size,
      cardOpenEvents: opens.length,
      campaignArrival: rate(arrived.size, communityVisitors.size),
    },
    follows: {
      savedFollowEvents: follows.length,
      savedUnfollowEvents: named("follow_changed").filter(
        (e) => e.properties.active === false,
      ).length,
      visitorFollow: rate(followed.size, pageVisitors.size),
    },
    donations: {
      startedAttempts: starts.size,
      completedAttempts: completions.size,
      completedCents,
      completion: rate(matched.length, starts.size),
      unmatchedCompletedAttempts: completions.size - matched.length,
      startsMissingAttemptId: named("donation_started").filter(
        (e) => !identifier(e, "attemptId"),
      ).length,
      completionsMissingAttemptId: named("donation_completed").filter(
        (e) => !identifier(e, "attemptId"),
      ).length,
    },
    sharing,
    video: videoReport(events),
    concierge: conciergeReport(events),
    returns: {
      sessionsStarted: begun.length,
      returningVisitors: new Set(returning.map((s) => s.visitor_id)).size,
      returningSession: rate(returning.length, begun.length),
    },
    ai: {
      submittedRequests: submitted.size,
      supported: outcomeCount("ai_answer_completed"),
      abstained: outcomeCount("ai_answer_abstained"),
      failed: outcomeCount("ai_answer_failed"),
      observedOutcome: rate(aiMatched.length, submitted.size),
      pendingSubmittedRequests: submitted.size - aiMatched.length,
      outcomesWithoutInWindowSubmission: outcomes.size - aiMatched.length,
      citationOpens: citations.length,
      citationVisitors: visitors(citations).size,
      visitorCitationUse: rate(citationVisitors.size, aiVisitors.size),
      answeredRequestCitationUse: rate(citedAnswers.length, answers.length),
      citationOpensWithoutMatchedAnswer: citations.filter(
        (c) =>
          !answers.some(
            ([id, e]) =>
              key(c, "requestId") === id &&
              instant(c.created_at) >= instant(e.created_at),
          ),
      ).length,
      latencySamples: latencies.length,
      meanLatencyMs: latencies.length
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null,
      eventsMissingRequestId: events.filter(
        (e) =>
          (e.name === "ai_question_submitted" ||
            terminalNames.includes(e.name)) &&
          !identifier(e, "requestId"),
      ).length,
    },
  };
}
