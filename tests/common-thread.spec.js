import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

async function reset(page) {
  await page.goto('/atlas/rooms/common-thread/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('mc-common-thread-v1'));
  await page.reload();
}

test.describe('Common Thread / privacy boundary', () => {
  test('private points stay out of a recipient-specific consent packet', async ({ page }) => {
    await reset(page);
    await page.locator('#name').fill('Private point');
    await page.locator('#kind').selectOption('Person');
    await page.locator('#privacy').selectOption('private');
    await page.getByRole('button', { name: 'Place on the field' }).click();

    await page.locator('#name').fill('Shareable point');
    await page.locator('#kind').selectOption('Project');
    await page.locator('#relation').selectOption({ label: 'Private point' });
    await page.locator('#privacy').selectOption('shared');
    await page.locator('#thread').fill('Shared work');
    await page.getByRole('button', { name: 'Place on the field' }).click();

    await expect(page.getByLabel('Include Private point in consent packet')).toBeDisabled();
    await page.getByLabel('Include Shareable point in consent packet').check();
    await page.locator('#recipient').fill('Research partner');
    await page.locator('#purpose').fill('Review this project relationship');
    await page.locator('#expiry').selectOption('30');
    await page.locator('#consent').check();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /EXPORT CONSENT-SCOPED PACKET/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('common-thread-consent-packet.json');
    const filePath = await download.path();
    const packet = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(packet.format).toBe('mc-common-thread-share-v1');
    expect(packet.recipient).toBe('Research partner');
    expect(packet.purpose).toBe('Review this project relationship');
    expect(packet.consentReviewed).toBe(true);
    expect(packet.nodes).toHaveLength(1);
    expect(packet.nodes[0].name).toBe('Shareable point');
    expect(packet.nodes[0].to).toBeNull();
    expect(packet.nodes[0].privacy).toBe('shared');
  });

  test('consent packets import as private copies and expired packets are rejected', async ({ page }) => {
    await reset(page);
    const packet = {
      format: 'mc-common-thread-share-v1',
      createdAt: new Date().toISOString(),
      recipient: 'Research partner',
      purpose: 'Review a selected relationship',
      expiresAt: new Date(Date.now()+86400000).toISOString(),
      scope: 'selected-points-only',
      consentReviewed: true,
      nodes: [{id:'shared-id',name:'A shared point',kind:'Question',to:null,thread:'A selected thread',privacy:'shared',x:45,y:55}],
    };
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#import-file').setInputFiles({name:'thread.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});
    await expect(page.locator('#notice')).toContainText('Imported 1 point(s) from a consent-scoped copy');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mc-common-thread-v1')||'[]'));
    expect(saved[0].privacy).toBe('private');
    expect(saved[0].shareSelected).toBe(false);

    const expired = {...packet,expiresAt:'2020-01-01T00:00:00.000Z'};
    await page.locator('#import-file').setInputFiles({name:'expired.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(expired))});
    await expect(page.locator('#notice')).toContainText('This consent packet has expired.');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('mc-common-thread-v1')||'[]'));
    expect(after).toHaveLength(1);
  });

  test('the private backup remains separate from the share packet', async ({ page }) => {
    await reset(page);
    await page.locator('#name').fill('Private archive point');
    await page.getByRole('button', { name: 'Place on the field' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export private backup' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('common-thread-private-backup.json');
    const filePath = await download.path();
    const backup = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(backup.format).toBe('mc-common-thread-v2');
    expect(backup.nodes).toHaveLength(1);
    expect(backup.nodes[0].privacy).toBe('private');
  });
});
