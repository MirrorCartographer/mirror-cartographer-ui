import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recoverV2 } from './recover-artifact-registry-gc-v2.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sort = (value) => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])])) : value;
const canonical = (value) => `${JSON.stringify(sort(value))}\n`;

async function fixture({ phase = 'quarantining', moveIntents = [], movedDigests = [], active = 'source' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'fia-gc-v2-recovery-'));
  const registry = join(root, 'registry');
  const transactionId = 'gc-test';
  const txdir = join(registry, 'transactions', transactionId);
  await mkdir(join(registry, 'blobs', 'sha256'), { recursive: true });
  await mkdir(txdir, { recursive: true });
  await mkdir(join(registry, 'locks'), { recursive: true });
  const keep = Buffer.from('keep');
  const drop = Buffer.from('drop');
  const keepDigest = `sha256:${sha(keep)}`;
  const dropDigest = `sha256:${sha(drop)}`;
  await writeFile(join(registry, 'blobs', 'sha256', keepDigest.slice(7)), keep);
  await writeFile(join(registry, 'blobs', 'sha256', dropDigest.slice(7)), drop);
  const release = `sha256:${'1'.repeat(64)}`;
  const source = { schema: 'foundation.artifact.registry.index.v1', generation: 1, releases: { [release]: { objects: [keepDigest, dropDigest] } }, objects: { [keepDigest]: { size: 4, mediaType: 'x' }, [dropDigest]: { size: 4, mediaType: 'x' } } };
  const target = { schema: 'foundation.artifact.registry.index.v1', generation: 2, releases: { [release]: { objects: [keepDigest] } }, objects: { [keepDigest]: { size: 4, mediaType: 'x' } } };
  const sourceBytes = Buffer.from(canonical(source));
  const targetBytes = Buffer.from(canonical(target));
  await writeFile(join(txdir, 'source-index.json'), sourceBytes);
  await writeFile(join(txdir, 'target-index.json'), targetBytes);
  const journal = { schema: 'foundation.artifact.registry.gc-journal.v2', transactionId, phase, sourceIndexSha256: `sha256:${sha(sourceBytes)}`, targetIndexSha256: `sha256:${sha(targetBytes)}`, candidateDigests: [dropDigest], moveIntents, movedDigests, createdAt: '1970-01-01T00:00:00.000Z' };
  await writeFile(join(txdir, 'journal.json'), canonical(journal));
  await writeFile(join(registry, 'index.json'), active === 'source' ? sourceBytes : targetBytes);
  return { root, registry, transactionId, output: join(root, 'evidence.json'), sourceBytes, targetBytes, keepDigest, dropDigest };
}
async function moveToQuarantine(state) {
  const qdir = join(state.registry, 'quarantine', state.transactionId);
  await mkdir(qdir, { recursive: true });
  await rename(join(state.registry, 'blobs', 'sha256', state.dropDigest.slice(7)), join(qdir, state.dropDigest.slice(7)));
}

test('rolls back a completed-but-unrecorded move before commit', async () => {
  const state = await fixture({ moveIntents: [] });
  const journalPath = join(state.registry, 'transactions', state.transactionId, 'journal.json');
  const journal = JSON.parse(await readFile(journalPath));
  journal.moveIntents = [state.dropDigest];
  await writeFile(journalPath, canonical(journal));
  await moveToQuarantine(state);
  const evidence = await recoverV2(state);
  assert.equal(evidence.action, 'rolled-back-pre-commit');
  assert.deepEqual(evidence.restoredDigests, [state.dropDigest]);
  await access(join(state.registry, 'blobs', 'sha256', state.dropDigest.slice(7)));
});

test('finalizes when target index is active despite lagging journal phase', async () => {
  const state = await fixture({ phase: 'quarantining', moveIntents: [], movedDigests: [], active: 'target' });
  const journalPath = join(state.registry, 'transactions', state.transactionId, 'journal.json');
  const journal = JSON.parse(await readFile(journalPath));
  journal.moveIntents = [state.dropDigest];
  await writeFile(journalPath, canonical(journal));
  await moveToQuarantine(state);
  const evidence = await recoverV2(state);
  assert.equal(evidence.action, 'finalized-post-commit');
  assert.deepEqual(evidence.deletedDigests, [state.dropDigest]);
});

test('equivalent recovery content identities are deterministic', async () => {
  const first = await fixture();
  const second = await fixture();
  for (const state of [first, second]) {
    const journalPath = join(state.registry, 'transactions', state.transactionId, 'journal.json');
    const journal = JSON.parse(await readFile(journalPath));
    journal.moveIntents = [state.dropDigest];
    await writeFile(journalPath, canonical(journal));
    await moveToQuarantine(state);
  }
  const a = await recoverV2(first);
  const b = await recoverV2(second);
  assert.equal(a.contentIdentity, b.contentIdentity);
  assert.notEqual(a.identity, b.identity);
});

test('rejects a digest present in both CAS and quarantine', async () => {
  const state = await fixture({ moveIntents: [] });
  const journalPath = join(state.registry, 'transactions', state.transactionId, 'journal.json');
  const journal = JSON.parse(await readFile(journalPath));
  journal.moveIntents = [state.dropDigest];
  await writeFile(journalPath, canonical(journal));
  const qdir = join(state.registry, 'quarantine', state.transactionId);
  await mkdir(qdir, { recursive: true });
  await writeFile(join(qdir, state.dropDigest.slice(7)), 'drop');
  await assert.rejects(() => recoverV2(state), /both CAS and quarantine/);
});

test('rejects a digest absent from both CAS and quarantine', async () => {
  const state = await fixture({ moveIntents: [] });
  await rm(join(state.registry, 'blobs', 'sha256', state.dropDigest.slice(7)));
  await assert.rejects(() => recoverV2(state), /absent from CAS and quarantine/);
});

test('rejects a quarantine move without retained intent', async () => {
  const state = await fixture();
  await moveToQuarantine(state);
  await assert.rejects(() => recoverV2(state), /moved without intent/);
});

test('rejects target index while a candidate remains in CAS', async () => {
  const state = await fixture({ active: 'target', moveIntents: [] });
  const journalPath = join(state.registry, 'transactions', state.transactionId, 'journal.json');
  const journal = JSON.parse(await readFile(journalPath));
  journal.moveIntents = [state.dropDigest];
  await writeFile(journalPath, canonical(journal));
  await assert.rejects(() => recoverV2(state), /candidate remains in CAS/);
});

test('existing evidence prevents all mutation', async () => {
  const state = await fixture();
  await writeFile(state.output, 'retained');
  await assert.rejects(() => recoverV2(state), /output already exists/);
  assert.equal(await readFile(state.output, 'utf8'), 'retained');
});
