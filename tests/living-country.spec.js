import { test, expect } from '@playwright/test';

const openCountry = async page => page.goto('/?view=workshop&lane=country', { waitUntil: 'domcontentloaded' });
const clearCountry = async page => page.addInitScript(() => {
  localStorage.removeItem('mc-living-country-v1');
  localStorage.removeItem('mc-living-country-v2');
  localStorage.removeItem('mc-living-country-investigations-v1');
});

test.describe('The Living Country', () => {
  test('the lens changes the reading mode and companion notes respond', async ({ page }) => {
    await clearCountry(page);
    await openCountry(page);
    await expect(page.getByRole('heading', { name: /THE LIVING COUNTRY/i })).toBeVisible();
    await expect(page.getByText('A place where scraps of meaning grow wild.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'INK / METAPHOR' }).click();
    await expect(page.getByRole('button', { name: 'PLAIN / OBSERVABLE' })).toBeVisible();
    await expect(page.getByText('A workspace for recording observations', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /Bug threshold inspector/ }).click();
    await expect(page.getByText('Checks every threshold.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nimbus weather watcher/ })).toBeVisible();
  });

  test('fragments can be created, filtered, reclassified, restored, and removed', async ({ page }) => {
    await clearCountry(page);
    await openCountry(page);
    await page.getByPlaceholder('A detail, an oddity, a question, a thing you noticed…').fill('A new signal\nIt repeats after a delay.');
    await page.getByLabel('TYPE').selectOption('hypothesis');
    await page.getByLabel('CONTEXT').selectOption('temporal');
    await page.getByRole('button', { name: 'PIN TO THE COUNTRY +' }).click();
    await expect(page.locator('.selected-fragment h2')).toHaveText('A new signal');
    await page.getByLabel('Read through context').selectOption('temporal');
    await expect(page.locator('.map-mark')).toContainText('A new signal');
    await expect(page.locator('.context-slip')).toContainText('Time / sequence');
    await page.getByLabel('Move fragment to context').selectOption('systems');
    await expect(page.locator('.context-slip')).toContainText('Systems / environment');
    await page.reload();
    await expect(page.locator('.map-mark')).toContainText('A new signal');
    await page.getByLabel('Read through context').selectOption('all');
    await page.getByRole('button', { name: /A new signal/ }).click();
    await page.getByRole('button', { name: 'REMOVE NOTE' }).click();
    await expect(page.locator('.map-mark')).not.toContainText('A new signal');
  });

  test('investigations record falsifiable predictions and survive reload', async ({ page }) => {
    await clearCountry(page);
    await openCountry(page);
    await page.getByPlaceholder('What changed, and what might explain it?').fill('Does the signal recur after the same exposure?');
    await page.getByPlaceholder('Record the source, conditions, and what was directly observed.').fill('Three observations, recorded on separate days.');
    await page.getByPlaceholder('If this explanation is right…').fill('The signal should recur within the same time window.');
    await page.getByPlaceholder('Keep a competing model alive.').fill('It may be a time-of-day effect unrelated to exposure.');
    await page.getByPlaceholder('A result that could be observed or measured.').fill('At least two prospective repeats under the defined condition.');
    await page.getByPlaceholder('State the result that would count against this model.').fill('No repeat across five controlled observations.');
    await page.getByRole('button', { name: 'SAVE INVESTIGATION +' }).click();
    await expect(page.locator('.investigation-record h3')).toHaveText('Does the signal recur after the same exposure?');
    await page.getByPlaceholder('What happened when the test was run? Include the actual measurement and conditions.').fill('No recurrence across five observations.');
    await page.getByLabel('Investigation assessment').selectOption('weakens');
    await expect(page.locator('.test-status')).toHaveText('WEAKENS');
    await page.reload();
    await expect(page.locator('.investigation-record h3')).toHaveText('Does the signal recur after the same exposure?');
    await expect(page.locator('.test-status')).toHaveText('WEAKENS');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'EXPORT NOTES + INVESTIGATIONS' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('mirror-cartographer-living-country.json');
  });

  test('the return desk is optional and opens plain-language care guidance', async ({ page }) => {
    await clearCountry(page);
    await openCountry(page);
    await page.getByRole('button', { name: 'OPEN THE HEALTH DESK' }).click();
    await expect(page.getByRole('heading', { name: 'Health desk / plain language only' })).toBeVisible();
    await expect(page.getByText('Bring the record to a licensed clinician.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'CLOSE THE HEALTH DESK' }).click();
    await expect(page.getByRole('heading', { name: 'Health desk / plain language only' })).toBeHidden();
  });

  test('legacy browser notes migrate without being discarded', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('mc-living-country-v2');
      localStorage.setItem('mc-living-country-v1', JSON.stringify([{ id:'legacy-note', title:'Recovered fragment', body:'A note from the earlier room.', kind:'field note', context:'temporal', x:42, y:33 }]));
    });
    await openCountry(page);
    await expect(page.getByRole('button', { name: /Recovered fragment/ })).toBeVisible();
    await page.getByPlaceholder('A detail, an oddity, a question, a thing you noticed…').fill('New note after migration');
    await page.getByRole('button', { name: 'PIN TO THE COUNTRY +' }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mc-living-country-v2') || '[]'));
    expect(saved.some(note => note.id === 'legacy-note')).toBe(true);
  });
});
