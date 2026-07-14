import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createPromotableStageEvidence } from './stage-evidence-promotion.mjs';
import { createRetainedStageEvidenceBundle, persistRetainedStageEvidence } from './stage-evidence-writer.mjs';

const promotable = createPromotableStageEvidence({
  observed_at: '2026-07-14T18:26:18.000Z',
  timezone: 'America/New_York',
  continuity_id: 'mirror-cartographer-public-continuity',
  continuity_revision: '1',
});

test('retains receipt and coherence as one digest-bound unit', () => {
  const bundle = createRetainedStageEvidenceBundle(promotable);
  assert.equal(bundle.promotable, true);
  assert.equal(bundle.retained_as_unit, true);
  assert.equal(bundle.receipt.production.id, 'signal-garden');
  assert.equal(bundle.coherence.verified, true);
  assert.match(bundle.sha256, /^[a-f0-9]{64}$/);
});

test('fails closed for unverified evidence', () => {
  assert.throws(
    () => createRetainedStageEvidenceBundle({ ...promotable, promotable: false }),
    (error) => error.code === 'STAGE_EVIDENCE_UNVERIFIED',
  );
});

test('persists once and never overwrites an existing path', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mc-stage-evidence-'));
  const outputPath = join(directory, 'retained.json');
  try {
    const written = persistRetainedStageEvidence({ evidence: promotable, output_path: outputPath });
    const retained = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.deepEqual(retained, written);
    assert.throws(
      () => persistRetainedStageEvidence({ evidence: promotable, output_path: outputPath }),
      (error) => error.code === 'STAGE_EVIDENCE_ALREADY_EXISTS',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
