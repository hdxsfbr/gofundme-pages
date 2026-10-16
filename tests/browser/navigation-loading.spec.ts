import { test, expect } from "@playwright/test";
import { community, fundraiser } from "./helpers";

test("delayed client navigation shows a distinct pending status while the current page remains readable, then arrives", async ({
  page,
}) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Automated suite: no live model calls permitted." },
    }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let navigationRequested = false;
  await page.route(
    (url) => url.pathname === fundraiser,
    async (route) => {
      const headers = route.request().headers();
      if (headers.rsc !== "1") return route.continue();
      // Prevent the in-memory prefetch cache from satisfying the later click.
      // Only the actual navigation response is deliberately held below.
      if (
        headers["next-router-prefetch"] ||
        headers["next-router-segment-prefetch"] ||
        headers.purpose === "prefetch"
      ) {
        return route.abort("aborted");
      }
      navigationRequested = true;
      await gate;
      await route.continue().catch(() => {});
    },
  );
  try {
    await page.goto(community);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "tomorrow.",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    const link = page
      .locator(".campaign-card")
      .first()
      .locator(".card-title-link");
    await link.click();
    await expect.poll(() => navigationRequested).toBe(true);
    await expect(link.getByRole("status")).toHaveText(
      "Finding your next good thing…",
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "tomorrow.",
    );
    await expect(
      page.getByRole("textbox", { name: "Search campaigns" }),
    ).toBeVisible();
    release();
    await expect(page).toHaveURL(new RegExp(fundraiser + "(?:\\?|$)"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Help a neighborhood grow something good",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Make a difference/ }),
    ).toBeEnabled();
  } finally {
    release();
  }
});
