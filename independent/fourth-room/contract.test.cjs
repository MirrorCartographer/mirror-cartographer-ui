'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, 'index.html');
const source = fs.readFileSync(file, 'utf8');

test('is a self-contained, viewport-safe document', () => {
  assert.match(source, /<!doctype html>/i);
  assert.match(source, /viewport-fit=cover/);
  assert.doesNotMatch(source, /<script[^>]+src=/i);
  assert.doesNotMatch(source, /<link[^>]+(?:stylesheet|preload)/i);
  assert.doesNotMatch(source, /https?:\/\//i);
});

test('has no commerce, analytics, authentication, or Mirror Cartographer coupling', () => {
  assert.doesNotMatch(source, /stripe|checkout|payment|buy now|subscribe/i);
  assert.doesNotMatch(source, /google-analytics|gtag\(|segment|mixpanel|posthog/i);
  assert.doesNotMatch(source, /oauth|sign[ -]?in|log[ -]?in|supabase|firebase/i);
  assert.doesNotMatch(source, /mirror cartographer|mirror-cartographer/i);
});

test('sound is opt-in and never autoplays', () => {
  assert.match(source, /id="sound"[^>]+aria-pressed="false"/);
  assert.match(source, /sound\.addEventListener\('click'/);
  assert.doesNotMatch(source, /<audio[^>]+autoplay/i);
  assert.doesNotMatch(source, /new \(window\.AudioContext[^]*?\)\s*;/i);
});

test('provides keyboard semantics and live status', () => {
  assert.match(source, /<button class="door"/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
});

test('bounds rendering cost and avoids persistent identity storage', () => {
  assert.match(source, /Math\.min\(devicePixelRatio \|\| 1, 2\)/);
  assert.match(source, /sessionStorage/);
  assert.doesNotMatch(source, /localStorage|indexedDB|document\.cookie/i);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket/i);
});
