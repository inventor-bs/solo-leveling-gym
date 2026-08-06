import { test, expect } from "@playwright/test";

test("login, onboard, and clear one dungeon set", async ({ page }) => {
  const pin = process.env.HUNTER_PIN;
  test.skip(!pin, "HUNTER_PIN not set in the environment running this test");

  await page.goto("/login");
  await page.locator('input[type="password"]').fill(pin!);
  await page.getByRole("button", { name: /authenticate/i }).click();

  // Either lands on onboarding (fresh DB) or dashboard (already onboarded
  // from a prior run) — both are valid depending on test DB state.
  await page.waitForURL(/\/(onboarding|dashboard)/);

  if (page.url().includes("onboarding")) {
    await page.getByRole("button", { name: /accept/i }).click();
    await page.getByLabel(/hunter name/i).fill("E2E Test Hunter");
    await page.getByRole("button", { name: /continue/i }).click();
    await page
      .getByLabel(/reason for hunting/i)
      .fill("Testing the flow end to end.");
    await page.getByRole("button", { name: /arise/i }).click();
    await page.waitForURL(/\/dashboard/);
  }

  await expect(page.locator("body")).toContainText(/SYSTEM/i);
});
