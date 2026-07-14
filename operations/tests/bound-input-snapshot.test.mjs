import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withBoundInputSnapshot } from '../tools/bound-input-snapshot.mjs';

test('operation observes the promoted object even if the caller mutates its source object', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'bound-input-test-'));
  const input = { commit_sha: 'a'.repeat(40), nested: { state: 'promoted' } };

  const result = await withBoundInputSnapshot(input, async snapshotPath => {
    input.nested.state = 'mutated-after-promotion';
    const retained = JSON.parse(await readFile(snapshotPath, 'utf8'));
    return { verified: true, retained };
  }, { temporary_root: temporaryRoot });

  assert.equal(result.verified, true);
  assert.equal(result.retained.nested.state, 'promoted');
  assert.match(result.bound_input_snapshot.sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.bound_input_snapshot.lifecycle, 'ephemeral_read_only_snapshot');
  assert.deepEqual(await readdir(temporaryRoot), []);
});

test('snapshot directory is removed when the downstream operation throws', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'bound-input-test-'));
  await assert.rejects(
    withBoundInputSnapshot({ value: 1 }, async snapshotPath => {
      await access(snapshotPath);
      throw new Error('synthetic downstream failure');
    }, { temporary_root: temporaryRoot }),
    /synthetic downstream failure/
  );
  assert.deepEqual(await readdir(temporaryRoot), []);
});

test('invalid inputs fail before creating a snapshot', async () => {
  assert.deepEqual(await withBoundInputSnapshot(null, async () => ({ verified: true })), {
    verified: false,
    reason: 'bound_input_invalid'
  });
  assert.deepEqual(await withBoundInputSnapshot({}, null), {
    verified: false,
    reason: 'bound_operation_required'
  });
});
