'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDurableRepertoryProvenance } = require('./validateDurableRepertoryProvenance.v1.cjs');

function production(overrides = {}) {
  return {
    id: 'archive-afterimage',
    provenance: {
      observed: [],
      inferred: 'An archive can be represented without exposing source records.',
      experiment: 'Render provenance classes as light persistence.',
      current_decision: 'Retain as a reversible repertory identity until runtime evidence exists.',
    },
    ...overrides,
  };
}

test('accepts durable production provenance without activation claims', () => {
  const result = validateDurableRepertoryProvenance({ productions: [production()] });
  assert.equal(result.valid, true);
  assert.equal(result.production_count, 1);
  assert.deepEqual(result.violations, []);
  assert.equal(result.activation_claimed, false);
  assert.equal(result.deployment_claimed, false);
});

test('rejects a static decision that claims selection for a transient UTC hour', () => {
  const candidate = production();
  candidate.provenance.current_decision = 'This is the stage selected for UTC hour 21 under repertory v1.';
  const result = validateDurableRepertoryProvenance({ productions: [candidate] });
  assert.equal(result.valid, false);
  assert.deepEqual(result.violations, [{
    index: 0,
    production_id: 'archive-afterimage',
    code: 'transient_stage_claim_in_durable_provenance',
    field: 'current_decision',
  }]);
});

test('rejects missing provenance fields and non-array observed evidence', () => {
  const candidate = production();
  candidate.provenance.inferred = '';
  candidate.provenance.observed = 'commit-sha';
  const result = validateDurableRepertoryProvenance({ productions: [candidate] });
  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code, field }) => ({ code, field })), [
    { code: 'missing_provenance_field', field: 'inferred' },
    { code: 'observed_must_be_array', field: 'observed' },
  ]);
});

test('rejects duplicate production identities', () => {
  const result = validateDurableRepertoryProvenance({ productions: [production(), production()] });
  assert.equal(result.valid, false);
  assert.equal(result.violations[0].code, 'duplicate_production_id');
});

test('fails closed for an empty or malformed repertory', () => {
  assert.throws(() => validateDurableRepertoryProvenance(null), /repertory must be an object/);
  assert.throws(() => validateDurableRepertoryProvenance({ productions: [] }), /non-empty array/);
});
