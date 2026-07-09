import { test, expect } from '@playwright/test';

const installAudioContextProbe = async (page) => {
  await page.addInitScript(() => {
    window.__mirrorAudioContextsCreated = 0;
    const NativeAudioContext = window.AudioContext;
    const NativeWebkitAudioContext = window.webkitAudioContext;

    if (NativeAudioContext) {
      window.AudioContext = class MirrorProbedAudioContext extends NativeAudioContext {
        constructor(...args) {
          window.__mirrorAudioContextsCreated += 1;
          super(...args);
        }
      };
    }

    if (NativeWebkitAudioContext) {
      window.webkitAudioContext = class MirrorProbedWebkitAudioContext extends NativeWebkitAudioContext {
        constructor(...args) {
          window.__mirrorAudioContextsCreated += 1;
          super(...args);
        }
      };
    }
  });
};

const audioContextsCreated = async (page) => page.evaluate(() => window.__mirrorAudioContextsCreated ?? 0);

const expectWordlessBody = async (page) => {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText.trim()).toBe('');
};

test.describe('Mirror Cartographer live hosting smoke', () => {
  test('deployed preview preserves the phone-first wordless audio contract', async ({ page }) => {
    await installAudioContextProbe(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    const sky = page.locator('button.sky');
    const canvas = page.locator('canvas');
    await expect(sky).toBeVisible();
    await expect(canvas).toBeVisible();
    await expectWordlessBody(page);
    expect(await audioContextsCreated(page)).toBe(0);

    await sky.tap({ position: { x: 195, y: 422 } });
    await page.waitForTimeout(700);

    await expect(canvas).toBeVisible();
    await expectWordlessBody(page);
    expect(await audioContextsCreated(page)).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});
