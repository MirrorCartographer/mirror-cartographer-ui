import { test, expect } from '@playwright/test';

const installRoutableAudioContext = async (page) => {
  await page.addInitScript(() => {
    class RoutableAudioContext extends EventTarget {
      constructor() {
        super();
        this.sinkId = 'speaker-test-device';
        window.__MC_TEST_AUDIO_CONTEXT__ = this;
      }

      async setSinkId(nextSinkId) {
        this.sinkId = nextSinkId;
        this.dispatchEvent(new Event('sinkchange'));
      }
    }

    window.AudioContext = RoutableAudioContext;
    window.webkitAudioContext = undefined;
  });
};

test.describe('audio routing evidence browser contract', () => {
  test('diagnostic refresh cannot downgrade a sinkchange-confirmed context', async ({ page }) => {
    await installRoutableAudioContext(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      window.__MC_AUDIO_ATTEMPT_ID__ = 'browser-regression-attempt';
      const context = new window.AudioContext();
      context.dispatchEvent(new Event('sinkchange'));

      const diagnostic = document.createElement('button');
      diagnostic.type = 'button';
      diagnostic.dataset.audioDiagnostic = 'true';
      diagnostic.textContent = 'diagnostic';
      document.body.appendChild(diagnostic);
      diagnostic.click();
    });

    await expect.poll(() => page.evaluate(() => window.__MC_AUDIO_ROUTING__?.status)).toBe('selected-confirmed');
    await expect.poll(() => page.evaluate(() => window.__MC_AUDIO_ROUTING__?.attemptId)).toBe('browser-regression-attempt');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.audioRouting)).toBe('selected-confirmed');
  });
});
