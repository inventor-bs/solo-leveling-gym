import { test, expect } from "@playwright/test";

test("an active penalty locks the owner into the Penalty Zone", async ({
  page,
}) => {
  const pin = process.env.HUNTER_PIN;
  test.skip(!pin, "HUNTER_PIN not set in the environment running this test");
  test.skip(
    !process.env.PENALTY_FIXTURE,
    "run with PENALTY_FIXTURE=1 after inserting a penalty row",
  );

  await page.goto("/login");
  await page.locator('input[type="password"]').fill(pin!);
  await page.getByRole("button", { name: /authenticate/i }).click();
  await page.waitForURL(/\/(onboarding|dashboard|penalty)/);

  await page.goto("/dashboard");
  await page.waitForURL(/\/penalty/);
  await expect(page.getByText(/penalty zone/i).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /escape the penalty zone/i }),
  ).toBeDisabled();
});
