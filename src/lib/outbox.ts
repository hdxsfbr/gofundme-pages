import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { sanitizeProperties } from "./events";
import { needsNewSession } from "./domain";

export interface EventContext {
  isTest: boolean;
  now?: Date;
}
/** Caller owns the domain transaction; no analytics projection is read or written here. */
export async function enqueueEvent(
  c: PoolClient,
  visitorId: string,
  name: string,
  entity: string | null,
  properties: unknown = {},
  eventId: string = randomUUID(),
  context: EventContext,
) {
  await c.query("SELECT id FROM visitors WHERE id=$1 FOR UPDATE", [visitorId]);
  if (
    (await c.query("SELECT id FROM domain_event_outbox WHERE id=$1", [eventId]))
      .rowCount
  )
    return;
  const now = context.now ?? new Date();
  const old = (
    await c.query("SELECT * FROM event_session_state WHERE visitor_id=$1", [
      visitorId,
    ])
  ).rows[0];
  const fresh = !old || needsNewSession(old.last_activity_at, now);
  const sessionId = fresh ? randomUUID() : old.session_id;
  const startedAt = fresh ? now : old.started_at;
  const isTest = fresh ? context.isTest : old.is_test;
  await c.query(
    `INSERT INTO event_session_state(visitor_id,session_id,started_at,last_activity_at,is_test)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(visitor_id) DO UPDATE SET session_id=EXCLUDED.session_id,
    started_at=EXCLUDED.started_at,last_activity_at=GREATEST(event_session_state.last_activity_at,EXCLUDED.last_activity_at),is_test=EXCLUDED.is_test`,
    [visitorId, sessionId, startedAt, now, isTest],
  );
  await c.query(
    `INSERT INTO domain_event_outbox(id,visitor_id,session_id,session_started_at,is_test,name,entity_id,properties,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
    [
      eventId,
      visitorId,
      sessionId,
      startedAt,
      isTest,
      name,
      entity,
      JSON.stringify(sanitizeProperties(properties)),
      now,
    ],
  );
}

/** Atomic projection: failed delivery retains the pending row; retries reuse its identity and time. */
export async function flushOutbox(
  pool: Pool,
  options: { visitorId?: string; limit?: number } = {},
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const pending = await c.query(
      `SELECT * FROM domain_event_outbox WHERE delivered_at IS NULL
      AND ($1::uuid IS NULL OR visitor_id=$1) ORDER BY created_at,id LIMIT $2 FOR UPDATE SKIP LOCKED`,
      [options.visitorId ?? null, options.limit ?? 500],
    );
    for (const row of pending.rows) {
      await c.query(
        `INSERT INTO analytics_sessions(id,visitor_id,started_at,last_activity_at,is_test)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET
        started_at=LEAST(analytics_sessions.started_at,EXCLUDED.started_at),
        last_activity_at=GREATEST(analytics_sessions.last_activity_at,EXCLUDED.last_activity_at)`,
        [
          row.session_id,
          row.visitor_id,
          row.session_started_at,
          row.created_at,
          row.is_test,
        ],
      );
      await c.query(
        `INSERT INTO events(id,visitor_id,session_id,name,entity_id,properties,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
        [
          row.id,
          row.visitor_id,
          row.session_id,
          row.name,
          row.entity_id,
          row.properties,
          row.created_at,
        ],
      );
      await c.query(
        "UPDATE domain_event_outbox SET delivered_at=now() WHERE id=$1",
        [row.id],
      );
    }
    await c.query("COMMIT");
    return pending.rowCount ?? 0;
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
