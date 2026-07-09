import { test, expect } from '@playwright/test';

const liveSiteUrl = process.env.LIVE_SITE_URL;

test.describe('Mirror Cartographer live hosting smoke', () => {
  test.skip(!liveSiteUrl, 'Set LIVE_SITE_URL to test a deployed Vercel, Cloudflare, Netlify, or Pages preview.');

  test('deployed preview preserves the phone-first wordless contract', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(liveSiteUrl, { waitUntil: 'networkidle' });

    const sky = page.locator('button.sky');
    const canvas = page.locator('canvas');
    await expect(sky).toBeVisible();
    await expect(canvas).toBeVisible();

    const visibleText = await page.locator('body').innerText();
    expect(visibleText.trim()).toBe('');

    await sky.tap({ position: { x: 195, y: 422 } });
    await page.waitForTimeout(700);

    await expect(canvas).toBeVisible();
    expect(errors).toEqual([]);
  });
});
