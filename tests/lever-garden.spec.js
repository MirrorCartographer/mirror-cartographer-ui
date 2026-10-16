import { test, expect } from '@playwright/test';

test.describe('Lever Beneath the Leaves', () => {
  test('compares one changed variable without overstating the result', async ({ page }) => {
    await page.goto('/lever-garden.html');
    await expect(page.getByRole('heading', { name: 'The lever beneath the leaves.' })).toBeVisible();
    await expect(page.locator('#result-heading')).toHaveText('No trial yet');
    await expect(page.locator('#comparison-copy')).toContainText('First trial');

    await page.getByRole('button', { name: 'Run trial' }).click();
    await expect(page.locator('#result-heading')).toHaveText('The seed opens.');
    await expect(page.locator('#trial-log li')).toHaveCount(1);

    await page.locator('#water').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#water-value')).toHaveText('0 · dry');
    await page.getByRole('button', { name: 'Run trial' }).click();
    await expect(page.locator('#result-heading')).toHaveText('The seed stays closed.');
    await expect(page.locator('#comparison-copy')).toContainText('Only water changed');
    await expect(page.locator('#comparison-copy')).toContainText('not a universal rule');

    await page.locator('#wind').focus();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Run trial' }).click();
    await expect(page.locator('#comparison-copy')).toContainText('Only wind changed');
    await expect(page.locator('#comparison-copy')).toContainText('does not prove this setting never matters');

    await page.getByText('Reveal the toy rule').click();
    await expect(page.getByText(/Wind has no effect/)).toBeVisible();
  });

  test('reset clears the trail and the page fits a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/lever-garden.html');

    await page.getByRole('button', { name: 'Run trial' }).click();
    await page.getByRole('button', { name: 'Reset garden' }).click();

    await expect(page.locator('#result-heading')).toHaveText('No trial yet');
    await expect(page.locator('#empty-history')).toHaveText('No trials recorded.');

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.reducedMotion).toBe(true);
    await expect(page.getByRole('group', { name: 'Environmental settings' })).toBeVisible();
  });
});
