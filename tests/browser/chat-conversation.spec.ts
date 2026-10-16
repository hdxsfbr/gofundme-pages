import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { answerFixture, askOpen, fundraiser, noOverflow } from "./helpers";

type Payload = {
  campaignId: string;
  question: string;
  history?: {
    campaignId: string;
    messages: { role: string; content: string }[];
  };
};
const chatEvidenceDirectory =
  process.env.CHAT_EVIDENCE_DIR || "docs/evidence/chat";
const fixture = (text: string) => ({
  ...answerFixture,
  claims: [{ ...answerFixture.claims[0], text }],
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Controlled fixture: no live model calls permitted." },
    }),
  );
});

test("Enter immediately sends and clears a user turn; failed retry preserves a later draft without duplicate messages", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const payloads: Payload[] = [];
  await page.route("**/api/ask", async (route) => {
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 1) {
      await gate;
      await route.fulfill({
        status: 503,
        json: { error: "Controlled fixture: please retry this answer." },
      });
    } else await route.fulfill({ json: answerFixture });
  });
  try {
    await page.goto(fundraiser);
    const dialog = await askOpen(page);
    const input = dialog.getByLabel("Your question");
    await expect(input).toBeFocused();
    await input.fill("How will the garden help neighbors?");
    await input.press("Enter");
    await expect.poll(() => payloads.length).toBe(1);
    await expect(input).toHaveValue("");
    await expect(dialog.locator(".chat-user")).toHaveCount(1);
    await expect(dialog.locator(".chat-user")).toContainText(
      "How will the garden help neighbors?",
    );
    await expect(dialog.getByRole("status")).toBeVisible();
    await expect(dialog.locator(".suggestions")).toHaveCount(0);
    await input.fill("A later draft I am still writing.");
    release();
    await expect(dialog.getByRole("alert")).toContainText("please retry");
    await expect(input).toHaveValue("A later draft I am still writing.");
    await dialog.getByRole("button", { name: "Retry answer" }).click();
    await expect(dialog.locator(".answer")).toHaveCount(1);
    await expect(dialog.locator(".chat-user")).toHaveCount(1);
    await expect(input).toHaveValue("A later draft I am still writing.");
    expect(payloads.map((payload) => payload.question)).toEqual([
      "How will the garden help neighbors?",
      "How will the garden help neighbors?",
    ]);
    expect(payloads.every((payload) => !payload.history)).toBe(true);
    await input.press("Enter");
    await expect(dialog.locator(".chat-user")).toHaveCount(2);
    await expect(input).toHaveValue("");
    await expect.poll(() => payloads.length).toBe(3);
    expect(payloads[2].question).toBe("A later draft I am still writing.");
  } finally {
    release();
  }
});

test("Shift+Enter inserts a newline, IME and repeated Enter do not send, and normal Enter sends once", async ({
  page,
}) => {
  const payloads: Payload[] = [];
  await page.route("**/api/ask", (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({ json: answerFixture });
  });
  await page.goto(fundraiser);
  const dialog = await askOpen(page);
  const input = dialog.getByLabel("Your question");
  await input.fill("First line");
  await input.press("Shift+Enter");
  await page.keyboard.insertText("Second line");
  await expect(input).toHaveValue("First line\nSecond line");
  expect(payloads).toHaveLength(0);
  await input.dispatchEvent("compositionstart", { data: "fixture" });
  await input.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    isComposing: true,
    keyCode: 229,
  });
  await input.dispatchEvent("compositionend", { data: "fixture" });
  await input.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    repeat: true,
  });
  expect(payloads).toHaveLength(0);
  await input.press("Enter");
  await expect(dialog.locator(".answer")).toHaveCount(1);
  expect(payloads).toHaveLength(1);
  expect(payloads[0].question).toBe("First line\nSecond line");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});

test("suggestion sends clear the composer and preserve a new draft while its answer arrives", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received: Payload | undefined;
  await page.route("**/api/ask", async (route) => {
    received = route.request().postDataJSON();
    await gate;
    await route.fulfill({ json: answerFixture });
  });
  try {
    await page.goto(fundraiser);
    const dialog = await askOpen(page);
    const input = dialog.getByLabel("Your question");
    await input.fill("An unsent earlier draft");
    await dialog
      .getByRole("button", { name: "What is the latest update?" })
      .click();
    await expect(dialog.getByRole("status")).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(dialog.locator(".chat-user")).toContainText(
      "What is the latest update?",
    );
    expect(received?.question).toBe("What is the latest update?");
    await input.fill("My next question is still a draft.");
    release();
    await expect(dialog.locator(".answer")).toHaveCount(1);
    await expect(input).toHaveValue("My next question is still a draft.");
    await expect(input).toBeFocused();
  } finally {
    release();
  }
});

