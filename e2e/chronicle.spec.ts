import { test, expect } from "@playwright/test";

test("the Chronicle page shows the heatmap, timeline, and charts", async ({
  page,
}) => {
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

  await page.goto("/chronicle");
  await expect(page.getByRole("heading", { name: "Chronicle" })).toBeVisible();
  await expect(page.getByText("365 DAYS")).toBeVisible();
  await expect(page.getByText("EVENT LOG")).toBeVisible();
  await expect(page.getByText("WEEKLY VOLUME")).toBeVisible();
  await expect(page.getByText("MAIN LIFTS")).toBeVisible();
  await expect(page.getByText("VOLUME BY MUSCLE GROUP")).toBeVisible();
});

test("an anonymous visitor can still read the Chronicle page", async ({
  page,
}) => {
  await page.goto("/chronicle");
  await expect(page.getByRole("heading", { name: "Chronicle" })).toBeVisible();
});
