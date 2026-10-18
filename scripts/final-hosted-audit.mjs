import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const origin = "https://web-production-7e5023.up.railway.app";
const out = "docs/evidence/submission-20261018/hosted";
await mkdir(out, { recursive: true });
const prior = process.env.AUDIT_RECHECK
  ? JSON.parse(await readFile(`${out}/audit.json`, "utf8"))
  : null;
if (prior) {
  prior.auditCorrections = [
    "Initial incorrect /profiles/me probe returned 404; corrected to /me.",
    "Await route completion and settled mutations before reload.",
    "Explicit Watch clip avoids intentionally restored session position.",
  ];
  prior.httpErrors = prior.httpErrors.filter((e) => e.path !== "/profiles/me");
}
const evidence = prior || {
  startedAt: new Date().toISOString(),
  origin,
  authentication:
    "isolated signed-out visitor with x-demo-test:true; no response interception",
  browserErrors: [],
  httpErrors: [],
  checks: [],
  screenshots: [],
  ai: [],
};
const health = await fetch(origin + "/api/health");
evidence.health = { status: health.status, body: await health.json() };
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
evidence.browser = browser.version();
const context = await browser.newContext({
  baseURL: origin,
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: { "x-demo-test": "true" },
  permissions: ["clipboard-read", "clipboard-write"],
});
context.setDefaultTimeout(20000);
const page = await context.newPage();
page.on("pageerror", (e) => evidence.browserErrors.push(e.message));
page.on("response", (r) => {
  const path = new URL(r.url()).pathname;
  if (r.status() >= 400) evidence.httpErrors.push({ path, status: r.status() });
  if (["/api/ask", "/api/concierge"].includes(path))
    evidence.ai.push({
      path,
      status: r.status(),
      type: r.headers()["content-type"],
    });
});
async function capture(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (!document.querySelector("[role=dialog]")) {
      const y = scrollY;
      for (
        let top = 0;
        top < document.documentElement.scrollHeight;
        top += innerHeight * 0.8
      ) {
        scrollTo(0, top);
        await new Promise((r) => setTimeout(r, 80));
      }
      await Promise.all(
        [...document.images]
          .filter((i) => i.getBoundingClientRect().width)
          .map((i) => i.decode().catch(() => {})),
      );
      scrollTo(0, y);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    }
  });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  evidence.screenshots = evidence.screenshots.filter((s) => s.name !== name);
  evidence.screenshots.push({
    name,
    url: page.url(),
    viewport: page.viewportSize(),
    overflow,
  });
  expect(overflow).toBeLessThanOrEqual(1);
}
async function check(name, fn) {
  if (
    prior &&
    (["concierge-real", "campaign-chat-real"].includes(name) ||
      (process.env.AUDIT_ONLY &&
        !process.env.AUDIT_ONLY.split(",").includes(name)))
  )
    return;
  evidence.checks = evidence.checks.filter((c) => c.name !== name);
  try {
    await fn();
    evidence.checks.push({ name, status: "passed" });
  } catch (e) {
    evidence.checks.push({ name, status: "failed", error: e.message });
    await page
      .screenshot({ path: `${out}/failure-${name}.png` })
      .catch(() => {});
  }
  await writeFile(`${out}/audit.json`, JSON.stringify(evidence, null, 2));
  console.log(name, evidence.checks.at(-1).status);
}
const community = "/communities/a-greener-tomorrow",
  garden = "/fundraisers/grow-a-neighborhood";
