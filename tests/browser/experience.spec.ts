import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  origin,
  community,
  campaign,
  fundraiser,
  db,
  actor,
  action,
  saved,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  // Accidental Ask calls fail locally and never consume provider credits.
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Automated suite: no live model calls permitted." },
    }),
  );
});

test("isolated identities persist on reload; supplied visitor IDs and foreign origins are rejected", async ({
  page,
  browser,
}) => {
  await page.goto(community);
  const a = await actor(page.context());
  const second = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  const p2 = await second.newPage();
  await p2.goto(community);
  const b = await actor(second);
  expect(a).not.toBe(b);
  await saved(page.context(), {
    action: "follow",
    targetType: "community",
    targetId: "a-greener-tomorrow",
    active: true,
  });
  const empty = await saved(second, {
    action: "follow",
    targetType: "fundraiser",
    targetId: campaign,
    active: false,
  });
  expect(empty.follows).toHaveLength(0);
  expect(
    (
      await action(second, {
        action: "follow",
        targetType: "community",
        targetId: "a-greener-tomorrow",
        active: false,
        visitorId: a,
      })
    ).status(),
  ).toBe(400);
  const foreign = await second.request.post("/api/actions", {
    headers: { origin: "https://example.invalid" },
    data: {
      action: "follow",
      targetType: "community",
      targetId: "a-greener-tomorrow",
      active: true,
    },
  });
  expect(foreign.status()).toBe(403);
  await page.reload();
  expect(await actor(page.context())).toBe(a);
  await expect(
    page.locator(".hero-actions").getByRole("button", { name: "Following" }),
  ).toHaveAttribute("aria-pressed", "true");
  await second.close();
});

