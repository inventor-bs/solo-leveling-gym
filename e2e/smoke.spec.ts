import { test, expect } from "@playwright/test";

test("trang chủ tải được", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
});
