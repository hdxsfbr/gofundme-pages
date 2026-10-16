import { chromium, expect } from "@playwright/test";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const origin = process.env.BASE_URL || "http://127.0.0.1:3000";
const dir = process.env.PERFORMANCE_EVIDENCE_DIR || "docs/evidence/performance";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  baseURL: origin,
  viewport: { width: 390, height: 844 },
  extraHTTPHeaders: { "x-demo-test": "true" },
});
await context.tracing.start({
  screenshots: true,
  snapshots: true,
  sources: true,
});
const page = await context.newPage();
let modelRequests = 0;
page.on("request", (r) => {
  if (new URL(r.url()).pathname === "/api/ask") modelRequests++;
});
const measures = [];
async function measure(name, action, settled) {
  const started = performance.now();
  await action();
  await settled();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  measures.push({
    name,
    elapsedMs: Math.round((performance.now() - started) * 10) / 10,
  });
}
await page.goto("/communities/a-greener-tomorrow");
await page.getByLabel("Search campaigns").scrollIntoViewIfNeeded();
for (let i = 0; i < 3; i++) {
  await measure(
    "filter-Maya",
    () => page.getByLabel("Search campaigns").fill("MAYA"),
    () => expect(page.locator(".campaign-card")).toHaveCount(1),
  );
  await page.getByLabel("Search campaigns").fill("");
  await expect(page.locator(".campaign-card")).toHaveCount(4);
}
await page.goto("/fundraisers/grow-a-neighborhood");
for (let i = 0; i < 3; i++) {
  await measure(
    "open-Ask-panel",
    () => page.getByRole("button", { name: /A little clarity/ }).click(),
    () =>
      expect(
        page.getByRole("dialog").getByLabel("Your question"),
      ).toBeVisible(),
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
}
await page
  .getByRole("button", { name: "7 days", exact: true })
  .scrollIntoViewIfNeeded();
for (const name of ["7 days", "All time", "30 days"])
  await measure(
    "chart-" + name,
    () => page.getByRole("button", { name, exact: true }).click(),
    () =>
      expect(page.getByRole("button", { name, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
  );
await mkdir(dir, { recursive: true });
await context.tracing.stop({
  path: `${dir}/interactions.zip`,
});
execFileSync("python3", ["scripts/redact-trace.py", `${dir}/interactions.zip`]);
await writeFile(
  `${dir}/interactions.json`,
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      browser: browser.version(),
      viewport: "390x844",
      throttling: "none",
      build: "production",
      buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
      tracePrivacy:
        "Cookie and authorization headers and cookie arrays redacted from trace/network records before sharing.",
      method:
        "Playwright action through visible DOM assertion plus two animation frames. Includes browser-driver overhead and any scrolling; these are scripted action-to-visible-result timings, not INP or pure event-handler duration.",
      modelRequestsDuringInitialRenderingAndPanelOpening: modelRequests,
      measures,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ modelRequests, measures }, null, 2));
await browser.close();
if (modelRequests !== 0) process.exitCode = 1;
