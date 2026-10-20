'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { verifyCurrentStageCoherence } = require('./verifyCurrentStageCoherence.v1.cjs');

const repertory = JSON.parse(fs.readFileSync(path.join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'));

function withObservedStage(id) {
  const altered = structuredClone(repertory);
  const production = altered.productions.find((item) => item.id === id);
  production.status = 'observed_current_stage';
  return altered;
}

test('does not convert a missing runtime observation into a current-stage fact', () => {
  const report = verifyCurrentStageCoherence(repertory, '2026-07-14T22:32:48Z');
  assert.equal(report.verified, false);
  assert.equal(report.classification, 'observed_stage_unknown');
  assert.equal(report.scheduled_production_id, 'body-constellation');
  assert.equal(report.observed_production_id, null);
  assert.equal(report.deployment_claimed, false);
});

test('detects scheduled versus observed drift when a runtime observation exists', () => {
  const report = verifyCurrentStageCoherence(withObservedStage('wordless-room-game'), '2026-07-14T22:32:48Z');
  assert.equal(report.verified, false);
  assert.equal(report.classification, 'scheduled_observed_drift');
  assert.equal(report.scheduled_production_id, 'body-constellation');
  assert.equal(report.observed_production_id, 'wordless-room-game');
  assert.equal(report.deployment_claimed, false);
  assert.equal(report.side_effects_performed, false);
});

test('accepts an explicit observed marker when it matches the scheduled slot', () => {
  const report = verifyCurrentStageCoherence(withObservedStage('wordless-room-game'), '2026-07-14T21:10:00Z');
  assert.equal(report.verified, true);
  assert.equal(report.classification, 'scheduled_observed_agreement');
});

test('fails closed when multiple productions claim observed_current_stage', () => {
  const altered = withObservedStage('wordless-room-game');
  altered.productions[0].status = 'observed_current_stage';
  altered.productions[0].provenance.observed = ['synthetic-source'];
  assert.throws(() => verifyCurrentStageCoherence(altered, '2026-07-14T21:10:00Z'), /at most one/);
});
