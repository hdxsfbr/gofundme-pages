import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import {
  community,
  fundraiser,
  askOpen,
  answerFixture,
  noOverflow,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  // Every AI browser test uses an explicitly controlled fixture, never a model call.
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Automated suite: no live model calls permitted." },
    }),
  );
});

test("AI controlled fixture: campaign scoped answer cites and focuses the exact update", async ({
  page,
}) => {
  await page.route("**/api/ask", async (route) => {
    expect(route.request().postDataJSON().campaignId).toBe(
      "grow-a-neighborhood",
    );
    await route.fulfill({ json: answerFixture });
  });
  await page.goto(fundraiser);
  const dialog = await askOpen(page);
  await dialog
    .getByRole("button", { name: "What is the latest update?" })
    .click();
  await expect(dialog.getByText(answerFixture.claims[0].text)).toBeVisible();
  await dialog
    .getByRole("button", { name: /Fixture: garden plan update/ })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#garden-plan")).toBeFocused();
  await expect(page).toHaveURL(/#garden-plan$/);
  const box = await page.locator("#garden-plan").boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(64);
});

test("AI controlled error fixtures: provider failure and rate limit offer source reading and retry", async ({
  page,
}) => {
  for (const status of [503, 429]) {
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status,
        json: {
          error:
            status === 429
              ? "Fixture: temporary request limit. Try again later."
              : "Fixture: provider unavailable. Try again.",
        },
      }),
    );
    await page.goto(fundraiser);
    const dialog = await askOpen(page);
    await dialog
      .getByRole("button", { name: "What will the funds be used for?" })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      status === 429 ? "temporary request limit" : "provider unavailable",
    );
    await expect(
      dialog.getByRole("button", { name: "Retry answer" }),
    ).toBeEnabled();
    await dialog
      .getByRole("button", { name: "Read the original campaign story" })
      .click();
    await expect(page.locator("#story")).toBeFocused();
  }
});

test("AI controlled malformed fixture: invalid 200 response offers a retry without crashing the page", async ({
  page,
}) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({ json: { fixture: "intentionally malformed output" } }),
  );
  await page.goto(fundraiser);
  const dialog = await askOpen(page);
  await dialog
    .getByRole("button", { name: "What is the latest update?" })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Help a neighborhood grow something good",
  );
  await expect(
    dialog.getByRole("button", { name: "Retry answer" }),
  ).toBeEnabled();
});

test("AI controlled delayed fixture: closing cancels stale answers and another campaign starts empty", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/ask", async (route) => {
    requested();
    await gate;
    await route.fulfill({ json: answerFixture }).catch(() => {});
  });
  await page.goto(fundraiser);
  let dialog = await askOpen(page);
  await dialog
    .getByRole("button", { name: "What is the latest update?" })
    .click();
  await started;
  await expect(dialog.getByRole("status")).toBeVisible();
  await page.keyboard.press("Escape");
  release();
  dialog = await askOpen(page);
  await expect(dialog.locator(".answer")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/fundraisers/roots-for-the-future");
  dialog = await askOpen(page);
  await expect(dialog.locator(".answer")).toHaveCount(0);
  await expect(dialog).toContainText("Plant the roots of a greener future");
});

const evidenceDirectory =
  process.env.BROWSER_EVIDENCE_DIR || "docs/evidence/browser";

for (const width of [1440, 390, 320]) {
  test(`visual, reduced motion, modal keyboard, and serious accessibility review at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    mkdirSync(evidenceDirectory, { recursive: true });
    for (const [name, path] of [
      ["community", community],
      ["fundraiser", fundraiser],
      ["profile", "/profiles/maya-chen"],
    ]) {
      await page.goto(path);
      await expect(page.locator("main[aria-busy=true]")).toHaveCount(0);
      await expect(page.locator("main")).toBeVisible();
      await noOverflow(page);
      // Deferred campaign media mounts only after its card nears the viewport.
      // Reveal every card first, then inspect the complete set of real images.
      const cards = page.locator(".campaign-card");
      const cardCount = await cards.count();
      for (let index = 0; index < cardCount; index++) {
        const card = cards.nth(index);
        await card.scrollIntoViewIfNeeded();
        await expect(card.locator("img.card-photo")).toBeVisible();
        await expect
          .poll(() =>
            card
              .locator("img.card-photo")
              .evaluate(
                (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
              ),
          )
          .toBe(true);
      }
      for (const image of await page.locator("main img").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            image.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
          )
          .toBe(true);
      }
      await page.evaluate(() => scrollTo(0, 0));
      const findings = await new AxeBuilder({ page }).analyze();
      expect(
        findings.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact || ""),
        ),
      ).toEqual([]);
      await page.screenshot({
        path: `${evidenceDirectory}/${name}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto(fundraiser);
    const trigger = page.getByRole("button", { name: /Make a difference/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeFocused();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () =>
            !!document.activeElement?.closest("dialog") ||
            (document.activeElement === document.body && !document.hasFocus()),
        ),
      ).toBe(true);
    }
    await noOverflow(page);
    await page.screenshot({
      path: `${evidenceDirectory}/donation-dialog-${width}.png`,
    });
    const findings = await new AxeBuilder({ page }).analyze();
    expect(
      findings.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}

test("AI controlled stalled fixture: visible wait ends at twenty seconds and leaves the source path usable", async ({
  page,
}) => {
  await page.clock.install();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/ask", async (route) => {
    requested();
    await gate;
    await route.fulfill({ json: answerFixture }).catch(() => {});
  });
  await page.goto(fundraiser);
  const dialog = await askOpen(page);
  await dialog
    .getByRole("button", { name: "What is the latest update?" })
    .click();
  await started;
  await expect(dialog.getByRole("status")).toBeVisible();
  await page.clock.fastForward(20001);
  await expect(dialog.getByRole("alert")).toContainText("took too long");
  await expect(dialog.getByRole("status")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Retry answer" }),
  ).toBeEnabled();
  release();
  await dialog
    .getByRole("button", { name: "Read the original campaign story" })
    .click();
  await expect(page.locator("#story")).toBeFocused();
});

test("AI question bounds reject blank input and cap typed length without provider requests", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/ask", (route) => {
    calls++;
    return route.fulfill({ json: answerFixture });
  });
  await page.goto(fundraiser);
  const dialog = await askOpen(page);
  const input = dialog.getByLabel("Your question");
  await input.fill("    ");
  await expect(
    dialog.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();
  expect(calls).toBe(0);
  await expect(input).toHaveAttribute("maxlength", "1000");
  await input.fill("a".repeat(1001));
  await expect(input).toHaveValue("a".repeat(1000));
  expect(calls).toBe(0);
});
