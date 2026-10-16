// Explicit hosted acceptance runner. This performs real demo actions; never run
// it as part of CI validation. Session state stays private outside the repository.
import { chromium, expect } from "@playwright/test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
const origin =
  process.env.APP_ORIGIN || "https://web-production-7e5023.up.railway.app";
if (new URL(origin).protocol !== "https:" || new URL(origin).origin !== origin)
  throw new Error("APP_ORIGIN must be a canonical HTTPS origin");
const mode = process.env.VERIFY_MODE || "initial";
if (!["initial", "persistence"].includes(mode))
  throw new Error("VERIFY_MODE must be initial or persistence");
const directory =
  mode === "initial"
    ? mkdtempSync(join(tmpdir(), "gfm-hosted-session-"))
    : process.env.DEPLOYMENT_SESSION_DIR;
if (!directory || !isAbsolute(directory) || !existsSync(directory))
  throw new Error(
    "Persistence verification requires an existing absolute DEPLOYMENT_SESSION_DIR",
  );
const sessionDir = realpathSync(directory);
const repo = realpathSync(process.cwd());
const withinRepo = relative(repo, sessionDir);
if (!withinRepo.startsWith("..") && !isAbsolute(withinRepo))
  throw new Error("Browser session storage must be outside the repository");
chmodSync(sessionDir, 0o700);
const sessionPath = join(sessionDir, "browser-state.json");
const metadataPath = join(sessionDir, "acceptance.json");
const previous =
  mode === "persistence"
    ? JSON.parse(readFileSync(metadataPath, "utf8"))
    : null;
if (previous && previous.origin !== origin)
  throw new Error("Saved session belongs to another origin");
