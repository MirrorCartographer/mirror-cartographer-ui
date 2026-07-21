import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeReconciliationTransaction, recoverReconciliationTransaction } from './fia-cas-reconciliation-transaction.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-reconcile-'));
  const auth = {
    schema: 'foundation.build.cas-authority-takeover-authorization.v2',
    identity: 'sha256:authorization', nonce: 'nonce-001', lockContentIdentity: 'sha256:lock',
    reconciliationAction: 'reconcile-publisher', scope: { claimedObjectDigests: ['sha256:abc'] },
    issuedAt: '2026-07-21T08:00:00.000Z', expiresAt: '2026-07-21T08:15:00.000Z'
  };
  const authorizationPath = path.join(root, 'authorization.json');
  await fs.writeFile(authorizationPath, JSON.stringify(auth));
  return { root, authorizationPath, intentPath: path.join(root, 'intent.json'), nonceDir: path.join(root, 'nonces'), evidencePath: path.join(root, 'evidence.json') };
}

const now = Date.parse('2026-07-21T08:05:00.000Z');

test('reserves nonce before dispatch and consumes after verified mutation', async () => {
  const f = await fixture();
  let reservedSeen = false;
  const evidence = await executeReconciliationTransaction({ ...f, now, dispatch: async () => {
    const nonce = JSON.parse(await fs.readFile(path.join(f.nonceDir, 'nonce-001.json')));
    reservedSeen = nonce.state === 'reserved';
    return { ok: true, identity: 'sha256:mutation' };
  }});
  assert.equal(reservedSeen, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.nonceDir, 'nonce-001.json'))).state, 'consumed');
  assert.match(evidence.contentIdentity, /^sha256:/);
  await assert.rejects(fs.access(f.intentPath));
});

test('failed dispatch leaves recoverable reservation and no evidence', async () => {
  const f = await fixture();
  await assert.rejects(executeReconciliationTransaction({ ...f, now, dispatch: async () => ({ ok: false }) }));
  assert.equal(JSON.parse(await fs.readFile(path.join(f.nonceDir, 'nonce-001.json'))).state, 'reserved');
  await assert.rejects(fs.access(f.evidencePath));
});

test('recovery releases reservation when mutation did not complete', async () => {
  const f = await fixture();
  await assert.rejects(executeReconciliationTransaction({ ...f, now, failpoint: 'after-reservation', dispatch: async () => ({ ok: true, identity: 'x' }) }));
  const result = await recoverReconciliationTransaction({ ...f, inspectMutation: async () => ({ complete: false }) });
  assert.equal(result.action, 'released-failed-reservation');
  await assert.rejects(fs.access(path.join(f.nonceDir, 'nonce-001.json')));
  await assert.rejects(fs.access(f.intentPath));
});

test('recovery commits completed mutation after dispatcher crash', async () => {
  const f = await fixture();
  await assert.rejects(executeReconciliationTransaction({ ...f, now, failpoint: 'after-dispatch', dispatch: async () => ({ ok: true, identity: 'sha256:mutation' }) }));
  const evidence = await recoverReconciliationTransaction({ ...f, inspectMutation: async () => ({ complete: true, identity: 'sha256:mutation' }) });
  assert.equal(evidence.dispatcherIdentity, 'sha256:mutation');
  assert.equal(JSON.parse(await fs.readFile(path.join(f.nonceDir, 'nonce-001.json'))).state, 'consumed');
});

test('replay is rejected by exclusive nonce reservation', async () => {
  const f = await fixture();
  await executeReconciliationTransaction({ ...f, now, dispatch: async () => ({ ok: true, identity: 'sha256:mutation' }) });
  await fs.rm(f.evidencePath);
  await assert.rejects(executeReconciliationTransaction({ ...f, now, dispatch: async () => ({ ok: true, identity: 'sha256:mutation' }) }), /EEXIST|already exists/);
});

test('expired authorization fails before intent creation', async () => {
  const f = await fixture();
  await assert.rejects(executeReconciliationTransaction({ ...f, now: Date.parse('2026-07-21T09:00:00Z'), dispatch: async () => ({ ok: true, identity: 'x' }) }), /validity/);
  await assert.rejects(fs.access(f.intentPath));
});
