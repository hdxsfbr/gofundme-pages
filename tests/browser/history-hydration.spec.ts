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
    let serverSnapshot = "";
    await page.route(
      (url) => url.pathname === fundraiser,
      async (route) => {
        if (!route.request().isNavigationRequest()) return route.continue();
        // Obtain real SSR HTML first, then advance only the browser clock before
        // it hydrates. Timers keep running; no sleeps or hydration waits hide
        // the first interaction that was lost during the original mismatch.
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        const html = await response.text();
        serverSnapshot =
          html
            .replace(/<!--[\s\S]*?-->/g, "")
            .match(/Snapshot:\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) UTC/)?.[1] ||
          "";
        expect(serverSnapshot).not.toBe("");
        await page.clock.setFixedTime(
          new Date(
            Date.parse(serverSnapshot.replace(" ", "T") + ":00Z") +
              milliseconds,
          ),
        );
        await route.fulfill({ response, body: html });
      },
    );
    await page.goto(fundraiser);
    await page.getByRole("button", { name: /Make a difference/ }).click();
    const dialog = page.getByRole("dialog", {
      name: "Support this good thing",
    });
    await expect(dialog.getByLabel("Donation amount")).toBeVisible();
    await dialog.getByLabel("Donation amount").fill("12.50");
    await expect(dialog.getByLabel("Donation amount")).toHaveValue("12.50");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const chart = page.locator("#funding");
    await chart.getByText("View the dated funding data").click();
    await expect(chart).toContainText(`Snapshot: ${serverSnapshot} UTC.`);
    await chart.getByRole("button", { name: "7 days", exact: true }).click();
    await expect(
      chart.getByRole("button", { name: "7 days", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(chart).toContainText(`Snapshot: ${serverSnapshot} UTC.`);
    expect(errors).toEqual([]);
  });
}
