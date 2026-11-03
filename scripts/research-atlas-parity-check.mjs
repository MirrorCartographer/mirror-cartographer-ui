import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('research-atlas/index.html', 'utf8');
const published = readFileSync('public/research-atlas/index.html', 'utf8');

assert.ok(source.includes('href="../public/atlas/"'), 'source copy must link to the repository-local public Atlas path');
assert.ok(published.includes('href="../atlas/"'), 'published copy must link to the deployed Atlas path');

const normalized = source.replace('href="../public/atlas/"', 'href="../atlas/"');
assert.equal(
  normalized,
  published,
  'source and published research atlas must be byte-identical after normalizing their one intentional relative route',
);

console.log('PASS: source and published research-atlas copies are identical apart from the intentional deployment-relative Atlas link.');
