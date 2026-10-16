import { test, expect } from "@playwright/test";
import { community, db, actor, answerFixture, askOpen } from "./helpers";

test("complete community → fundraiser → organizer → follow → Following → Ask citation → feature → support → private profile journey", async ({
  page,
}) => {
  // Controlled UI fixture, explicitly separate from live-provider acceptance.
  await page.route("**/api/ask", (route) =>
    route.fulfill({ json: answerFixture }),
  );
  await page.goto(community);
  await page
    .locator(".campaign-card")
    .first()
    .getByRole("link", { name: "Room to grow. Food to share." })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Help a neighborhood grow something good",
  );
  await page.locator("#organizer a").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maya Chen");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Following" })
    .click();
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await expect(page.locator(".campaign-card")).toContainText("Maya Chen");
  await page.locator(".card-title-link").click();
  const dialog = await askOpen(page);
  await dialog
    .getByRole("button", { name: "What is the latest update?" })
    .click();
  await expect(dialog).toContainText("Controlled response fixture");
  await dialog
    .getByRole("button", { name: /Fixture: garden plan update/ })
    .click();
  await expect(page.locator("#garden-plan")).toBeFocused();
  await page.getByRole("button", { name: "Feature this cause" }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .fill("A fixture note about caring for our shared neighborhood.");
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Make a difference/ }).click();
  await page.getByLabel("Donation amount").fill("12.50");
  await page
    .getByRole("button", { name: "Confirm simulated donation" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("No money was charged.");
  await page.getByRole("link", { name: "See your impact" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your corner of good.",
  );
  await expect(page.locator("blockquote")).toHaveText(
    "A fixture note about caring for our shared neighborhood.",
  );
  await expect(
    page.getByText("Contributed $12.50 in simulated support"),
  ).toBeVisible();
  await expect(page.locator(".funding-line strong")).toHaveText("$11,862.50");
  await page.reload();
  await expect(
    page.getByText("Contributed $12.50 in simulated support"),
  ).toBeVisible();
  const visitor = await actor(page.context());
  await expect
    .poll(
      async () =>
        (
          await db.query(
            "SELECT count(*)::int n FROM events WHERE visitor_id=$1 AND name='donation_completed'",
            [visitor],
          )
        ).rows[0].n,
    )
    .toBe(1);
});
