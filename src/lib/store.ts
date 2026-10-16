import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { PoolClient } from "pg";
import { pool, transaction } from "./db";
import { type Viewer } from "./domain";
import { enqueueEvent, flushOutbox, type EventContext } from "./outbox";
export async function visitor() {
  const token = (await cookies()).get("demo_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new Error("Session unavailable. Reload the page.");
  const hash = createHash("sha256").update(token).digest("hex");
  const row = await pool.query(
    "INSERT INTO visitors(id,token_hash) VALUES($1,$2) ON CONFLICT(token_hash) DO UPDATE SET token_hash=EXCLUDED.token_hash RETURNING id",
    [randomUUID(), hash],
  );
  return row.rows[0].id as string;
}
export async function state(id: string): Promise<Viewer> {
  const [f, d, p, v] = await Promise.all([
    pool.query(
      "SELECT target_type,target_id FROM follows WHERE visitor_id=$1",
      [id],
    ),
    pool.query(
      "SELECT id,campaign_id,cents,created_at FROM donations WHERE visitor_id=$1 ORDER BY created_at DESC",
      [id],
    ),
    pool.query(
      "SELECT campaign_id,reason,updated_at FROM features WHERE visitor_id=$1 ORDER BY updated_at DESC",
      [id],
    ),
    pool.query(
      "SELECT campaign_id,viewed_at FROM update_views WHERE visitor_id=$1",
      [id],
    ),
  ]);
  return JSON.parse(
    JSON.stringify({
      follows: f.rows,
      donations: d.rows,
      features: p.rows,
      views: v.rows,
    }),
  );
}
export async function viewer() {
  return state(await visitor());
}
export async function eventContext(): Promise<EventContext> {
  const h = await headers();
  return {
    isTest:
      process.env.NODE_ENV !== "production" ||
      h.get("x-demo-test") === "true" ||
      (await cookies()).get("demo_test")?.value === "1",
  };
}
export async function record(
  c: PoolClient,
  id: string,
  name: string,
  entity: string | null,
  properties: unknown = {},
  eventId: string = randomUUID(),
  now = new Date(),
  context?: EventContext,
) {
  return enqueueEvent(c, id, name, entity, properties, eventId, {
    ...(context ?? (await eventContext())),
    now,
  });
}
export async function deliverPendingEvents(id: string) {
  try {
    return await flushOutbox(pool, { visitorId: id });
  } catch {
    console.error(
      "Analytics delivery deferred; durable events remain pending.",
    );
    return 0;
  }
}
export async function event(
  id: string,
  name: string,
  entity: string | null,
  props: unknown = {},
  eid: string = randomUUID(),
) {
  const context = await eventContext();
  await transaction((c) =>
    record(c, id, name, entity, props, eid, new Date(), context),
  );
  await deliverPendingEvents(id);
}