const evidenceDir = resolve("docs/evidence/deployment");
mkdirSync(evidenceDir, { recursive: true });
const label = `${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const evidence = {
  inspectedAt: new Date().toISOString(),
  origin,
  mode,
  authentication: "signed out; anonymous device-bound demo session",
  traffic: "x-demo-test: true; excluded from normal analytics",
  simulatedDonation: true,
  modelRequests: 0,
  checks: {},
  screenshots: [],
  networkFailures: [],
  pageErrors: [],
};
const privateWrite = (path, value) => {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
};
let browser;
try {
  const healthResponse = await fetch(`${origin}/api/health`, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const health = await healthResponse.json();
  expect(healthResponse.status).toBe(200);
  expect(health.status).toBe("ok");
  expect(health.deploymentId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(healthResponse.headers.has("set-cookie")).toBe(false);
  expect(healthResponse.headers.get("cache-control")).toContain("no-store");
  if (process.env.EXPECTED_DEPLOYMENT_ID)
    expect(health.deploymentId).toBe(process.env.EXPECTED_DEPLOYMENT_ID);
  if (previous) expect(health.deploymentId).not.toBe(previous.deploymentId);
  evidence.deploymentId = health.deploymentId;
  evidence.previousDeploymentId = previous?.deploymentId || null;
  evidence.checks.readiness = true;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_BIN ||
      (existsSync("/usr/bin/google-chrome")
        ? "/usr/bin/google-chrome"
        : existsSync("/usr/bin/chromium")
          ? "/usr/bin/chromium"
          : undefined),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { "x-demo-test": "true" },
    ...(previous ? { storageState: sessionPath } : {}),
  });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(30000);
  const page = await context.newPage();
  const observe = (page) => {
    page.on("pageerror", (error) => evidence.pageErrors.push(error.name));
    page.on("response", (response) => {
      if (new URL(response.url()).origin !== origin) return;
      if (response.status() >= 400)
        evidence.networkFailures.push({
          path: new URL(response.url()).pathname,
          status: response.status(),
        });
    });
  };
  observe(page);
  const capture = async (page, name) => {
    await page.evaluate(async () => {
      const position = { top: scrollY, left: scrollX };
      const paint = () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      const modalOpen = Boolean(
        document.querySelector("dialog[open], [role=dialog][aria-modal=true]"),
      );
      let timer;
      const ready = async () => {
        await document.fonts.ready;
        try {
          if (!modalOpen) {
            // Native scrolling lets the browser request lazy images normally.
            // Preserve the original position rather than altering loading attrs.
            for (
              let top = 0;
              top < document.documentElement.scrollHeight;
              top += Math.max(1, innerHeight * 0.8)
            ) {
              scrollTo({ top, left: position.left, behavior: "instant" });
              await paint();
            }
          }
          const images = Array.from(document.images).filter((image) => {
            const bounds = image.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return false;
            return (
              !modalOpen ||
              (bounds.bottom > 0 &&
                bounds.top < innerHeight &&
                bounds.right > 0 &&
                bounds.left < innerWidth)
            );
          });
          await Promise.all(
            images.map(async (image) => {
              if (!image.complete)
                await new Promise((resolve, reject) => {
                  image.addEventListener("load", resolve, { once: true });
                  image.addEventListener(
                    "error",
                    () => reject(new Error("Screenshot image failed to load")),
                    { once: true },
                  );
                });
              if (!image.naturalWidth)
                throw new Error("Screenshot image has no decoded content");
              await image.decode();
            }),
          );
        } finally {
          if (!modalOpen) scrollTo({ ...position, behavior: "instant" });
          await paint();
        }
      };
      try {
        await Promise.race([
          ready(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    "Screenshot images did not become ready within 30 seconds",
                  ),
                ),
              30_000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    });
    const filename = `${label}-${name}.png`;
    await page.screenshot({
      path: join(evidenceDir, filename),
      fullPage: true,
    });
    evidence.screenshots.push({
      file: filename,
      viewport: page.viewportSize(),
      path: new URL(page.url()).pathname,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  };
  const saveState = async () =>
    privateWrite(sessionPath, await context.storageState());
  const community = "/communities/a-greener-tomorrow";
  const fundraiser = "/fundraisers/grow-a-neighborhood";
  const reason =
    previous?.reason ||
    "Hosted acceptance: shared neighborhood gardens bring people together.";
  await page.goto(community);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await saveState();
  await capture(page, "desktop-community");
  await page
    .locator(".campaign-card")
    .first()
    .getByRole("link", { name: "Room to grow. Food to share." })
    .click();
  await expect(page).toHaveURL(origin + fundraiser);
  await capture(page, "desktop-fundraiser");
  await page.locator("#organizer a").click();
  await expect(page).toHaveURL(origin + "/profiles/maya-chen");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maya Chen");
  if (!previous)
    await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await capture(page, "desktop-organizer");
  evidence.checks.followPersistedOnReload = true;
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Following", exact: true })
    .click();
  await expect(page.locator(".campaign-card")).toHaveCount(1);
  await page.locator(".card-title-link").click();
  if (!previous) {
    await page
      .getByRole("button", { name: "Feature this cause", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("textbox").fill(reason);
    await capture(page, "desktop-feature-dialog");
    await page.getByRole("button", { name: "Save to my profile" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: /Make a difference/ }).click();
    await page.getByLabel("Donation amount").fill("12.50");
    await capture(page, "desktop-simulated-donation-dialog");
    await page
      .getByRole("button", { name: "Confirm simulated donation" })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "No money was charged.",
    );
    await page.getByRole("link", { name: "See your impact" }).click();
  } else
    await page.getByRole("link", { name: "Your demo profile" }).first().click();
  const verifySaved = async (page) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your corner of good.",
    );
    await expect(page.locator("blockquote")).toHaveText(reason);
    await expect(
      page.getByText("Contributed $12.50 in simulated support", {
        exact: true,
      }),
    ).toHaveCount(1);
  };
  await verifySaved(page);
  await page.reload();
  await verifySaved(page);
  evidence.checks.featureAndDonationPersistedOnReload = true;
  await capture(page, "desktop-private-profile");
  const cookie = (await context.cookies()).find(
    (candidate) => candidate.name === "demo_session",
  );
  expect(cookie).toBeTruthy();
  expect(cookie.secure).toBe(true);
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  evidence.cookie = {
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    path: cookie.path,
  };
  await saveState();
  if (!previous)
    privateWrite(metadataPath, {
      origin,
      reason,
      deploymentId: health.deploymentId,
      savedAt: new Date().toISOString(),
    });
  if (process.env.LIVE_AI_CHECK === "1") {
    if (previous)
      throw new Error("Live AI check is limited to the initial acceptance run");
    await page.goto(fundraiser);
    await page.getByRole("button", { name: /A little clarity/ }).click();
    const dialog = page.getByRole("dialog", {
      name: "Ask about this fundraiser",
    });
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/ask",
      { timeout: 30000 },
    );
    await dialog
      .getByLabel("Your question")
      .fill("What will the funds be used for?");
    await dialog.getByRole("button", { name: "Send message" }).click();
    const response = await responsePromise;
    evidence.modelRequests = 1;
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/event-stream");
    await expect(dialog.locator(".chat-pending")).toHaveCount(0, {
      timeout: 30000,
    });
    await expect(dialog.locator(".answer")).toBeVisible({ timeout: 30000 });
    await expect(dialog.locator(".answer .citation").first()).toBeVisible();
    evidence.liveAi = {
      status: response.status(),
      transport: "text/event-stream",
      answer: await dialog.locator(".answer").innerText(),
      citations: await dialog.locator(".answer .citation").allTextContents(),
    };
    await capture(page, "desktop-live-ai");
  }
  const mobile = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    storageState: sessionPath,
    extraHTTPHeaders: { "x-demo-test": "true" },
  });
  mobile.setDefaultTimeout(15000);
  mobile.setDefaultNavigationTimeout(30000);
  const phone = await mobile.newPage();
  observe(phone);
  await phone.goto(community);
  await capture(phone, "mobile-community");
  await phone
    .locator(".campaign-card")
    .first()
    .getByRole("link", { name: "Room to grow. Food to share." })
    .click();
  await expect(phone).toHaveURL(origin + fundraiser);
  await capture(phone, "mobile-fundraiser");
  await phone.getByRole("button", { name: /Make a difference/ }).click();
  await expect(phone.getByRole("dialog")).toBeVisible();
  await capture(phone, "mobile-simulated-donation-dialog");
  await phone
    .getByRole("dialog")
    .getByRole("button", { name: "Close" })
    .click();
  await phone.locator("#organizer a").click();
  await expect(phone).toHaveURL(origin + "/profiles/maya-chen");
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText(
    "Maya Chen",
  );
  await expect(
    phone.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await capture(phone, "mobile-organizer");
  await phone.locator(".my-profile-link").click();
  await verifySaved(phone);
  await capture(phone, "mobile-private-profile");
  evidence.checks.desktopAndMobileNavigation = true;
  evidence.checks.savedSessionAfterReplacement = Boolean(previous);
  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.networkFailures).toEqual([]);
  evidence.status = "passed";
  console.log(`Private session directory for replacement check: ${sessionDir}`);
} catch (error) {
  evidence.status = "failed";
  evidence.failure = error.message;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  const evidencePath = join(evidenceDir, `${label}.json`);
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
  console.log(`Hosted evidence: ${evidencePath} (${evidence.status})`);
}
