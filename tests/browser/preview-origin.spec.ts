import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { actor, campaign, community, db, fundraiser, origin } from "./helpers";

const previewURL = process.env.PREVIEW_BASE_URL;
const primaryURL = process.env.PRIMARY_BASE_URL || origin;

test.skip(
  !previewURL,
  "Set PREVIEW_BASE_URL to run the local forwarded-origin reproduction.",
);

type Observation = {
  path: string;
  status: number;
  origin: string | null;
  action?: string;
};

function observePosts(page: Page) {
  const observations: Observation[] = [];
  page.on("response", (response) => {
    const request = response.request();
    const path = new URL(response.url()).pathname;
    if (
      request.method() !== "POST" ||
      !["/api/actions", "/api/events", "/api/ask"].includes(path)
    )
      return;
    observations.push({
      path,
      status: response.status(),
      origin: request.headers().origin || null,
      ...(path === "/api/actions"
        ? { action: request.postDataJSON().action as string }
        : {}),
    });
  });
  return observations;
}

async function browserPost(page: Page, path: string, data: unknown) {
  return page.evaluate(
    async ({ path, data }) => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, data },
  );
}

async function rejectValidAskCalls(page: Page) {
  await page.route("**/api/ask", (route) => {
    // Only the deterministic invalid-input probe may reach the real API.
    if (route.request().postDataJSON().question === "") return route.continue();
    return route.fulfill({
      status: 503,
      json: { error: "Automated suite: no live model calls permitted." },
    });
  });
}

