import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planStartupRecovery } from './plan-artifact-registry-startup-recovery.mjs';

const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const canonical = (value) => `${JSON.stringify(value)}\n`;
const index = (generation, marker) => ({ schema: 'foundation.artifact.registry.index.v1', generation, releases: {}, objects: { marker } });

async function fixture({ count = 1, active = 'source', overlap = false, orphan = false, disconnected = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'fia-startup-'));
  const registry = join(root, 'registry');
  await mkdir(join(registry, 'transactions'), { recursive: true });
  await mkdir(join(registry, 'quarantine'), { recursive: true });
  const source = Buffer.from(canonical(index(1, 'source')));
  const target = Buffer.from(canonical(index(2, 'target')));
  await writeFile(join(registry, 'index.json'), active === 'target' ? target : disconnected ? Buffer.from(canonical(index(9, 'other'))) : source);
  for (let i = 0; i < count; i++) {
    const id = `gc-t${i + 1}`;
    const dir = join(registry, 'transactions', id);
    await mkdir(dir, { recursive: true });
    await mkdir(join(registry, 'quarantine', id), { recursive: true });
    const s = i === 0 ? source : Buffer.from(canonical(index(i + 1, `source-${i}`)));
    const t = i === 0 ? target : Buffer.from(canonical(index(i + 2, `target-${i}`)));
    const candidates = [overlap ? `sha256:${'a'.repeat(64)}` : `sha256:${String(i + 1).repeat(64).slice(0, 64)}`];
    const journal = { schema: 'foundation.artifact.registry.gc-journal.v2', transactionId: id, phase: 'prepared', sourceIndexSha256: sha(s), targetIndexSha256: sha(t), candidateDigests: candidates, moveIntents: [], movedDigests: [], createdAt: '1970-01-01T00:00:00.000Z' };
    await writeFile(join(dir, 'journal.json'), canonical(journal));
    await writeFile(join(dir, 'source-index.json'), s);
    await writeFile(join(dir, 'target-index.json'), t);
  }
  if (orphan) await mkdir(join(registry, 'quarantine', 'gc-orphan'));
  return { root, registry, output: join(root, 'evidence.json') };
}
async function rejects(options, pattern) {
  const f = await fixture(options);
  try { await assert.rejects(planStartupRecovery({ registry: f.registry, output: f.output }), pattern); }
  finally { await rm(f.root, { recursive: true, force: true }); }
}

test('plans pre-commit recovery for one active transaction', async () => {
  const f = await fixture();
  try { const result = await planStartupRecovery({ registry: f.registry, output: f.output }); assert.equal(result.action, 'recover-pre-commit'); assert.equal(result.selectedTransactionId, 'gc-t1'); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});
test('plans post-commit recovery when target index is active', async () => {
  const f = await fixture({ active: 'target' });
  try { const result = await planStartupRecovery({ registry: f.registry, output: f.output }); assert.equal(result.action, 'recover-post-commit'); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});
test('equivalent plans are byte-identical', async () => {
  const a = await fixture(); const b = await fixture();
  try { await planStartupRecovery({ registry: a.registry, output: a.output }); await planStartupRecovery({ registry: b.registry, output: b.output }); assert.deepEqual(await readFile(a.output), await readFile(b.output)); }
  finally { await rm(a.root, { recursive: true, force: true }); await rm(b.root, { recursive: true, force: true }); }
});
test('rejects overlapping candidates', async () => rejects({ count: 2, overlap: true }, /candidate overlap/));
test('rejects multiple abandoned transactions even without overlap', async () => rejects({ count: 2 }, /explicit arbitration/));
test('rejects orphan quarantine directories', async () => rejects({ orphan: true }, /orphan quarantine/));
test('rejects transaction disconnected from active index', async () => rejects({ disconnected: true }, /disconnected/));
test('preserves existing evidence', async () => {
  const f = await fixture();
  try { await writeFile(f.output, 'retained'); await assert.rejects(planStartupRecovery({ registry: f.registry, output: f.output }), /output already exists/); assert.equal(await readFile(f.output, 'utf8'), 'retained'); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});
