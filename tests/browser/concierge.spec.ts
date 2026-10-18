import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const community = "/communities/a-greener-tomorrow";
const evidence =
  process.env.CONCIERGE_BROWSER_EVIDENCE_DIR ||
  "test-results/screenshots/concierge";
const answer = {
  requestId: "8687f260-f081-43c5-9af5-6aeef0920ced",
  message: "A neighborhood garden could fit your interests.",
  recommendations: [
    {
      campaignId: "grow-a-neighborhood",
      reason:
        "The campaign brings neighbors together around growing fresh food.",
      sources: [
        {
          id: "story",
          label: "Campaign story",
          href: "/fundraisers/grow-a-neighborhood#story",
        },
      ],
    },
  ],
};
type Payload = {
  question: string;
  history?: { role: string; content: string }[];
};
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Find your kind of good" });
const composer = (page: Page) =>
  page.getByRole("textbox", {
    name: "What kind of difference would you like to make?",
  });
async function open(page: Page) {
  await page.getByRole("button", { name: "Find my cause" }).click();
  await expect(composer(page)).toBeFocused();
}
async function screenshot(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/${name}.png` });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(
    await composer(page).evaluate(
      (el) => el.getBoundingClientRect().bottom <= innerHeight,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ page }) => {
  // Catch every concierge request before any test-specific fixture is installed.
  // No browser check may reach a live provider.
  await page.route("**/api/concierge", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Unconfigured browser fixture" },
    }),
  );
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "No live model calls permitted" },
    }),
  );
});

for (const width of [1440, 390, 320]) {
  test(`discovery concierge entry and conversation fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const requests: Payload[] = [];
    await page.route("**/api/concierge", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: answer });
    });
    await page.goto(community);
    await page
      .getByRole("button", { name: "Find a cause with the concierge" })
      .scrollIntoViewIfNeeded();
    await screenshot(page, `${width}-entry`);
    await page
      .getByRole("button", { name: "Find a cause with the concierge" })
      .click();
    await expect(composer(page)).toBeFocused();
    await dialog(page).getByRole("button", { name: "Close dialog" }).click();
    await expect(
      page.getByRole("button", { name: "Find a cause with the concierge" }),
    ).toBeFocused();
    await open(page);
    await noOverflow(page);
    await screenshot(page, `${width}-intro`);
    await dialog(page)
      .getByRole("button", { name: "I care about climate and nature" })
      .click();
    await expect(dialog(page).locator(".concierge-recommendation")).toHaveCount(
      1,
    );
    expect(requests[0]).toEqual({
      question: "I care about climate and nature",
    });
    await composer(page).fill("Food and neighbors");
    await composer(page).press("Shift+Enter");
    await expect(composer(page)).toHaveValue("Food and neighbors\n");
    expect(requests).toHaveLength(1);
    await composer(page).press("Enter");
    await expect(dialog(page).locator(".chat-answer")).toHaveCount(2);
    expect(requests[1].history?.map((entry) => entry.role)).toEqual([
      "user",
      "assistant",
    ]);
    await noOverflow(page);
    await screenshot(page, `${width}-recommendations`);
    await dialog(page)
      .getByRole("link", { name: "Campaign story", exact: true })
      .last()
      .click();
    await expect(page).toHaveURL(/\/fundraisers\/grow-a-neighborhood#story$/);
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("#story")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("followups send at most two completed pairs and campaign navigation clears context", async ({
  page,
}) => {
  const requests: Payload[] = [];
  await page.route("**/api/concierge", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: answer });
  });
  await page.goto(community);
  await open(page);
  for (let i = 0; i < 5; i++) {
    await composer(page).fill(`Question ${i}`);
    await composer(page).press("Enter");
    await expect(dialog(page).locator(".chat-answer")).toHaveCount(i + 1);
  }
  expect(requests.map((request) => request.history?.length || 0)).toEqual([
    0, 2, 4, 4, 4,
  ]);
  expect(
    requests[4].history
      ?.filter((entry) => entry.role === "user")
      .map((entry) => entry.content),
  ).toEqual(["Question 2", "Question 3"]);
  await dialog(page)
    .getByRole("link", { name: "Explore & support" })
    .last()
    .click();
  await expect(page).toHaveURL(/\/fundraisers\/grow-a-neighborhood$/);
  await page.goto(community);
  await open(page);
  await expect(
    dialog(page).getByText("What matters to you?", { exact: true }),
  ).toBeVisible();
  await composer(page).fill("Fresh start");
  await composer(page).press("Enter");
  await expect(dialog(page).locator(".chat-answer")).toHaveCount(1);
  expect(requests.at(-1)?.history).toBeUndefined();
  await dialog(page).getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("tab", { name: /Following/ }).click();
  await expect(page.getByRole("button", { name: "Find my cause" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Find a cause with the concierge" }),
  ).toHaveCount(0);
});

