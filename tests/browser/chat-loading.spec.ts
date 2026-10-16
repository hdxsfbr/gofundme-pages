import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fundraiser } from "./helpers";

// Discover the current production assets by their module/style contents. Names
// intentionally follow each build rather than depending on a retained chunk hash.
function chatAssets(extension: ".js" | ".css") {
  const root = ".next/static/chunks";
  const paths = readdirSync(root, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => entry.endsWith(extension))
    .filter((entry) =>
      readFileSync(join(root, entry), "utf8").includes("chat-composer"),
    )
    .map((entry) => "/_next/static/chunks/" + entry);
  expect(paths.length, "Built Ask assets were discovered").toBeGreaterThan(0);
  return new Set(paths);
}
async function blockPaidCalls(page: Page) {
  const requests: string[] = [];
  await page.route("**/api/ask", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      status: 503,
      json: { error: "Controlled fixture: no paid calls in loader checks." },
    });
  });
  return requests;
}
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
const dialogFor = (page: Page) =>
  page.getByRole("dialog", { name: "Ask about this fundraiser" });
const entryFor = (page: Page) =>
  page.getByRole("button", { name: /A little clarity/ });

test("chat JavaScript and styles stay lazy; delayed opening has an accessible cancellable loading dialog and starts no model request", async ({
  page,
}) => {
  const scripts = chatAssets(".js");
  const styles = chatAssets(".css");
  const seen: string[] = [];
  const calls = await blockPaidCalls(page);
  const gate = deferred();
  const requested = deferred();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (scripts.has(path) || styles.has(path)) seen.push(path);
  });
  await page.route(
    (url) => scripts.has(url.pathname),
    async (route) => {
      requested.release();
      await gate.promise;
      await route.continue().catch(() => {});
    },
  );
  try {
    const initial = await page.goto("/profiles/maya-chen");
    expect(await initial!.text()).not.toContain("chat-composer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Maya Chen",
    );
    expect(seen).toEqual([]);
    await page.locator(".card-image-link").click();
    await expect(page).toHaveURL(new RegExp(fundraiser + "$"));
    expect(seen).toEqual([]);
    await entryFor(page).click();
    await requested.promise;
    const dialog = dialogFor(page);
    await expect(dialog.getByRole("status")).toHaveText(
      "Opening the fundraiser assistant…",
    );
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeFocused();
    expect(calls).toEqual([]);
    gate.release();
    await expect(dialog.getByLabel("Your question")).toBeFocused();
    await expect(dialog.getByRole("status")).toHaveCount(0);
    expect(seen.some((path) => styles.has(path))).toBe(true);
    expect(
      await dialog.evaluate((node) => getComputedStyle(node).overflow),
    ).toBe("hidden");
    expect(calls).toEqual([]);
  } finally {
    gate.release();
  }
});

test("a failed chat chunk offers retry and a successful retry opens the composer without calling the model", async ({
  page,
}) => {
  const scripts = chatAssets(".js");
  const calls = await blockPaidCalls(page);
  let attempts = 0;
  let unavailable = true;
  await page.route(
    (url) => scripts.has(url.pathname),
    async (route) => {
      attempts++;
      if (unavailable) await route.abort("failed");
      else await route.continue();
    },
  );
  await page.goto(fundraiser);
  await entryFor(page).click();
  const dialog = dialogFor(page);
  await expect(dialog.getByRole("alert")).toContainText("could not open");
  await expect(dialog.getByRole("status")).toHaveCount(0);
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  expect(calls).toEqual([]);
  unavailable = false;
  await dialog.getByRole("button", { name: "Retry opening assistant" }).click();
  await expect(dialog.getByLabel("Your question")).toBeFocused();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(calls).toEqual([]);
});

test("closing before the chunk arrives restores focus and does not reopen stale chat; deliberate reopening works", async ({
  page,
}) => {
  const scripts = chatAssets(".js");
  const calls = await blockPaidCalls(page);
  const gate = deferred();
  const requested = deferred();
  const delivered = deferred();
  await page.route(
    (url) => scripts.has(url.pathname),
    async (route) => {
      requested.release();
      await gate.promise;
      await route.continue().catch(() => {});
      delivered.release();
    },
  );
  try {
    await page.goto(fundraiser);
    await entryFor(page).click();
    await requested.promise;
    await expect(dialogFor(page).getByRole("status")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogFor(page)).toHaveCount(0);
    await expect(entryFor(page)).toBeFocused();
    gate.release();
    await delivered.promise;
    // Await actual script execution, not an arbitrary sleep after response arrival.
    await page.waitForFunction(
      (paths) =>
        performance
          .getEntriesByType("resource")
          .some((entry) => paths.includes(new URL(entry.name).pathname)),
      [...scripts],
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(dialogFor(page)).toHaveCount(0);
    expect(calls).toEqual([]);
    await entryFor(page).click();
    await expect(dialogFor(page).getByLabel("Your question")).toBeFocused();
    await expect(dialogFor(page).locator(".chat-turn")).toHaveCount(0);
    expect(calls).toEqual([]);
  } finally {
    gate.release();
  }
});
