import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const manifestPath = '/.well-known/mirror-cartographer-deployment.json';
const rule = config.headers?.find((entry) => entry.source === manifestPath);

assert.ok(rule, `Missing Vercel header rule for ${manifestPath}`);

const headers = Object.fromEntries(
  (rule.headers || []).map(({ key, value }) => [String(key).toLowerCase(), String(value)]),
);

assert.equal(headers['content-type'], 'application/json; charset=utf-8');
assert.match(headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
assert.match(headers['cache-control'], /(?:^|,\s*)max-age=0(?:,|$)/);
assert.equal(headers['x-content-type-options'], 'nosniff');

assert.ok(
  config.rewrites?.some(
    (entry) => entry.destination === '/index.html' && entry.source.includes('api/') && entry.source.includes('atlas'),
  ),
  'SPA fallback must retain API and static-atlas route exclusions',
);

console.log('Vercel identity delivery contract passed: 5/5');
