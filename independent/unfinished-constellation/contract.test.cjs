'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

test('is a self-contained viewport-safe work', () => {
  assert.match(source, /<!doctype html>/i);
  assert.match(source, /viewport-fit=cover/);
  assert.doesNotMatch(source, /<script[^>]+src=/i);
  assert.doesNotMatch(source, /<link[^>]+(?:stylesheet|preload)/i);
  assert.doesNotMatch(source, /https?:\/\//i);
});

test('remains independent and non-commercial', () => {
  assert.doesNotMatch(source, /mirror cartographer|mirror-cartographer/i);
  assert.doesNotMatch(source, /stripe|checkout|payment|buy now|subscribe|lead capture/i);
  assert.doesNotMatch(source, /oauth|sign[ -]?in|log[ -]?in|supabase|firebase/i);
  assert.doesNotMatch(source, /google-analytics|gtag\(|segment|mixpanel|posthog/i);
});

test('provides accessible controls and equivalent status', () => {
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /aria-pressed="false"/);
  assert.match(source, /<button class="control"/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
});

test('bounds rendering cost and keeps one animation loop', () => {
  assert.match(source, /Math\.min\(devicePixelRatio \|\| 1, 2\)/);
  assert.match(source, /cancelAnimationFrame\(raf\)/);
  assert.match(source, /function resize\(\)[^]*?if \(reduced\) draw\(\);[^]*?\n  }/);
  assert.doesNotMatch(source, /function resize\(\)[^]*?\n    draw\(\);[^]*?\n  }/);
  assert.equal((source.match(/requestAnimationFrame\(draw\)/g) || []).length, 2);
});

test('uses no network, durable identity storage, audio, or autoplay media', () => {
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|EventSource/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
  assert.doesNotMatch(source, /AudioContext|<audio|<video/i);
  assert.doesNotMatch(source, /autoplay/i);
});