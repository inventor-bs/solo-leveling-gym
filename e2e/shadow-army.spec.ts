import { test, expect } from "@playwright/test";

test("the Shadow Army page shows Igris already extracted", async ({ page }) => {
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

  await page.goto("/shadow-army");
  await expect(page.getByText("Igris")).toBeVisible();
  await expect(page.getByText(/army rank/i)).toBeVisible();
});
