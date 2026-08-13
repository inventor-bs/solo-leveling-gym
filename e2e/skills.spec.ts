// e2e/skills.spec.ts
import { test, expect, type Page } from "@playwright/test";

/**
 * Mirrors the inline login block every other e2e spec in this suite repeats
 * (see e2e/economy.spec.ts and e2e/shadow-army.spec.ts) — same PIN check,
 * same skip conditions. This repo has no shared login helper module; every
 * spec that needs the owner session copies this block rather than importing
 * one, so this file follows the same pattern instead of introducing a new
 * shared helper.
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

test.describe("Skills page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("loads without a server error and shows the three branches", async ({
    page,
  }) => {
    await page.goto("/skills");
    // loginAsOwner already skips this test unless the fixture hunter is
    // onboarded, so the locked ("no Hunter registered") branch can't render
    // here — asserting the real heading directly, same as e2e/status.spec.ts.
    await expect(page.getByRole("heading", { name: "Ability" })).toBeVisible();
    // exact + heading role: several skill names contain these words too
    // ("Iron Body", "Shadow Preservation", ...), so a plain text match is
    // ambiguous — the branch panel header is the only exact-text heading.
    await expect(
      page.getByRole("heading", { name: "BODY", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "SHADOW", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "SOVEREIGN", exact: true }),
    ).toBeVisible();
  });

  test("every skill row renders a LEARN or EQUIP/UNEQUIP button with no console error", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/skills");
    const learnButtons = page.getByRole("button", { name: "LEARN" });
    const equipButtons = page.getByRole("button", {
      name: /^(EQUIP|UNEQUIP)$/,
    });
    await expect(learnButtons.or(equipButtons).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("buying a Rune Stone either raises the slot count or shows a gold-shortfall notice, never a page error", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/skills");
    const slotButton = page.getByRole("button", { name: /BUY RUNE STONE/ });
    await expect(slotButton).toBeVisible();

    if (await slotButton.isDisabled()) {
      // Fixture hunter's slots are already at the 8-slot ceiling — confirm
      // the disabled state itself rendered correctly rather than a 500,
      // which is the actual regression this test exists to catch (see
      // Phase 5's Task 37: a Server Component passing an inline closure to
      // a "use client" component is not serializable and crashes the page
      // for every visitor).
      return;
    }

    await slotButton.click();
    // The action rejects the purchase when gold is short of the price, and
    // that rejection must render as an on-page notice, not a thrown error.
    // Either outcome proves the action round-tripped through the real
    // Server Action wiring without crashing the page.
    await expect(
      page
        .getByText(/slots equipped/)
        .or(page.getByText(/Not enough gold for that yet\./)),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
