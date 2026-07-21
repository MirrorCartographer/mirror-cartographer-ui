import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { reconcilePublisher, inspectPublisher } from './fia-cas-publisher-reconciliation.mjs';

const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-publisher-'));
  const stagingDir = path.join(root, 'staging');
  const casRoot = path.join(root, 'cas');
  await fs.mkdir(stagingDir, { recursive: true });
  const bytes = Buffer.from('owned');
  await fs.writeFile(path.join(stagingDir, 'index.html'), bytes);
  return { scope: { stagingDir, casRoot, manifestPath: 'manifests/release.json', sourceExecutionIdentity: 'sha256:source', claimedObjectDigests: [digest(bytes)] } };
}

test('publishes and independently verifies object closure', async () => {
  const f = await fixture();
  const result = await reconcilePublisher({ scope: f.scope });
  const observed = await inspectPublisher({ scope: f.scope });
  assert.equal(observed.complete, true);
  assert.equal(observed.identity, result.identity);
});

test('rejects claim and staging disagreement', async () => {
  const f = await fixture();
  f.scope.claimedObjectDigests = [`sha256:${'0'.repeat(64)}`];
  await assert.rejects(reconcilePublisher({ scope: f.scope }), /claims disagree/);
});

test('rejects changed existing object bytes', async () => {
  const f = await fixture();
  const objectName = f.scope.claimedObjectDigests[0].slice(7);
  await fs.mkdir(path.join(f.scope.casRoot, 'objects', 'sha256'), { recursive: true });
  await fs.writeFile(path.join(f.scope.casRoot, 'objects', 'sha256', objectName), 'changed');
  await assert.rejects(reconcilePublisher({ scope: f.scope }), /CAS object mismatch/);
});

test('failure after objects leaves no manifest', async () => {
  const f = await fixture();
  await assert.rejects(reconcilePublisher({ scope: f.scope, failpoint: 'after-objects' }), /injected/);
  await assert.rejects(fs.access(path.join(f.scope.casRoot, f.scope.manifestPath)));
});

test('inspector rejects object changes after commit', async () => {
  const f = await fixture();
  await reconcilePublisher({ scope: f.scope });
  const objectName = f.scope.claimedObjectDigests[0].slice(7);
  await fs.writeFile(path.join(f.scope.casRoot, 'objects', 'sha256', objectName), 'changed');
  await assert.rejects(inspectPublisher({ scope: f.scope }), /CAS object mismatch/);
});

test('equivalent authority has identical manifest identity', async () => {
  const a = await fixture();
  const b = await fixture();
  assert.equal((await reconcilePublisher({ scope: a.scope })).identity, (await reconcilePublisher({ scope: b.scope })).identity);
});
