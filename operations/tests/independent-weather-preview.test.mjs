import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../independent-creative-web/weather-that-remembers-no-one/index.html', import.meta.url);
const html = await readFile(path, 'utf8');

test('is a self-contained artwork rather than a product surface', () => {
  assert.match(html, /The Weather That Remembers No One/);
  assert.doesNotMatch(html, /checkout|payment|subscribe|sign up|dashboard/i);
});

test('audio requires an explicit user gesture', () => {
  const listener = html.indexOf("soundButton.addEventListener('click'");
  const context = html.indexOf('new (window.AudioContext||window.webkitAudioContext)');
  assert.ok(listener >= 0);
  assert.ok(context > listener);
  assert.doesNotMatch(html, /autoplay/i);
});

test('supports reduced motion and hidden-page suspension', () => {
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /visibilitychange/);
  assert.match(html, /audio\.suspend\(\)/);
});

test('contains keyboard-operable controls and live status', () => {
  assert.match(html, /<button[^>]+id="sound"/);
  assert.match(html, /<button[^>]+id="calm"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
});
