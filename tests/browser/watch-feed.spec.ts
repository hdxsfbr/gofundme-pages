import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { actor, community, db, origin, noOverflow } from "./helpers";

const watchRoute = `${community}/watch`;
const evidence = "docs/evidence/watch-20261016";

test("Watch defers optional media until hydration and keeps sources adjacent during navigation", async ({
  page,
}) => {
  let allowScripts = () => {};
  const scriptsAllowed = new Promise<void>((resolve) => {
    allowScripts = resolve;
  });
  const mediaRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/media/watch/")) mediaRequests.push(path);
  });
  await page.route("**/_next/**/*.js", async (route) => {
    await scriptsAllowed;
    await route.continue();
  });

  try {
    const response = await page.goto(watchRoute, { waitUntil: "commit" });
    expect(response?.ok()).toBe(true);
    const serverSources = await page.evaluate(
      (html) => {
        const document = new DOMParser().parseFromString(html, "text/html");
        return {
          posters: [...document.querySelectorAll(".watch-poster[src]")].map(
            (image) => image.getAttribute("src"),
          ),
          videos: [...document.querySelectorAll(".watch-video[src]")].map(
            (video) => video.getAttribute("src"),
          ),
        };
      },
      await response!.text(),
    );
    expect(serverSources).toEqual({
      posters: ["/media/watch/garden.webp"],
      videos: [],
    });
    await expect(page.getByTestId("watch-feed")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.locator(".watch-poster[src]")).toHaveCount(1);
    await expect(page.locator("video[src]")).toHaveCount(0);
    expect(mediaRequests).toEqual(["/media/watch/garden.webp"]);
  } finally {
    allowScripts();
  }

  await expect(page.getByTestId("watch-feed")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".watch-poster[src]")).toHaveCount(2);
  await expect(page.locator("video[src]")).toHaveCount(2);
  const activeVideo = page.locator(".watch-item.is-active video");
  await expect(activeVideo).toHaveAttribute("src", "/media/watch/garden.mp4");
  await expect(
    page.locator('[data-clip-id="tree-care"] video'),
  ).toHaveAttribute("src", "/media/watch/trees.mp4");
  await expect
    .poll(() =>
      activeVideo.evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0.2);

  await page
    .locator(".watch-navigation")
    .getByRole("button", { name: "Next clip" })
    .click();
  await expect(activeVideo).toHaveAttribute("src", "/media/watch/trees.mp4");
  await expect(page.locator(".watch-poster[src]")).toHaveCount(3);
  await expect(page.locator("video[src]")).toHaveCount(2);
  await expect(
    page.locator('[data-clip-id="garden-neighbors"] video'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-clip-id="common-ground-solar"] video'),
  ).toHaveAttribute("src", "/media/watch/solar.mp4");
  await expect(
    page.locator('[data-clip-id="open-path-access"] img'),
  ).not.toHaveAttribute("src");
  await expect
    .poll(() =>
      activeVideo.evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0.2);
  expect(
    await page
      .locator("video")
      .evaluateAll((videos) =>
        videos
          .filter(
            (video): video is HTMLVideoElement =>
              video instanceof HTMLVideoElement && !video.paused,
          )
          .map((video) => video.getAttribute("src")),
      ),
  ).toEqual(["/media/watch/trees.mp4"]);
});

test("reduced motion overrides saved autoplay when Watch is re-entered", async ({
  page,
}) => {
  await page.goto(community);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Watch" }).click();
  const video = page.locator(".watch-item.is-active video");
  await expect(video).toHaveAttribute("src", "/media/watch/garden.mp4");
  await expect(
    page
      .locator(".watch-item.is-active")
      .getByText("Illustrative stock footage | Fictional demo", {
        exact: false,
      }),
  ).toBeVisible();
  await expect
    .poll(() => video.evaluate((item: HTMLVideoElement) => item.readyState))
    .toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Play video" }).click();
  await expect
    .poll(() => video.evaluate((item: HTMLVideoElement) => item.currentTime))
    .toBeGreaterThan(0.2);

  await page.getByRole("link", { name: "Explore campaigns" }).click();
  await expect(page).toHaveURL(new RegExp(`${community}(?:\\?.*)?$`));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await nav.getByRole("link", { name: "Watch" }).click();
  const returnedVideo = page.locator(".watch-item.is-active video");
  await expect(returnedVideo).toHaveAttribute("src", "/media/watch/garden.mp4");
  await expect
    .poll(() => returnedVideo.evaluate((item: HTMLVideoElement) => item.paused))
    .toBe(true);
});

