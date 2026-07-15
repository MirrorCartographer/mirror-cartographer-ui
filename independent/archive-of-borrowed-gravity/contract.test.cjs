const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');

test('is isolated from network, storage, analytics, auth, commerce, and autoplay',()=>{
  for(const forbidden of [/fetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/localStorage/,/sessionStorage/,/indexedDB/,/document\.cookie/,/analytics/i,/stripe/i,/paypal/i,/sign[ -]?in/i,/autoplay/i]) assert.doesNotMatch(source,forbidden);
});

test('provides pointer, keyboard, status, and 44px controls',()=>{
  assert.match(source,/pointerdown/);assert.match(source,/keydown/);assert.match(source,/aria-live="polite"/);assert.match(source,/min-height:44px/);assert.match(source,/aria-pressed/);
});

test('contains bounded rendering and teardown behavior',()=>{
  assert.match(source,/clamp\(devicePixelRatio\|\|1,1,2\)/);assert.match(source,/Math\.min\(32,t-last\|\|16\)/);assert.match(source,/cancelAnimationFrame\(raf\)/);assert.match(source,/pointercancel/);
});

test('honors reduced motion and keeps meaning independent of sound',()=>{
  assert.match(source,/prefers-reduced-motion: reduce/);assert.match(source,/reduce\.matches/);assert.doesNotMatch(source,/<audio|AudioContext|webkitAudioContext/);
});
