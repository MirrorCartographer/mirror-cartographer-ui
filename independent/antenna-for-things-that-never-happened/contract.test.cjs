const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function absent(pattern, message) {
  assert.equal(pattern.test(source), false, message);
}

function present(pattern, message) {
  assert.equal(pattern.test(source), true, message);
}

test('remains network-silent, non-extractive, and commerce-free', () => {
  absent(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/, 'network API found');
  absent(/localStorage|sessionStorage|indexedDB|document\.cookie/, 'durable visitor storage found');
  absent(/analytics|gtag|segment|mixpanel|stripe|checkout|subscribe|sign[ -]?up|log[ -]?in/i, 'product or conversion vocabulary found');
  absent(/<script[^>]+src=|<link[^>]+href=["']https?:/i, 'external dependency found');
});

test('sound is optional, explicit, and never autoplayed', () => {
  present(/id="sound"[^>]*aria-pressed="false"/, 'sound control missing');
  present(/addEventListener\('click'.*toggleSound/s, 'sound is not bound to an explicit click');
  present(/new \(window\.AudioContext \|\| window\.webkitAudioContext\)\(\)/, 'user-created audio context missing');
  absent(/autoplay/i, 'autoplay vocabulary found');
  absent(/\.play\s*\(/, 'media play call found');
});

test('provides accessible pointer and keyboard operation', () => {
  present(/aria-label="A responsive field/, 'canvas accessible name missing');
  present(/aria-live="polite"/, 'live status region missing');
  present(/type="range"/, 'semantic tuning control missing');
  present(/pointerdown/, 'pointer interaction missing');
  present(/pointercancel/, 'pointer cancellation missing');
  present(/ArrowLeft/, 'left keyboard tuning missing');
  present(/ArrowRight/, 'right keyboard tuning missing');
  present(/event\.key === ' '/, 'keyboard hold path missing');
  present(/min-width:44px; min-height:44px/, 'minimum control target missing');
  present(/prefers-reduced-motion: reduce/, 'reduced-motion accommodation missing');
});

test('bounds rendering and tears down active resources', () => {
  present(/Math\.min\(devicePixelRatio \|\| 1, 2\)/, 'device-pixel ratio is not capped');
  present(/Math\.min\(32, now - previous\)/, 'frame delta is not bounded');
  present(/cancelAnimationFrame\(raf\)/, 'animation teardown missing');
  present(/audio\.close\(\)/, 'audio context teardown missing');
  present(/pagehide/, 'page lifecycle teardown missing');
});
