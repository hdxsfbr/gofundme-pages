import { z } from "zod";
import { clientEvents } from "@/lib/events";
import { body, failure, RequestError } from "@/lib/http";
import { event, visitor } from "@/lib/store";
import { community } from "@/lib/content";
import { clipById } from "@/lib/video-content";
const schema = z
  .object({
    id: z.uuid(),
    name: z.enum(clientEvents),
    entityId: z.string().max(80).nullable(),
    properties: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
const clipEvents = new Set([
  "video_clip_impression",
  "video_play_started",
  "video_campaign_opened",
]);
const supportEvents = new Set([
  "donation_started",
  "share_opened",
  "share_copied",
  "native_share_completed",
  "share_cancelled",
  "share_failed",
]);
export function validClientEventAssociation(a: {
  name: string;
  entityId: string | null;
  properties?: Record<string, unknown>;
}) {
  const p = a.properties ?? {};
  if (a.name === "video_feed_opened")
    return (
      a.entityId === community.id &&
      p.sourceId === undefined &&
      (p.source === undefined || p.source === "watch")
    );
  const clipEvent = clipEvents.has(a.name);
  const attributedSupport =
    supportEvents.has(a.name) &&
    (p.source !== undefined || p.sourceId !== undefined);
  if (!clipEvent && !attributedSupport) return true;
  if (p.source !== "watch" || typeof p.sourceId !== "string") return false;
  const clip = clipById(p.sourceId);
  return Boolean(clip && clip.campaignId === a.entityId);
}
export async function POST(req: Request) {
  try {
    const p = schema.safeParse(await body(req));
    if (!p.success) throw new RequestError("Invalid event.");
    const a = p.data;
    if (!validClientEventAssociation(a))
      throw new RequestError("Invalid video source for this cause.");
    await event(await visitor(), a.name, a.entityId, a.properties, a.id);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
