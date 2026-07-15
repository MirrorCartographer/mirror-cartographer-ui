'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUIRED_REPERTORY_TESTS,
  assessRepertoryTestInventory,
} = require('./repertoryTestInventory.v1.cjs');

test('verifies when every required repertory test is present', () => {
  const result = assessRepertoryTestInventory([
    ...REQUIRED_REPERTORY_TESTS,
    'validateHourlyRepertory.v1.test.cjs',
  ]);

  assert.equal(result.verified, true, JSON.stringify(result.violations));
  assert.deepEqual(result.missing_required_tests, []);
  assert.equal(result.claim_boundary, 'required_repertory_tests_present_before_execution');
});

test('fails closed when activation coverage is omitted', () => {
  const result = assessRepertoryTestInventory([
    'assessCurlBoundRepertoryPublicationReadiness.v1.test.cjs',
  ]);

  assert.equal(result.verified, false);
  assert.deepEqual(result.missing_required_tests, ['assessRepertoryActivation.v1.test.cjs']);
  assert.equal(result.violations.includes('required_repertory_test_missing'), true);
  assert.equal(result.claim_boundary, 'repertory_test_execution_prohibited');
});

test('fails closed on empty discovery and duplicate names', () => {
  const empty = assessRepertoryTestInventory([]);
  assert.equal(empty.verified, false);
  assert.equal(empty.violations.includes('no_repertory_tests_discovered'), true);

  const duplicated = assessRepertoryTestInventory([
    ...REQUIRED_REPERTORY_TESTS,
    REQUIRED_REPERTORY_TESTS[0],
  ]);
  assert.equal(duplicated.verified, false);
  assert.equal(duplicated.violations.includes('duplicate_discovered_test_name'), true);
});