test("enabling reduced motion while Watch is mounted stops autoplay but allows manual Play", async ({
  page,
}) => {
  await page.goto(community);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Watch" })
    .click();
  const video = page.locator(".watch-item.is-active video");
  await expect
    .poll(() => video.evaluate((item: HTMLVideoElement) => item.currentTime))
    .toBeGreaterThan(0.2);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => video.evaluate((item: HTMLVideoElement) => item.paused))
    .toBe(true);
  await page.getByRole("button", { name: "Play video" }).click();
  await expect
    .poll(() => video.evaluate((item: HTMLVideoElement) => item.currentTime))
    .toBeGreaterThan(0.5);
});

test("Watch loads media only on entry, plays one clip, navigates, and ends explicitly", async ({
  page,
}) => {
  const videoRequests: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.includes("/media/watch/") &&
      new URL(request.url()).pathname.endsWith(".mp4")
    )
      videoRequests.push(request.url());
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(community);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(400);
  expect(videoRequests).toEqual([]);
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    let denyOnce = true;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLVideoElement && denyOnce) {
        denyOnce = false;
        return Promise.reject(
          new DOMException("Playback denied by test", "NotAllowedError"),
        );
      }
      return original.call(this);
    };
  });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Watch" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${watchRoute}(?:\\?.*)?$`));
  const scroller = page.locator(".watch-scroller");
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "garden-neighbors",
  );
  await expect(page.locator(".watch-item.is-active[data-clip-id]")).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("button", { name: "No audio available in this demo clip" }),
  ).toBeDisabled();
  const activeVideo = page.locator(".watch-item.is-active video");
  await expect(activeVideo).toHaveAttribute("src", "/media/watch/garden.mp4");
  await expect
    .poll(() =>
      activeVideo.evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("status")).toContainText("Tap Play to watch");
  await page.getByRole("button", { name: "Play video" }).click();
  await expect
    .poll(() =>
      activeVideo.evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0.5);
  expect(
    new Set(videoRequests.map((url) => new URL(url).pathname)).size,
  ).toBeLessThanOrEqual(2);
  expect(
    new Set(videoRequests.map((url) => new URL(url).pathname)).size,
  ).toBeGreaterThanOrEqual(1);
  await expect(page.locator("video")).toHaveCount(2);

  mkdirSync(evidence, { recursive: true });
  const firstVideo = await activeVideo.elementHandle();
  // Watch is a fixed-height shell, so a viewport capture is the full page.
  // fullPage capture briefly resizes the viewport, which on the slow CI
  // runner let a late re-layout move the feed before the Next click.
  await page.screenshot({ path: `${evidence}/desktop.png` });
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "garden-neighbors",
  );
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(0);
  await page
    .locator(".watch-navigation")
    .getByRole("button", { name: "Next clip" })
    .click();
  await expect(scroller).toHaveAttribute("data-active-clip", "tree-care");
  await expect(page.locator(".watch-item.is-active video")).toHaveAttribute(
    "src",
    "/media/watch/trees.mp4",
  );
  await expect
    .poll(() =>
      page
        .locator(".watch-item.is-active video")
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0.2);
  await expect
    .poll(() => firstVideo!.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(true);
  expect(
    new Set(videoRequests.map((url) => new URL(url).pathname)).size,
  ).toBeLessThanOrEqual(3);

  for (const clip of ["common-ground-solar", "open-path-access"]) {
    await page
      .locator(".watch-navigation")
      .getByRole("button", { name: "Next clip" })
      .click();
    await expect(scroller).toHaveAttribute("data-active-clip", clip);
    const currentVideo = page.locator(".watch-item.is-active video");
    const track = page.locator(".watch-item.is-active video track");
    await expect
      .poll(() =>
        currentVideo.evaluate((video: HTMLVideoElement) => video.readyState),
      )
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(() =>
        currentVideo.evaluate((video: HTMLVideoElement) => video.currentTime),
      )
      .toBeGreaterThan(0.2);
    await expect
      .poll(() => track.evaluate((item: HTMLTrackElement) => item.readyState))
      .toBe(2);
    expect(
      await track.evaluate(
        (item: HTMLTrackElement) => item.track.cues?.length ?? 0,
      ),
    ).toBeGreaterThanOrEqual(2);
  }
  await page
    .locator(".watch-navigation")
    .getByRole("button", { name: "Next clip" })
    .click();
  await expect(scroller).toHaveAttribute("data-active-clip", "end");
  await expect(page.getByTestId("watch-end")).toContainText(
    "You’ve seen every story",
  );
  await page.getByRole("button", { name: "Replay stories" }).click();
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "garden-neighbors",
  );
  // Replay settles on the first story (not one past it) before the next
  // keyboard step; steps closer than 360 ms are intentionally ignored.
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(0);
  await page.waitForTimeout(100);
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "garden-neighbors",
  );
  await scroller.focus();
  await page.keyboard.press("ArrowDown");
  await expect(scroller).toHaveAttribute("data-active-clip", "tree-care");
  await page.waitForTimeout(400);
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 540);
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "common-ground-solar",
  );
  await expect(await page.locator("video").count()).toBeLessThanOrEqual(2);
  await noOverflow(page);
});

