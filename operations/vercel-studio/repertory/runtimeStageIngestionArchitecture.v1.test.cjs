'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIRECTORY = __dirname;
const CANONICAL_INGESTION_FILE = 'ingestRuntimeStageEvidence.v1.cjs';
const REPERTORY_PROMOTION_FILE = 'promoteRuntimeStageFromRepertory.v1.cjs';

function productionModules() {
  return fs.readdirSync(DIRECTORY)
    .filter((name) => name.endsWith('.cjs') && !name.endsWith('.test.cjs'))
    .sort();
}

function modulesRequiring(target) {
  const needle = `require('./${target}')`;
  return productionModules().filter((name) => {
    const source = fs.readFileSync(path.join(DIRECTORY, name), 'utf8');
    return source.includes(needle);
  });
}

test('canonical ingestion is the sole production importer of repertory promotion', () => {
  assert.deepEqual(
    modulesRequiring('promoteRuntimeStageFromRepertory.v1.cjs'),
    [CANONICAL_INGESTION_FILE],
  );
});

test('repertory promotion is the sole production importer of caller-shaped promotion', () => {
  assert.deepEqual(
    modulesRequiring('promoteRuntimeStageEvidence.v1.cjs'),
    [REPERTORY_PROMOTION_FILE],
  );
});

test('the canonical ingestion boundary retains its fail-closed identity markers', () => {
  const source = fs.readFileSync(path.join(DIRECTORY, CANONICAL_INGESTION_FILE), 'utf8');
  assert.match(source, /repertory_derived_identity_only/);
  assert.match(source, /caller-supplied expected stage identity is forbidden/);
  assert.match(source, /unsupported runtime stage ingestion field/);
});
