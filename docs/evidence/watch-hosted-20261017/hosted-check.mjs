// One-off hosted acceptance (not committed). Test-tagged traffic only.
import { chromium, expect } from "@playwright/test";
const origin = "https://web-production-7e5023.up.railway.app";
const out = {};
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  extraHTTPHeaders: { "x-demo-test": "true" },
});
const page = await context.newPage();
const media = [];
page.on("response", (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith("/media/watch/"))
    media.push(`${r.status()} ${u.pathname} ${r.headers()["content-type"]}`);
});
try {
  const watch = `/communities/a-greener-tomorrow/watch`;
  const resp = await page.goto(origin + watch + "?clip=garden-neighbors");
  out.watchStatus = resp.status();
  const scroller = page.locator(".watch-scroller");
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "garden-neighbors",
    { timeout: 20000 },
  );
  const video = page.locator(".watch-item.is-active video");
  await expect
    .poll(() => video.evaluate((v) => v.readyState), { timeout: 20000 })
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(
      () =>
        page
          .locator(".watch-item.is-active video track")
          .evaluate((t) => t.readyState),
      { timeout: 20000 },
    )
    .toBe(2);
  out.cues = await page
    .locator(".watch-item.is-active video track")
    .evaluate((t) => t.track.cues?.length ?? 0);
  await page.screenshot({ path: "test-results/hosted/watch-mobile.png" });
  // return journey: campaign and back
  await page
    .locator(".watch-item.is-active")
    .getByRole("link", { name: "Help a neighborhood grow something good" })
    .click();
  await expect(page).toHaveURL(/\/fundraisers\/grow-a-neighborhood$/);
  await page.goBack();
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "garden-neighbors",
    { timeout: 20000 },
  );
  out.returnedToClip = await scroller.getAttribute("data-active-clip");
  // support: one $1.00 simulated donation from Watch
  await page
    .locator(".watch-item.is-active")
    .getByRole("button", { name: "Donate now" })
    .click();
  const donation = page.locator("dialog");
  await donation.getByLabel("Donation amount").fill("1.00");
  await donation
    .getByRole("button", { name: "Confirm simulated donation" })
    .click();
  await expect(donation).toContainText("No money was charged.", {
    timeout: 20000,
  });
  out.donationConfirmedAt = new Date().toISOString();
  await page.screenshot({ path: "test-results/hosted/donation-confirmed.png" });
  await donation.getByRole("button", { name: "Close dialog" }).click();
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "garden-neighbors",
  );
  out.afterDonationClip = await scroller.getAttribute("data-active-clip");
  out.afterDonationVideo = await page
    .locator(".watch-item.is-active video")
    .getAttribute("src");
  out.ok = true;
} catch (e) {
  out.ok = false;
  out.error = String(e).slice(0, 600);
  await page
    .screenshot({ path: "test-results/hosted/failure.png" })
    .catch(() => {});
}
out.mediaResponses = [...new Set(media)];
console.log(JSON.stringify(out, null, 2));
await browser.close();