test("mobile swipe advances one story and donation/follow/share restore the originating clip", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin,
  });
  const page = await context.newPage();
  try {
    await page.goto(community);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("link", { name: "Following" }).click();
    await expect(page).toHaveURL(/view=following/);
    await nav.getByRole("link", { name: "Watch" }).click();
    const scroller = page.locator(".watch-scroller");
    await expect(scroller).toHaveAttribute(
      "data-active-clip",
      "garden-neighbors",
    );
    await expect
      .poll(() =>
        page
          .locator(".watch-item.is-active video")
          .evaluate((video: HTMLVideoElement) => video.readyState),
      )
      .toBeGreaterThanOrEqual(2);

    const mediaBox = await page
      .locator(".watch-item.is-active .watch-media")
      .boundingBox();
    expect(mediaBox).not.toBeNull();
    const cdp = await context.newCDPSession(page);
    const swipe = async (id: number, distance: number) => {
      const x = Math.round(mediaBox!.x + mediaBox!.width / 2);
      const y = Math.round(mediaBox!.y + mediaBox!.height * 0.55);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + distance, id }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    };
    await swipe(0, -20);
    await expect(scroller).toHaveAttribute(
      "data-active-clip",
      "garden-neighbors",
    );
    await swipe(1, -Math.round(mediaBox!.height * 0.8));
    await expect(scroller).toHaveAttribute("data-active-clip", "tree-care", {
      timeout: 4000,
    });
    await page.waitForTimeout(400);
    await swipe(2, Math.round(mediaBox!.height * 0.8));
    await expect(scroller).toHaveAttribute(
      "data-active-clip",
      "garden-neighbors",
      { timeout: 4000 },
    );
    await page.waitForTimeout(400);
    await swipe(3, -Math.round(mediaBox!.height * 0.8));
    await swipe(4, -Math.round(mediaBox!.height * 0.8));
    await expect(scroller).toHaveAttribute("data-active-clip", "tree-care");
    await page.waitForTimeout(450);
    await expect(scroller).toHaveAttribute("data-active-clip", "tree-care");
    const currentMedia = await page
      .locator(".watch-item.is-active .watch-media")
      .boundingBox();
    expect(currentMedia).not.toBeNull();
    await swipe(5, Math.round(currentMedia!.height * 0.8));
    await expect(scroller).toHaveAttribute(
      "data-active-clip",
      "garden-neighbors",
    );

    const follow = page
      .locator(".watch-item.is-active")
      .getByRole("button", { name: "Follow" });
    await follow.click();
    await expect(
      page
        .locator(".watch-item.is-active")
        .getByRole("button", { name: "Following" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .locator(".watch-item.is-active")
      .getByRole("button", { name: "Share" })
      .click();
    const share = page.getByRole("dialog", {
      name: "Pass a little good along",
    });
    await expect(share.getByLabel("Public link")).toHaveValue(
      `${origin}/fundraisers/grow-a-neighborhood`,
    );
    await share.getByRole("button", { name: "Copy link" }).click();
    await expect(share.getByRole("status")).toContainText("Link copied");
    await share.getByRole("button", { name: "Close dialog" }).click();

    const video = page.locator(".watch-item.is-active video");
    await video.evaluate((element: HTMLVideoElement) => {
      element.currentTime = 4;
    });
    if (await page.getByRole("button", { name: "Pause video" }).count())
      await page.getByRole("button", { name: "Pause video" }).click();
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Play video" }),
    ).toBeVisible();

    await page
      .locator(".watch-identity")
      .getByRole("link", { name: "View Maya Chen's profile" })
      .click();
    await expect(page).toHaveURL(/\/profiles\/maya-chen$/);
    await page.goBack();
    await expect(page).toHaveURL(
      new RegExp(`${watchRoute}\\?clip=garden-neighbors$`),
    );
    await expect(scroller).toHaveAttribute(
      "data-active-clip",
      "garden-neighbors",
    );
    await expect
      .poll(() =>
        page
          .locator(".watch-item.is-active video")
          .evaluate((element: HTMLVideoElement) => element.currentTime),
      )
      .toBeGreaterThanOrEqual(3.8);
    await expect
      .poll(() =>
        page
          .locator(".watch-item.is-active video")
          .evaluate((element: HTMLVideoElement) => element.paused),
      )
      .toBe(true);

    await page
      .locator(".watch-item.is-active")
      .getByRole("link", { name: "Help a neighborhood grow something good" })
      .click();
    await expect(page).toHaveURL(/\/fundraisers\/grow-a-neighborhood$/);
    await page.goBack();
    await expect(page).toHaveURL(
      new RegExp(`${watchRoute}\\?clip=garden-neighbors$`),
    );
    await expect(scroller).toHaveAttribute(
      "data-active-clip",
      "garden-neighbors",
    );
    await expect
      .poll(() =>
        page
          .locator(".watch-item.is-active video")
          .evaluate((element: HTMLVideoElement) => element.currentTime),
      )
      .toBeGreaterThanOrEqual(3.8);
    await expect
      .poll(() =>
        page
          .locator(".watch-item.is-active video")
          .evaluate((element: HTMLVideoElement) => element.paused),
      )
      .toBe(true);

    await page
      .locator(".watch-item.is-active")
      .getByRole("button", { name: "Donate now" })
      .click();
    const donation = page.locator("dialog");
    await expect
      .poll(() =>
        page
          .locator(".watch-item.is-active video")
          .evaluate((element: HTMLVideoElement) => element.paused),
      )
      .toBe(true);
    await expect(
      page
        .locator(".watch-navigation")
        .getByRole("button", { name: "Next clip" }),
    ).toBeDisabled();
    await donation.getByLabel("Donation amount").fill("12.50");
    await donation
      .getByRole("button", { name: "Confirm simulated donation" })
      .click();
    await expect(donation).toContainText("No money was charged.");
    await donation.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.locator(".watch-item.is-active video")).toHaveAttribute(
      "src",
      "/media/watch/garden.mp4",
    );
    await expect
      .poll(() =>
        page
          .locator(".watch-item.is-active video")
          .evaluate((element: HTMLVideoElement) => element.paused),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator(".watch-item.is-active video")
          .evaluate((element: HTMLVideoElement) => element.currentTime),
      )
      .toBeGreaterThanOrEqual(3.8);
    await expect(page.locator(".watch-item.is-active .funding")).toContainText(
      "$11,862.50",
    );
    await noOverflow(page);
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/mobile.png`, fullPage: true });

    const visitor = await actor(context);
    const actions = await db.query(
      `SELECT name, entity_id, properties FROM events WHERE visitor_id=$1 AND name IN ('follow_changed','share_opened','share_copied','donation_started','donation_completed') ORDER BY created_at`,
      [visitor],
    );
    expect(actions.rows).toHaveLength(5);
    for (const row of actions.rows) {
      expect(row.entity_id).toBe("grow-a-neighborhood");
      expect(row.properties).toMatchObject({
        source: "watch",
        sourceId: "garden-neighbors",
      });
    }
    const gifts = await db.query(
      "SELECT count(*)::int AS count FROM donations WHERE visitor_id=$1 AND campaign_id='grow-a-neighborhood' AND cents=1250",
      [visitor],
    );
    expect(gifts.rows[0].count).toBe(1);

    await page.goBack();
    await expect(page).toHaveURL(/view=following/);
    await expect(page.locator(".campaign-card")).toHaveCount(1);
    await expect(page.locator(".campaign-card")).toContainText(
      "Room to grow. Food to share.",
    );
  } finally {
    await context.close();
  }
});

test("direct, invalid, and storage-blocked Watch links remain recoverable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException(
          "Storage is disabled for this test",
          "SecurityError",
        );
      },
    });
  });
  await page.goto(`${watchRoute}?clip=tree-care`);
  await expect(page.locator(".watch-scroller")).toHaveAttribute(
    "data-active-clip",
    "tree-care",
  );
  await expect(
    page.locator(".watch-item.is-active .watch-campaign-link"),
  ).toContainText("Plant the roots of a greener future");
  await expect(
    page.getByRole("link", { name: "Explore campaigns" }).first(),
  ).toBeVisible();
  await page.goto(`${watchRoute}?clip=does-not-exist`);
  await expect(page.getByTestId("watch-invalid-clip")).toContainText(
    "This clip is unavailable",
  );
  const missing = await page.goto("/communities/no-such-community/watch");
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This cause isn’t here." }),
  ).toBeVisible();
});

test("Watch server-renders the selected poster and defers video until hydration", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${watchRoute}?clip=tree-care`);
    await expect(page.locator(".watch-scroller")).toHaveAttribute(
      "data-active-clip",
      "tree-care",
    );
    await expect(
      page.locator(".watch-item.is-active img.watch-poster"),
    ).toHaveAttribute("src", "/media/watch/trees.webp");
    await expect(
      page.locator(".watch-item.is-active img.watch-poster"),
    ).toHaveAttribute("fetchpriority", "high");
    await expect(page.locator(".watch-item video[src]")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "More trees. A cooler tomorrow." }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("visibility changes pause playback and preserve explicit pause intent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(watchRoute);
  const video = page.locator(".watch-item.is-active video");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);

  const setVisibility = async (state: "hidden" | "visible") => {
    await page.evaluate((value) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);
  };
  await setVisibility("hidden");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
  await setVisibility("visible");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);

  await page.getByRole("button", { name: "Pause video" }).click();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
  await setVisibility("hidden");
  await setVisibility("visible");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
});

