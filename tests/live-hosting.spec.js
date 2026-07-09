import { test, expect } from '@playwright/test';

test.describe('Mirror Cartographer live hosting smoke', () => {
  test('deployed preview preserves the phone-first wordless contract', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/', { waitUntil: 'networkidle' });

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
