import { test, expect } from '@playwright/test';

const expectWordlessBody = async (page) => {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText.trim()).toBe('');
};

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

const installAnimationFrameProbe = async (page) => {
  await page.addInitScript(() => {
    window.__mirrorAnimationFrames = 0;
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => nativeRequestAnimationFrame((time) => {
      window.__mirrorAnimationFrames += 1;
      callback(time);
    });
  });
};

const audioContextsCreated = async (page) => page.evaluate(() => window.__mirrorAudioContextsCreated ?? 0);
const animationFrames = async (page) => page.evaluate(() => window.__mirrorAnimationFrames ?? 0);

const expectAnimationFramesAtLeast = async (page, minimum) => {
  await expect.poll(() => animationFrames(page), {
    timeout: 3000,
    message: `expected wordless sky to render at least ${minimum} animation frames`,
  }).toBeGreaterThanOrEqual(minimum);
};

test.describe('Mirror Cartographer phone-first smoke', () => {
  test('renders wordless sky and survives first tap', async ({ page }) => {
    await installAudioContextProbe(page);
    await installAnimationFrameProbe(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const sky = page.locator('button.sky');
    const canvas = page.locator('canvas');
    await expect(sky).toBeVisible();
    await expect(canvas).toBeVisible();
    await expectWordlessBody(page);
    await expectAnimationFramesAtLeast(page, 8);
    expect(await audioContextsCreated(page)).toBe(0);

    const framesBeforeTap = await animationFrames(page);
    await sky.tap({ position: { x: 195, y: 422 } });
    await page.waitForTimeout(700);

    await expect(canvas).toBeVisible();
    await expectWordlessBody(page);
    await expectAnimationFramesAtLeast(page, framesBeforeTap + 8);
    expect(await audioContextsCreated(page)).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('keeps visible surface essentially wordless', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await expectWordlessBody(page);
  });
});
