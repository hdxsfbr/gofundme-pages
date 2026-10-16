import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { join } from "node:path";
const origin = process.env.BASE_URL || "http://127.0.0.1:3000";
const startedAt = new Date().toISOString();
const outputDirectory = process.env.DEMO_EVIDENCE_DIR || "docs/evidence";
const output = (name) => join(outputDirectory, name);
const scenes = [];
const answers = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
await mkdir(output("recordings"), { recursive: true });
const context = await browser.newContext({
  baseURL: origin,
  viewport: { width: 1440, height: 1000 },
  recordVideo: {
    dir: output("recordings"),
    size: { width: 1440, height: 1000 },
  },
  extraHTTPHeaders: { "x-demo-test": "true" },
  permissions: ["clipboard-read", "clipboard-write"],
});
const videoStartedAt = Date.now();
const page = await context.newPage();
const video = page.video();
const liveResponses = [];
page.on("response", async (response) => {
  if (new URL(response.url()).pathname === "/api/ask")
    liveResponses.push({
      status: response.status(),
      time: new Date().toISOString(),
    });
});
const pause = (ms = 1800) => page.waitForTimeout(ms);
const scene = (name) =>
  scenes.push({ name, seconds: (Date.now() - videoStartedAt) / 1000 });
function engagement(to = new Date().toISOString()) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--env-file-if-exists=.env.local",
        "--import",
        "tsx",
        "scripts/report.ts",
        "--from",
        startedAt,
        "--to",
        to,
        "--include-test",
      ],
      { encoding: "utf8" },
    ),
  );
}
// Observe real transport and visible partials without altering the UI response.
// Only event types, timing, and counts are retained; no credentials or cookies.
await page.addInitScript(() => {
  window.__demoStreams = [];
  const original = window.fetch.bind(window);
  new MutationObserver(() => {
    const entry = window.__demoStreams.at(-1);
    const partial = document.querySelector(".chat-streaming");
    if (entry && partial && entry.visiblePartialAtMs === undefined)
      entry.visiblePartialAtMs = performance.now() - entry.started;
  }).observe(document, { childList: true, subtree: true });
  window.fetch = async (...args) => {
    const started = performance.now();
    const response = await original(...args);
    if (
      new URL(response.url).pathname === "/api/ask" &&
      response.headers.get("content-type")?.includes("text/event-stream")
    ) {
      const entry = {
        started,
        startedEpochMs: performance.timeOrigin + started,
        events: [],
        completed: false,
      };
      window.__demoStreams.push(entry);
      void (async () => {
        const reader = response.clone().body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            const receivedAt = performance.now() - started;
            buffer += decoder.decode(chunk.value, { stream: true });
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop();
            for (const frame of frames) {
              const type = frame.match(/^event:\s*(.+)$/m)?.[1];
              if (type)
                entry.events.push({
                  type,
                  elapsedMs: receivedAt,
                });
            }
          }
          entry.completed = true;
        } catch {
          entry.observationError = "Transport observer interrupted";
        } finally {
          reader.releaseLock();
        }
      })();
    }
    return response;
  };
});
async function askLive(
  name,
  submit,
  answerCount,
  supported,
  abstained,
  verify,
) {
  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/ask",
    { timeout: 21000 },
  );
  await submit();
  await expect(
    page.getByRole("dialog").getByLabel("Your question"),
  ).toHaveValue("");
  const response = await responsePromise;
  assert.equal(response.status(), 200, "Live Ask succeeds");
  assert.ok(
    response.headers()["content-type"]?.includes("text/event-stream"),
    "Live Ask uses SSE",
  );
  const frames = (await response.text())
    .split(/\r?\n\r?\n/)
    .filter((frame) => frame.trim())
    .map((frame) => ({
      type: frame.match(/^event:\s*(.+)$/m)?.[1],
      data: JSON.parse(
        frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n"),
      ),
    }));
  assert.ok(!frames.some((frame) => frame.type === "error"), "No stream error");
  const done = frames.find((frame) => frame.type === "done");
  assert.ok(done, "Validated final done frame arrived");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".answer")).toHaveCount(answerCount, {
    timeout: 21000,
  });
  await expect(dialog.locator(".chat-streaming")).toHaveCount(0);
  await expect(dialog.getByRole("status")).toHaveCount(0);
  const rendered = dialog.locator(".answer").last();
  const text = await rendered.innerText();
  await verify(done.data, text, rendered);
  await expect
    .poll(
      async () => {
        const report = engagement();
        return {
          supported: report.ai.supported,
          abstained: report.ai.abstained,
          failed: report.ai.failed,
          pending: report.outbox.pending,
        };
      },
      { timeout: 10000 },
    )
    .toEqual({ supported, abstained, failed: 0, pending: 0 });
  await expect
    .poll(() => page.evaluate(() => window.__demoStreams.at(-1)?.completed))
    .toBe(true);
  const stream = await page.evaluate(() => window.__demoStreams.at(-1));
  const firstPartial = stream.events.find((event) => event.type === "partial");
  const completion = stream.events.find((event) => event.type === "done");
  const uniqueSources = new Set(
    done.data.claims.flatMap((claim) =>
      claim.citations.map((source) => source.id),
    ),
  );
  await expect(rendered.locator(".citation")).toHaveCount(uniqueSources.size);
  answers.push({
    name,
    status: done.data.status,
    requestId: done.data.requestId,
    historyMessages:
      response.request().postDataJSON().history?.messages.length || 0,
    claimCount: done.data.claims.length,
    sourceIds: [...uniqueSources],
    transport: "live server/provider SSE; no interception",
    partialBeforeCompletion:
      !!firstPartial &&
      !!completion &&
      firstPartial.elapsedMs < completion.elapsedMs,
    visiblePartialBeforeCompletion:
      stream.visiblePartialAtMs !== undefined &&
      stream.visiblePartialAtMs < completion?.elapsedMs,
    stream: {
      events: stream.events,
      completed: stream.completed,
      visiblePartialAtMs: stream.visiblePartialAtMs,
    },
    visiblePartialVideoSeconds:
      stream.visiblePartialAtMs === undefined
        ? null
        : (stream.startedEpochMs + stream.visiblePartialAtMs - videoStartedAt) /
          1000,
  });
  scene(name);
}

