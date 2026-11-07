import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recover } from './recover-artifact-registry-gc.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => `${JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])))}\n`;

async function fixture(phase = 'quarantining') {
  const root = await mkdtemp(join(tmpdir(), 'fia-gc-recovery-'));
  const registry = join(root, 'registry');
  await mkdir(join(registry, 'blobs', 'sha256'), { recursive: true });
  await mkdir(join(registry, 'transactions'), { recursive: true });
  await mkdir(join(registry, 'locks'), { recursive: true });

  const keep = Buffer.from('keep');
  const drop = Buffer.from('drop');
  const keepDigest = `sha256:${sha(keep)}`;
  const dropDigest = `sha256:${sha(drop)}`;
  await writeFile(join(registry, 'blobs', 'sha256', keepDigest.slice(7)), keep);
  await writeFile(join(registry, 'blobs', 'sha256', dropDigest.slice(7)), drop);

  const source = {
    schema: 'foundation.artifact.registry.index.v1',
    generation: 1,
    releases: { r1: { objects: [keepDigest, dropDigest] } },
    objects: {
      [keepDigest]: { size: 4, mediaType: 'x' },
      [dropDigest]: { size: 4, mediaType: 'x' }
    }
  };
  const target = {
    schema: 'foundation.artifact.registry.index.v1',
    generation: 2,
    releases: { r1: { objects: [keepDigest] } },
    objects: { [keepDigest]: { size: 4, mediaType: 'x' } }
  };
  const sourceBytes = Buffer.from(canonical(source));
  const targetBytes = Buffer.from(canonical(target));
  await writeFile(join(registry, 'transactions', 'tx.source-index.json'), sourceBytes);
  await writeFile(join(registry, 'transactions', 'tx.target-index.json'), targetBytes);

  const journal = {
    schema: 'foundation.artifact.registry.gc-journal.v1',
    transactionId: 'tx',
    phase,
    sourceIndexSha256: `sha256:${sha(sourceBytes)}`,
    targetIndexSha256: `sha256:${sha(targetBytes)}`,
    candidateDigests: [dropDigest],
    movedDigests: [dropDigest],
    createdAt: '2026-07-19T00:00:00Z'
  };
  await writeFile(join(registry, 'transactions', 'gc-journal.json'), canonical(journal));
  return { root, registry, output: join(root, 'evidence.json'), sourceBytes, targetBytes, keepDigest, dropDigest };
}

async function quarantineDrop(fixtureState) {
  await mkdir(join(fixtureState.registry, 'quarantine', 'tx'), { recursive: true });
  await writeFile(join(fixtureState.registry, 'quarantine', 'tx', fixtureState.dropDigest.slice(7)), 'drop');
  await rm(join(fixtureState.registry, 'blobs', 'sha256', fixtureState.dropDigest.slice(7)));
}

test('rolls back a pre-commit quarantine', async () => {
  const state = await fixture();
  await quarantineDrop(state);
  await writeFile(join(state.registry, 'index.json'), state.sourceBytes);
  const evidence = await recover(state);
  assert.equal(evidence.action, 'rolled-back-pre-commit');
  await access(join(state.registry, 'blobs', 'sha256', state.dropDigest.slice(7)));
});

test('finalizes a post-commit quarantine', async () => {
  const state = await fixture('index-published');
  await mkdir(join(state.registry, 'quarantine', 'tx'), { recursive: true });
  await writeFile(join(state.registry, 'quarantine', 'tx', state.dropDigest.slice(7)), 'drop');
  await writeFile(join(state.registry, 'index.json'), state.targetBytes);
  const evidence = await recover(state);
  assert.equal(evidence.action, 'finalized-post-commit');
  assert.deepEqual(evidence.deletedDigests, [state.dropDigest]);
});

test('equivalent recoveries produce identical identities', async () => {
  const first = await fixture();
  const second = await fixture();
  for (const state of [first, second]) {
    await quarantineDrop(state);
    await writeFile(join(state.registry, 'index.json'), state.sourceBytes);
  }
  assert.equal((await recover(first)).identity, (await recover(second)).identity);
});

test('rejects a live maintenance lock', async () => {
  const state = await fixture();
  await writeFile(join(state.registry, 'index.json'), state.sourceBytes);
  await writeFile(join(state.registry, 'locks', 'maintenance.lock'), JSON.stringify({ pid: process.pid, processStartTicks: null, transactionId: 'tx' }));
  await assert.rejects(() => recover(state), /still alive/);
});

test('rejects a partial journal', async () => {
  const state = await fixture();
  await writeFile(join(state.registry, 'index.json'), state.sourceBytes);
  await writeFile(join(state.registry, 'transactions', 'gc-journal.json'), '{}');
  await assert.rejects(() => recover(state), /fields mismatch/);
});

test('rejects phase and active-index disagreement', async () => {
  const state = await fixture('index-published');
  await writeFile(join(state.registry, 'index.json'), state.sourceBytes);
  await assert.rejects(() => recover(state), /disagree/);
});

test('existing evidence prevents mutation', async () => {
  const state = await fixture();
  await writeFile(join(state.registry, 'index.json'), state.sourceBytes);
  await writeFile(state.output, 'retained');
  await assert.rejects(() => recover(state), /output already exists/);
  assert.equal(await readFile(state.output, 'utf8'), 'retained');
});
