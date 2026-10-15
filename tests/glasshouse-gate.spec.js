import { test, expect } from '@playwright/test';

test.describe('Glasshouse Gate public-safe abstraction proof', () => {
  test('holds release until every transformation is selected and never auto-publishes', async ({ page }) => {
    const externalRequests = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
    });

    await page.goto('/glasshouse-gate.html');
    const status = page.locator('#gate-status');
    const count = page.locator('#gate-count');
    const artifact = page.locator('#artifact-copy');

    await expect(status).toContainText('BLOCKED');
    await expect(count).toHaveText('0 of 4 transformations selected');
    await expect(artifact).toContainText('No method extracted yet');

    await page.locator('[data-transform="convert-method"]').check();
    await expect(status).toContainText('BLOCKED');
    await expect(artifact).toContainText('Draft method');
    await expect(page.locator('#artifact-note')).toContainText('Draft only');

    for (const key of ['generalize', 'remove-context', 'bound-claim']) {
      await page.locator('[data-transform="' + key + '"]').check();
    }

    await expect(status).toContainText('READY FOR HUMAN REVIEW');
    await expect(status).not.toContainText('PUBLISHED');
    await expect(artifact).toContainText('without identifying a place or person');
    await expect(page.locator('#artifact-note')).toContainText('does not establish');

    await page.locator('#reset-gate').click();
    await expect(status).toContainText('BLOCKED');
    await expect(count).toHaveText('0 of 4 transformations selected');
    expect(externalRequests).toEqual([]);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });

  test('remains readable at a narrow viewport and respects reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/glasshouse-gate.html');

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      motionPreference: matchMedia('(prefers-reduced-motion: reduce)').matches
    }));

    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.motionPreference).toBe(true);
    await expect(page.getByRole('heading', { name: 'The Glasshouse Gate' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Release checks' })).toBeVisible();
  });
});
