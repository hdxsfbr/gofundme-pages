export const clientEvents = [
  "page_view",
  "discovery_card_open",
  "discovery_filter_changed",
  "donation_started",
  "share_opened",
  "share_copied",
  "native_share_completed",
  "share_cancelled",
  "share_failed",
  "ai_citation_opened",
  "performance_measured",
  "video_feed_opened",
  "video_clip_impression",
  "video_play_started",
  "video_campaign_opened",
] as const;
export const trustedEvents = [
  "follow_changed",
  "cause_featured",
  "cause_unfeatured",
  "donation_completed",
  "update_opened",
  "ai_question_submitted",
  "ai_answer_completed",
  "ai_answer_abstained",
  "ai_answer_failed",
] as const;
export const propertyKeys = [
  "pageType",
  "targetType",
  "active",
  "attemptId",
  "requestId",
  "sourceId",
  "status",
  "latencyMs",
  "cents",
  "metric",
  "value",
  "source",
  "filterType",
] as const;
export function sanitizeProperties(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!propertyKeys.includes(key as (typeof propertyKeys)[number])) continue;
    if (
      typeof value === "string" &&
      value.length <= 80 &&
      !/[?@\n]/.test(value)
    )
      output[key] = value;
    if (typeof value === "number" && Number.isFinite(value))
      output[key] = value;
    if (typeof value === "boolean") output[key] = value;
  }
  return output;
}
