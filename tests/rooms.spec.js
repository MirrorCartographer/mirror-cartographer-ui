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
      await expect(page.locator('canvas')).toHaveAttribute('style', /hue-rotate/);
      await expect(page.locator('body')).not.toHaveAttribute('style', /hue-rotate/);
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
    test.setTimeout(120000);
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
      ...Array.from({ length: 10 }, (_, i) => '/atlas/rooms/arcade/connections/game-' + (i + 1) + '.html'),
      '/atlas/rooms/arcade/veteran-mission/', '/atlas/rooms/veterans/',
      '/atlas/rooms/veterans/hub.html', '/atlas/rooms/veterans/mission.html',
      '/atlas/rooms/world/', '/atlas/rooms/composition/', '/atlas/rooms/unmapped/',
    ];
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('dialog', dialog => dialog.dismiss());
    page.on('popup', popup => popup.close());

    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), route + ' should return a successful response').toBeTruthy();
      await expect(page.locator('body')).not.toBeEmpty();
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
    await expect(page.locator('.room')).toHaveCount(34);
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
    await expect(page.locator('.room')).toHaveCount(34);
  });

  test('the wordless world is keyboard-operable, silent by default, and motion-adjustable', async ({ page }) => {
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
    await expect(page.getByRole('link', { name: 'All rooms and instruments' })).toHaveAttribute('href', './atlas/rooms/');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Room constellation' })).toHaveCount(0);
    await expect(page.locator('.world-map-button')).toBeFocused();
  });

});

test('local observatory telemetry detects semantic control-state changes', async ({ page }) => {
  await page.goto('/atlas/rooms/experiments/001-observatory/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('mc:observatory:v1'));
  const sound = page.locator('button[data-action="sound"]');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(950);
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('mc:observatory:v1') || '[]'));
  const interaction = rows.filter(row => row.type === 'interaction').at(-1);
  const outcome = rows.filter(row => row.type === 'interaction_outcome' && row.id === interaction?.id).at(-1);
  expect(interaction).toBeTruthy();
  expect(outcome?.outcome).toBe('state-changed');
  expect(outcome.state_before['aria-pressed']).toBe('false');
  expect(outcome.state_after['aria-pressed']).toBe('true');
  expect(Object.keys(outcome.state_before)).not.toContain('value');
  expect(Object.keys(outcome.state_after)).not.toContain('value');
});

test('observatory dashboard reports semantic changes without misclassifying buttons as dead links', async ({ page }) => {
  await page.goto('/atlas/rooms/experiments/001-observatory/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('mc:observatory:v1'));
  await page.locator('button[data-action="sound"]').click();
  await page.waitForTimeout(950);
  await page.goto('/atlas/rooms/observatory.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#outcomes')).toContainText('state-changed');
  await expect(page.locator('#stats')).toContainText('Semantic state changes');
  await expect(page.locator('#deadends')).not.toContainText('sound');
  await expect(page.locator('.foot')).toContainText('Buttons normally have no href');
});

test('observatory telemetry confirms same-origin route transitions across page loads', async ({ page }) => {
  await page.goto('/atlas/rooms/observatory.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('mc:observatory:v1'));
  await page.locator('a[href="./experiments/001-observatory/"]').click();
  await expect(page).toHaveURL(/\/atlas\/rooms\/experiments\/001-observatory\//);
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('mc:observatory:v1') || '[]'));
  const interaction = rows.filter(row => row.type === 'interaction').at(-1);
  const outcome = rows.filter(row => row.type === 'interaction_outcome' && row.id === interaction?.id).at(-1);
  expect(interaction?.target).toContain('/atlas/rooms/experiments/001-observatory/');
  expect(outcome?.outcome).toBe('route-changed');
  expect(outcome?.target_actual).toContain('/atlas/rooms/experiments/001-observatory/');
});

 
test('experiment rooms capture the initial touch point without a prior pointermove', async ({ page }) => {
  await page.goto('/atlas/rooms/experiments/001-observatory/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: Math.round(innerWidth * 0.2), clientY: Math.round(innerHeight * 0.7),
      pointerId: 1, pointerType: 'touch',
    }));
  });
  const pointer = await page.evaluate(() => window.__MC_EXPERIMENT__.getPointer());
  expect(pointer.x).toBeCloseTo(0.2, 1);
  expect(pointer.y).toBeCloseTo(0.7, 1);
  await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch' })));
});

 
test('room animation advances consistently across 60 Hz and 120 Hz frame schedules', async ({ page }) => {
  await page.goto('/atlas/rooms/experiments/001-observatory/', { waitUntil: 'domcontentloaded' });
  const times = await page.evaluate(() => {
    const room = window.__MC_EXPERIMENT__;
    room.setPaused(false);
    room.setIntensity(0.72);
    room.resetClock();
    room.advanceClock(1000);
    room.advanceClock(1016.6666667);
    const at60Hz = room.getTime();
    room.resetClock();
    room.advanceClock(1000);
    room.advanceClock(1008.3333333);
    room.advanceClock(1016.6666667);
    const at120Hz = room.getTime();
    return { at60Hz, at120Hz };
  });
  expect(times.at60Hz).toBeGreaterThan(0);
  expect(times.at120Hz).toBeCloseTo(times.at60Hz, 8);
});

 
test('cancelled touch gestures release the room pointer state', async ({ page }) => {
  await page.goto('/atlas/rooms/experiments/001-observatory/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: Math.round(innerWidth * 0.4), clientY: Math.round(innerHeight * 0.4),
      pointerId: 2, pointerType: 'touch',
    }));
  });
  expect(await page.evaluate(() => window.__MC_EXPERIMENT__.getPointer().down)).toBe(true);
  await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 2, pointerType: 'touch' })));
  expect(await page.evaluate(() => window.__MC_EXPERIMENT__.getPointer().down)).toBe(false);
});

 
test('room keyboard controls clamp coordinates and prevent arrow-key page scrolling', async ({ page }) => {
  await page.goto('/atlas/rooms/experiments/001-observatory/', { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(() => {
    let prevented = false;
    for (let i = 0; i < 20; i++) {
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      prevented = prevented || event.defaultPrevented;
    }
    const left = window.__MC_EXPERIMENT__.getPointer().x;
    for (let i = 0; i < 30; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    return { left, right: window.__MC_EXPERIMENT__.getPointer().x, prevented };
  });
  expect(result.left).toBe(0);
  expect(result.right).toBe(1);
  expect(result.prevented).toBe(true);
});
