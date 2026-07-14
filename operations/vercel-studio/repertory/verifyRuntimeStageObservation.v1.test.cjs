'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const repertory = require('./HOURLY_REPERTORY.v1.json');
const { verifyRuntimeStageObservation } = require('./verifyRuntimeStageObservation.v1.cjs');

const commitSha = '8c353e049c3c2b257a88942871d792c83a5d902e';

function observation(overrides = {}) {
  return {
    contract_id: 'vercel-studio-runtime-stage-observation-v1',
    observed_at: '2026-07-14T22:45:00.000Z',
    commit_sha: commitSha,
    deployment_id: 'dpl_runtime_observation_fixture',
    deployment_url: 'https://mirror-cartographer-ui.example.test/',
    repertory_contract_id: repertory.contract_id,
    production_id: 'body-constellation',
    source: 'runtime_dom_probe',
    deployment_verified: true,
    autoplay_audio_detected: false,
    private_source_material_detected: false,
    ...overrides,
  };
}

test('accepts exact-commit observation matching the deterministic UTC stage', () => {
  const result = verifyRuntimeStageObservation({
    repertory,
    observation: observation(),
    expectedCommitSha: commitSha,
  });
  assert.equal(result.verified, true);
  assert.equal(result.production_id, 'body-constellation');
  assert.equal(result.utc_hour, 22);
  assert.equal(result.classification, 'commit_bound_runtime_stage_verified');
});

test('rejects a stale or different commit', () => {
  assert.throws(
    () => verifyRuntimeStageObservation({
      repertory,
      observation: observation({ commit_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      expectedCommitSha: commitSha,
    }),
    /commit does not match/,
  );
});

test('rejects a production that does not match the hourly selector', () => {
  assert.throws(
    () => verifyRuntimeStageObservation({
      repertory,
      observation: observation({ production_id: 'wordless-room-game' }),
      expectedCommitSha: commitSha,
    }),
    /does not match deterministic hourly selection/,
  );
});

test('rejects unverified deployment identity', () => {
  assert.throws(
    () => verifyRuntimeStageObservation({
      repertory,
      observation: observation({ deployment_verified: false }),
      expectedCommitSha: commitSha,
    }),
    /deployment_verified must be true/,
  );
});

test('rejects autoplay audio or private source exposure', () => {
  assert.throws(
    () => verifyRuntimeStageObservation({
      repertory,
      observation: observation({ autoplay_audio_detected: true }),
      expectedCommitSha: commitSha,
    }),
    /autoplay_audio_detected must be false/,
  );
  assert.throws(
    () => verifyRuntimeStageObservation({
      repertory,
      observation: observation({ private_source_material_detected: true }),
      expectedCommitSha: commitSha,
    }),
    /private_source_material_detected must be false/,
  );
});

test('rejects non-HTTPS deployment URLs and non-runtime probes', () => {
  assert.throws(
    () => verifyRuntimeStageObservation({
      repertory,
      observation: observation({ deployment_url: 'http://example.test/' }),
      expectedCommitSha: commitSha,
    }),
    /must use HTTPS/,
  );
  assert.throws(
    () => verifyRuntimeStageObservation({
      repertory,
      observation: observation({ source: 'static_manifest' }),
      expectedCommitSha: commitSha,
    }),
    /must be runtime_dom_probe/,
  );
});
