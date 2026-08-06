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

test("clearing the Survival Quest enables the escape button and exits the Penalty Zone", async ({
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

  const escapeButton = page.getByRole("button", {
    name: /escape the penalty zone/i,
  });
  await expect(escapeButton).toBeDisabled();

  // Clear every rep requirement by clicking its +20 button until it disables
  // itself (met). The three requirement rows render in a fixed order
  // (push-ups, sit-ups, squats), so the nth "+20" button is unambiguous —
  // an hasText(label) div filter is not, since ancestor containers also
  // contain the label text.
  for (let row = 0; row < 3; row++) {
    const plusTwenty = page.getByRole("button", { name: "+20" }).nth(row);
    for (let attempt = 0; attempt < 10; attempt++) {
      if (await plusTwenty.isDisabled()) break;
      await plusTwenty.click();
      await page.waitForTimeout(300);
    }
  }

  // Log a run comfortably past any rank's target — unless real training
  // logged earlier today already cleared it, in which case the run input
  // is no longer rendered and there is nothing left to do here.
  const kmInput = page.getByPlaceholder("km");
  if (await kmInput.isVisible().catch(() => false)) {
    await kmInput.fill("50");
    await page.getByPlaceholder("min").fill("300");
    await page.getByRole("button", { name: "LOG RUN" }).click();
  }

  await expect(escapeButton).toBeEnabled({ timeout: 10_000 });
  await escapeButton.click();
  await page.waitForURL(/\/dashboard/);
});
