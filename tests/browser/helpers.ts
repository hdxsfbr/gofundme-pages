import { expect, type BrowserContext, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
export const origin = process.env.BASE_URL || "http://127.0.0.1:3000";
export const community = "/communities/a-greener-tomorrow";
export const campaign = "grow-a-neighborhood";
export const fundraiser = "/fundraisers/" + campaign;
const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const connectionString =
  process.env.DATABASE_URL || env.match(/^DATABASE_URL=["']?([^\n"']+)/m)?.[1];
export const db = new pg.Pool({
  connectionString,
  max: 2,
  allowExitOnIdle: true,
});
export async function actor(context: BrowserContext) {
  const token = (await context.cookies()).find(
    (c) => c.name === "demo_session",
  )?.value;
  expect(token).toBeTruthy();
  const result = await db.query("SELECT id FROM visitors WHERE token_hash=$1", [
    createHash("sha256").update(token!).digest("hex"),
  ]);
  expect(result.rowCount).toBe(1);
  return result.rows[0].id as string;
}
export async function action(context: BrowserContext, data: unknown) {
  return context.request.post("/api/actions", { headers: { origin }, data });
}
export async function saved(context: BrowserContext, data: unknown) {
  const r = await action(context, data);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).viewer;
}
export async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
}
export async function askOpen(page: Page) {
  await page.getByRole("button", { name: /A little clarity/ }).click();
  return page.getByRole("dialog", { name: "Ask about this fundraiser" });
}
// UI-only controlled fixture. This is never represented as a live-model result.
export const answerFixture = {
  status: "supported",
  claims: [
    {
      text: "Controlled response fixture: the draft layout has twelve raised beds.",
      citations: [
        {
          id: "garden-plan",
          label: "Fixture: garden plan update",
          date: "2026-10-14T17:00:00Z",
          href: "/fundraisers/grow-a-neighborhood#garden-plan",
        },
      ],
    },
  ],
  missing: "",
  facts: [],
  snapshot: "2026-10-15T12:00:00Z",
};
