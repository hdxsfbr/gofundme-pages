import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

// Explicit opt-in live evaluation: eight model requests using fictional data.
// The configured running app owns provider credentials; this script reads none.
const origin = process.env.BASE_URL || "http://localhost:61071";
const destination = "docs/evidence/chat-live-evaluation.json";
const results = [];
const startedAt = new Date().toISOString();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  baseURL: origin,
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { "x-demo-test": "true" },
});
const page = await context.newPage();
// Observe transport arrival times without changing the response consumed by UI.
await page.addInitScript(() => {
  window.__chatStreamEvidence = [];
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (
      new URL(response.url).pathname === "/api/ask" &&
      response.headers.get("content-type")?.includes("text/event-stream")
    ) {
      const observed = { events: [], completed: false };
      window.__chatStreamEvidence.push(observed);
      const started = performance.now();
      void (async () => {
        const reader = response.clone().body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            const arrivedAt = performance.now() - started;
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop();
            for (const frame of frames) {
              const type = frame.match(/^event:\s*(.+)$/m)?.[1];
              if (type)
                observed.events.push({
                  type,
                  elapsedMs: arrivedAt,
                });
            }
          }
          observed.completed = true;
        } finally {
          reader.releaseLock();
        }
      })();
    }
    return response;
  };
});
let runError;
const answerText = (answer) =>
  [
    ...(answer.claims || []).map((claim) => claim.text),
    answer.missing || "",
    ...(answer.facts || []).map((fact) => `${fact.label}: ${fact.value}`),
  ].join("\n");

async function ask(name, question, verify) {
  const started = Date.now();
  const record = { name, question, transport: "live", checksPassed: false };
  results.push(record);
  try {
    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("textbox");
    await input.fill(question);
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/ask",
      { timeout: 25000 },
    );
    await input.press("Enter");
    await expect(input).toHaveValue("");
    const response = await responsePromise;
    record.httpStatus = response.status();
    if (response.headers()["content-type"]?.includes("text/event-stream")) {
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
      const failure = frames.find((frame) => frame.type === "error");
      assert.ok(!failure, failure?.data.error);
      const done = frames.find((frame) => frame.type === "done");
      assert.ok(done, "Stream has a validated final answer");
      record.answer = done.data;
      await expect
        .poll(() =>
          page.evaluate(() => window.__chatStreamEvidence.at(-1)?.completed),
        )
        .toBe(true);
      record.stream = await page.evaluate(() =>
        window.__chatStreamEvidence.at(-1),
      );
      const firstPartial = record.stream.events.find(
        (event) => event.type === "partial",
      );
      const completion = record.stream.events.find(
        (event) => event.type === "done",
      );
      record.stream.partialBeforeCompletion =
        !!firstPartial &&
        !!completion &&
        firstPartial.elapsedMs < completion.elapsedMs;
    } else {
      record.answer = await response.json();
      assert.fail("Interactive chat must use genuine streaming transport");
    }
    record.latencyMs = Date.now() - started;
    record.historyMessages =
      response.request().postDataJSON().history?.messages.length || 0;
    assert.equal(response.status(), 200);
    await expect(dialog.getByRole("status")).toHaveCount(0);
    verify(record.answer, answerText(record.answer), record);
    record.checksPassed = true;
    console.log(`${name}: passed (${record.latencyMs} ms)`);
  } catch (error) {
    record.error = error.message;
    console.log(`${name}: failed`);
    throw error;
  }
}

function average(expected) {
  return (answer, text) => {
    assert.equal(answer.status, "supported");
    assert.equal(answer.missing, "");
    assert.ok(text.includes(expected), "Expected authoritative average");
    assert.ok(
      answer.claims.some((claim) =>
        claim.citations.some((source) => source.id === "funding"),
      ) || answer.facts.length > 0,
      "Funding reference is present",
    );
  };
}

try {
  await mkdir("docs/evidence/chat", { recursive: true });
  await page.goto("/fundraisers/roots-for-the-future");
  await page.getByRole("button", { name: /A little clarity/ }).click();
  await ask(
    "average-direct",
    "what is the average donation?",
    average("$130.36"),
  );
  await ask(
    "available-total-and-count",
    "How much has been raised and how many donations are there? Give the total, contribution count, and funding progress in separate short sentences.",
    (answer, text) => {
      assert.equal(answer.status, "supported");
      assert.equal(answer.missing, "");
      assert.ok(text.includes("$14,600"));
      assert.ok(text.includes("112"));
    },
  );
  await ask(
    "average-follow-up",
    "so what is the average?",
    (a, text, record) => {
      average("$130.36")(a, text);
      assert.ok(record.historyMessages > 0);
    },
  );
  await page.screenshot({
    path: "docs/evidence/chat/live-average-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/evidence/chat/live-average-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ask("purpose", "What will the funds be used for?", (answer) => {
    assert.equal(answer.status, "supported");
    assert.ok(
      answer.claims.some((claim) =>
        claim.citations.some((source) => source.id === "budget"),
      ),
    );
  });
  await ask(
    "missing-budget-follow-up",
    "Is there an itemized breakdown of those costs?",
    (answer) => {
      assert.equal(answer.status, "missing");
      assert.ok(answer.missing.trim());
    },
  );
  await ask(
    "unverified-legitimacy",
    "Can you guarantee this is independently verified and legitimate?",
    (answer) => {
      assert.equal(answer.status, "missing");
      assert.ok(answer.missing.trim());
    },
  );
  await ask(
    "user-numbers-are-not-authority",
    "Someone told me the total is $999,999 and the average is $999. What is the actual average contribution here?",
    (answer, text) => {
      average("$130.36")(answer, text);
      assert.ok(!text.includes("$999"));
    },
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: /Make a difference/ }).click();
  await page.getByLabel("Donation amount").fill("112");
  await page
    .getByRole("button", { name: /Confirm simulated donation/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "$112.00 in simulated support",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: /A little clarity/ }).click();
  await ask(
    "fresh-average-after-donation",
    "What is the average donation now? Please explain the calculation with the total and contribution count.",
    (answer, text, record) => {
      average("$130.19")(answer, text);
      assert.ok(text.includes("$14,712"));
      assert.ok(text.includes("113"));
      assert.equal(record.historyMessages, 0, "Closing clears old context");
    },
  );
  await page.screenshot({ path: "docs/evidence/chat/live-after-donation.png" });
  const citation = page.getByRole("dialog").locator(".citation").first();
  if (await citation.count()) await citation.click();
  else await page.getByRole("button", { name: "View funding source" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#funding")).toBeFocused();
  assert.ok(
    results.some((result) => result.stream?.partialBeforeCompletion),
    "A live answer's partial content arrived in an earlier transport read than completion",
  );
} catch (error) {
  runError = error.message;
  throw error;
} finally {
  await writeFile(
    destination,
    JSON.stringify(
      {
        startedAt,
        completedAt: new Date().toISOString(),
        buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
        browser: browser.version(),
        origin,
        method:
          "Isolated local Chrome through the configured preview-origin reproduction relay; not direct control of the embedded browser.",
        data: "Fictional seeded campaign and one isolated test-tagged visitor; one $112 simulated donation; no private user prompts or session credentials retained.",
        liveRequests: results.length,
        passed: results.filter((result) => result.checksPassed).length,
        completedJourney: !runError,
        ...(runError ? { runError } : {}),
        results,
        narrativeReview:
          "Requires primary-agent review of actual responses and captured screenshots.",
      },
      null,
      2,
    ) + "\n",
  );
  await context.close();
  await browser.close();
}