await check("discover", async () => {
  await page.goto(community);
  await expect(page.locator(".campaign-card")).toHaveCount(4);
  await capture("desktop-discover");
  await page.getByLabel("Search campaigns").fill("MAYA");
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Food & community", exact: true })
    .click();
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await page.getByLabel("Search campaigns").fill("zzzz-no-such-cause");
  await expect(page.locator(".campaign-card")).toHaveCount(0);
  await expect(page.getByText("No causes match just yet.")).toBeVisible();
  await capture("desktop-no-match");
  await page.getByLabel("Search campaigns").fill("");
});
await check("concierge-real", async () => {
  await page.goto(community);
  await page
    .getByRole("button", { name: /^(Find my cause|Open discovery concierge)$/ })
    .click();
  await page
    .locator("#concierge-question")
    .fill(
      "I care about community gardens and fresh food. Which cause should I support?",
    );
  await page.locator("#concierge-question").press("Enter");
  await expect(page.locator(".concierge-recommendation").first()).toBeVisible({
    timeout: 60000,
  });
  evidence.conciergeText = await page
    .locator(".concierge-recommendation")
    .allTextContents();
  await capture("desktop-concierge");
  await page.locator(`.concierge-campaign-title[href="${garden}"]`).click();
  await expect(page).toHaveURL(origin + garden);
});
await check("campaign-charts", async () => {
  await page.goto(garden);
  await capture("desktop-campaign");
  const chart = page.getByTestId("live-donation-chart");
  await chart.scrollIntoViewIfNeeded();
  const total = chart.locator(".live-chart-total");
  const initial = await total.getAttribute("aria-label");
  await expect(total).not.toHaveAttribute("aria-label", initial, {
    timeout: 6000,
  });
  await chart
    .getByRole("button", { name: "Pause live donation demo", exact: true })
    .click();
  const paused = await total.getAttribute("aria-label");
  await page.waitForTimeout(2500);
  await expect(total).toHaveAttribute("aria-label", paused);
  await capture("desktop-live-chart");
  for (const name of ["7 days", "30 days", "All time"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByText("View the dated funding data", { exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  evidence.fundingTable = await page.getByRole("table").innerText();
  await capture("desktop-recorded-chart");
});
await check("campaign-chat-real", async () => {
  await page.goto(garden);
  await page
    .getByRole("button", {
      name: /^(Ask about this fundraiser|Open fundraiser assistant)$/,
    })
    .click();
  await page
    .getByRole("button", {
      name: "What will the funds be used for?",
      exact: true,
    })
    .click();
  await expect(page.locator(".answer .citation").first()).toBeVisible({
    timeout: 60000,
  });
  evidence.chatAnswer = await page.locator(".answer").innerText();
  await capture("desktop-chat");
  await page.locator(".answer .citation").first().click();
  expect(new URL(page.url()).hash).not.toBe("");
  evidence.citationDestination = page.url();
});
await check("support-actions", async () => {
  await page.goto(garden);
  await page.getByRole("button", { name: /Make a difference/ }).click();
  await page.getByLabel("Donation amount").fill("12.50");
  await page
    .getByRole("button", { name: /Confirm simulated donation/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "$12.50 in simulated support",
  );
  await capture("desktop-donation");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .locator(".support-panel")
    .getByRole("button", { name: "Share", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Link copied",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Feature this cause", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .fill("Final hosted audit: fresh food and shared space.");
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
});
await check("follow-and-persistence", async () => {
  await page.goto(garden);
  await page.locator("#organizer a").click();
  await expect(page).toHaveURL(origin + "/profiles/maya-chen");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await capture("desktop-organizer");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Following", exact: true })
    .click();
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await capture("desktop-following");
  await page.locator(".my-profile-link").click();
  await expect(page).toHaveURL(origin + "/me");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your corner of good.",
  );
  await page.reload();
  await expect(page.locator("blockquote")).toHaveText(
    "Final hosted audit: fresh food and shared space.",
  );
  await expect(
    page.getByText("Contributed $12.50 in simulated support", { exact: true }),
  ).toHaveCount(1);
  await capture("desktop-private-profile");
});
for (const width of [1440, 390])
  await check(`watch-${width}`, async () => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(community + "/watch?clip=garden-neighbors");
    const video = page.locator(".watch-item.is-active video");
    await expect
      .poll(() => video.evaluate((e) => e.readyState), { timeout: 30000 })
      .toBeGreaterThanOrEqual(2);
    if (await video.evaluate((e) => e.paused))
      await page
        .getByRole("button", { name: "Play video", exact: true })
        .click();
    await expect
      .poll(() => video.evaluate((e) => e.currentTime))
      .toBeGreaterThan(1);
    await capture(`watch-${width}`);
    await page.getByRole("button", { name: "Next clip", exact: true }).click();
    await expect(page.locator(".watch-scroller")).toHaveAttribute(
      "data-active-clip",
      "tree-care",
    );
    await page
      .locator(".watch-item.is-active")
      .getByRole("button", { name: /Donate/ })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture(`watch-donation-${width}`);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.locator(".watch-scroller")).toHaveAttribute(
      "data-active-clip",
      "tree-care",
    );
    await page
      .locator('.watch-item.is-active a[href^="/fundraisers/"]')
      .first()
      .click();
    await expect(page).toHaveURL(/fundraisers/);
  });
await check("mobile-pages", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, path] of [
    ["discover", community],
    ["campaign", garden],
    ["organizer", "/profiles/maya-chen"],
    ["private-profile", "/me"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await capture("mobile-" + name);
  }
});
evidence.finishedAt = new Date().toISOString();
evidence.status =
  evidence.checks.every((c) => c.status === "passed") &&
  evidence.browserErrors.length === 0 &&
  evidence.httpErrors.length === 0
    ? "passed"
    : "needs-review";
await writeFile(`${out}/audit.json`, JSON.stringify(evidence, null, 2) + "\n");
await browser.close();
console.log(
  JSON.stringify({
    status: evidence.status,
    checks: evidence.checks,
    ai: evidence.ai,
  }),
);
