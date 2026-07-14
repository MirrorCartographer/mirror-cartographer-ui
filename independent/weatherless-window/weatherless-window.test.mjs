import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('is a self-contained document with no external network dependencies', () => {
  assert.match(html, /<!doctype html>/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+href=/i);
  assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
});

test('stays independent from Mirror Cartographer and conversion surfaces', () => {
  assert.doesNotMatch(html, /Mirror Cartographer|mirror-cartographer|checkout|payment|subscribe|sign up|dashboard/i);
});

test('contains accessibility and motion safeguards', () => {
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /aria-pressed/);
  assert.match(html, /focus-visible/);
  assert.match(html, /viewport-fit=cover/);
});

test('does not autoplay audio or retain identity', () => {
  assert.doesNotMatch(html, /<audio|Audio\s*\(|localStorage|sessionStorage|indexedDB|document\.cookie/i);
  assert.match(html, /disappears when the page closes/i);
});
