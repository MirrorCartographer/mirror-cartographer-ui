import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('offers touch-complete climate controls', () => {
  for (const mode of ['ash', 'rain', 'moths', 'static']) {
    assert.match(html, new RegExp(`data-mode="[0-3]"[^>]*>${mode}<`));
  }
  assert.match(html, /pointerdown/);
  assert.match(html, /pointermove/);
});

test('offers keyboard and assistive-state contracts', () => {
  assert.match(html, /tabindex="0"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /ArrowRight/);
  assert.match(html, /ArrowLeft/);
  assert.match(html, /aria-pressed/);
});

test('keeps sound optional and motion preference bounded', () => {
  assert.match(html, /sound: off/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /if\(reduce\)/);
  assert.doesNotMatch(html, /autoplay/i);
});

test('remains independent of Mirror Cartographer runtime and commerce', () => {
  assert.doesNotMatch(html, /Mirror Cartographer/i);
  assert.doesNotMatch(html, /checkout|payment|subscribe|pricing/i);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket/);
});
