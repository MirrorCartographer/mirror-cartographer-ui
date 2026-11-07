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
    await expect(page.locator('.result').first()).toBeVisible();
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

  test('Carnival directory card loads the bespoke crooked-midway artwork', async ({ page }) => {
    await page.goto('/atlas/rooms/experiments/', { waitUntil: 'domcontentloaded' });
    const artwork = page.locator('.carnival-card .card-art');
    await expect(artwork).toBeVisible();
    await expect.poll(() => artwork.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  });

  test('procedural room memory is opt-in, local, restorable, and erasable', async ({ page }) => {
    const memoryKey = 'mc-room-memory:v1:carnival';
    const preferenceKey = 'mc-room-memory-enabled:v1:carnival';
    await page.goto('/atlas/rooms/experiments/004-carnival-of-thought/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(([dataKey, preference]) => {
      localStorage.removeItem(dataKey);
      localStorage.removeItem(preference);
    }, [memoryKey, preferenceKey]);
    const remember = page.getByRole('button', { name: 'Toggle local room memory' });
    await expect(remember).toHaveAttribute('aria-pressed', 'false');
    await remember.click();
    await expect(remember).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.click(360, 300);
    await expect.poll(async () => page.evaluate(key => {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      return saved?.traces?.length || 0;
    }, memoryKey)).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Toggle local room memory' })).toHaveAttribute('aria-pressed', 'true');
    const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), memoryKey);
    expect(restored?.version).toBe(1);
    expect(restored?.traces?.length).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Forget local room memory' }).click();
    expect(await page.evaluate(key => localStorage.getItem(key), memoryKey)).toBeNull();
    expect(await page.evaluate(key => localStorage.getItem(key), preferenceKey)).toBeNull();
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

  test('Signal Loom routes the beam, records completion, and resets cleanly', async ({ page }) => {
    await page.goto('/atlas/rooms/arcade/connections/game-11.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#state')).toHaveText('In motion');
    await page.getByRole('button', { name: /Row 5, column 3, mirror/ }).click();
    await page.getByRole('button', { name: /Row 3, column 3, mirror/ }).click();
    await expect(page.locator('#state')).toHaveText('Complete');
    await expect(page.locator('#message')).toHaveText('The signal arrived. The field is connected.');
    await expect(page.locator('#moves')).toHaveText('2');
    await page.locator('#reset').click();
    await expect(page.locator('#moves')).toHaveText('0');
    await expect(page.locator('#message')).toHaveText('The source is waiting.');
    await page.locator('#hint').click();
    await expect(page.locator('#message')).toContainText('Two mirrors control the turn');
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
  test('Self Cartographer saves and exports a trace locally', async ({ page }) => {
    await page.goto('/self/', { waitUntil: 'domcontentloaded' });
    await page.locator('.lens[data-id="attention"]').click();
    await expect(page.locator('.lens[data-id="attention"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#note-title').fill('A small signal');
    await page.locator('#note-body').fill('Attention changed when the room became quieter.');
    await page.locator('#add-trace').click();
    await expect(page.locator('#saved .entry')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('#saved .entry')).toHaveCount(1);
    const download = page.waitForEvent('download');
    await page.locator('#export').click();
    expect((await download).suggestedFilename()).toContain('mirror-cartographer-self-map');
  });

  test('Image Organism grows, disturbs, remembers, and exports a specimen', async ({ page }) => {
    await page.goto('/art-machine/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#art')).toBeVisible();
    await page.locator('#grow').click();
    await expect(page.locator('#status')).toHaveText('A new specimen has grown.');
    await page.locator('#disturb').click();
    await expect(page.locator('#status')).toHaveText('The structure was disturbed.');
    await page.locator('#save').click();
    await expect(page.locator('#status')).toHaveText('Recipe kept in this browser.');
    await page.locator('#recall').click();
    await expect(page.locator('#status')).toHaveText('Last recipe restored.');
    const download = page.waitForEvent('download');
    await page.locator('#download').click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
  });

  test('every public room loads and every visible button can be activated without a runtime error', async ({ page, context }) => {
    test.setTimeout(180000);
    const routes = [
      '/', '/atlas/', '/atlas/rooms/', '/atlas/rooms/experiments/',
      '/atlas/rooms/experiments/001-observatory/',
      '/atlas/rooms/experiments/002-machine-garden/',
      '/atlas/rooms/experiments/003-echo-cathedral/',
      '/atlas/rooms/experiments/004-carnival-of-thought/',
      '/atlas/rooms/experiments/005-ocean/',
      '/atlas/rooms/experiments/006-living-blueprint/',
      '/atlas/rooms/experiments/007-dream-library/',
      '/atlas/rooms/experiments/008-signal-forest/',
      '/atlas/rooms/experiments/009-impossible-museum/',
      '/atlas/rooms/experiments/010-composer/',
      '/atlas/rooms/music/', '/atlas/rooms/mind/',
      '/atlas/rooms/chatgpt/', '/atlas/rooms/worlds/unreliable-observatory/',
      '/atlas/archive.html', '/self/', '/art-machine/', '/research-atlas/', '/arc/',
      '/atlas/rooms/independent-web/', '/atlas/rooms/independent-web/afterbell.html',
      '/atlas/rooms/independent-web/rain-organ/', '/atlas/rooms/independent-web/afterimage-orchard/',
      '/atlas/rooms/independent-web/cloud-press/', '/atlas/rooms/independent-web/moth-dial/',
      '/atlas/rooms/independent-web/orchard-that-remembers-rain/', '/atlas/rooms/independent-web/pressure-garden/',
      '/atlas/rooms/night-shift-orchard/', '/atlas/rooms/house-that-forgets-gravity/',
      '/atlas/rooms/arcade/connections/',
      ...Array.from({ length: 11 }, (_, i) => '/atlas/rooms/arcade/connections/game-' + (i + 1) + '.html'),
      '/atlas/research-atlas/', '/atlas/rooms/observatory.html', '/atlas/rooms/worlds/the-living-country/',
      '/atlas/rooms/arcade/veteran-mission/', '/atlas/rooms/veterans/',
      '/atlas/rooms/veterans/hub.html', '/atlas/rooms/veterans/mission.html',
      '/atlas/rooms/signal-loom/', '/atlas/rooms/after-the-uniform/',
      '/atlas/rooms/world/', '/atlas/rooms/composition/', '/atlas/rooms/unmapped/',
    ];
    const manifestResponse = await page.request.get('/atlas/rooms/room-identities.json');
    expect(manifestResponse.ok(), 'room identity manifest should load').toBeTruthy();
    const roomManifest = await manifestResponse.json();
    expect(roomManifest.count).toBe(39);
    const manifestRoutes = roomManifest.rooms.map(room => new URL(room.path, 'http://localhost/atlas/rooms/').pathname);
    const allRoutes = [...new Set([...routes, ...manifestRoutes])];
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('dialog', dialog => dialog.dismiss());
    page.on('popup', popup => popup.close());

    for (const route of allRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), route + ' should return a successful response').toBeTruthy();
      await expect(page.locator('body')).not.toBeEmpty();
      // Respect first-entry gates before testing controls underneath them.
      const entryGate = page.locator('#intro #enter');
      if (await entryGate.isVisible().catch(() => false)) await entryGate.click();
      const internalLinks = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => ({
        href: node.href,
        raw: node.getAttribute('href'),
        label: (node.textContent || '').trim().slice(0, 60),
      })));
      for (const link of internalLinks) {
        const target = new URL(link.href);
        if (target.origin !== new URL(page.url()).origin) continue;
        if (target.hash && target.pathname === new URL(page.url()).pathname) {
          const exists = await page.evaluate(hash => Boolean(document.getElementById(decodeURIComponent(hash.slice(1)))), target.hash);
          expect(exists, route + ' anchor ' + link.raw + ' should have a destination').toBeTruthy();
          continue;
        }
        const linkedResponse = await page.request.get(target.href);
        expect(linkedResponse.ok(), route + ' link ' + link.raw + ' should resolve').toBeTruthy();
      }
      const buttons = page.locator('button:visible:not([disabled])');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        if (await button.isVisible().catch(() => false)) {
          await button.click({ timeout: 3000 }).catch(error => failures.push(route + ' button ' + i + ': ' + error.message));
          if (await page.locator('[role="dialog"]').count()) await page.keyboard.press('Escape');
        }
      }
      expect(failures, route + ' should not throw browser runtime errors').toEqual([]);
    }
    await context.clearCookies();
  });

  test('the room map offers four cognitive modes and working sensory controls', async ({ page }) => {
    await page.goto('/atlas/rooms/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.room')).toHaveCount(39);
    for (const mode of ['visual','text','audio','minimal']) {
      const button = page.locator('button[data-mode="' + mode + '"]');
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('body')).toHaveAttribute('data-mode', mode);
    }
    await expect(page.locator('#sound')).toHaveText('Sound on');
    await page.locator('#sound').click();
    await expect(page.locator('#sound')).toHaveText('Sound off');
    await page.locator('#sound').click();
    await expect(page.locator('#sound')).toHaveText('Sound on');
    await page.locator('#still').click();
    await expect(page.locator('body')).toHaveAttribute('data-still', 'true');
    await page.locator('#still').click();
    await expect(page.locator('body')).toHaveAttribute('data-still', 'false');
    await page.locator('#intensity').evaluate(node => {
      node.value = '25';
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#intensity-value')).toHaveText('25%');
    await expect(page.locator('.room')).toHaveCount(39);
  });

  test('the shifting world is keyboard-operable, silent by default, and motion-adjustable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const surface = page.getByRole('button', { name: /Explore/ });
    await expect(surface).toBeVisible();
    await expect(page.locator('.sound-orb')).toHaveAttribute('aria-label', 'Turn sound on');
    await surface.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.depth-spine i.lit')).toHaveCount(2);
    await page.keyboard.press('Enter');
    await expect(page.locator('.depth-spine i.lit')).toHaveCount(3);

    await page.locator('.sound-orb').click();
    await expect(page.locator('.sound-orb')).toHaveAttribute('aria-label', 'Turn sound off');
    await page.locator('.sound-orb').click();
    await expect(page.locator('.sound-orb')).toHaveAttribute('aria-label', 'Turn sound on');

    const motion = page.locator('.motion-orb');
    await motion.click();
    await expect(motion).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveClass(/mc-reduced-motion/);
    await motion.click();
    await expect(motion).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).not.toHaveClass(/mc-reduced-motion/);

    await page.locator('.world-map-button').click();
    await expect(page.getByRole('dialog', { name: 'Room constellation' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse all 39 rooms and instruments/ })).toHaveAttribute('href', './atlas/rooms/');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Room constellation' })).toHaveCount(0);
    await expect(page.locator('.world-map-button')).toBeFocused();
  });

});
