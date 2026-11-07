import { test, expect } from '@playwright/test';

async function setRange(page, id, value) {
  await page.locator('#'+id).evaluate((node, next) => {
    node.value = String(next);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test.describe('Human Judgment Lab / Consensus Trap', () => {
  test('a seeded panel can agree unanimously and still be wrong', async ({ page }) => {
    await page.goto('/field-instruments/consensus-trap.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'The Consensus Trap.' })).toBeVisible();
    await setRange(page,'signal',100);
    await setRange(page,'bias',100);
    await setRange(page,'noise',0);
    await setRange(page,'count',5);
    await setRange(page,'trials',200);
    await setRange(page,'seed',7);
    await expect(page.locator('#accuracy')).toHaveText('0.0%');
    await expect(page.locator('#agreement')).toHaveText('100.0%');
    await expect(page.locator('#unanimous')).toHaveText('100.0%');
    await expect(page.locator('#wrong')).toHaveText('100.0%');
    await expect(page.locator('#interpretation')).toContainText('agrees more than it is accurate');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export reproducible run record' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('consensus-trap-seed-7.json');
  });

  test('a one-person panel does not pretend to have inter-rater agreement', async ({ page }) => {
    await page.goto('/field-instruments/consensus-trap.html', { waitUntil: 'domcontentloaded' });
    await setRange(page,'count',1);
    await expect(page.locator('#agreement')).toHaveText('N/A');
    await expect(page.locator('#interpretation')).toContainText('no inter-rater agreement');
  });
});
