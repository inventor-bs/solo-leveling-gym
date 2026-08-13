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
      // which is the actual regression this test exists to catch: a Server
      // Component passing an inline closure to a "use client" component is
      // not serializable and crashes the page for every visitor.
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

function skillCard(page: Page, name: string) {
  return page.locator("div.space-y-1").filter({ hasText: name });
}

/**
 * Read-only by design: these tests never click EQUIP/UNEQUIP. The fixture
 * hunter is a real, persistent dev database — a slot-toggle round trip that
 * hangs partway (a slow router.refresh, a flaky assertion) would leave real
 * equip/slot state permanently altered with no attempt at this hunter's
 * actual training behind it, which is exactly what CLAUDE.md's Progression
 * rule exists to prevent. Each test instead asserts against whatever the
 * real fixture already shows, branching on it rather than forcing a path.
 */
test.describe("Skills page — SOVEREIGN action controls", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("Ruler's Authority renders correctly whether or not it is equipped, with no console error", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/skills");
    const card = skillCard(page, "Ruler's Authority");
    const equipButton = card.getByRole("button", { name: /^(EQUIP|UNEQUIP)$/ });
    await expect(equipButton).toBeVisible();

    if ((await equipButton.innerText()) === "UNEQUIP") {
      await expect(
        card.getByRole("button", { name: "OVERRIDE TODAY'S TARGET" }),
      ).toBeVisible();
    } else {
      await expect(
        card.getByRole("button", { name: "OVERRIDE TODAY'S TARGET" }),
      ).toHaveCount(0);
    }
    expect(consoleErrors).toEqual([]);
  });

  test("Shadow Exchange renders correctly whether or not it is equipped, with no console error", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/skills");
    const card = skillCard(page, "Shadow Exchange");
    const equipButton = card.getByRole("button", { name: /^(EQUIP|UNEQUIP)$/ });
    await expect(equipButton).toBeVisible();

    if ((await equipButton.innerText()) === "UNEQUIP") {
      await expect(
        card.getByRole("button", { name: "SWAP THIS WEEK" }),
      ).toBeVisible();
    } else {
      await expect(
        card.getByRole("button", { name: "SWAP THIS WEEK" }),
      ).toHaveCount(0);
    }
    expect(consoleErrors).toEqual([]);
  });

  test("Shadow Storage's row renders its live bank count with no console error", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/skills");
    const card = skillCard(page, "Shadow Storage");
    await expect(card).toBeVisible();

    const learnButton = card.getByRole("button", { name: "LEARN" });
    if ((await learnButton.count()) > 0) {
      // Not learned in this fixture — confirm the row still renders
      // cleanly now that SkillsView also threads the bank counts through
      // on every load, learned or not.
      await expect(learnButton).toBeVisible();
      expect(consoleErrors).toEqual([]);
      return;
    }

    const equipButton = card.getByRole("button", { name: /^(EQUIP|UNEQUIP)$/ });
    if ((await equipButton.innerText()) === "UNEQUIP") {
      await expect(card.getByText(/banked \/ .* pending credit/)).toBeVisible();
      await expect(
        card.getByRole("button", { name: "DEPOSIT SESSION" }),
      ).toBeVisible();
      await expect(
        card.getByRole("button", { name: "WITHDRAW CREDIT" }),
      ).toBeVisible();
    } else {
      await expect(card.getByText(/banked \/ .* pending credit/)).toHaveCount(
        0,
      );
    }
    expect(consoleErrors).toEqual([]);
  });
});
