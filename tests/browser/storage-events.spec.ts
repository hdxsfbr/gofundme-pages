import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  origin,
  community,
  fundraiser,
  campaign,
  db,
  actor,
  saved,
} from "./helpers";

test("migration runs in an empty transactional schema; uniqueness and amount constraints reject invalid rows", async () => {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const schema = "browser_" + randomUUID().replaceAll("-", "");
    await c.query(`CREATE SCHEMA ${schema}`);
    await c.query(`SET LOCAL search_path TO ${schema}`);
    const migration = readFileSync("db/001_initial.sql", "utf8");
    await c.query(migration);
    await c.query(migration);
    const id = randomUUID();
    await c.query("INSERT INTO visitors(id,token_hash) VALUES($1,$2)", [
      id,
      "fixture-token",
    ]);
    const session = randomUUID();
    await c.query(
      "INSERT INTO analytics_sessions(id,visitor_id,started_at,last_activity_at,is_test) VALUES($1,$2,now(),now(),true)",
      [session, id],
    );
    const donationKey = randomUUID();
    const eventId = randomUUID();
    const checks: [string, unknown[], string][] = [
      [
        "INSERT INTO follows(visitor_id,target_type,target_id) VALUES($1,$2,$3)",
        [id, "fundraiser", campaign],
        "23505",
      ],
      [
        "INSERT INTO features(visitor_id,campaign_id,reason) VALUES($1,$2,$3)",
        [id, campaign, "Fixture plain text"],
        "23505",
      ],
      [
        "INSERT INTO donations(id,visitor_id,campaign_id,cents,idempotency_key) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), id, campaign, 1250, donationKey],
        "23505",
      ],
      [
        "INSERT INTO events(id,visitor_id,session_id,name) VALUES($1,$2,$3,$4)",
        [eventId, id, session, "page_view"],
        "23505",
      ],
    ];
    for (const [sql, values, code] of checks) {
      await c.query(sql, values);
      await c.query("SAVEPOINT invalid");
      try {
        await c.query(
          sql,
          sql.startsWith("INSERT INTO donations")
            ? [randomUUID(), ...values.slice(1)]
            : values,
        );
        throw new Error("Expected duplicate rejection");
      } catch (e) {
        expect((e as { code: string }).code).toBe(code);
      }
      await c.query("ROLLBACK TO SAVEPOINT invalid");
    }
    for (const cents of [0, 99, 1000001]) {
      await c.query("SAVEPOINT invalid");
      try {
        await c.query(
          "INSERT INTO donations(id,visitor_id,campaign_id,cents,idempotency_key) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), id, campaign, cents, randomUUID()],
        );
        throw new Error("Expected amount rejection");
      } catch (e) {
        expect((e as { code: string }).code).toBe("23514");
      }
      await c.query("ROLLBACK TO SAVEPOINT invalid");
    }
    await c.query("SAVEPOINT invalid");
    try {
      await c.query(
        "INSERT INTO features(visitor_id,campaign_id,reason) VALUES($1,$2,$3)",
        [id, "other-fixture", "a".repeat(281)],
      );
      throw new Error("Expected note rejection");
    } catch (e) {
      expect((e as { code: string }).code).toBe("23514");
    }
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});

test("collector deduplicates delivery, strips private payloads, tags test traffic, rejects trusted spoofing", async ({
  page,
}) => {
  await page.goto(community);
  const visitor = await actor(page.context());
  const id = randomUUID();
  const event = {
    id,
    name: "discovery_filter_changed",
    entityId: "a-greener-tomorrow",
    properties: {
      filterType: "search",
      rawSearch: "sensitive fixture",
      question: "secret fixture",
      reason: "private fixture",
      url: "/?token=fixture",
      value: 3,
    },
  };
  const post = (data: unknown) =>
    page.context().request.post("/api/events", { headers: { origin }, data });
  const [a, b] = await Promise.all([post(event), post(event)]);
  expect(a.status()).toBe(200);
  expect(b.status()).toBe(200);
  const rows = await db.query(
    "SELECT e.properties,s.is_test FROM events e JOIN analytics_sessions s ON s.id=e.session_id WHERE e.id=$1 AND e.visitor_id=$2",
    [id, visitor],
  );
  expect(rows.rows).toEqual([
    { properties: { filterType: "search", value: 3 }, is_test: true },
  ]);
  expect(
    (
      await post({ ...event, id: randomUUID(), name: "donation_completed" })
    ).status(),
  ).toBe(400);
  expect(
    (
      await db.query(
        "SELECT * FROM events WHERE visitor_id=$1 AND name='donation_completed'",
        [visitor],
      )
    ).rowCount,
  ).toBe(0);
});

