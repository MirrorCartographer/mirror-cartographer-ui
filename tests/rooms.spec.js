import { test, expect } from '@playwright/test';

const experimentSlugs = [
  '001-observatory','002-machine-garden','003-echo-cathedral','004-carnival-of-thought',
  '005-ocean','006-living-blueprint','007-dream-library','008-signal-forest',
  '009-impossible-museum','010-composer',
];

test.describe('Playable Atlas rooms', () => {
  test('the front door controls respond and the collection search works', async ({ page }) => {
    await page.goto('/atlas/', { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText('The room');
    await expect(page.locator('#sound-toggle')).toHaveText('SOUND OFF');

    await page.locator('#sound-toggle').click();
    await expect(page.locator('#sound-toggle')).toHaveText('SOUND ON');
    await page.locator('#sound-toggle').click();
    await expect(page.locator('#sound-toggle')).toHaveText('SOUND OFF');

    await page.locator('#rain').click();
    await expect(page.locator('#field-readout')).toContainText('RAIN');
    await page.locator('#erase').click();
    await expect(page.locator('#field-readout')).toHaveText('THE FIELD IS QUIET');
    await page.locator('#bloom').click();
    await expect(page.locator('#field-readout')).toContainText('BLOOM');

    await page.locator('#intensity').evaluate((node) => {
      node.value = '30';
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#intensity-readout')).toHaveText('30 / 100');
    await page.locator('#still').click();
    await expect(page.locator('#still')).toHaveText('RETURN TO MOTION');
    await page.locator('#still').click();
    await expect(page.locator('#still')).toHaveText('STILLNESS');

    await expect(page.locator('.result').first()).toBeVisible();
    await page.locator('#search').fill('008-signal-forest');
    await expect(page.locator('.result')).toHaveCount(1);
    await expect(page.locator('.result').first()).toContainText('index.html');
  });

  test('all ten experiment rooms load and their shared controls work', async ({ page }) => {
    for (const slug of experimentSlugs) {
      await page.goto('/atlas/rooms/experiments/' + slug + '/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('canvas')).toBeVisible();
      await expect(page.locator('.mc-home')).toBeVisible();
      const sound = page.locator('button[data-action="sound"]');
      const shift = page.locator('button[data-action="shift"]');
      await expect(sound).toBeVisible();
      await expect(shift).toBeVisible();
      await sound.click();
      await expect(sound).toHaveText('sound on');
      await shift.click();
      await expect(page.locator('body')).toHaveAttribute('style', /hue-rotate/);
      const still = page.getByRole('button', { name: 'stillness' });
      await still.click();
      await expect(page.getByRole('button', { name: 'return to motion' })).toBeVisible();
      const intensity = page.locator('.mc-intensity input');
      await intensity.evaluate((node) => {
        node.value = '40';
        node.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(intensity).toHaveValue('40');
    }
  });

  test('the Music Room plays, sequences, stops, and clears notes', async ({ page }) => {
    await page.goto('/atlas/rooms/music/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#status')).toHaveText('SILENCE / READY');
    await page.locator('[data-key="0"]').click();
    await expect(page.locator('#status')).toHaveText('WAKE THE ROOM FIRST');

    await page.locator('#sound').click();
    await expect(page.locator('#sound')).toHaveText('ROOM AWAKE');
    await page.locator('[data-key="0"]').click();
    await expect(page.locator('#status')).toHaveText('SOUND / A');
    await expect(page.locator('#readout')).toHaveText('1 NOTES IN THE PATTERN');

    await page.locator('#play').click();
    await expect(page.locator('#status')).toHaveText('PATTERN IN MOTION');
    await page.locator('#stop').click();
    await expect(page.locator('#status')).toHaveText('STILL / PATTERN HELD');

    await page.locator('#volume').evaluate((node) => {
      node.value = '60';
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#volume-out')).toHaveText('60%');
    await page.locator('#ambience').click();
    await expect(page.locator('#ambience')).toHaveText('AMBIENCE ON');
    await page.locator('#ambience').click();
    await expect(page.locator('#ambience')).toHaveText('AMBIENCE OFF');
    await page.locator('#clear').click();
    await expect(page.locator('#readout')).toHaveText('0 NOTES IN THE PATTERN');
  });

  test('the archive and message room remain reachable and interactive', async ({ page }) => {
    await page.goto('/atlas/archive.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#filter')).toBeVisible();

    await page.goto('/atlas/rooms/chatgpt/', { waitUntil: 'domcontentloaded' });
    await page.locator('#fragment').fill('A room that changes when I look away.');
    await page.locator('#copy').click();
    await expect(page.locator('#status')).not.toHaveText('Leave a fragment first.');
    await expect(page.locator('#status')).not.toBeEmpty();

    await page.goto('/self/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toBeEmpty();
    await page.goto('/art-machine/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toBeEmpty();
    await page.goto('/research-atlas/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-node="signal"]')).toBeVisible();
  });
});