test("reduced motion, keyboard focus, enlarged text, and short landscape stay usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${watchRoute}?clip=tree-care`);
  const scroller = page.locator(".watch-scroller");
  const video = page.locator(".watch-item.is-active video");
  await expect(scroller).toHaveAttribute("data-active-clip", "tree-care");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
  await page
    .locator(".watch-navigation")
    .getByRole("button", { name: "Next clip" })
    .click();
  await expect(scroller).toHaveAttribute(
    "data-active-clip",
    "common-ground-solar",
  );
  expect(
    await scroller.evaluate((element) =>
      Math.abs(element.scrollTop - element.clientHeight * 2),
    ),
  ).toBeLessThanOrEqual(1);
  const solarVideo = page.locator(".watch-item.is-active video");
  await expect
    .poll(() =>
      solarVideo.evaluate((element: HTMLVideoElement) => element.paused),
    )
    .toBe(true);
  await expect(
    page.locator('.watch-item[data-clip-id][aria-hidden="true"]'),
  ).toHaveCount(3);
  await expect(
    page.locator('.watch-item[data-clip-id][aria-hidden="true"]').first(),
  ).toHaveJSProperty("inert", true);

  await scroller.focus();
  await page.keyboard.press("Tab");
  const play = page.getByRole("button", { name: "Play video" });
  await expect(play).toBeFocused();
  await expect(play).toHaveCSS("outline-style", "solid");
  const visitor = await actor(page.context());
  await page
    .locator(".watch-item.is-active")
    .getByRole("button", { name: "Donate now" })
    .click();
  const donation = page.locator("dialog");
  await expect(donation).toBeVisible();
  await expect
    .poll(() =>
      solarVideo.evaluate((element: HTMLVideoElement) => element.paused),
    )
    .toBe(true);
  await expect(
    page
      .locator(".watch-navigation")
      .getByRole("button", { name: "Next clip" }),
  ).toBeDisabled();
  await page.waitForTimeout(1200);
  const covered = await db.query(
    "SELECT count(*)::int AS count FROM events WHERE visitor_id=$1 AND name='video_clip_impression' AND properties->>'sourceId'='common-ground-solar'",
    [visitor],
  );
  expect(covered.rows[0].count).toBe(0);
  await donation.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page
      .locator(".watch-item.is-active")
      .getByRole("button", { name: "Donate now" }),
  ).toBeFocused();
  await expect
    .poll(async () => {
      const result = await db.query(
        "SELECT count(*)::int AS count FROM events WHERE visitor_id=$1 AND name='video_clip_impression' AND properties->>'sourceId'='common-ground-solar'",
        [visitor],
      );
      return result.rows[0].count;
    })
    .toBe(1);
  const exposure = await db.query(
    "SELECT properties FROM events WHERE visitor_id=$1 AND name='video_clip_impression' AND properties->>'sourceId'='common-ground-solar'",
    [visitor],
  );
  expect(exposure.rows[0].properties).toEqual({
    source: "watch",
    sourceId: "common-ground-solar",
  });

  await page.evaluate(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".site-header *, .watch-shell *"),
    );
    const sizes = elements.map(
      (element) => [element, getComputedStyle(element).fontSize] as const,
    );
    for (const [element, size] of sizes) {
      const pixels = Number.parseFloat(size);
      if (Number.isFinite(pixels))
        element.style.setProperty("font-size", `${pixels * 2}px`, "important");
    }
  });
  mkdirSync(evidence, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${evidence}/text-zoom-200.png` });
  await noOverflow(page);
  await page
    .locator(".watch-item.is-active")
    .getByRole("button", { name: "Donate now" })
    .scrollIntoViewIfNeeded();
  await expect(
    page
      .locator(".watch-item.is-active")
      .getByRole("button", { name: "Donate now" }),
  ).toBeVisible();
  await page.screenshot({ path: `${evidence}/text-zoom-200-actions.png` });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>(
      ".site-header *, .watch-shell *",
    ))
      element.style.removeProperty("font-size");
  });
  await noOverflow(page);
  await page
    .locator(".watch-item.is-active")
    .getByRole("button", { name: "Donate now" })
    .scrollIntoViewIfNeeded();
  await expect(
    page
      .locator(".watch-item.is-active")
      .getByRole("button", { name: "Donate now" }),
  ).toBeVisible();
  await page.screenshot({ path: `${evidence}/landscape-actions.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${evidence}/landscape.png` });
});

test("broken media keeps campaign context and offers retry, next, and discovery exit", async ({
  page,
}) => {
  await page.route("**/media/watch/trees.mp4", (route) => route.abort());
  await page.goto(`${watchRoute}?clip=tree-care`);
  await expect(page.getByTestId("watch-feed")).toBeVisible();
  await expect(page.locator(".watch-media-notice")).toContainText(
    "Video could not load",
  );
  await expect(
    page.getByRole("link", { name: "Plant the roots of a greener future" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry video" }).click();
  await expect(page.locator(".watch-media-notice")).toContainText(
    "Video could not load",
  );
  await page
    .locator(".watch-media-notice")
    .getByRole("button", { name: "Next clip" })
    .click();
  await expect(page.locator(".watch-scroller")).toHaveAttribute(
    "data-active-clip",
    "common-ground-solar",
  );
  await page.getByRole("link", { name: "Explore campaigns" }).first().click();
  await expect(page).toHaveURL(new RegExp(`${community}$`));
});
