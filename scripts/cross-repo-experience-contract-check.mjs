import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const readme = read('../README.md');
const state = JSON.parse(read('../operations/CURRENT_STATE.json'));

const canonical = [
  'https://mirror-cartographer-ui-3orp.vercel.app',
  'https://mirrorcartographeravprototypev4.vercel.app/#',
];
for (const url of canonical) {
  assert.ok(readme.includes(url), `UI README must retain canonical URL: ${url}`);
}
assert.equal(state.delivery_state, 'in_progress_blocked', 'stale deployment identity must not be represented as accepted');
assert.match(state.operating_constraints.join(' '), /Do not claim deployment or peer execution without evidence/);
assert.match(state.next_action, /exact deployed commit/);
console.log('PASS cross-repository experience and deployment evidence contract');