test("donations validate cents, serialize duplicate retries, reject conflicts, and save one trusted event per record", async ({
  page,
  browser,
}) => {
  await page.goto(fundraiser);
  const id = await actor(page.context());
  for (const amount of [
    "0",
    "-1",
    "0.99",
    "10000.01",
    "1.001",
    "NaN",
    "Infinity",
    "1e3",
    "foo",
    "",
  ]) {
    expect(
      (
        await action(page.context(), {
          action: "donate",
          campaignId: campaign,
          amount,
          key: randomUUID(),
        })
      ).status(),
      amount,
    ).toBe(400);
  }
  const donation = {
    action: "donate",
    campaignId: campaign,
    amount: "12.50",
    key: randomUUID(),
  };
  const [a, b] = await Promise.all([
    action(page.context(), donation),
    action(page.context(), donation),
  ]);
  expect(a.status()).toBe(200);
  expect(b.status()).toBe(200);
  // Ignore the saved response, then retry the same intended donation.
  await action(page.context(), donation);
  const retry = await saved(page.context(), donation);
  expect(retry.donations).toHaveLength(1);
  expect(retry.donations[0].cents).toBe(1250);
  expect(
    (await action(page.context(), { ...donation, amount: "13.00" })).status(),
  ).toBe(409);
  expect(
    (
      await action(page.context(), {
        ...donation,
        campaignId: "roots-for-the-future",
      })
    ).status(),
  ).toBe(409);
  await saved(page.context(), { ...donation, key: randomUUID() });
  const rows = await db.query(
    "SELECT d.cents,e.name,s.is_test FROM donations d JOIN events e ON e.id=d.id JOIN analytics_sessions s ON s.id=e.session_id WHERE d.visitor_id=$1",
    [id],
  );
  expect(rows.rows).toHaveLength(2);
  expect(
    rows.rows.every(
      (r) => r.cents === 1250 && r.name === "donation_completed" && r.is_test,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator(".support-panel .funding-line strong")).toHaveText(
    "$11,875",
  );
  await page.goto("/me");
  await expect(
    page.getByText("Contributed $12.50 in simulated support"),
  ).toHaveCount(2);
  await page.goto(community);
  await expect(
    page.locator(".hero-metrics").getByText("$52,775"),
  ).toBeVisible();
  const second = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  const p2 = await second.newPage();
  await p2.goto(fundraiser);
  await expect(p2.locator(".support-panel .funding-line strong")).toHaveText(
    "$11,850",
  );
  await second.close();
});

test("donation failure retains amount; keyboard confirmation is explicitly simulated and restores focus", async ({
  page,
}) => {
  await page.goto(fundraiser);
  const trigger = page.getByRole("button", { name: /Make a difference/ });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("No money is charged.");
  expect(await modal.locator("input").count()).toBe(1);
  await expect(
    modal.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await modal.getByLabel("Donation amount").fill("12.50");
  await page.route("**/api/actions", (route) =>
    route.request().postDataJSON().action === "donate"
      ? route.fulfill({
          status: 503,
          json: { error: "Fixture: storage unavailable. Try again." },
        })
      : route.continue(),
  );
  await modal.getByRole("button", { name: /Confirm simulated/ }).click();
  await expect(modal.getByRole("alert")).toHaveText(
    "Fixture: storage unavailable. Try again.",
  );
  await expect(modal.getByLabel("Donation amount")).toHaveValue("12.50");
  await page.unroute("**/api/actions");
  await modal.getByRole("button", { name: /Confirm simulated/ }).click();
  await expect(modal).toContainText("$12.50 in simulated support");
  await expect(modal).toContainText("No money was charged.");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Following is a persistent deduplicated union of campaign, community, and organizer", async ({
  page,
}) => {
  await page.goto(community + "?view=following");
  await expect(
    page.getByRole("heading", { name: "Your next good thing is out there." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore all causes" }).click();
  await expect(page.locator(".campaign-card")).toHaveCount(4);
  for (const [targetType, targetId] of [
    ["fundraiser", campaign],
    ["community", "a-greener-tomorrow"],
    ["organizer", "maya-chen"],
  ]) {
    await saved(page.context(), {
      action: "follow",
      targetType,
      targetId,
      active: true,
    });
    await saved(page.context(), {
      action: "follow",
      targetType,
      targetId,
      active: true,
    });
  }
  const id = await actor(page.context());
  expect(
    (await db.query("SELECT * FROM follows WHERE visitor_id=$1", [id]))
      .rowCount,
  ).toBe(3);
  await page.goto(community + "?view=following");
  await expect(page.locator(".campaign-card")).toHaveCount(4);
  await saved(page.context(), {
    action: "follow",
    targetType: "fundraiser",
    targetId: campaign,
    active: false,
  });
  await page.reload();
  await expect(page.locator(".campaign-card")).toHaveCount(4);
  await saved(page.context(), {
    action: "follow",
    targetType: "community",
    targetId: "a-greener-tomorrow",
    active: false,
  });
  await page.reload();
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await expect(page.locator(".campaign-card")).toContainText("Maya Chen");
  await page.goto("/profiles/maya-chen");
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Following", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("failed follow rolls back; collector failure does not block saving the retry", async ({
  page,
}) => {
  await page.goto(community);
  await page.route("**/api/actions", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Fixture: save failed; retry." },
    }),
  );
  const follow = page
    .locator(".hero-actions")
    .getByRole("button", { name: "Follow", exact: true });
  await follow.click();
  await expect(page.locator(".hero-actions").getByRole("alert")).toContainText(
    "retry",
  );
  await expect(follow).toHaveAttribute("aria-pressed", "false");
  await expect(follow).toBeEnabled();
  await page.unroute("**/api/actions");
  await page.route("**/api/events", (route) => route.abort("failed"));
  await follow.click();
  await expect(
    page.locator(".hero-actions").getByRole("button", { name: "Following" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("featured reasons render plain text, enforce 280 characters, remain private, persist and reverse", async ({
  page,
  browser,
}) => {
  await page.goto(fundraiser);
  const reason =
    '<img src=x onerror="window.featureExecuted=true"> I care about this garden.';
  await page.getByRole("button", { name: "Feature this cause" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toHaveAttribute("maxlength", "280");
  await dialog.getByRole("textbox").fill(reason);
  await dialog.getByRole("button", { name: "Save to my profile" }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/me");
  await expect(page.locator("blockquote")).toHaveText(reason);
  expect(await page.locator("blockquote img").count()).toBe(0);
  expect(await page.evaluate(() => "featureExecuted" in window)).toBe(false);
  await expect(page.getByRole("button", { name: /^Follow$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Share$/ })).toHaveCount(0);
  expect(
    (
      await action(page.context(), {
        action: "feature",
        campaignId: campaign,
        reason: "a".repeat(281),
        active: true,
      })
    ).status(),
  ).toBe(400);
  await page.reload();
  await expect(page.locator("blockquote")).toHaveText(reason);
  const second = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  const p2 = await second.newPage();
  await p2.goto("/me");
  await expect(p2.locator("blockquote")).toHaveCount(0);
  await second.close();
  await page.goto("/profiles/maya-chen");
  await expect(page.locator("blockquote")).not.toHaveText(reason);
  await page.goto("/me");
  await page.getByRole("button", { name: "Featured on my profile" }).click();
  await page.getByRole("button", { name: "Remove feature" }).click();
  await expect(
    page.getByRole("heading", { name: "Make room for what matters." }),
  ).toBeVisible();
});

test("combined search/reset and Back restore URL filters and card position; profile links are connected", async ({
  page,
}) => {
  await page.goto(community);
  const search = page.getByRole("textbox", { name: "Search campaigns" });
  for (const term of ["MAYA", "empty lot", "grow something good"]) {
    await search.fill(term);
    await expect(page.locator(".campaign-card")).toHaveCount(1);
  }
  await page
    .getByRole("button", { name: "Food & community", exact: true })
    .click();
  await search.fill("MAYA");
  await expect(
    page.getByRole("button", { name: "Food & community", exact: true }),
  ).toHaveClass(/selected/);
  await expect(page).toHaveURL(/topic=Food/);
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await page.locator(".campaign-card").scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  const href = page.url();
  await page.locator(".card-image-link").click();
  await expect(page).toHaveURL(new RegExp(fundraiser));
  await page.goBack();
  await expect(search).toHaveValue("MAYA");
  await expect(page).toHaveURL(href);
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => scrollY)) - before))
    .toBeLessThanOrEqual(30);
  await expect(
    page.getByRole("button", { name: "Food & community", exact: true }),
  ).toHaveClass(/selected/);
  await search.fill("nothing matches fixture");
  await expect(
    page.getByRole("heading", { name: "No causes match just yet." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator(".campaign-card")).toHaveCount(4);
  await page
    .locator(".organizer-line")
    .filter({ hasText: "Maya Chen" })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maya Chen");
  await page.locator(".card-title-link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Help a neighborhood grow something good",
  );
});

test("updates are marked seen after content becomes visible and persist on reload", async ({
  page,
}) => {
  await page.goto(fundraiser);
  const id = await actor(page.context());
  expect(
    (await db.query("SELECT * FROM update_views WHERE visitor_id=$1", [id]))
      .rowCount,
  ).toBe(0);
  await expect(page.locator("#updates")).toBeVisible();
  await page
    .locator("#updates")
    .evaluate((section) => section.scrollIntoView({ behavior: "instant" }));
  await expect(page.locator("#updates")).toBeInViewport({ ratio: 0.1 });
  await expect
    .poll(
      async () =>
        (
          await db.query(
            "SELECT * FROM update_views WHERE visitor_id=$1 AND campaign_id=$2",
            [id, campaign],
          )
        ).rowCount,
    )
    .toBe(1);
  const viewed = (
    await db.query("SELECT viewed_at FROM update_views WHERE visitor_id=$1", [
      id,
    ])
  ).rows[0].viewed_at;
  await page.goto(community);
  await expect(page.locator(".new-badge")).toHaveCount(0);
  await page.reload();
  expect(
    (
      await db.query("SELECT viewed_at FROM update_views WHERE visitor_id=$1", [
        id,
      ])
    ).rows[0].viewed_at,
  ).toEqual(viewed);
});

test("share cancellation and denied clipboard preserve canonical selectable URL and distinct events", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Fixture: canceled", "AbortError");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Fixture: clipboard denied");
        },
      },
    });
  });
  await page.goto(community + "?q=private-filter&view=following");
  await page
    .locator(".hero-actions")
    .getByRole("button", { name: "Share", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toHaveValue(origin + community);
  await dialog.getByRole("button", { name: "Share with…" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Sharing canceled.");
  await dialog.getByRole("button", { name: "Copy link" }).click();
  await expect(dialog.getByRole("status")).toContainText("copy it manually");
  const input = dialog.getByRole("textbox");
  await input.focus();
  expect(
    await input.evaluate(
      (el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!,
    ),
  ).toBe((origin + community).length);
  const id = await actor(page.context());
  await expect
    .poll(async () =>
      (
        await db.query(
          "SELECT name FROM events WHERE visitor_id=$1 AND name LIKE 'share_%'",
          [id],
        )
      ).rows
        .map((r) => r.name)
        .sort(),
    )
    .toEqual(["share_cancelled", "share_failed", "share_opened"]);
});

test("clipboard success copies the public fundraiser URL without private query or hash", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { copiedFixture?: string }).copiedFixture = text;
        },
      },
    }),
  );
  await page.goto(fundraiser + "#budget");
  await page
    .locator(".support-panel")
    .getByRole("button", { name: "Share", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  expect(
    await page.evaluate(
      () => (window as Window & { copiedFixture?: string }).copiedFixture,
    ),
  ).toBe(origin + fundraiser);
});

