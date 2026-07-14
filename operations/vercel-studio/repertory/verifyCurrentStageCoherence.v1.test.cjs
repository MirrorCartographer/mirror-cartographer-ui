'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { verifyCurrentStageCoherence } = require('./verifyCurrentStageCoherence.v1.cjs');

const repertory = JSON.parse(fs.readFileSync(path.join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'));

test('detects scheduled versus observed drift at UTC hour 22', () => {
  const report = verifyCurrentStageCoherence(repertory, '2026-07-14T22:32:48Z');
  assert.equal(report.verified, false);
  assert.equal(report.classification, 'scheduled_observed_drift');
  assert.equal(report.scheduled_production_id, 'body-constellation');
  assert.equal(report.observed_production_id, 'wordless-room-game');
  assert.equal(report.deployment_claimed, false);
  assert.equal(report.side_effects_performed, false);
});

test('accepts a timestamp whose scheduled production matches the observed marker', () => {
  const report = verifyCurrentStageCoherence(repertory, '2026-07-14T21:10:00Z');
  assert.equal(report.verified, true);
  assert.equal(report.classification, 'scheduled_observed_agreement');
});

test('fails closed when more than one production claims observed_current_stage', () => {
  const altered = structuredClone(repertory);
  altered.productions[0].status = 'observed_current_stage';
  assert.throws(() => verifyCurrentStageCoherence(altered, '2026-07-14T21:10:00Z'), /exactly one/);
});
