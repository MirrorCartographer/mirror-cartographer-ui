const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');

test('is self-contained and network silent',()=>{
  assert.doesNotMatch(html,/<script[^>]+src=/i);
  assert.doesNotMatch(html,/<link[^>]+rel=["']stylesheet/i);
  assert.doesNotMatch(html,/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b/);
  assert.doesNotMatch(html,/https?:\/\//i);
});

test('does not persist or identify visitors',()=>{
  assert.doesNotMatch(html,/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(html,/\b(login|signup|analytics|payment|checkout)\b/i);
});

test('provides accessible direct manipulation',()=>{
  assert.match(html,/<canvas[^>]+aria-label=/i);
  assert.match(html,/role="status"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/aria-pressed="false"/);
  assert.match(html,/prefers-reduced-motion/);
  assert.match(html,/min-height:44px/);
  assert.match(html,/safe-area-inset/);
});

test('supports pointer and keyboard operation',()=>{
  for(const token of ['pointerdown','pointermove','pointerup','ArrowLeft','ArrowRight','Escape']) assert.match(html,new RegExp(token));
});

test('bounds rendering and tears animation down',()=>{
  assert.match(html,/Math\.min\(devicePixelRatio\|\|1,2\)/);
  assert.match(html,/cancelAnimationFrame/);
  assert.match(html,/pagehide/);
});

test('keeps one animation request scheduler',()=>{
  const direct=(html.match(/requestAnimationFrame\(draw\)/g)||[]).length;
  assert.equal(direct,2,'one continuation and one guarded scheduler are expected');
  assert.match(html,/if\(!raf\)raf=requestAnimationFrame\(draw\)/);
});