test("chart ranges support keyboard and a dated cumulative balance alternative", async ({
  page,
}) => {
  await page.goto(fundraiser);
  for (const range of ["7 days", "30 days", "All time"]) {
    const button = page.getByRole("button", { name: range, exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByText("View the dated funding data", { exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator("tbody tr").last()).toContainText("$11,850.00");
  await expect(
    page.getByRole("img", { name: /Cumulative USD funding/ }),
  ).toBeVisible();
});

for (const [slug, title] of [
  ["grow-a-neighborhood", "Help a neighborhood grow something good"],
  ["roots-for-the-future", "Plant the roots of a greener future"],
  ["power-our-common-ground", "Bring clean energy to our community center"],
  ["a-path-for-everyone", "Make the neighborhood trail a path for everyone"],
]) {
  test(
    "public fundraiser and relationship links: " + slug,
    async ({ page }) => {
      await page.goto("/fundraisers/" + slug);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator("#beneficiary")).toContainText("fictional");
      await expect(page.locator("#organizer a")).toHaveAttribute(
        "href",
        /\/profiles\//,
      );
      await expect(page.locator(".community-link")).toHaveAttribute(
        "href",
        community,
      );
      await expect
        .poll(() =>
          page
            .locator("main img")
            .evaluateAll((imgs) =>
              imgs.every(
                (img) =>
                  (img as HTMLImageElement).complete &&
                  (img as HTMLImageElement).naturalWidth > 0 &&
                  !!img.getAttribute("alt"),
              ),
            ),
        )
        .toBe(true);
      if (slug === "roots-for-the-future" || slug === "a-path-for-everyone")
        await expect(page.locator("#budget")).toContainText(
          /itemized budget.*(not|provided)|No itemized budget/,
        );
    },
  );
}

test("invalid public entities provide useful not-found routes", async ({
  page,
}) => {
  for (const path of [
    "/communities/invalid-fixture",
    "/fundraisers/invalid-fixture",
    "/profiles/invalid-fixture",
  ]) {
    const r = await page.goto(path);
    expect([200, 404]).toContain(r?.status());
    await expect(
      page.getByRole("heading", { name: "This cause isn’t here." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to discovery" }),
    ).toHaveAttribute("href", community);
    await expect(
      page.locator("meta[name=robots][content=noindex]").first(),
    ).toBeAttached();
  }
});
