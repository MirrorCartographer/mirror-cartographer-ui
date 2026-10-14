import { test, expect } from '@playwright/test';

test('Three Lenses keeps the observation invariant and resets cleanly', async ({ page }) => {
  const outsideRequests = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173/')) outsideRequests.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/three-lenses.html', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle(/Three Lenses/);

  const signal = page.locator('#signal-copy');
  const original = await signal.textContent();
  expect(original).toBe('A task planned for 30 minutes took 55 minutes.');

  for (const id of ['lens-a', 'lens-b', 'lens-c']) {
    await page.locator('label[for="' + id + '"]').click();
    await expect(page.locator('#' + id)).toBeChecked();
    await expect(signal).toHaveText(original);
  }

  await page.locator('label[for="action-b"]').click();
  await expect(page.locator('#action-b')).toBeChecked();
  await expect(signal).toHaveText(original);

  await page.locator('#reset').click();
  for (const id of ['lens-a', 'lens-b', 'lens-c', 'action-a', 'action-b', 'action-c']) {
    await expect(page.locator('#' + id)).not.toBeChecked();
  }
  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  expect(storage.local).toBe(0);
  expect(storage.session).toBe(0);
  expect(storage.horizontalOverflow).toBe(false);
  expect(outsideRequests).toEqual([]);
});

test('Three Lenses supports keyboard selection and reduced-motion preference', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/three-lenses.html', { waitUntil: 'networkidle' });

  await page.locator('#lens-c').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#lens-c')).toBeChecked();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: /Research and adversarial review protocol/ })).toBeVisible();
});
