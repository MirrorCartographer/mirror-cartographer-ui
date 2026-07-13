import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('./weather-score.html', import.meta.url), 'utf8');
test('provides a sixteen-beat editable score',()=>{assert.equal((html.match(/length:16/g)||[]).length,1);for(const mode of ['ash','rain','moths','static'])assert.match(html,new RegExp(`data-paint="${mode}"`));assert.match(html,/function apply\(i\)/)});
test('supports touch, keyboard, and assistive state',()=>{assert.match(html,/addEventListener\('click'/);assert.match(html,/ArrowRight/);assert.match(html,/aria-live="polite"/);assert.match(html,/aria-label="Sixteen beat weather score"/)});
test('keeps sound optional and reduced motion bounded',()=>{assert.match(html,/sound: off/);assert.match(html,/prefers-reduced-motion/);assert.doesNotMatch(html,/autoplay/i);assert.match(html,/reduce\?700:430/)});
test('remains local, independent, and commerce-free',()=>{assert.doesNotMatch(html,/Mirror Cartographer/i);assert.doesNotMatch(html,/checkout|payment|subscribe|pricing/i);assert.doesNotMatch(html,/fetch\(|XMLHttpRequest|WebSocket/)});
