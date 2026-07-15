'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const repertoryDirectory = __dirname;
const runnerPath = join(repertoryDirectory, 'runRepertoryTests.v1.mjs');
const criticalTests = Object.freeze([
  'assessRepertoryActivation.v1.test.cjs',
  'buildContinuityHandoff.v1.test.cjs',
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

test('critical activation, continuity, programmed-stage, and OIDC gates remain discoverable exactly once', () => {
  const discovered = discoveredTestNames();
  assert.ok(discovered.length >= criticalTests.length + 1, 'repertory suite unexpectedly contracted');

  for (const criticalTest of criticalTests) {
    assert.equal(
      discovered.filter((name) => name === criticalTest).length,
      1,
      `critical repertory test missing or duplicated: ${criticalTest}`,
    );
  }

  assert.equal(
    discovered.filter((name) => name === 'repertoryTestInventory.v1.test.cjs').length,
    1,
    'inventory gate must itself be auto-discovered exactly once',
  );
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