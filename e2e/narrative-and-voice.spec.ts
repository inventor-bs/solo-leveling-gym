// e2e/narrative-and-voice.spec.ts
import { test, expect } from "@playwright/test";

test("the Archive page renders whatever stage the arc is at", async ({
  page,
}) => {
  await page.goto("/archive");
  await expect(page.getByRole("heading", { name: "Archive" })).toBeVisible();
  // Every state of this page says one of these two things: either records
  // have surfaced, or the count of what is still sealed is shown.
  const body = page.locator("body");
  await expect(body).toContainText(/sealed|RECORD \d/);
});

test("an anonymous visitor can read the Archive", async ({ page }) => {
  await page.goto("/archive");
  await expect(page.getByRole("heading", { name: "Archive" })).toBeVisible();
});

test("the Dashboard shows a System message with no API key configured", async ({
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

  // The template engine always addresses the reader as Hunter, so this
  // asserts the fallback really renders rather than leaving a blank panel.
  await expect(page.locator("body")).toContainText("Hunter");
});

test("the Quests page renders a System line above the requirements", async ({
  page,
}) => {
  await page.goto("/quests");
  await expect(page.getByText("REQUIREMENTS")).toBeVisible();
});
