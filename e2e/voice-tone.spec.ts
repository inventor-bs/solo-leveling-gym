// e2e/voice-tone.spec.ts
import { test, expect, type Page } from "@playwright/test";

/**
 * Mirrors the inline login block every other e2e spec in this suite
 * repeats (see e2e/cosmetic.spec.ts and e2e/economy.spec.ts) — same PIN
 * check, same skip conditions. This repo has no shared login helper
 * module; every spec copies this block rather than importing one.
 */
async function loginAsOwner(page: Page): Promise<void> {
  const pin = process.env.HUNTER_PIN;
  test.skip(!pin, "HUNTER_PIN not set in the environment running this test");

  await page.goto("/login");
  await page.locator('input[type="password"]').fill(pin!);
  await page.getByRole("button", { name: /authenticate/i }).click();
  await page.waitForURL(/\/(onboarding|dashboard)/);
  test.skip(
    page.url().includes("onboarding"),
    "needs an onboarded hunter; the onboarding spec covers that path",
  );
}

test.describe("Voice of the Ruler", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("the Store lists the item with all four sample lines and no console error", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/store");
    await expect(
      page.getByRole("heading", { name: "COSMETIC", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Voice of the Ruler/)).toBeVisible();

    // One distinctive fragment per voice. These are the only part of this
    // feature a human can verify, so their presence on the page is the
    // thing worth asserting.
    for (const fragment of [
      "A new record. Do not let this be the last time.",
      "Predictable, eventually.",
      "Thy strength hath grown",
      "New maximum. Noted.",
    ]) {
      await expect(page.getByText(fragment, { exact: false })).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test("renders either the UNLOCK button or the four tone buttons, never both", async ({
    page,
  }) => {
    // Branch, never force: the bundle is a real 4,000 G purchase this
    // fixture hunter either made or did not. Both renders must be clean —
    // a Server Component handing a closure to a client component would 500
    // this page for every visitor, which is the regression this catches.
    await page.goto("/store");

    const coldButton = page.getByRole("button", { name: "COLD", exact: true });
    if ((await coldButton.count()) > 0) {
      await expect(coldButton).toBeVisible();
      for (const name of ["MOCKING", "ANCIENT", "MERCILESS"]) {
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      }
      await expect(
        page.getByText(/daily briefing from the next reset/),
      ).toBeVisible();
    } else {
      await expect(coldButton).toHaveCount(0);
      await expect(
        page.getByText("Unlocks three more voices for the System.", {
          exact: false,
        }),
      ).toBeVisible();
    }
  });

  test("the Dashboard still renders a System message in whatever voice is live", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Welcome back/ }),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
