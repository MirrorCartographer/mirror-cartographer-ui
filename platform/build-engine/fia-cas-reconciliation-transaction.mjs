import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SCHEMA = 'foundation.build.cas-authority-reconciliation-transaction.v1';
const INTENT_SCHEMA = 'foundation.build.cas-authority-reconciliation-intent.v1';
const NONCE_SCHEMA = 'foundation.build.cas-authority-nonce.v1';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex')}`;
}

async function writeExclusiveJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const handle = await fs.open(file, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally { await handle.close(); }
  const dir = await fs.open(path.dirname(file), 'r');
  try { await dir.sync(); } finally { await dir.close(); }
}

async function replaceJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${randomUUID()}`;
  const handle = await fs.open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally { await handle.close(); }
  await fs.rename(temp, file);
  const dir = await fs.open(path.dirname(file), 'r');
  try { await dir.sync(); } finally { await dir.close(); }
}

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }

function validateAuthorization(auth, now = Date.now()) {
  if (!auth || auth.schema !== 'foundation.build.cas-authority-takeover-authorization.v2') throw new Error('unsupported authorization schema');
  if (!auth.nonce || typeof auth.nonce !== 'string') throw new Error('authorization nonce missing');
  if (!auth.lockContentIdentity || !auth.reconciliationAction) throw new Error('authorization scope incomplete');
  const issued = Date.parse(auth.issuedAt);
  const expires = Date.parse(auth.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) throw new Error('authorization time bounds invalid');
  if (expires - issued > 3600_000) throw new Error('authorization lifetime exceeds policy');
  if (now < issued - 30_000 || now > expires) throw new Error('authorization outside validity window');
  return auth;
}

function intentAuthority(auth) {
  return {
    authorizationIdentity: auth.identity,
    authorizationNonce: auth.nonce,
    lockContentIdentity: auth.lockContentIdentity,
    reconciliationAction: auth.reconciliationAction,
    scope: auth.scope ?? {},
    policy: {
      nonceReservedBeforeMutation: true,
      nonceConsumedAfterVerifiedMutation: true,
      failedReservationRecoverable: true,
      providerNeutral: true
    }
  };
}

async function reserveNonce(nonceDir, auth, intentIdentity) {
  const file = path.join(nonceDir, `${auth.nonce}.json`);
  const record = {
    schema: NONCE_SCHEMA,
    nonce: auth.nonce,
    state: 'reserved',
    authorizationIdentity: auth.identity,
    intentIdentity,
    identity: null
  };
  record.identity = sha256({ ...record, identity: undefined });
  await writeExclusiveJson(file, record);
  return { file, record };
}

async function consumeNonce(file, record, dispatcherIdentity) {
  const consumed = {
    ...record,
    state: 'consumed',
    dispatcherIdentity,
    identity: null
  };
  consumed.identity = sha256({ ...consumed, identity: undefined });
  await replaceJson(file, consumed);
  return consumed;
}

export async function executeReconciliationTransaction({
  authorizationPath,
  intentPath,
  nonceDir,
  evidencePath,
  dispatch,
  now = Date.now(),
  failpoint = null
}) {
  if (await exists(evidencePath)) throw new Error('evidence already exists');
  if (await exists(intentPath)) throw new Error('reconciliation intent already exists');
  const auth = validateAuthorization(await readJson(authorizationPath), now);
  const authority = intentAuthority(auth);
  const intent = {
    schema: INTENT_SCHEMA,
    phase: 'prepared',
    authority,
    identity: sha256(authority)
  };
  await writeExclusiveJson(intentPath, intent);
  if (failpoint === 'after-intent') throw new Error('injected failure after intent');
  const { file: nonceFile, record: nonceRecord } = await reserveNonce(nonceDir, auth, intent.identity);
  intent.phase = 'nonce-reserved';
  await replaceJson(intentPath, intent);
  if (failpoint === 'after-reservation') throw new Error('injected failure after reservation');
  const result = await dispatch({ action: auth.reconciliationAction, scope: auth.scope ?? {}, authorization: auth });
  if (!result || result.ok !== true || typeof result.identity !== 'string') throw new Error('dispatcher failed or returned unverifiable authority');
  intent.phase = 'mutation-complete';
  intent.dispatcherIdentity = result.identity;
  await replaceJson(intentPath, intent);
  if (failpoint === 'after-dispatch') throw new Error('injected failure after dispatch');
  const consumed = await consumeNonce(nonceFile, nonceRecord, result.identity);
  intent.phase = 'committed';
  intent.nonceUseIdentity = consumed.identity;
  await replaceJson(intentPath, intent);
  const contentAuthority = {
    intentIdentity: intent.identity,
    authorizationIdentity: auth.identity,
    authorizationNonce: auth.nonce,
    reconciliationAction: auth.reconciliationAction,
    scope: auth.scope ?? {},
    dispatcherIdentity: result.identity,
    nonceUseIdentity: consumed.identity,
    policy: authority.policy
  };
  const evidence = {
    schema: SCHEMA,
    contentIdentity: sha256(contentAuthority),
    operationalId: `cas-reconcile-${randomUUID()}`,
    identity: null,
    ...contentAuthority
  };
  evidence.identity = sha256({ contentIdentity: evidence.contentIdentity, operationalId: evidence.operationalId });
  await writeExclusiveJson(evidencePath, evidence);
  await fs.rm(intentPath);
  return evidence;
}

export async function recoverReconciliationTransaction({ intentPath, nonceDir, evidencePath, inspectMutation }) {
  if (await exists(evidencePath)) return readJson(evidencePath);
  const intent = await readJson(intentPath);
  if (intent.schema !== INTENT_SCHEMA || intent.identity !== sha256(intent.authority)) throw new Error('intent identity mismatch');
  const nonceFile = path.join(nonceDir, `${intent.authority.authorizationNonce}.json`);
  if (!(await exists(nonceFile))) throw new Error('nonce reservation missing');
  const nonce = await readJson(nonceFile);
  if (nonce.intentIdentity !== intent.identity) throw new Error('nonce reservation belongs to another intent');
  if (nonce.state === 'consumed') throw new Error('consumed nonce lacks retained success evidence');
  const observed = await inspectMutation({ action: intent.authority.reconciliationAction, scope: intent.authority.scope });
  if (!observed || observed.complete !== true || typeof observed.identity !== 'string') {
    await fs.rm(nonceFile);
    await fs.rm(intentPath);
    return { action: 'released-failed-reservation', contentIdentity: sha256({ intentIdentity: intent.identity, action: 'released-failed-reservation' }) };
  }
  if (intent.dispatcherIdentity && intent.dispatcherIdentity !== observed.identity) throw new Error('observed mutation differs from retained dispatcher identity');
  const consumed = await consumeNonce(nonceFile, nonce, observed.identity);
  const contentAuthority = {
    intentIdentity: intent.identity,
    authorizationIdentity: intent.authority.authorizationIdentity,
    authorizationNonce: intent.authority.authorizationNonce,
    reconciliationAction: intent.authority.reconciliationAction,
    scope: intent.authority.scope,
    dispatcherIdentity: observed.identity,
    nonceUseIdentity: consumed.identity,
    policy: intent.authority.policy
  };
  const evidence = {
    schema: SCHEMA,
    contentIdentity: sha256(contentAuthority),
    operationalId: `cas-reconcile-recovery-${randomUUID()}`,
    identity: null,
    ...contentAuthority
  };
  evidence.identity = sha256({ contentIdentity: evidence.contentIdentity, operationalId: evidence.operationalId });
  await writeExclusiveJson(evidencePath, evidence);
  await fs.rm(intentPath);
  return evidence;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('Use the exported transaction APIs from an operation-specific dispatcher.');
  process.exitCode = 2;
}
