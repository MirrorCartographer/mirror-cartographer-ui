import { test, expect } from '@playwright/test';

test.describe('Mirror Cartographer live phone-first smoke', () => {
  test('deployed site keeps the wordless phone instrument contract', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    const surface = page.locator('button.world-surface');
    const canvas = page.locator('canvas');
    await expect(surface).toBeVisible();
    await expect(canvas).toBeVisible();

    const visibleText = await page.locator('body').innerText();
    expect(visibleText.trim()).toBe('');

    await surface.tap({ position: { x: 195, y: 422 } });
    await page.waitForTimeout(700);

    await expect(canvas).toBeVisible();
    expect(errors).toEqual([]);
  });
});
