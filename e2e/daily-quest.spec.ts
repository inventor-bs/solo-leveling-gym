import { test, expect } from "@playwright/test";

test("the daily quest is issued and progress persists", async ({ page }) => {
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

  await page.goto("/quests");
  await expect(page.getByText(/daily quest/i).first()).toBeVisible();

  const pushupRow = page.getByText(/push-ups/i).first();
  await expect(pushupRow).toBeVisible();

  await page.getByRole("button", { name: "+10" }).first().click();
  await expect(page.getByText(/10 \/ \d+/).first()).toBeVisible();

  // The number must survive a reload — it is stored, not local state.
  await page.reload();
  await expect(page.getByText(/10 \/ \d+/).first()).toBeVisible();
});

test("the run-log panel is reachable on the Dashboard on any weekday", async ({
  page,
}) => {
  // Deliberately anonymous: reads stay public in this app (CLAUDE.md), and
  // the owner's own session gets redirected to /penalty whenever a penalty
  // is active — a real, current fixture-DB state this test must not force
  // its way past by ending the hunter's actual penalty. An anonymous visit
  // reaches the Dashboard's real content regardless of penalty state.
  //
  // dailyQuestTargets() has no weekday parameter — the run-km target is
  // active every day, with no exception — so the only reachable way to
  // satisfy it, this Dashboard panel, must be visible regardless of what
  // weekday this test happens to run on.
  const response = await page.goto("/dashboard");
  expect(response?.status()).toBeLessThan(400);
  await expect(
    page.getByRole("heading", { name: /endurance training/i }),
  ).toBeVisible();
});
