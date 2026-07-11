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

const expectWordlessBody = async (page) => {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText.trim()).toBe('');
};

const expectAnimationFramesAtLeast = async (page, minimum) => {
  await expect.poll(() => animationFrames(page), {
    timeout: 3000,
    message: `expected deployed wordless sky to render at least ${minimum} animation frames`,
  }).toBeGreaterThanOrEqual(minimum);
};

const expectResolvedDeploymentIdentity = async (page) => {
  const identity = await page.evaluate(() => window.__MC_DEPLOYMENT_IDENTITY__ ?? null);
  expect(identity, 'deployed runtime must expose immutable source identity').not.toBeNull();
  expect(identity.schemaVersion).toBe('1.0.0');
  expect(identity.verificationState).toBe('source-identified');
  expect(identity.commitResolved).toBe(true);
  expect(identity.commit).toMatch(/^[0-9a-f]{40}$/);

  const marker = await page.locator('meta[name="mc-deployment-identity"]').getAttribute('content');
  expect(marker).toBeTruthy();
  expect(JSON.parse(marker)).toEqual(identity);

  const expectedCommit = String(process.env.EXPECTED_DEPLOYMENT_COMMIT || '').trim().toLowerCase();
  if (expectedCommit) {
    expect(expectedCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(identity.commit).toBe(expectedCommit);
  }

  return identity;
};

test.describe('Mirror Cartographer live hosting smoke', () => {
  test('deployed preview preserves the phone-first wordless audio contract', async ({ page }) => {
    await installAudioContextProbe(page);
    await installAnimationFrameProbe(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    const identity = await expectResolvedDeploymentIdentity(page);
    if (new URL(page.url()).hostname.endsWith('.vercel.app')) {
      expect(identity.provider).toBe('vercel');
    }

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
});