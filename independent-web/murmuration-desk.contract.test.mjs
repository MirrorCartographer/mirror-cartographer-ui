import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./murmuration-desk.html', import.meta.url), 'utf8');

test('remains a self-contained static artifact', () => {
  assert.match(source, /<!doctype html>/i);
  assert.doesNotMatch(source, /<script[^>]+src=/i);
  assert.doesNotMatch(source, /<link[^>]+href=/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
});

test('requires explicit activation before sound', () => {
  assert.match(source, /let[^;]*muted=true/);
  assert.match(source, /soundButton\.addEventListener\('click',toggleSound\)/);
  assert.match(source, /if\(muted\)return/);
});

test('retains keyboard and reduced-motion paths', () => {
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /e\.code==='Space'/);
  assert.match(source, /aria-live="polite"/);
});

test('contains the independent identity and no product funnel language', () => {
  assert.match(source, /Murmuration Desk/);
  assert.doesNotMatch(source, /Mirror Cartographer/i);
  assert.doesNotMatch(source, /buy|subscribe|checkout|pricing|commission/i);
});
