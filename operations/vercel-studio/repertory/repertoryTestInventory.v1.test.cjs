'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  REQUIRED_REPERTORY_TESTS,
  assessRepertoryTestInventory,
} = require('./repertoryTestInventory.v1.cjs');

const repertoryDirectory = __dirname;
const runnerPath = join(repertoryDirectory, 'runRepertoryTests.v1.mjs');
const criticalTests = Object.freeze([
  'assessCurlBoundRepertoryPublicationReadiness.v1.test.cjs',
  'assessRepertoryActivation.v1.test.cjs',
  'buildContinuityHandoff.v1.test.cjs',
  'repertoryTestInventory.v1.test.cjs',
  'verifyProgrammedStageReceipt.v1.test.cjs',
  'vercelRepertoryOidcWorkflowContract.v1.test.cjs',
]);

function discoveredTestNames() {
  return readdirSync(repertoryDirectory)
    .filter((name) => name.endsWith('.test.cjs'))
    .sort();
}

test('canonical runner retains deterministic fail-closed discovery', () => {
  const runnerSource = readFileSync(runnerPath, 'utf8');
  assert.match(runnerSource, /endsWith\('\.test\.cjs'\)/);
  assert.match(runnerSource, /\.sort\(\)/);
  assert.match(runnerSource, /No repertory tests were discovered; failing closed\./);
  assert.match(runnerSource, /spawnSync\(process\.execPath, \['--test', \.\.\.testFiles\]/);
});

test('critical publication, activation, continuity, programmed-stage, inventory, and OIDC gates are mandatory', () => {
  assert.deepEqual(
    [...REQUIRED_REPERTORY_TESTS].sort(),
    [...criticalTests].sort(),
    'required inventory must name every critical repertory gate',
  );

  const discovered = discoveredTestNames();
  assert.ok(discovered.length >= criticalTests.length, 'repertory suite unexpectedly contracted');

  for (const criticalTest of criticalTests) {
    assert.equal(
      discovered.filter((name) => name === criticalTest).length,
      1,
      `critical repertory test missing or duplicated: ${criticalTest}`,
    );
  }
});

test('inventory fails closed before execution when any critical gate is removed', () => {
  for (const criticalTest of criticalTests) {
    const contracted = discoveredTestNames().filter((name) => name !== criticalTest);
    const assessment = assessRepertoryTestInventory(contracted);
    assert.equal(assessment.verified, false, `removal must fail closed: ${criticalTest}`);
    assert.ok(assessment.missing_required_tests.includes(criticalTest));
    assert.ok(assessment.violations.includes('required_repertory_test_missing'));
    assert.equal(assessment.claim_boundary, 'repertory_test_execution_prohibited');
  }
});

test('discovery order is stable and contains no path traversal entries', () => {
  const discovered = discoveredTestNames();
  assert.deepEqual(discovered, [...discovered].sort());
  for (const name of discovered) {
    assert.equal(name, name.split('/').pop());
    assert.equal(name, name.split('\\').pop());
    assert.ok(!name.includes('..'), `unsafe test filename: ${name}`);
  }
});