test("explicit preview origin supports real browser actions, persistence, analytics and invalid-Ask validation; primary origin still works", async ({
  browser,
}, testInfo) => {
  const preview = await browser.newContext({
    baseURL: previewURL!,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  const primary = await browser.newContext({
    baseURL: primaryURL,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  try {
    const page = await preview.newPage();
    await rejectValidAskCalls(page);
    const requests = observePosts(page);
    await page.goto(community);
    expect(new URL(page.url()).origin).toBe(new URL(previewURL!).origin);
    const visitor = await actor(preview);
    const controls = page.locator(".hero-actions");
    await controls.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(
      controls.getByRole("button", { name: "Following", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    expect(await actor(preview)).toBe(visitor);
    await expect(
      controls.getByRole("button", { name: "Following", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await controls
      .getByRole("button", { name: "Following", exact: true })
      .click();
    await expect(
      controls.getByRole("button", { name: "Follow", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(
      controls.getByRole("button", { name: "Follow", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");

    await page.goto(fundraiser);
    const reason =
      "Forwarded-origin regression fixture: a shared neighborhood matters.";
    await page.getByRole("button", { name: "Feature this cause" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(reason);
    await page.getByRole("button", { name: "Save to my profile" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/me");
    await expect(page.locator("blockquote")).toHaveText(reason);
    await page.reload();
    await expect(page.locator("blockquote")).toHaveText(reason);

    await page.locator(".card-title-link").click();
    await page.getByRole("button", { name: /Make a difference/ }).click();
    await page.getByLabel("Donation amount").fill("12.50");
    await page
      .getByRole("button", { name: "Confirm simulated donation" })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "$12.50 in simulated support",
    );
    await expect(page.getByRole("dialog")).toContainText(
      "No money was charged.",
    );
    await page.getByRole("link", { name: "See your impact" }).click();
    await expect(page).toHaveURL(new URL("/me", previewURL!).href);
    await page.reload();
    await expect(
      page.getByText("Contributed $12.50 in simulated support"),
    ).toHaveCount(1);
    await expect(page.locator(".funding-line strong")).toHaveText("$11,862.50");
    await expect(page.locator("blockquote")).toHaveText(reason);
    expect(await actor(preview)).toBe(visitor);
    expect(
      (
        await db.query("SELECT cents FROM donations WHERE visitor_id=$1", [
          visitor,
        ])
      ).rows,
    ).toEqual([{ cents: 1250 }]);
    expect(
      (
        await db.query(
          "SELECT campaign_id,reason FROM features WHERE visitor_id=$1",
          [visitor],
        )
      ).rows,
    ).toEqual([{ campaign_id: campaign, reason }]);
    expect(
      (await db.query("SELECT * FROM follows WHERE visitor_id=$1", [visitor]))
        .rowCount,
    ).toBe(0);

    const eventId = randomUUID();
    const event = await browserPost(page, "/api/events", {
      id: eventId,
      name: "page_view",
      entityId: "preview-origin-regression",
      properties: { pageType: "community" },
    });
    expect(event.status).toBe(200);
    await expect
      .poll(
        async () =>
          (
            await db.query(
              "SELECT s.is_test FROM events e JOIN analytics_sessions s ON s.id=e.session_id WHERE e.id=$1 AND e.visitor_id=$2",
              [eventId, visitor],
            )
          ).rows,
      )
      .toEqual([{ is_test: true }]);
    const ask = await browserPost(page, "/api/ask", {
      campaignId: campaign,
      question: "",
    });
    expect(ask.status).toBe(400);
    expect(ask.body.error).toContain("between 1 and 1,000 characters");
    expect(
      (
        await db.query("SELECT * FROM ai_usage WHERE scope=$1", [
          "visitor:" + visitor,
        ])
      ).rowCount,
    ).toBe(0);
    await expect
      .poll(
        () =>
          requests.filter((request) => request.path === "/api/actions").length,
      )
      .toBeGreaterThanOrEqual(4);
    expect(
      requests
        .filter((request) => request.path !== "/api/ask")
        .every(
          (request) =>
            request.status === 200 &&
            request.origin === new URL(previewURL!).origin,
        ),
    ).toBe(true);

    const primaryPage = await primary.newPage();
    await rejectValidAskCalls(primaryPage);
    const primaryRequests = observePosts(primaryPage);
    await primaryPage.goto(community);
    expect(new URL(primaryPage.url()).origin).toBe(new URL(primaryURL).origin);
    expect(await actor(primary)).not.toBe(visitor);
    await primaryPage
      .locator(".hero-actions")
      .getByRole("button", { name: "Follow", exact: true })
      .click();
    await expect(
      primaryPage
        .locator(".hero-actions")
        .getByRole("button", { name: "Following", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await primaryPage.reload();
    await expect(
      primaryPage
        .locator(".hero-actions")
        .getByRole("button", { name: "Following", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const primaryAsk = await browserPost(primaryPage, "/api/ask", {
      campaignId: campaign,
      question: "",
    });
    expect(primaryAsk.status).toBe(400);
    await primaryPage.goto("/me");
    await expect(primaryPage.locator("blockquote")).toHaveCount(0);
    await expect(
      primaryPage.getByText("Contributed $12.50 in simulated support"),
    ).toHaveCount(0);
    await expect
      .poll(
        () =>
          primaryRequests.filter((request) => request.path === "/api/events")
            .length,
      )
      .toBeGreaterThan(0);
    expect(
      primaryRequests
        .filter((request) => request.path !== "/api/ask")
        .every(
          (request) =>
            request.status === 200 &&
            request.origin === new URL(primaryURL).origin,
        ),
    ).toBe(true);
    await testInfo.attach("preview-origin-observations", {
      contentType: "application/json",
      body: JSON.stringify({
        reproduction:
          "Local relay of the forwarded preview origin; not direct control of the user's embedded browser",
        previewOrigin: new URL(previewURL!).origin,
        primaryOrigin: new URL(primaryURL).origin,
        previewRequests: requests,
        primaryRequests,
        persistence: {
          followReload: true,
          unfollowReload: true,
          featureReasonReload: true,
          donationReload: true,
          donationCents: 1250,
          donationRecords: 1,
          featureRecords: 1,
          independentPrimaryVisitor: true,
        },
        invalidAsk: {
          previewStatus: ask.status,
          primaryStatus: primaryAsk.status,
          liveModelCalls: 0,
        },
        explicitEvent: { status: event.status, testTrafficTagged: true },
      }),
    });
  } finally {
    await preview.close();
    await primary.close();
  }
});

test("foreign, absent and unconfigured loopback origins remain forbidden on actions, events and Ask", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: previewURL!,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  try {
    const page = await context.newPage();
    await page.goto(community);
    const visitor = await actor(context);
    const cases = [
      { label: "foreign", origin: "https://example.invalid" },
      { label: "missing", origin: undefined },
      { label: "unconfigured-loopback", origin: "http://localhost:61072" },
    ];
    const checks: {
      category: string;
      origin: string | null;
      path: string;
      status: number;
    }[] = [];
    const eventIds: string[] = [];
    for (const candidate of cases) {
      for (const path of ["/api/actions", "/api/events", "/api/ask"]) {
        const eventId = randomUUID();
        eventIds.push(eventId);
        const data =
          path === "/api/actions"
            ? {
                action: "follow",
                targetType: "fundraiser",
                targetId: campaign,
                active: true,
              }
            : path === "/api/events"
              ? {
                  id: eventId,
                  name: "page_view",
                  entityId: "forbidden-origin-fixture",
                  properties: {},
                }
              : { campaignId: campaign, question: "" };
        const response = await context.request.post(path, {
          headers: candidate.origin ? { origin: candidate.origin } : {},
          data,
        });
        expect(response.status(), candidate.label + " " + path).toBe(403);
        expect((await response.json()).error).toBe(
          "This action must come from this site.",
        );
        checks.push({
          category: candidate.label,
          origin: candidate.origin || null,
          path,
          status: response.status(),
        });
      }
    }
    expect(
      (await db.query("SELECT * FROM follows WHERE visitor_id=$1", [visitor]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await db.query("SELECT * FROM events WHERE id=ANY($1::uuid[])", [
          eventIds,
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await db.query("SELECT * FROM ai_usage WHERE scope=$1", [
          "visitor:" + visitor,
        ])
      ).rowCount,
    ).toBe(0);
    await testInfo.attach("preview-origin-rejections", {
      contentType: "application/json",
      body: JSON.stringify({
        checks,
        forbiddenMutationsSaved: 0,
        forbiddenEventsSaved: 0,
        liveModelCalls: 0,
      }),
    });
  } finally {
    await context.close();
  }
});
