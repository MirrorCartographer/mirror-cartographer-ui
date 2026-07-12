import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAliasProvenance } from './alias-provenance-validator.mjs';

const base = {
  term: 'MC',
  first_known_on: '2026-01-26',
  last_seen_on: '2026-07-12',
  sources: [
    { id: 'chat-summary:2026-01-26', type: 'chat_summary', observed_on: '2026-01-26', contains_raw_private_content: false },
    { id: 'repo:lexicon', type: 'repository', observed_on: '2026-07-12', contains_raw_private_content: false },
  ],
};

test('accepts provenance-bound range', () => assert.equal(validateAliasProvenance(base).valid, true));
test('rejects guessed earlier date', () => assert.ok(validateAliasProvenance({ ...base, first_known_on: '2025-01-01' }).errors.includes('first_known_not_earliest_source')));
test('rejects reversed range', () => assert.ok(validateAliasProvenance({ ...base, first_known_on: '2026-07-13' }).errors.includes('date_order_invalid')));
test('rejects raw private content', () => assert.ok(validateAliasProvenance({ ...base, sources: [{ ...base.sources[0], contains_raw_private_content: true }] }).errors.includes('raw_private_content_forbidden')));
test('rejects duplicate source ids', () => assert.ok(validateAliasProvenance({ ...base, sources: [base.sources[0], base.sources[0]] }).errors.includes('duplicate_source_id')));
test('rejects unsupported source type', () => assert.ok(validateAliasProvenance({ ...base, sources: [{ ...base.sources[0], type: 'memory' }] }).errors.includes('source_type_invalid')));
