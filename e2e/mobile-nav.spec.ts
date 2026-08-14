import { test, expect } from "@playwright/test";

test.describe("Mobile navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the System Menu toggle reaches every page on a mobile viewport", async ({
    page,
  }) => {
    // Deliberately anonymous — reads stay public, and this is purely a
    // navigation-chrome check with no owner-only content involved. Anonymous
    // access also sidesteps redirectOwnerIfPenalised(), which only redirects
    // a write-access session — this test must work regardless of whatever
    // real penalty state the fixture hunter happens to be in.
    await page.goto("/dashboard");

    // Below the md breakpoint the desktop sidebar's links must not be
    // reachable until the toggle is used.
    await expect(page.getByRole("link", { name: /Shadow Army/i })).toBeHidden();

    const toggle = page.getByRole("button", { name: /open system menu/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const shadowArmyLink = page.getByRole("link", { name: /Shadow Army/i });
    await expect(shadowArmyLink).toBeVisible();

    await shadowArmyLink.click();
    await expect(page).toHaveURL(/\/shadow-army/);
    // Navigating away closes the overlay automatically — it must not still
    // cover the destination page.
    await expect(page.getByRole("link", { name: /Shadow Army/i })).toBeHidden();
  });

  test("the System Menu closes without navigating when dismissed", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /open system menu/i }).click();
    await expect(page.getByRole("link", { name: /Quests/i })).toBeVisible();

    await page.getByRole("button", { name: /close system menu/i }).click();
    await expect(page.getByRole("link", { name: /Quests/i })).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
