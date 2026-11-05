import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';

const root = process.cwd();
const rootFile = resolve(root, 'execution-hub.html');
const publicFile = resolve(root, 'public/execution-hub.html');
assert.ok(existsSync(rootFile), 'root execution-hub.html must exist');
assert.ok(existsSync(publicFile), 'public/execution-hub.html must exist for Vite static copy');
const rootHtml = readFileSync(rootFile, 'utf8');
const publicHtml = readFileSync(publicFile, 'utf8');
assert.equal(rootHtml, publicHtml, 'root and public copies must remain byte-identical');

for (const marker of ['Unified Execution Hub', 'localStorage', 'JSON.stringify', 'JSON.parse', 'safeHref', 'noopener noreferrer', 'mc-unified-execution-hub-v1']) {
  assert.ok(rootHtml.includes(marker), `missing required contract marker: ${marker}`);
}
assert.doesNotMatch(rootHtml, /\bfetch\s*\(|XMLHttpRequest|WebSocket|api\.openai\.com/i, 'hub must remain local-first with no remote API calls');
assert.doesNotMatch(rootHtml, /sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/, 'hub must not contain credential patterns');

const scripts = [...rootHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1, 'expected one inline application script');
new vm.Script(scripts[0][1], { filename: 'execution-hub-inline.js' });
console.log('Execution Hub contract passed: copies match, inline JS parses, local-only boundary holds.');