test("persisted freshness flags an update newer than prior viewing and clears only after visible", async ({
  page,
}) => {
  await page.goto(community);
  const visitor = await actor(page.context());
  await saved(page.context(), {
    action: "follow",
    targetType: "fundraiser",
    targetId: campaign,
    active: true,
  });
  await db.query(
    "INSERT INTO update_views(visitor_id,campaign_id,viewed_at) VALUES($1,$2,$3)",
    [visitor, campaign, "2026-10-10T00:00:00Z"],
  );
  await page.goto(community + "?view=following");
  await expect(page.locator(".new-badge")).toHaveCount(1);
  await page.goto(fundraiser);
  expect(
    (
      await db.query("SELECT viewed_at FROM update_views WHERE visitor_id=$1", [
        visitor,
      ])
    ).rows[0].viewed_at.toISOString(),
  ).toBe("2026-10-10T00:00:00.000Z");
  await expect(page.locator("#updates")).toBeVisible();
  await page
    .locator("#updates")
    .evaluate((section) => section.scrollIntoView({ behavior: "instant" }));
  await expect(page.locator("#updates")).toBeInViewport({ ratio: 0.1 });
  await expect
    .poll(async () =>
      (
        await db.query(
          "SELECT viewed_at FROM update_views WHERE visitor_id=$1",
          [visitor],
        )
      ).rows[0].viewed_at.toISOString(),
    )
    .not.toBe("2026-10-10T00:00:00.000Z");
  await page.goto(community + "?view=following");
  await expect(page.locator(".new-badge")).toHaveCount(0);
});

test("header Following and Discover links change the selected view during client navigation", async ({
  page,
}) => {
  await page.goto(community);
  await expect(page.locator(".campaign-card")).toHaveCount(4);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Following" })
    .click();
  await expect(page).toHaveURL(/view=following/);
  await expect(page.getByRole("tab", { name: /Following/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".campaign-card")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Discover" })
    .click();
  await expect(
    page.getByRole("tab", { name: "Discover", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".campaign-card")).toHaveCount(4);
});

test("a visitor-scoped database failure renders the page error state and Retry recovers after storage resumes", async ({
  page,
}) => {
  await page.goto(community);
  const visitor = await actor(page.context());
  const hash = (
    await db.query("SELECT token_hash FROM visitors WHERE id=$1", [visitor])
  ).rows[0].token_hash as string;
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  const name = "browser_failure_" + randomUUID().replaceAll("-", "");
  // Only this disposable test visitor is rejected. Other visitors remain usable.
  await db.query(
    `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.token_hash='${hash}' THEN RAISE EXCEPTION 'Controlled browser fixture: visitor storage unavailable'; END IF; RETURN NEW; END $$`,
  );
  let installed = false;
  try {
    await db.query(
      `CREATE TRIGGER ${name} BEFORE INSERT OR UPDATE ON visitors FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    );
    installed = true;
    await page.goto(community + "?fixture=failure");
    await expect(
      page.getByRole("heading", { name: "A little pause." }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "We couldn’t load this page right now. Your saved actions are still yours.",
      ),
    ).toBeVisible();
    await db.query(`DROP TRIGGER ${name} ON visitors`);
    installed = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "tomorrow.",
    );
    await expect(page.locator(".campaign-card")).toHaveCount(4);
    expect(await actor(page.context())).toBe(visitor);
  } finally {
    if (installed) await db.query(`DROP TRIGGER IF EXISTS ${name} ON visitors`);
    await db.query(`DROP FUNCTION IF EXISTS ${name}()`);
  }
});