test("error retry keeps the draft and one user turn; no match stays honest", async ({
  page,
}) => {
  const requests: Payload[] = [];
  await page.route("**/api/concierge", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill(
      requests.length === 1
        ? {
            status: 503,
            json: { error: "The guide is temporarily unavailable." },
          }
        : {
            json: {
              ...answer,
              message:
                "None of these four campaigns matches animal rescue. Would a neighborhood project interest you?",
              recommendations: [],
            },
          },
    );
  });
  await page.goto(community);
  await open(page);
  await composer(page).fill("Help animals");
  await composer(page).press("Enter");
  await expect(dialog(page).getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await composer(page).fill("A draft for later");
  await screenshot(page, "desktop-error-draft");
  await dialog(page).getByRole("button", { name: "Try again" }).click();
  await expect(dialog(page).locator(".chat-answer")).toContainText(
    "None of these four campaigns",
  );
  await expect(dialog(page).locator(".question-bubble")).toHaveCount(1);
  await expect(composer(page)).toHaveValue("A draft for later");
  await expect(dialog(page).locator(".concierge-recommendation")).toHaveCount(
    0,
  );
  expect(requests).toEqual([
    { question: "Help animals" },
    { question: "Help animals" },
  ]);
  await screenshot(page, "desktop-no-match");
});

test("closing aborts a pending turn, restores launcher focus, and reopens empty", async ({
  page,
}) => {
  const requests: Payload[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/concierge", async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) await held;
    await route.fulfill({ json: answer }).catch(() => {});
  });
  let aborted = false;
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/concierge")) aborted = true;
  });
  await page.goto(community);
  await open(page);
  await composer(page).fill("Slow question");
  await composer(page).press("Enter");
  await expect(dialog(page).getByRole("status")).toContainText(
    "Looking through",
  );
  await screenshot(page, "desktop-pending");
  await composer(page).press("Enter");
  expect(requests).toHaveLength(1);
  await dialog(page).getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("button", { name: "Find my cause" }),
  ).toBeFocused();
  await expect.poll(() => aborted).toBe(true);
  release();
  await open(page);
  await expect(dialog(page).locator(".question-bubble")).toHaveCount(0);
  await composer(page).fill("New question");
  await composer(page).press("Enter");
  await expect(dialog(page).locator(".chat-answer")).toHaveCount(1);
  expect(requests[1]).toEqual({ question: "New question" });
});

test("malformed catalog reply fails safely with ordinary catalog fallback", async ({
  page,
}) => {
  await page.route("**/api/concierge", (route) =>
    route.fulfill({
      json: {
        ...answer,
        recommendations: [
          {
            ...answer.recommendations[0],
            campaignId: "invented-campaign",
            sources: [
              { id: "story", label: "Unsafe", href: "https://example.invalid" },
            ],
          },
        ],
      },
    }),
  );
  await page.goto(community);
  await open(page);
  await composer(page).fill("Find something");
  await composer(page).press("Enter");
  await expect(dialog(page).getByRole("alert")).toContainText(
    "couldn’t verify",
  );
  await expect(dialog(page).locator(".concierge-recommendation")).toHaveCount(
    0,
  );
  await expect(
    dialog(page).locator('a[href="https://example.invalid"]'),
  ).toHaveCount(0);
  await dialog(page)
    .getByText("Browse campaign information instead", { exact: true })
    .click();
  await expect(dialog(page).locator(".concierge-fallback a")).toHaveCount(4);
  await screenshot(page, "desktop-safe-failure");
});

test("concierge respects IME and bounds a stalled request", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/concierge", async () => {
    calls++;
  });
  await page.goto(community);
  await open(page);
  await composer(page).fill("Food and neighbors");
  await composer(page).evaluate((el) =>
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        isComposing: true,
      }),
    ),
  );
  expect(calls).toBe(0);
  await composer(page).press("Enter");
  await expect(dialog(page).getByRole("status")).toContainText(
    "Looking through",
  );
  await page.clock.fastForward(20000);
  await expect(dialog(page).getByRole("alert")).toContainText("took too long");
  await expect(
    dialog(page).getByRole("button", { name: "Try again", exact: true }),
  ).toBeEnabled();
  expect(calls).toBe(1);
});