test("follow-up payloads contain only the last two completed prior pairs; failed-turn retry excludes future turns", async ({
  page,
}) => {
  const payloads: Payload[] = [];
  let failed = false;
  await page.route("**/api/ask", (route) => {
    const payload = route.request().postDataJSON() as Payload;
    payloads.push(payload);
    if (payload.question === "Question 2" && !failed) {
      failed = true;
      return route.fulfill({
        status: 503,
        json: { error: "Controlled fixture: second turn failed." },
      });
    }
    return route.fulfill({
      json: fixture(
        "Controlled conversation fixture answer to " + payload.question,
      ),
    });
  });
  await page.goto(fundraiser);
  const dialog = await askOpen(page);
  const input = dialog.getByLabel("Your question");
  for (let index = 1; index <= 5; index++) {
    await input.fill("Question " + index);
    await input.press("Enter");
    if (index === 2)
      await expect(dialog.getByRole("alert")).toContainText(
        "second turn failed",
      );
    else
      await expect(dialog.locator(".answer")).toHaveCount(
        index > 2 ? index - 1 : index,
      );
  }
  expect(payloads[0].history).toBeUndefined();
  expect(
    payloads[2].history?.messages
      .filter((message) => message.role === "user")
      .map((message) => message.content),
  ).toEqual(["Question 1"]);
  expect(payloads[4].history?.campaignId).toBe("grow-a-neighborhood");
  expect(
    payloads[4].history?.messages.map((message) => message.content),
  ).toEqual([
    "Question 3",
    "Controlled conversation fixture answer to Question 3",
    "Question 4",
    "Controlled conversation fixture answer to Question 4",
  ]);
  await input.fill("A draft after the fifth turn");
  await dialog.getByRole("button", { name: "Retry answer" }).click();
  await expect(dialog.locator(".answer")).toHaveCount(5);
  expect(payloads[5].question).toBe("Question 2");
  expect(
    payloads[5].history?.messages.map((message) => message.content),
  ).toEqual([
    "Question 1",
    "Controlled conversation fixture answer to Question 1",
  ]);
  await expect(dialog.locator(".chat-user")).toHaveCount(5);
  await expect(input).toHaveValue("A draft after the fifth turn");
  expect(
    payloads.every((payload) => JSON.stringify(payload).length <= 8192),
  ).toBe(true);
});

test("serialized request limits drop oldest full history pairs and cap assistant context without truncating the new question", async ({
  page,
}) => {
  const payloads: Payload[] = [];
  await page.route("**/api/ask", (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      json: fixture("Controlled history fixture: " + "\\".repeat(2000)),
    });
  });
  await page.goto(fundraiser);
  const dialog = await askOpen(page);
  const input = dialog.getByLabel("Your question");
  for (const [index, prefix] of ["A", "B", "C"].entries()) {
    await input.fill(prefix + '"'.repeat(999));
    await input.press("Enter");
    await expect(dialog.locator(".answer")).toHaveCount(index + 1);
  }
  expect(payloads[2].question).toBe("C" + '"'.repeat(999));
  expect(payloads[2].history?.messages).toHaveLength(2);
  expect(payloads[2].history?.messages[0].content).toBe("B" + '"'.repeat(999));
  expect(payloads[2].history?.messages[1].content.length).toBe(1500);
  expect(
    payloads.every((payload) => JSON.stringify(payload).length <= 8192),
  ).toBe(true);
});

