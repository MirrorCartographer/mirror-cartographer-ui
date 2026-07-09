import { test, expect } from '@playwright/test';

const expectWordlessBody = async (page) => {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText.trim()).toBe('');
};

test.describe('Mirror Cartographer phone-first smoke', () => {
  test('renders wordless sky and survives first tap', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const sky = page.locator('button.sky');
    const canvas = page.locator('canvas');
    await expect(sky).toBeVisible();
    await expect(canvas).toBeVisible();
    await expectWordlessBody(page);

    await sky.tap({ position: { x: 195, y: 422 } });
    await page.waitForTimeout(700);

    await expect(canvas).toBeVisible();
    await expectWordlessBody(page);
    expect(errors).toEqual([]);
  });

  test('keeps visible surface essentially wordless', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await expectWordlessBody(page);
  });
});
