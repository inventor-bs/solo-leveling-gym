import { test, expect } from "@playwright/test";

test("trang chủ tải được", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
});

test("the landing page's background glow actually renders, not just its blur", async ({
  page,
}) => {
  // A Tailwind opacity modifier outside the default scale (e.g. /3, when
  // the scale only defines 0, 5, 10, ...) silently produces no CSS rule at
  // all — the class name survives in the markup with zero visual effect.
  // Checking the real computed style is the only way to catch that; the
  // class string itself would look identical either way.
  await page.goto("/");
  const glow = page.locator("div.blur-\\[120px\\]");
  const alpha = await glow.evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor;
    const match = bg.match(/rgba\(([^)]+)\)/);
    if (!match) return 1; // "rgb(...)" with no alpha channel at all
    const parts = match[1]!.split(",").map((n) => parseFloat(n));
    return parts[3] ?? 1;
  });
  expect(alpha).toBeGreaterThan(0);
});