try {
  await page.goto("/communities/a-greener-tomorrow");
  scene("community-discovery");
  await pause(2500);
  await page.getByLabel("Search campaigns").fill("Maya");
  await page
    .getByRole("button", { name: "Food & community", exact: true })
    .click();
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await pause();
  await page.locator(".card-image-link").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "grow something good",
  );
  await pause(2500);
  await page.locator("#organizer a").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maya Chen");
  scene("organizer-profile");
  await pause();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await pause();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Following" })
    .click();
  await expect(page).toHaveURL(
    /\/communities\/a-greener-tomorrow\?view=following/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "tomorrow.",
  );
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await page.locator(".campaign-card").scrollIntoViewIfNeeded();
  scene("following-discovery");
  await pause();
  await page.locator(".card-image-link").click();
  console.log("Recording source-linked live AI.");
  await page.getByRole("button", { name: /A little clarity/ }).click();
  await askLive(
    "purpose-answer-and-source-footer",
    () =>
      page
        .getByRole("button", {
          name: "What will the funds be used for?",
          exact: true,
        })
        .click(),
    1,
    1,
    0,
    async (answer, text, rendered) => {
      assert.equal(answer.status, "supported");
      await expect(rendered.locator(".citation").first()).toBeVisible();
      assert.ok(text.length > 40);
    },
  );
  await pause(4000);
  await page.locator(".answer .citation").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await pause(2500);
  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await page.getByText("View the dated funding data", { exact: true }).click();
  await pause();
  await page.getByRole("button", { name: /Make a difference/ }).click();
  await page.getByLabel("Donation amount").fill("12.50");
  await pause();
  await page
    .getByRole("button", { name: /Confirm simulated donation/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "$12.50 in simulated support",
  );
  scene("simulated-donation-confirmation");
  await pause(2500);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".support-panel .funding-line strong")).toHaveText(
    "$11,862.50",
  );
  await page.getByRole("button", { name: /A little clarity/ }).click();
  const composer = page.getByRole("dialog").getByLabel("Your question");
  await composer.fill(
    "How much has been raised, how many contributions are there, and how much is still needed?",
  );
  await askLive(
    "fresh-funding-after-donation",
    () => composer.press("Enter"),
    1,
    2,
    0,
    async (answer, text) => {
      assert.equal(answer.status, "supported");
      assert.ok(text.includes("$11,862.50"));
      assert.ok(text.includes("87"));
      assert.ok(text.includes("$3,137.50"));
    },
  );
  await pause(2500);
  await composer.fill("So what is the average contribution?");
  await askLive(
    "contextual-average-follow-up",
    () => composer.press("Enter"),
    2,
    3,
    0,
    async (answer, text) => {
      assert.equal(answer.status, "supported");
      assert.ok(text.includes("$136.35"));
      assert.ok(
        answer.claims.some((claim) =>
          claim.citations.some((source) => source.id === "funding"),
        ),
      );
    },
  );
  assert.equal(
    answers.at(-1).historyMessages,
    2,
    "Follow-up includes one completed prior exchange",
  );
  await pause(3500);
  await page
    .locator(".answer")
    .last()
    .getByRole("button", { name: /Current demo funding|View funding source/ })
    .first()
    .click();
  await pause();
  await page
    .getByRole("button", { name: "Feature this cause", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .fill("Fresh food and shared space, close to home.");
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(".support-panel")
    .getByRole("button", { name: "Share", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  await pause();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: /My profile/ }).click();
  await expect(
    page.getByText("Contributed $12.50 in simulated support"),
  ).toBeVisible();
  scene("private-supporter-profile");
  await pause(3000);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Discover" })
    .click();
  await page
    .locator('.card-image-link[href="/fundraisers/roots-for-the-future"]')
    .click();
  await page.getByRole("button", { name: /A little clarity/ }).click();
  await page
    .getByLabel("Your question")
    .fill("What is the itemized budget? Give each cost.");
  await askLive(
    "explicit-missing-budget",
    () => page.getByLabel("Your question").press("Enter"),
    1,
    3,
    1,
    async (answer, text) => {
      assert.equal(answer.status, "missing");
      assert.ok(/not|no |missing|unavailable/i.test(text));
    },
  );
  await pause(3500);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await pause(700);
  const endedAt = new Date().toISOString();
  const report = engagement(endedAt);
  if (
    report.donations.completedAttempts !== 1 ||
    report.donations.completedCents !== 1250 ||
    report.ai.supported !== 3 ||
    report.ai.abstained !== 1 ||
    report.ai.failed !== 0 ||
    report.ai.submittedRequests !== 4 ||
    liveResponses.length !== 4 ||
    report.follows.savedFollowEvents !== 1 ||
    report.ai.citationOpens !== 2 ||
    report.sharing.share_copied.events !== 1 ||
    report.ai.pendingSubmittedRequests !== 0 ||
    report.outbox.pending !== 0
  )
    throw new Error("Recorded report does not match demonstrated actions");
  await writeFile(
    output("demo-engagement.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  const rows = [
    [
      "Saved simulated donations",
      `${report.donations.completedAttempts} / ${report.donations.startedAttempts} started · $${(report.donations.completedCents / 100).toFixed(2)}`,
    ],
    [
      "Observed visitors / sessions",
      `${report.counts.pageVisitors} / ${report.counts.activeSessions}`,
    ],
    ["Saved follows", report.follows.savedFollowEvents],
    [
      "Live AI answers",
      `${report.ai.supported} supported · ${report.ai.abstained} missing-information · ${report.ai.failed} failures`,
    ],
    ["Source citations opened", report.ai.citationOpens],
    ["Copied public links", report.sharing.share_copied.events],
    ["Pending durable events", report.outbox.pending],
  ];
  await page.setContent(
    `<html lang="en"><style>body{font:24px system-ui;background:#fbfaf6;color:#202b27;margin:90px;line-height:1.5}h1{font-size:52px;letter-spacing:-2px}small{font-size:19px}table{border-collapse:collapse;width:100%}td{padding:18px 10px;border-bottom:1px solid #ddd}td:last-child{text-align:right;color:#245c43;font-weight:600}</style><p>RECORDED DEMO · MEASUREMENT EVIDENCE</p><h1>What this journey actually recorded.</h1><table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table><p><small>Actual PostgreSQL report for this recording's UTC time window.<br>One automated recording visitor; report includes all sessions in the displayed time window.<br>Donations are simulated. No engagement uplift or retention claim.<br>Reproduce with npm run report -- --from … --to … --include-test</small></p></html>`,
  );
  scene("actual-measurement-report");
  await pause(6000);
  await writeFile(
    output("demo-recording.json"),
    JSON.stringify(
      {
        startedAt,
        endedAt,
        origin,
        buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
        viewport: "1440x1000",
        browser: browser.version(),
        runtime: "Live OpenAI Responses requests, no intercepted AI answers",
        liveResponses,
        providerCalls: liveResponses.length,
        timingSemantics:
          "Each reader.read arrival samples one elapsed time shared by all frames in that read; visible partial timing comes from a DOM MutationObserver.",
        reportPopulation: {
          visitors: report.counts.pageVisitors,
          sessions: report.counts.activeSessions,
          scope: report.population,
        },
        answers,
        scenes,
        outputDirectory,
        recordedUntil: new Date().toISOString(),
        privacy:
          "x-demo-test tagged isolated new visitor; no credentials or cookie values captured in artifact metadata",
        report: "demo-engagement.json",
        notes:
          "Silent real-browser recording. Final measurement scene renders the actual CLI report captured for this time window; it is not an application dashboard.",
      },
      null,
      2,
    ) + "\n",
  );
  await context.close();
  await video.saveAs(output("demo.webm"));
  await video.delete();
  console.log(`Recorded ${output("demo.webm")}`);
} finally {
  await browser.close();
}
