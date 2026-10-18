import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
const out = resolve(
  process.env.DEMO_CAPTURE_DIR || "artifacts/demo-20261018/capture",
);
await mkdir(join(out, "raw"), { recursive: true });
function selectedState() {
  try {
    return {
      storageState: JSON.parse(
        execFileSync("cat", [join(out, "state.json")], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      ),
    };
  } catch {
    return {};
  }
}
const origin = "https://web-production-7e5023.up.railway.app";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  ...selectedState(),
  baseURL: origin,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: join(out, "raw"), size: { width: 1440, height: 900 } },
  extraHTTPHeaders: { "x-demo-test": "true" },
  permissions: ["clipboard-read", "clipboard-write"],
});
const selected = process.argv.slice(2);
const prior = selected.length
  ? await readFile(join(out, "metadata.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null)
  : null;
const metadata = prior || {
  startedAt: new Date().toISOString(),
  origin,
  viewport: "1440x900",
  scenes: [],
  requests: [],
  errors: [],
  notes: [
    "Real production browser interactions; no response interception.",
    "Fictional campaigns; simulated donations.",
  ],
};
const community = "/communities/a-greener-tomorrow",
  garden = "/fundraisers/grow-a-neighborhood";
const sleep = (p, n) => p.waitForTimeout(n);
async function scene(name, path, fn) {
  if (
    (name === "04-launcher" && !selected.includes(name)) ||
    (selected.length && !selected.includes(name))
  )
    return;
  metadata.scenes = metadata.scenes.filter((s) => s.name !== name);
  const p = await context.newPage();
  const video = p.video();
  const start = Date.now();
  let usable;
  p.on("pageerror", (e) =>
    metadata.errors.push({ scene: name, error: e.message }),
  );
  p.on("response", async (r) => {
    if (["/api/ask", "/api/concierge"].includes(new URL(r.url()).pathname)) {
      const item = {
        scene: name,
        url: new URL(r.url()).pathname,
        status: r.status(),
      };
      metadata.requests.push(item);
      try {
        item.body = await r.text();
      } catch {}
    }
  });
  const item = { name, path };
  metadata.scenes.push(item);
  try {
    await p.goto(path, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await sleep(p, 700);
    usable = (Date.now() - start) / 1000;
    item.usableStartSeconds = usable;
    await fn(p);
    await p.screenshot({ path: join(out, name + ".png") });
  } catch (e) {
    item.error = e.message;
    metadata.errors.push({ scene: name, error: e.message });
    await p
      .screenshot({ path: join(out, name + "-error.png") })
      .catch(() => {});
  } finally {
    await p.close();
    const dest = join(out, name + ".webm");
    await video.saveAs(dest);
    await video.delete();
    item.durationSeconds = Number(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=nw=1:nk=1",
          dest,
        ],
        { encoding: "utf8" },
      ).trim(),
    );
    await writeFile(
      join(out, "metadata.json"),
      JSON.stringify(metadata, null, 2),
    );
    console.log(JSON.stringify(item));
  }
}
await scene("01-discover", community, async (p) => {
  await sleep(p, 10000);
  await p.getByLabel("Search campaigns").scrollIntoViewIfNeeded();
  await sleep(p, 1500);
  await p
    .getByLabel("Search campaigns")
    .pressSequentially("Maya", { delay: 140 });
  await sleep(p, 2000);
  await p
    .getByRole("button", { name: "Food & community", exact: true })
    .click();
  await sleep(p, 2500);
  await p.getByLabel("Search campaigns").fill("");
  await p.locator(".campaign-card").first().scrollIntoViewIfNeeded();
  await sleep(p, 5000);
});
await scene("02-concierge", community, async (p) => {
  await sleep(p, 1200);
  await p.getByRole("button", { name: "Find my cause" }).click();
  const q = p.locator("#concierge-question");
  await q.pressSequentially(
    "I care about community gardens and fresh food. Which cause should I support?",
    { delay: 45 },
  );
  await sleep(p, 900);
  await q.press("Enter");
  await expect(p.locator(".concierge-recommendation").first()).toBeVisible({
    timeout: 45000,
  });
  await sleep(p, 7000);
  await p.locator('.concierge-campaign-title[href="' + garden + '"]').click();
  await sleep(p, 4500);
});
await scene("03-campaign", garden, async (p) => {
  await sleep(p, 6000);
  await p
    .getByRole("button", { name: "Live demo", exact: true })
    .scrollIntoViewIfNeeded();
  await p.getByRole("button", { name: "Live demo", exact: true }).click();
  await p.locator(".live-donation-chart").scrollIntoViewIfNeeded();
  await sleep(p, 13000);
});
await scene("04-launcher", garden, async (p) => {
  await sleep(p, 1500);
  await p
    .getByRole("button", { name: "Ask about this fundraiser", exact: true })
    .click();
  await sleep(p, 3500);
});
await scene("04-chat", garden, async (p) => {
  await sleep(p, 1800);
  await p
    .getByRole("button", { name: "Ask about this fundraiser", exact: true })
    .click();
  await sleep(p, 2000);
  await p
    .getByRole("button", {
      name: "What will the funds be used for?",
      exact: true,
    })
    .click();
  await expect(p.locator(".answer .citation").first()).toBeVisible({
    timeout: 45000,
  });
  await sleep(p, 9000);
  await p.locator(".answer .citation").first().click();
  await sleep(p, 5500);
});
await scene("05-support", garden, async (p) => {
  await sleep(p, 1800);
  await p.getByRole("button", { name: /Make a difference/ }).click();
  await sleep(p, 1300);
  await p.getByLabel("Donation amount").fill("12.50");
  await sleep(p, 1300);
  await p.getByRole("button", { name: /Confirm simulated donation/ }).click();
  await expect(p.getByRole("dialog")).toContainText(
    "$12.50 in simulated support",
  );
  await sleep(p, 3500);
  await p.getByRole("button", { name: "Close dialog" }).click();
  await p
    .locator(".support-panel")
    .getByRole("button", { name: "Share", exact: true })
    .click();
  await sleep(p, 1500);
  await p.getByRole("button", { name: "Copy link" }).click();
  await sleep(p, 2000);
  await p.getByRole("button", { name: "Close dialog" }).click();
  await p
    .getByRole("button", { name: "Feature this cause", exact: true })
    .click();
  await p
    .getByRole("dialog")
    .getByRole("textbox")
    .pressSequentially("Fresh food and shared space, close to home.", {
      delay: 45,
    });
  await p.getByRole("button", { name: "Save to my profile" }).click();
  await sleep(p, 3000);
});
await scene("06-profile", garden, async (p) => {
  await p.locator("#organizer a").click();
  await sleep(p, 3500);
  await p.getByRole("button", { name: "Follow", exact: true }).click();
  await sleep(p, 2500);
  await p
    .getByRole("navigation")
    .getByRole("link", { name: "Following", exact: true })
    .click();
  await p.locator(".campaign-card").scrollIntoViewIfNeeded();
  await sleep(p, 4000);
  await p.getByRole("link", { name: /My profile/ }).click();
  await sleep(p, 5000);
  await p
    .getByText("Contributed $12.50 in simulated support")
    .scrollIntoViewIfNeeded();
  await sleep(p, 4000);
});
await scene("07-watch", community + "/watch", async (p) => {
  const v = p.locator(".watch-item.is-active video");
  await expect
    .poll(() => v.evaluate((e) => e.readyState))
    .toBeGreaterThanOrEqual(2);
  if (await v.evaluate((e) => e.paused))
    await p.getByRole("button", { name: "Play video", exact: true }).click();
  await expect.poll(() => v.evaluate((e) => e.currentTime)).toBeGreaterThan(1);
  await sleep(p, 6500);
  await p.getByRole("button", { name: "Next clip", exact: true }).click();
  await sleep(p, 6500);
  await p
    .locator('.watch-item.is-active a[href^="/fundraisers/"]')
    .first()
    .click();
  await sleep(p, 4000);
});
await scene("08-close", community, async (p) => {
  await sleep(p, 15000);
  await p.mouse.wheel(0, 550);
  await sleep(p, 8000);
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(p, 9000);
});
metadata.finishedAt = new Date().toISOString();
metadata.providerCallsObserved = metadata.requests.length;
await writeFile(join(out, "metadata.json"), JSON.stringify(metadata, null, 2));
await context.storageState({ path: join(out, "state.json") });
await context.close();
await browser.close();
