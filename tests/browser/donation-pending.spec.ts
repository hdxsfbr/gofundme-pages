import { test, expect, type Page } from "@playwright/test";
import { actor, campaign, db, fundraiser } from "./helpers";

type DonationRequest = {
  action: string;
  campaignId: string;
  amount: string;
  key: string;
};

async function holdFirstSavedDonation(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saved!: (request: DonationRequest) => void;
  const firstSaved = new Promise<DonationRequest>((resolve) => {
    saved = resolve;
  });
  let held = false;
  await page.route("**/api/actions", async (route) => {
    const request = route.request().postDataJSON() as DonationRequest;
    if (request.action !== "donate" || held) return route.continue();
    held = true;
    // Persist through the real endpoint, then delay only its acknowledgement.
    // This models a slow/lost response without fabricating a completed donation.
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    saved(request);
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  return { firstSaved, release: () => release() };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Automated suite: no live model calls permitted." },
    }),
  );
});

test("pending donation freezes amount controls and confirms the exact durably saved cents", async ({
  page,
}) => {
  await page.goto(fundraiser);
  const visitor = await actor(page.context());
  const held = await holdFirstSavedDonation(page);
  try {
    await page.getByRole("button", { name: /Make a difference/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Donation amount").fill("12.50");
    await dialog
      .getByRole("button", { name: "Confirm simulated donation" })
      .click();
    const request = await held.firstSaved;
    expect(request.amount).toBe("12.50");
    expect(request.campaignId).toBe(campaign);
    await expect(dialog.getByLabel("Donation amount")).toBeDisabled();
    for (const amount of ["$10", "$25", "$50", "$100"]) {
      await expect(
        dialog.getByRole("button", { name: amount, exact: true }),
      ).toBeDisabled();
    }
    await expect(
      dialog.getByRole("button", { name: "Saving your support…" }),
    ).toBeDisabled();
    await expect(dialog.getByLabel("Donation amount")).toHaveValue("12.50");
    const persisted = await db.query(
      "SELECT cents FROM donations WHERE visitor_id=$1 AND idempotency_key=$2",
      [visitor, request.key],
    );
    expect(persisted.rows).toEqual([{ cents: 1250 }]);
    held.release();
    await expect(
      dialog.getByRole("heading", { name: "$12.50 in simulated support" }),
    ).toBeVisible();
    await expect(
      page.locator(".support-panel .funding-line strong"),
    ).toHaveText("$11,862.50");
    await expect
      .poll(
        async () =>
          (
            await db.query(
              "SELECT count(*)::int n FROM events WHERE visitor_id=$1 AND name='donation_completed'",
              [visitor],
            )
          ).rows[0].n,
      )
      .toBe(1);
  } finally {
    held.release();
  }
});

test("closing and reopening during a pending donation prevents the old response completing the new attempt", async ({
  page,
}) => {
  await page.goto(fundraiser);
  const visitor = await actor(page.context());
  const held = await holdFirstSavedDonation(page);
  try {
    const trigger = page.getByRole("button", { name: /Make a difference/ });
    await trigger.click();
    await page.getByLabel("Donation amount").fill("12.50");
    await page
      .getByRole("button", { name: "Confirm simulated donation" })
      .click();
    const first = await held.firstSaved;
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await trigger.click();
    const nextDialog = page.getByRole("dialog", {
      name: "Support this good thing",
    });
    await expect(nextDialog.getByLabel("Donation amount")).toBeEnabled();
    await nextDialog.getByLabel("Donation amount").fill("50");
    held.release();
    // The old save must update funding, while this new form remains unsubmitted.
    // Waiting for funding also ensures the delayed response has reached React.
    await expect(
      page.locator(".support-panel .funding-line strong"),
    ).toHaveText("$11,862.50");
    await expect(nextDialog).toBeVisible();
    await expect(nextDialog.getByLabel("Donation amount")).toHaveValue("50");
    await expect(
      nextDialog.getByRole("button", { name: "Confirm simulated donation" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("dialog", { name: "A little good, added." }),
    ).toHaveCount(0);
    expect(
      (
        await db.query("SELECT cents FROM donations WHERE visitor_id=$1", [
          visitor,
        ])
      ).rows,
    ).toEqual([{ cents: 1250 }]);
    const secondRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/actions") &&
        request.method() === "POST" &&
        request.postDataJSON().action === "donate",
    );
    await nextDialog
      .getByRole("button", { name: "Confirm simulated donation" })
      .click();
    const second = (await secondRequest).postDataJSON() as DonationRequest;
    expect(second.key).not.toBe(first.key);
    expect(second.amount).toBe("50");
    await expect(page.getByRole("dialog")).toContainText(
      "$50.00 in simulated support",
    );
    await expect(
      page.locator(".support-panel .funding-line strong"),
    ).toHaveText("$11,912.50");
    expect(
      (
        await db.query(
          "SELECT cents FROM donations WHERE visitor_id=$1 ORDER BY created_at",
          [visitor],
        )
      ).rows,
    ).toEqual([{ cents: 1250 }, { cents: 5000 }]);
    await expect
      .poll(
        async () =>
          (
            await db.query(
              "SELECT count(*)::int n FROM events WHERE visitor_id=$1 AND name='donation_completed'",
              [visitor],
            )
          ).rows[0].n,
      )
      .toBe(2);
  } finally {
    held.release();
  }
});

test("an older donation acknowledgement cannot overwrite a newer completed donation or its funding total", async ({
  page,
}) => {
  await page.goto(fundraiser);
  const visitor = await actor(page.context());
  const held = await holdFirstSavedDonation(page);
  try {
    const trigger = page.getByRole("button", { name: /Make a difference/ });
    await trigger.click();
    await page.getByLabel("Donation amount").fill("12.50");
    await page
      .getByRole("button", { name: "Confirm simulated donation" })
      .click();
    const first = await held.firstSaved;
    await page.keyboard.press("Escape");
    await trigger.click();
    await page.getByLabel("Donation amount").fill("50");
    await page
      .getByRole("button", { name: "Confirm simulated donation" })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "$50.00 in simulated support",
    );
    await expect(
      page.locator(".support-panel .funding-line strong"),
    ).toHaveText("$11,912.50");
    const oldAcknowledged = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/actions") &&
        response.request().postDataJSON().key === first.key,
    );
    // The late acknowledgement must refresh authoritative records, rather than
    // committing its older response snapshot over the newer completed donation.
    const refreshed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === fundraiser &&
        response.request().headers()["rsc"] === "1",
    );
    held.release();
    await (await oldAcknowledged).finished();
    await refreshed;
    // RSC streams can remain open; wait for the next paint instead of EOF.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.getByRole("dialog")).toContainText(
      "$50.00 in simulated support",
    );
    await expect(
      page.locator(".support-panel .funding-line strong"),
    ).toHaveText("$11,912.50");
    expect(
      (
        await db.query(
          "SELECT cents FROM donations WHERE visitor_id=$1 ORDER BY created_at",
          [visitor],
        )
      ).rows,
    ).toEqual([{ cents: 1250 }, { cents: 5000 }]);
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(
      page.locator(".support-panel .funding-line strong"),
    ).toHaveText("$11,912.50");
  } finally {
    held.release();
  }
});
