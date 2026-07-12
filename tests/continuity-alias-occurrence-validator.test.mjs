import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateOccurrence, validateOccurrenceSet } from '../scripts/continuity-alias-occurrence-validator.mjs';

const fixtureUrl = new URL('./fixtures/continuity-alias-occurrence-v2.json', import.meta.url);
const fixtures = JSON.parse(await readFile(fixtureUrl, 'utf8'));

test('accepts valid rows across different lifecycle dimensions', () => {
  const result = validateOccurrenceSet(fixtures.valid);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('rejects every invalid fixture', () => {
  for (const fixture of fixtures.invalid) {
    const errors = validateOccurrence(fixture.row);
    assert.ok(errors.length > 0, `${fixture.name} should fail`);
  }
});

test('same normalized value across different dimensions is not a conflict', () => {
  const result = validateOccurrenceSet(fixtures.valid);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('same normalized value and dimension with different statuses requires conflict review', () => {
  const rows = fixtures.valid.map((row) => ({ ...row }));
  rows.push({
    ...rows[1],
    occurrence_id: 'occ-mc-alias-002',
    lifecycle_status: 'superseded',
    review_state: 'needs_review'
  });
  const result = validateOccurrenceSet(rows);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('lifecycle conflict')));
});

test('conflicting rows pass only when all are marked conflict', () => {
  const base = fixtures.valid[1];
  const rows = [
    { ...base, occurrence_id: 'occ-conflict-001', lifecycle_status: 'active', review_state: 'conflict' },
    { ...base, occurrence_id: 'occ-conflict-002', lifecycle_status: 'superseded', review_state: 'conflict' }
  ];
  const result = validateOccurrenceSet(rows);
  assert.equal(result.valid, true, result.errors.join('\n'));
});
