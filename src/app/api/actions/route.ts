import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  visitor,
  state,
  record,
  eventContext,
  deliverPendingEvents,
} from "@/lib/store";
import { transaction } from "@/lib/db";
import { body, failure, RequestError } from "@/lib/http";
import { amountCents } from "@/lib/domain";
import { campaignById, validTarget } from "@/lib/content";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("follow"),
      targetType: z.enum(["community", "fundraiser", "organizer"]),
      targetId: z.string(),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("donate"),
      campaignId: z.string(),
      amount: z.string(),
      key: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("feature"),
      campaignId: z.string(),
      reason: z.string().max(280),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({ action: z.literal("view-updates"), campaignId: z.string() })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await body(req));
    if (!parsed.success)
      throw new RequestError(
        "Please check your input. Notes must be at most 280 characters.",
      );
    const a = parsed.data;
    const id = await visitor();
    if (
      a.action === "follow"
        ? !validTarget(a.targetType, a.targetId)
        : !campaignById(a.campaignId)
    )
      throw new RequestError("That cause could not be found.", 404);
    let cents = 0;
    if (a.action === "donate") {
      try {
        cents = amountCents(a.amount);
      } catch (e) {
        throw new RequestError((e as Error).message);
      }
    }
    const context = await eventContext();
    await transaction(async (c) => {
      const saveEvent = (
        name: string,
        entity: string,
        properties: unknown = {},
        eventId = randomUUID(),
      ) =>
        record(c, id, name, entity, properties, eventId, new Date(), context);
      await c.query("SELECT id FROM visitors WHERE id=$1 FOR UPDATE", [id]);
      if (a.action === "follow") {
        const result = a.active
          ? await c.query(
              "INSERT INTO follows(visitor_id,target_type,target_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING target_id",
              [id, a.targetType, a.targetId],
            )
          : await c.query(
              "DELETE FROM follows WHERE visitor_id=$1 AND target_type=$2 AND target_id=$3 RETURNING target_id",
              [id, a.targetType, a.targetId],
            );
        if (result.rowCount)
          await saveEvent("follow_changed", a.targetId, {
            targetType: a.targetType,
            active: a.active,
          });
      } else if (a.action === "donate") {
        const old = (
          await c.query(
            "SELECT * FROM donations WHERE visitor_id=$1 AND idempotency_key=$2",
            [id, a.key],
          )
        ).rows[0];
        if (old) {
          if (old.campaign_id !== a.campaignId || old.cents !== cents)
            throw new RequestError(
              "This donation attempt already used a different amount. Start a new donation.",
              409,
            );
          return;
        }
        const donationId = randomUUID();
        await c.query(
          "INSERT INTO donations(id,visitor_id,campaign_id,cents,idempotency_key) VALUES($1,$2,$3,$4,$5)",
          [donationId, id, a.campaignId, cents, a.key],
        );
        await saveEvent(
          "donation_completed",
          a.campaignId,
          { cents, attemptId: a.key },
          donationId,
        );
      } else if (a.action === "feature") {
        if (a.active)
          await c.query(
            "INSERT INTO features(visitor_id,campaign_id,reason) VALUES($1,$2,$3) ON CONFLICT(visitor_id,campaign_id) DO UPDATE SET reason=EXCLUDED.reason,updated_at=now()",
            [id, a.campaignId, a.reason],
          );
        else
          await c.query(
            "DELETE FROM features WHERE visitor_id=$1 AND campaign_id=$2",
            [id, a.campaignId],
          );
        await saveEvent(
          a.active ? "cause_featured" : "cause_unfeatured",
          a.campaignId,
        );
      } else {
        await c.query(
          "INSERT INTO update_views(visitor_id,campaign_id) VALUES($1,$2) ON CONFLICT(visitor_id,campaign_id) DO UPDATE SET viewed_at=now()",
          [id, a.campaignId],
        );
        await saveEvent("update_opened", a.campaignId);
      }
    });
    await deliverPendingEvents(id);
    return Response.json({ viewer: await state(id) });
  } catch (e) {
    return failure(e);
  }
}
