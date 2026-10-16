import { expect, test, type Page } from "@playwright/test";
import { answerFixture, askOpen, campaign, fundraiser } from "./helpers";

type FixtureStream = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  cancelled: boolean;
};
type FixtureWindow = Window & {
  controlledChatStreams: {
    requests: { body: Record<string, unknown>; accept: string | null }[];
    streams: FixtureStream[];
  };
};
const requestId = "a10e3062-5c9b-4c3f-a035-6d6074fcb16e";
const partial = {
  ...answerFixture,
  requestId,
  claims: [
    {
      ...answerFixture.claims[0],
      text: "Controlled stream fixture: café 🌱 progress.",
    },
  ],
};
const completed = {
  ...partial,
  claims: [
    ...partial.claims,
    {
      ...partial.claims[0],
      text: "Controlled stream fixture: a later sourced sentence.",
    },
  ],
};

// Controlled in-browser transport fixture: native Response/ReadableStream exercises
// the production incremental reader without contacting a provider or simulating tokens.
async function installStreamFixture(page: Page) {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Controlled fixture: live calls blocked." },
    }),
  );
  await page.addInitScript(() => {
    const target = window as unknown as FixtureWindow;
    target.controlledChatStreams = { requests: [], streams: [] };
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (new URL(url, location.href).pathname !== "/api/ask")
        return original(input, init);
      const state = target.controlledChatStreams;
      state.requests.push({
        body: JSON.parse(String(init?.body)),
        accept: new Headers(init?.headers).get("accept"),
      });
      const entry = { cancelled: false } as FixtureStream;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          entry.controller = controller;
        },
        cancel() {
          entry.cancelled = true;
        },
      });
      state.streams.push(entry);
      return new Response(body, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    };
  });
}
async function push(page: Page, index: number, raw: string, bytes = false) {
  await page.evaluate(
    ({ index, raw, bytes }) => {
      const entry = (window as unknown as FixtureWindow).controlledChatStreams
        .streams[index];
      const encoded = new TextEncoder().encode(raw);
      if (bytes)
        for (const byte of encoded)
          entry.controller.enqueue(Uint8Array.of(byte));
      else entry.controller.enqueue(encoded);
    },
    { index, raw, bytes },
  );
}
const frame = (event: string, data: unknown) =>
  `event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
async function start(page: Page, index = 0) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as FixtureWindow).controlledChatStreams.streams
            .length,
      ),
    )
    .toBe(index + 1);
  await push(
    page,
    index,
    ": fixture keepalive\r\n\r\n" +
      frame("start", { requestId, campaignId: campaign }),
    true,
  );
}

test.beforeEach(async ({ page }) => {
  await installStreamFixture(page);
  await page.goto(fundraiser);
});

test("validated incremental claims render before completion across split UTF-8 frames, with deduplicated references below all prose", async ({
  page,
}) => {
  const dialog = await askOpen(page);
  const input = dialog.getByLabel("Your question");
  await input.fill("Controlled stream fixture question");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await start(page);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as FixtureWindow).controlledChatStreams.requests[0]
          .accept,
    ),
  ).toBe("text/event-stream");
  await push(page, 0, frame("partial", partial), true);
  await expect(dialog.locator(".chat-streaming")).toContainText(
    "café 🌱 progress",
  );
  await expect(dialog.locator(".answer")).toHaveCount(0);
  await expect(dialog.getByRole("status")).toContainText("Writing");
  await input.fill("A draft written while the answer streams");
  await push(page, 0, frame("partial", completed));
  await expect(dialog.locator(".chat-streaming .citation")).toHaveCount(1);
  await expect(dialog.locator(".chat-streaming")).toContainText(
    "later sourced sentence",
  );
  await push(page, 0, frame("done", completed));
  await expect(dialog.locator(".answer")).toHaveCount(1);
  await expect(dialog.locator(".chat-streaming")).toHaveCount(0);
  await expect(dialog.getByRole("status")).toHaveCount(0);
  await expect(input).toHaveValue("A draft written while the answer streams");
  expect(
    await dialog.locator(".answer").evaluate((node) => {
      const footer = node.querySelector(".chat-references")!;
      return [...node.querySelectorAll(":scope > p")].every(
        (paragraph) =>
          !!(
            paragraph.compareDocumentPosition(footer) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      );
    }),
  ).toBe(true);
  await input.press("Enter");
  await start(page, 1);
  const history = await page.evaluate(
    () =>
      (window as unknown as FixtureWindow).controlledChatStreams.requests[1]
        .body.history,
  );
  expect(history).toMatchObject({
    campaignId: campaign,
    messages: [
      { role: "user", content: "Controlled stream fixture question" },
      {
        role: "assistant",
        content: completed.claims.map((claim) => claim.text).join("\n\n"),
      },
    ],
  });
});

for (const failure of [
  "error",
  "truncated",
  "malformed",
  "wrong identity",
  "invalid final",
] as const) {
  test(`stream ${failure} discards partial content and retries the same turn without losing a later draft`, async ({
    page,
  }) => {
    const dialog = await askOpen(page);
    const input = dialog.getByLabel("Your question");
    await input.fill("Controlled interrupted stream question");
    await input.press("Enter");
    await start(page);
    await push(page, 0, frame("partial", partial));
    await expect(dialog.locator(".chat-streaming")).toBeVisible();
    await input.fill("My later draft survives");
    if (failure === "error")
      await push(
        page,
        0,
        frame("error", {
          requestId,
          error: "Controlled fixture interruption; please retry.",
        }),
      );
    else if (failure === "truncated")
      await page.evaluate(() =>
        (
          window as unknown as FixtureWindow
        ).controlledChatStreams.streams[0].controller.close(),
      );
    else if (failure === "malformed")
      await push(page, 0, "event: done\ndata: {broken JSON}\n\n");
    else if (failure === "wrong identity")
      await push(
        page,
        0,
        frame("done", {
          ...completed,
          requestId: "b10e3062-5c9b-4c3f-a035-6d6074fcb16e",
        }),
      );
    else
      await push(
        page,
        0,
        frame("done", {
          ...completed,
          claims: [{ text: "Invalid fixture source", citations: [] }],
        }),
      );
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(
      dialog.locator(".chat-streaming, .answer, .citation"),
    ).toHaveCount(0);
    await expect(input).toHaveValue("My later draft survives");
    await dialog.getByRole("button", { name: "Retry answer" }).click();
    await start(page, 1);
    await expect(dialog.locator(".chat-user")).toHaveCount(1);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as FixtureWindow).controlledChatStreams.requests[1]
            .body.history,
      ),
    ).toBeUndefined();
    await push(page, 1, frame("done", completed));
    await expect(dialog.locator(".answer")).toHaveCount(1);
    await expect(input).toHaveValue("My later draft survives");
  });
}

test("closing cancels the stream reader and a reopened panel starts without partial content or old history", async ({
  page,
}) => {
  let dialog = await askOpen(page);
  await dialog
    .getByLabel("Your question")
    .fill("Controlled cancelled stream question");
  await dialog.getByLabel("Your question").press("Enter");
  await start(page);
  await push(page, 0, frame("partial", partial));
  await expect(dialog.locator(".chat-streaming")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as FixtureWindow).controlledChatStreams.streams[0]
            .cancelled,
      ),
    )
    .toBe(true);
  dialog = await askOpen(page);
  await expect(dialog.locator(".chat-turn")).toHaveCount(0);
  await dialog
    .getByLabel("Your question")
    .fill("Controlled new conversation question");
  await dialog.getByLabel("Your question").press("Enter");
  await start(page, 1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as FixtureWindow).controlledChatStreams.requests[1]
          .body.history,
    ),
  ).toBeUndefined();
  await push(
    page,
    1,
    frame("done", {
      ...completed,
      claims: [
        {
          ...partial.claims[0],
          text: "Controlled new conversation answer only.",
        },
      ],
    }),
  );
  await expect(dialog.locator(".answer")).toContainText(
    "new conversation answer only",
  );
  await expect(dialog).not.toContainText("café");
});

test("a partially delivered stream still has one twenty-second visible deadline and cancels its reader", async ({
  page,
}) => {
  await page.clock.install();
  const dialog = await askOpen(page);
  const input = dialog.getByLabel("Your question");
  await input.fill("Controlled stream deadline question");
  await input.press("Enter");
  await start(page);
  // Multi-line SSE data fields reconstruct one valid JSON object.
  const multiline = JSON.stringify(partial).replace(
    '{"status":',
    '{\n"status":',
  );
  await push(
    page,
    0,
    "event: partial\ndata: " + multiline.replaceAll("\n", "\ndata: ") + "\n\n",
  );
  await expect(dialog.locator(".chat-streaming")).toBeVisible();
  await page.clock.fastForward(20001);
  await expect(dialog.getByRole("alert")).toContainText("took too long");
  await expect(dialog.locator(".chat-streaming, .answer")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as FixtureWindow).controlledChatStreams.streams[0]
          .cancelled,
    ),
  ).toBe(true);
  await expect(
    dialog.getByRole("button", { name: "Retry answer" }),
  ).toBeEnabled();
});
