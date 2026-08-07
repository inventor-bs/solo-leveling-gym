import { test, expect } from "@playwright/test";

test("the Status page shows the six stats and the title shelf", async ({
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

  await page.goto("/status");
  // .first() is required: each axis label is rendered twice on this page —
  // once as an SVG tick inside the radar, once in the numeric list beside
  // it — and Playwright's strict mode fails a locator that matches two.
  await expect(page.getByText("STR", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("LUK", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Army Rank")).toBeVisible();
  await expect(page.getByText("Unyielding")).toBeVisible();
  await expect(page.getByText("Monarch of Dawn")).toBeVisible();
  await expect(page.getByText("One Who Returned")).toBeVisible();
});

test("an anonymous visitor can still read the Status page", async ({
  page,
}) => {
  // Reads are public by design — the whole point is an unfakeable public
  // record. Only writes are gated.
  await page.goto("/status");
  await expect(page.getByText(/hunter status/i)).toBeVisible();
});
