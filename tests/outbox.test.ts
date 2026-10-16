import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Next's request context is replaced; route, persistence, SQL, and projection are real.
const context = vi.hoisted(() => ({
  database: undefined as pg.Pool | undefined,
  token: "a".repeat(64),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-demo-test": "true" }),
  cookies: async () => ({
    get: (name: string) =>
      name === "demo_session" ? { value: context.token } : undefined,
  }),
}));
vi.mock("@/lib/db", () => ({
  pool: new Proxy(
    {},
    {
      get: (_target, property) => {
        const pool = context.database!;
        const value = pool[property as keyof pg.Pool];
        return typeof value === "function" ? value.bind(pool) : value;
      },
    },
  ),
  transaction: async (fn: (client: pg.PoolClient) => Promise<unknown>) => {
    const client = await context.database!.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
}));

import { POST } from "../src/app/api/actions/route";
import { enqueueEvent, flushOutbox } from "../src/lib/outbox";
import { campaigns } from "../src/lib/content";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI may provide DATABASE_URL directly. */
}
const connectionString = process.env.DATABASE_URL;
describe.skipIf(!connectionString)(
  "durable event outbox (isolated PostgreSQL schema)",
  () => {
    let admin: pg.Pool;
    let database: pg.Pool;
    const schema = "outbox_test_" + randomUUID().replaceAll("-", "");
    const key = randomUUID();
    const campaignId = campaigns[0].id;
    async function action(value: object) {
      const origin = process.env.APP_ORIGIN || "http://localhost:3000";
      return POST(
        new Request(origin + "/api/actions", {
          method: "POST",
          headers: { origin, "Content-Type": "application/json" },
          body: JSON.stringify(value),
        }),
      );
    }
    async function counts() {
      return (
        await database.query(`SELECT
      (SELECT count(*)::int FROM donations) AS donations,
      (SELECT count(*)::int FROM follows) AS follows,
      (SELECT count(*)::int FROM domain_event_outbox) AS outbox,
      (SELECT count(*)::int FROM domain_event_outbox WHERE delivered_at IS NULL) AS pending,
      (SELECT count(*)::int FROM events) AS events`)
      ).rows[0];
    }
    beforeAll(async () => {
      admin = new pg.Pool({ connectionString });
      await admin.query(`CREATE SCHEMA "${schema}"`);
      database = new pg.Pool({
        connectionString,
        options: `-c search_path=${schema}`,
      });
      context.database = database;
      for (const name of ["001_initial.sql", "002_event_outbox.sql"])
        await database.query(
          await readFile(new URL("../db/" + name, import.meta.url), "utf8"),
        );
      await database.query(`CREATE FUNCTION fail_event_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic analytics outage'; END $$`);
      await database.query(
        "CREATE TRIGGER analytics_outage BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION fail_event_insert()",
      );
    });
    afterAll(async () => {
      await database?.end();
      if (admin) {
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await admin.end();
      }
    });
    it("commits donation/follow despite projection failure, then reconciles exactly once on retry", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const donation = await action({
          action: "donate",
          campaignId,
          amount: "25",
          key,
        });
        expect(donation.status).toBe(200);
        expect((await donation.json()).viewer.donations).toHaveLength(1);
        expect(
          (
            await action({
              action: "follow",
              targetType: "fundraiser",
              targetId: campaignId,
              active: true,
            })
          ).status,
        ).toBe(200);
        expect(await counts()).toEqual({
          donations: 1,
          follows: 1,
          outbox: 2,
          pending: 2,
          events: 0,
        });
        const before = (
          await database.query(
            "SELECT id,session_id,created_at,is_test,properties FROM domain_event_outbox ORDER BY id",
          )
        ).rows;
        expect(before.every((row) => row.is_test)).toBe(true);
        expect(new Set(before.map((row) => row.session_id)).size).toBe(1);
        const donationId = (await database.query("SELECT id FROM donations"))
          .rows[0].id;
        expect(
          before.some(
            (row) => row.id === donationId && row.properties.attemptId === key,
          ),
        ).toBe(true);
        // Same-key replay and repeated saved follow do not enqueue duplicate outcomes.
        expect(
          (await action({ action: "donate", campaignId, amount: "25", key }))
            .status,
        ).toBe(200);
        expect(
          (
            await action({
              action: "follow",
              targetType: "fundraiser",
              targetId: campaignId,
              active: true,
            })
          ).status,
        ).toBe(200);
        expect(await counts()).toEqual({
          donations: 1,
          follows: 1,
          outbox: 2,
          pending: 2,
          events: 0,
        });
        expect(
          (await action({ action: "donate", campaignId, amount: "26", key }))
            .status,
        ).toBe(409);
        await expect(flushOutbox(database)).rejects.toThrow(
          "synthetic analytics outage",
        );
        expect((await counts()).pending).toBe(2);
        await database.query("DROP TRIGGER analytics_outage ON events");
        expect(await flushOutbox(database)).toBe(2);
        expect(await flushOutbox(database)).toBe(0);
        expect(await counts()).toEqual({
          donations: 1,
          follows: 1,
          outbox: 2,
          pending: 0,
          events: 2,
        });
        const projected = (
          await database.query(
            "SELECT e.id,e.session_id,e.created_at,s.is_test FROM events e JOIN analytics_sessions s ON e.session_id=s.id ORDER BY e.id",
          )
        ).rows;
        expect(projected).toEqual(
          before.map(({ id, session_id, created_at, is_test }) => ({
            id,
            session_id,
            created_at,
            is_test,
          })),
        );
        expect(
          (await action({ action: "donate", campaignId, amount: "25", key }))
            .status,
        ).toBe(200);
        expect((await counts()).events).toBe(2);
        expect(log).toHaveBeenCalledWith(
          "Analytics delivery deferred; durable events remain pending.",
        );
      } finally {
        log.mockRestore();
      }
    });
    it("reuses event identity, minimizes queued payloads, and keeps original session timing without request context", async () => {
      const visitor = (await database.query("SELECT id FROM visitors LIMIT 1"))
        .rows[0].id;
      const client = await database.connect();
      const id = randomUUID();
      const now = new Date("2026-10-15T12:00:00Z");
      try {
        await client.query("BEGIN");
        await enqueueEvent(
          client,
          visitor,
          "page_view",
          campaignId,
          {
            pageType: "fundraisers",
            question: "private prompt",
            reason: "private note",
            url: "?secret",
          },
          id,
          { isTest: true, now },
        );
        await enqueueEvent(client, visitor, "page_view", campaignId, {}, id, {
          isTest: false,
          now: new Date(now.getTime() + 31 * 60 * 1000),
        });
        await client.query("COMMIT");
      } finally {
        client.release();
      }
      const queued = (
        await database.query("SELECT * FROM domain_event_outbox WHERE id=$1", [
          id,
        ])
      ).rows[0];
      expect(queued.properties).toEqual({ pageType: "fundraisers" });
      expect(queued.created_at).toEqual(now);
      expect(queued.is_test).toBe(true);
      expect(await flushOutbox(database)).toBe(1);
      expect(
        (
          await database.query("SELECT created_at FROM events WHERE id=$1", [
            id,
          ])
        ).rows[0].created_at,
      ).toEqual(now);
    });
    it("can rerun migrations without losing persisted state", async () => {
      const before = await counts();
      // Model an upgrade from 001: an established visitor/session lacks the new cursor.
      const visitor = randomUUID(),
        session = randomUUID();
      await database.query(
        "INSERT INTO visitors(id,token_hash) VALUES($1,$2)",
        [visitor, "migration-" + visitor],
      );
      await database.query(
        "INSERT INTO analytics_sessions(id,visitor_id,started_at,last_activity_at,is_test) VALUES($1,$2,$3,$3,true)",
        [session, visitor, "2026-10-15T12:00:00Z"],
      );
      for (const name of ["001_initial.sql", "002_event_outbox.sql"])
        await database.query(
          await readFile(new URL("../db/" + name, import.meta.url), "utf8"),
        );
      expect(await counts()).toEqual(before);
      expect(
        (
          await database.query(
            "SELECT session_id,is_test FROM event_session_state WHERE visitor_id=$1",
            [visitor],
          )
        ).rows[0],
      ).toEqual({ session_id: session, is_test: true });
    });
    it("keeps an unfollow saved when the session projection fails, and delivers on the next action", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await database.query(
          "CREATE TRIGGER session_outage BEFORE INSERT ON analytics_sessions FOR EACH ROW EXECUTE FUNCTION fail_event_insert()",
        );
        const before = await counts();
        const response = await action({
          action: "follow",
          targetType: "fundraiser",
          targetId: campaignId,
          active: false,
        });
        expect(response.status).toBe(200);
        expect((await response.json()).viewer.follows).toHaveLength(0);
        expect(await counts()).toEqual({
          ...before,
          follows: 0,
          outbox: before.outbox + 1,
          pending: 1,
        });
        await database.query(
          "DROP TRIGGER session_outage ON analytics_sessions",
        );
        // A no-change action is enough to reconcile pending measurements after commit.
        expect(
          (
            await action({
              action: "follow",
              targetType: "fundraiser",
              targetId: campaignId,
              active: false,
            })
          ).status,
        ).toBe(200);
        expect(await counts()).toEqual({
          ...before,
          follows: 0,
          outbox: before.outbox + 1,
          pending: 0,
          events: before.events + 1,
        });
      } finally {
        log.mockRestore();
      }
    });
  },
);
