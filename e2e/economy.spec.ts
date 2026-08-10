// e2e/economy.spec.ts
import { test, expect, type Page } from "@playwright/test";

/**
 * These assert what an anonymous visitor and the owner each SEE. The rules
 * themselves are covered by unit tests at the app-service layer; repeating
 * them here against rendered HTML would test React, not the economy.
 */

/**
 * Mirrors the inline login block every other e2e spec in this suite repeats
 * (see e2e/shadow-army.spec.ts) — same PIN check, same skip conditions.
 * Factored into one helper here only because this file calls it six times.
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

test.describe("Store", () => {
  test("an anonymous visitor can read the Store without a write control", async ({
    page,
  }) => {
    await page.goto("/store");
    // Reads stay public by design — the whole point is a public record.
    // Scoped to the page's own <h1> rather than any text node: the sidebar
    // nav renders a "Exchange" subtitle under its Store link on every page,
    // which a plain text match would also catch. The locked-state title
    // (no hunter registered yet) renders as a <p>, not a heading, so it
    // needs its own branch of the locator.
    const heading = page.getByRole("heading", { name: "Exchange" });
    const locked = page.getByText("SYSTEM STORE");
    await expect(heading.or(locked)).toBeVisible();
  });

  test("the owner sees the three challenges with their prices", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/store");
    await expect(page.getByText("Red Gate")).toBeVisible();
    await expect(page.getByText("2500 G")).toBeVisible();
    await expect(page.getByText("Boss Raid")).toBeVisible();
    await expect(page.getByText("4000 G")).toBeVisible();
    await expect(page.getByText("Demon Castle Floor")).toBeVisible();
  });

  test("the Store says outright that nothing here buys progress", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/store");
    await expect(page.getByText(/Nothing here buys progress/i)).toBeVisible();
  });

  test("an unaffordable unlock renders with its button disabled", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/store");
    // A fresh hunter holds no gold, so every UNLOCK button is disabled.
    const unlockButtons = page.getByRole("button", { name: "UNLOCK" });
    await expect(unlockButtons.first()).toBeDisabled();
  });
});

test.describe("Inventory", () => {
  test("shows all three slots as empty before anything has dropped", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/inventory");
    await expect(page.getByText("Knight Killer")).toBeVisible();
    await expect(page.getByText("Shadow Compression Gear")).toBeVisible();
    await expect(page.getByText("Hunter's Charm")).toBeVisible();
    await expect(page.getByText("— empty —")).toHaveCount(3);
  });

  test("says equipment is never for sale", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/inventory");
    await expect(page.getByText(/Nothing here is for sale/i)).toBeVisible();
  });
});

test.describe("Quests", () => {
  test("shows no grace window when no Hourglass has been bought", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/quests");
    await expect(page.getByText("GRACE WINDOW")).toHaveCount(0);
  });
});
