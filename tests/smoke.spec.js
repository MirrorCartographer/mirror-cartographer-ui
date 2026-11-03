import { test, expect } from '@playwright/test';

const expectWordlessBody = async (page) => {
  const visibleText = await page.locator('body').evaluate((body) => {
    const clone = body.cloneNode(true);
    clone.querySelectorAll('script, style, .sr-only, [data-audio-diagnostic], #mc-audio-diagnostic-help, [data-audio-observability], [data-audibility-panel], [data-audio-evidence-export], [data-audio-evidence-status]').forEach((node) => node.remove());
    return clone.innerText;
  });
  const readableText = visibleText.replace(/[\s\p{P}\p{S}]/gu, '');
  expect(readableText).toBe('');
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

const expectCanvasHasPixels = async (canvas) => {
  await expect.poll(async () => canvas.evaluate((node) => {
    const ctx = node.getContext('2d');
    if (!ctx || node.width < 1 || node.height < 1) return 0;
    const positions = [
      [0.08, 0.08], [0.5, 0.08], [0.92, 0.08],
      [0.08, 0.5], [0.5, 0.5], [0.92, 0.5],
      [0.08, 0.92], [0.5, 0.92], [0.92, 0.92],
    ];
    return positions.filter(([x, y]) => {
      const pixelX = Math.min(node.width - 1, Math.floor(node.width * x));
      const pixelY = Math.min(node.height - 1, Math.floor(node.height * y));
      const [red, green, blue, alpha] = ctx.getImageData(pixelX, pixelY, 1, 1).data;
      return alpha > 0 && (red > 0 || green > 0 || blue > 0);
    }).length;
  }), {
    timeout: 3000,
    message: 'expected the room canvas to repaint at least three regions without restarting its animation loop',
  }).toBeGreaterThanOrEqual(3);
};

test.describe('Mirror Cartographer phone-first smoke', () => {
  test('renders wordless room surface and survives first gesture', async ({ page }) => {
    await installAudioContextProbe(page);
    await installAnimationFrameProbe(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const sky = page.locator('button.world-surface');
    const canvas = page.locator('canvas');
    await expect(sky).toBeVisible();
    await expect(canvas).toBeVisible();
    await expectWordlessBody(page);
    await expectAnimationFramesAtLeast(page, 8);
    await expectCanvasHasPixels(canvas);
    expect(await audioContextsCreated(page)).toBe(0);

    const framesBeforeTap = await animationFrames(page);
    await sky.tap({ position: { x: 195, y: 422 } });
    await page.waitForTimeout(700);

    await expect(canvas).toBeVisible();
    await expectWordlessBody(page);
    await expectAnimationFramesAtLeast(page, framesBeforeTap + 8);
    await expectCanvasHasPixels(canvas);
    expect(await audioContextsCreated(page)).toBe(0);
    await expect(page.locator('[data-audio-diagnostic]')).toHaveCount(0);
    await expect(page.locator('[data-audio-evidence-export]')).toHaveCount(0);
    const sound = page.locator('.sound-orb');
    await expect(sound).toHaveAttribute('aria-label', 'Turn sound on');
    await sound.click();
    await expect.poll(async () => audioContextsCreated(page)).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('keeps visible surface essentially wordless', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await expectWordlessBody(page);
  });
  test('workbench loads an artifact and runs an edited live design', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/workbench.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#artifact')).toBeVisible();
    await expect(page.locator('#status')).toContainText('Loaded', { timeout: 15000 });
    await expect(page.locator('#source')).not.toHaveValue('', { timeout: 15000 });
    await expect(page.locator('#preview')).toBeVisible();
    const source = page.locator('#source');
    const liveDesign = '<!doctype html><html><head><title>Live design proof</title></head><body><main><h1>Live, not static</h1><button id="proof">Working control</button></main><scr' + 'ipt>document.querySelector("#proof").addEventListener("click",()=>document.body.dataset.clicked="yes")</scr' + 'ipt></body></html>';
    await source.fill(liveDesign);
    await page.locator('#run').click();
    const preview = page.frameLocator('#preview');
    await expect(preview.locator('h1')).toHaveText('Live, not static');
    await preview.locator('#proof').click();
    await expect(preview.locator('body')).toHaveAttribute('data-clicked', 'yes');
    await page.locator('#reset').click();
    await expect(page.locator('#source')).not.toHaveValue('', { timeout: 5000 });
    expect(errors).toEqual([]);
  });

});