test("funding claims with no separate facts retain a dated snapshot and exact funding source focus", async ({
  page,
}) => {
  const answer = {
    ...answerFixture,
    claims: [
      {
        text: "Controlled fixture: the average contribution is $137.79.",
        citations: [
          {
            id: "funding",
            label: "Fixture current funding",
            date: answerFixture.snapshot,
            href: fundraiser + "#funding",
          },
        ],
      },
    ],
    facts: [],
  };
  await page.route("**/api/ask", (route) => route.fulfill({ json: answer }));
  await page.goto(fundraiser);
  const dialog = await askOpen(page);
  await dialog
    .getByLabel("Your question")
    .fill("What is the average contribution?");
  await dialog.getByLabel("Your question").press("Enter");
  await expect(dialog.locator(".answer")).toContainText("Funding snapshot:");
  await expect(dialog.locator(".answer")).toContainText("UTC");
  await expect(
    dialog.getByRole("button", { name: "View funding source" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: /Fixture current funding/ }).click();
  await expect(page.locator("#funding")).toBeFocused();
  await expect(page).toHaveURL(/#funding$/);
});

for (const width of [1440, 390, 320]) {
  test(`chat keeps its header/composer visible and preserves scrollback at ${width}px with no serious accessibility findings`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let count = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const longAnswer = Array.from(
      { length: 3 },
      (_, index) =>
        `Controlled layout fixture paragraph ${index + 1}. The organizer describes a proposed shared garden with raised beds, tools, and accessible paths. Read the dated source before treating those plans as independently verified outcomes.`,
    ).join("\n\n");
    await page.route("**/api/ask", async (route) => {
      count++;
      if (count === 4) await gate;
      await route.fulfill({ json: fixture(longAnswer) });
    });
    try {
      await page.goto(fundraiser);
      const dialog = await askOpen(page);
      const input = dialog.getByLabel("Your question");
      const log = dialog.getByRole("log");
      await expect(input).toBeFocused();
      mkdirSync(chatEvidenceDirectory, { recursive: true });
      await page.screenshot({
        path: `${chatEvidenceDirectory}/after-empty-${width}.png`,
      });
      const initial = await new AxeBuilder({ page }).analyze();
      expect(
        initial.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact || ""),
        ),
      ).toEqual([]);
      const header = await dialog.locator(".dialog-heading").boundingBox();
      const composer = await dialog.locator(".chat-composer").boundingBox();
      for (let index = 1; index <= 3; index++) {
        await input.fill("Layout fixture question " + index);
        await input.press("Enter");
        await expect(dialog.locator(".answer")).toHaveCount(index);
      }
      await input.fill("Layout fixture question 4");
      await input.press("Enter");
      await expect(dialog.getByRole("status")).toBeVisible();
      await log.evaluate((node) => {
        node.scrollTop = 0;
        node.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await expect(
        dialog.getByRole("button", { name: "Latest message" }),
      ).toBeVisible();
      release();
      await expect(dialog.locator(".answer")).toHaveCount(4);
      expect(await log.evaluate((node) => node.scrollTop)).toBeLessThanOrEqual(
        10,
      );
      expect(
        await log.evaluate((node) => node.scrollHeight > node.clientHeight),
      ).toBe(true);
      const finalHeader = await dialog.locator(".dialog-heading").boundingBox();
      const finalComposer = await dialog
        .locator(".chat-composer")
        .boundingBox();
      expect(Math.abs(finalHeader!.y - header!.y)).toBeLessThanOrEqual(2);
      // The composer grows for multiline drafts/placeholder wrapping while its
      // bottom stays anchored and the transcript takes the remaining space.
      expect(
        Math.abs(
          finalComposer!.y +
            finalComposer!.height -
            composer!.y -
            composer!.height,
        ),
      ).toBeLessThanOrEqual(2);
      if (width < 600)
        expect(
          await input.evaluate((node) => getComputedStyle(node).fontSize),
        ).toBe("16px");
      expect(finalComposer!.y + finalComposer!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      );
      await dialog.getByRole("button", { name: "Latest message" }).click();
      await expect
        .poll(() =>
          log.evaluate(
            (node) => node.scrollHeight - node.scrollTop - node.clientHeight,
          ),
        )
        .toBeLessThanOrEqual(2);
      await noOverflow(page);
      expect(
        await dialog.evaluate((node) => node.scrollWidth - node.clientWidth),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `${chatEvidenceDirectory}/after-conversation-${width}.png`,
      });
      const findings = await new AxeBuilder({ page }).analyze();
      expect(
        findings.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact || ""),
        ),
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /A little clarity/ }),
      ).toBeFocused();
    } finally {
      release();
    }
  });
}
