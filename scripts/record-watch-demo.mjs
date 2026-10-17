import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const origin = process.env.BASE_URL || "http://127.0.0.1:3012";
const evidence = resolve(
  process.env.DEMO_EVIDENCE_DIR || "docs/evidence/watch-20261016",
);
const recordings = join(evidence, "recordings");
const startedAt = new Date().toISOString();
await mkdir(recordings, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const browserVersion = browser.version();
const context = await browser.newContext({
  baseURL: origin,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  extraHTTPHeaders: { "x-demo-test": "true" },
  recordVideo: { dir: recordings, size: { width: 390, height: 844 } },
});
const page = await context.newPage();
const recording = page.video();
const videoPath = join(recordings, "watch-mobile-swipe-donate.webm");

try {
  await page.goto("/communities/a-greener-tomorrow");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Watch" })
    .click();
  const scroller = page.locator(".watch-scroller");
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "garden-neighbors",
  );
  const video = page.locator(".watch-item.is-active video");
  await expect
    .poll(() => video.evaluate((element) => element.readyState))
    .toBeGreaterThanOrEqual(2);
  if (await video.evaluate((element) => element.paused))
    await page.getByRole("button", { name: "Play video" }).click();
  await expect
    .poll(() => video.evaluate((element) => element.currentTime))
    .toBeGreaterThan(1);

  const media = await page
    .locator(".watch-item.is-active .watch-media")
    .boundingBox();
  if (!media) throw new Error("Active Watch media is not visible");
  const cdp = await context.newCDPSession(page);
  const x = Math.round(media.x + media.width / 2);
  const y = Math.round(media.y + media.height * 0.55);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y - Math.round(media.height * 0.8), id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(scroller).toHaveAttribute("data-active-clip", "tree-care");
  await page.waitForTimeout(1400);

  const pause = page.getByRole("button", { name: "Pause video" });
  if (await pause.count()) await pause.click();

  await page
    .locator(".watch-item.is-active")
    .getByRole("button", { name: "Donate now" })
    .click();
  const donation = page.locator("dialog");
  await expect(donation).toBeVisible();
  await donation.getByLabel("Donation amount").fill("12.50");
  await donation
    .getByRole("button", { name: "Confirm simulated donation" })
    .click();
  await expect(donation).toContainText("No money was charged.");
  await page.waitForTimeout(1200);
  await donation.getByRole("button", { name: "Close dialog" }).click();
  await expect(scroller).toHaveAttribute("data-active-clip", "tree-care");
  await expect(page.locator(".watch-item.is-active .funding")).toBeVisible();
  await page.waitForTimeout(700);
} finally {
  await context.close();
  if (recording) await recording.saveAs(videoPath);
  await browser.close();
}

const finishedAt = new Date().toISOString();
if (!recording) throw new Error("Chromium did not create a demo recording");
const engagement = execFileSync(
  process.execPath,
  [
    "--env-file-if-exists=.env.local",
    "--import",
    "tsx",
    "scripts/report.ts",
    "--from",
    startedAt,
    "--to",
    finishedAt,
    "--include-test",
  ],
  { encoding: "utf8" },
);
await writeFile(join(evidence, "watch-demo-engagement.json"), engagement);
const buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
await writeFile(
  join(evidence, "watch-demo-recording.json"),
  JSON.stringify(
    {
      startedAt,
      finishedAt,
      origin,
      buildId,
      browser: browserVersion,
      viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
      recordedActions: [
        "Enter Watch from Discover",
        "Play the first captioned clip",
        "Swipe up to the next campaign clip",
        "Open Donate now and save $12.50 in simulated support",
        "Show the no-charge confirmation and return to the same paused clip",
      ],
      recording: videoPath,
      limitations: [
        "Chromium mobile emulation; no physical iOS device was used.",
        "Campaign footage is licensed illustrative stock with editorial demo text and no spoken audio.",
        "The donation is simulated; no money moves.",
      ],
    },
    null,
    2,
  ) + "\n",
);
