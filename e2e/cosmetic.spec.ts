// e2e/cosmetic.spec.ts
import { test, expect, type Page } from "@playwright/test";

/**
 * Mirrors the inline login block every other e2e spec in this suite
 * repeats (see e2e/skills.spec.ts and e2e/economy.spec.ts) — same PIN
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

test.describe("Cosmetic store and equip surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("the Store renders a COSMETIC section with an aura price and no console error", async ({
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
    await expect(
      page.getByText(
        "Nothing in this section changes a number. It only changes what the System looks like.",
      ),
    ).toBeVisible();
    await expect(page.getByText(/Aura of the Monarch/)).toBeVisible();
    // Either the normal line or the saturated warning must render — both
    // are correct states, and which one appears depends on real gold spent.
    await expect(
      page
        .getByText(/Deepens the glow around your rank/)
        .or(page.getByText(/Intensity is already at its maximum/)),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("the Store's title frame rows render, bought or not", async ({
    page,
  }) => {
    await page.goto("/store");
    for (const name of ["System Frame", "Monarch Frame", "Sovereign Frame"]) {
      await expect(
        page.getByText(name, { exact: false }).first(),
      ).toBeVisible();
    }
  });

  test("the Shadow Army page renders its skin state without a server error", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/shadow-army");
    await expect(
      page.getByRole("heading", { name: "Shadow Army" }),
    ).toBeVisible();

    // Igris is extracted at onboarding, so an extracted card always exists:
    // either it owns no skin yet, or it renders the NONE + skin buttons.
    await expect(
      page
        .getByText("No skin owned")
        .first()
        .or(page.getByRole("button", { name: "NONE" }).first()),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("the Status page renders the frame row in whichever state it is in", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/status");
    await expect(
      page.getByRole("heading", { name: "TITLES", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByText("No frame owned. The Store sells three.")
        .or(page.getByText("FRAME", { exact: true })),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("the Dashboard renders its action panels, with REARRANGE only if unlocked", async ({
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

    // Branch, never force: the layout unlock is a real purchase this
    // fixture hunter either made or did not. Both renders must be clean —
    // a Server Component handing a closure to a client component would 500
    // this page for every visitor, which is the regression this catches.
    const rearrange = page.getByRole("button", { name: "REARRANGE" });
    if ((await rearrange.count()) > 0) {
      await expect(rearrange).toBeVisible();
    } else {
      await expect(rearrange).toHaveCount(0);
    }
    expect(consoleErrors).toEqual([]);
  });
});
