import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`live donation illustration stays separate from saved funding at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "POST") requests.push(request.url());
    });
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "No live model calls permitted." },
      }),
    );
    await page.goto("/fundraisers/grow-a-neighborhood");
    const chart = page.getByTestId("live-donation-chart");
    await chart.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const total = chart.locator(".live-chart-total");
    const line = chart.locator("path[stroke]");
    const savedFunding = await page.locator(".support-panel").textContent();
    const initial = await total.getAttribute("aria-label");
    const initialLine = await line.getAttribute("d");
    const initialRequests = requests.length;
    await expect(total).not.toHaveAttribute("aria-label", initial!, {
      timeout: 5000,
    });
    await expect(line).not.toHaveAttribute("d", initialLine!);
    expect(requests).toHaveLength(initialRequests);
    await chart
      .getByRole("button", { name: "Pause live donation demo", exact: true })
      .click();
    const pausedTotal = await total.getAttribute("aria-label");
    const pausedLine = await line.getAttribute("d");
    await page.waitForTimeout(3500);
    await expect(total).toHaveAttribute("aria-label", pausedTotal!);
    await expect(line).toHaveAttribute("d", pausedLine!);
    await page.screenshot({
      path: `test-results/live-donation-chart-${width}.png`,
    });
    await chart
      .getByRole("button", { name: "Resume live donation demo" })
      .click();
    await expect(total).not.toHaveAttribute("aria-label", pausedTotal!, {
      timeout: 5000,
    });
    await expect(page.locator(".support-panel")).toHaveText(savedFunding!);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    for (const range of ["7 days", "30 days", "All time"]) {
      const button = page.getByRole("button", { name: range, exact: true });
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(button).toHaveAttribute("aria-pressed", "true");
    }
    await page
      .getByText("View the dated funding data", { exact: true })
      .click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("tbody tr").last()).toContainText("$11,850.00");
    await page.getByRole("button", { name: "Live demo", exact: true }).click();
    await page.evaluate(() => {
      location.hash = "funding";
      document.getElementById("funding")?.focus();
    });
    await expect(
      page.getByRole("img", { name: /Cumulative USD funding/ }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("reduced motion keeps the illustration static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/fundraisers/grow-a-neighborhood");
  const chart = page.getByTestId("live-donation-chart");
  await chart.scrollIntoViewIfNeeded();
  await expect(chart.getByRole("button")).toBeDisabled();
  const total = chart.locator(".live-chart-total");
  const line = chart.locator("path[stroke]");
  const initialTotal = await total.getAttribute("aria-label");
  const initialLine = await line.getAttribute("d");
  await page.waitForTimeout(3500);
  await expect(total).toHaveAttribute("aria-label", initialTotal!);
  await expect(line).toHaveAttribute("d", initialLine!);
});
