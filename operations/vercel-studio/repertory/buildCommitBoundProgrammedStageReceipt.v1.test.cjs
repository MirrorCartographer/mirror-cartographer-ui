'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const repertory = require('./HOURLY_REPERTORY.v1.json');
const {
  buildCommitBoundProgrammedStageReceipt,
  sha256CanonicalJson,
} = require('./buildCommitBoundProgrammedStageReceipt.v1.cjs');

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

test('binds deterministic stage identity to exact commit and repertory content', () => {
  const receipt = buildCommitBoundProgrammedStageReceipt(
    repertory,
    new Date('2026-07-15T05:28:00.000Z'),
    COMMIT,
  );

  assert.equal(receipt.programmed_production.id, 'archive-afterimage');
  assert.equal(receipt.source_commit, COMMIT);
  assert.equal(receipt.repertory_sha256, sha256CanonicalJson(repertory));
  assert.equal(receipt.exact_commit_bound, true);
  assert.equal(receipt.repertory_content_bound, true);
  assert.equal(receipt.runtime_activation_claimed, false);
  assert.equal(receipt.deployment_claimed, false);
  assert.equal(receipt.audio_playback_claimed, false);
  assert.equal(receipt.side_effects_performed, false);
});

test('canonical digest is stable across object key order', () => {
  const left = { b: 2, a: { y: 2, x: 1 } };
  const right = { a: { x: 1, y: 2 }, b: 2 };
  assert.equal(sha256CanonicalJson(left), sha256CanonicalJson(right));
});

test('canonical digest changes when repertory content changes', () => {
  const changed = JSON.parse(JSON.stringify(repertory));
  changed.hour_slots[5].production_id = 'residual-comet';
  assert.notEqual(sha256CanonicalJson(changed), sha256CanonicalJson(repertory));
});

test('rejects missing, uppercase, or malformed commit identity', () => {
  const date = new Date('2026-07-15T05:28:00.000Z');
  assert.throws(() => buildCommitBoundProgrammedStageReceipt(repertory, date), /sourceCommit/);
  assert.throws(
    () => buildCommitBoundProgrammedStageReceipt(repertory, date, COMMIT.toUpperCase()),
    /sourceCommit/,
  );
  assert.throws(
    () => buildCommitBoundProgrammedStageReceipt(repertory, date, 'abc'),
    /sourceCommit/,
  );
});
