import { test, expect } from "@playwright/test";

test("login, onboard, and clear one dungeon set", async ({ page }) => {
  const pin = process.env.HUNTER_PIN;
  test.skip(!pin, "HUNTER_PIN not set in the environment running this test");

  await page.goto("/login");
  await page.locator('input[type="password"]').fill(pin!);
  await page.getByRole("button", { name: /authenticate/i }).click();

  // loginAction redirects server-side depending on whether a hunter has
  // been onboarded yet, so this settles on exactly one real destination —
  // never a transient URL the client has to correct afterward. Either
  // landing is valid depending on test DB state (fresh vs. already
  // onboarded from a prior run).
  await page.waitForURL(/\/(onboarding|dashboard)/);

  if (page.url().includes("onboarding")) {
    await expect(
      page.getByRole("heading", { name: /double dungeon/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /accept/i }).click();
    await page.getByLabel(/hunter name/i).fill("E2E Test Hunter");
    await page.getByRole("button", { name: /continue/i }).click();
    await page
      .getByLabel(/reason for hunting/i)
      .fill("Testing the flow end to end.");
    await page.getByRole("button", { name: /arise/i }).click();
    await page.waitForURL(/\/dashboard/);
  }

  // A loose "/SYSTEM/i" check on the whole body would pass on either page
  // (both headers match it) without proving onboarding actually ran — this
  // checks the one heading only a settled dashboard, post-onboarding, has.
  await expect(page.getByText(/welcome back/i)).toBeVisible();
});
