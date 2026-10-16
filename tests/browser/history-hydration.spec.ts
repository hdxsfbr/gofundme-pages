import { test, expect } from "@playwright/test";
import { fundraiser } from "./helpers";

for (const [boundary, milliseconds] of [
  ["minute", 60_000],
  ["UTC day", 86_400_000],
] as const) {
  test(`server history snapshot survives a client ${boundary} boundary and the initial donation click`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Fetch real SSR before navigation. Changing the page clock while a
    // navigation route is pending waits for that same navigation to finish.
    // The context request shares cookies with the page, preserving its visitor.
    const response = await page.request.get(fundraiser);
    expect(response.status()).toBe(200);
    const html = await response.text();
    const serverSnapshot =
      html
        .replace(/<!--[\s\S]*?-->/g, "")
        .match(/Snapshot:\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) UTC/)?.[1] || "";
    expect(serverSnapshot).not.toBe("");
    await page.clock.setFixedTime(
      new Date(
        Date.parse(serverSnapshot.replace(" ", "T") + ":00Z") + milliseconds,
      ),
    );
    await page.route(
      (url) => url.pathname === fundraiser,
      async (route) => {
        if (!route.request().isNavigationRequest()) return route.continue();
        // Deliver the exact server-rendered snapshot with a later browser clock.
        // Timers still run, so the initial click exercises normal hydration.
        await route.fulfill({ response, body: html });
      },
    );
    await page.goto(fundraiser);
    const chart = page.locator("#funding");
    // Read hidden details without scrolling: viewing Updates legitimately saves
    // an action and refreshes the server snapshot, beyond this hydration check.
    await expect(chart).toContainText(`Snapshot: ${serverSnapshot} UTC.`);
    await page.getByRole("button", { name: /Make a difference/ }).click();
    const dialog = page.getByRole("dialog", {
      name: "Support this good thing",
    });
    await expect(dialog.getByLabel("Donation amount")).toBeVisible();
    await dialog.getByLabel("Donation amount").fill("12.50");
    await expect(dialog.getByLabel("Donation amount")).toHaveValue("12.50");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(chart).toContainText(`Snapshot: ${serverSnapshot} UTC.`);
    expect(errors).toEqual([]);
  });
}
