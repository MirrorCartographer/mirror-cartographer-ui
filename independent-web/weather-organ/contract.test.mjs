import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('is a self-contained document without external network dependencies', () => {
  assert.match(html, /<!doctype html>/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
  assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|WebSocket/i);
});

test('contains no product funnel or Mirror Cartographer identity', () => {
  assert.doesNotMatch(html, /Mirror\s*Cartographer/i);
  assert.doesNotMatch(html, /checkout|payment|subscribe|sign\s*up|buy\s*now/i);
});

test('provides explicit-input audio and keyboard-equivalent interaction', () => {
  assert.match(html, /button\.addEventListener\('click'/);
  assert.match(html, /AudioContext/);
  assert.match(html, /ArrowLeft/);
  assert.match(html, /aria-pressed/);
});

test('includes motion and transparency accessibility fallbacks', () => {
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /prefers-reduced-transparency/);
  assert.match(html, /aria-live="polite"/);
});
