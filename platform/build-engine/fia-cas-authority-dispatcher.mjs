import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { executeReconciliationTransaction, recoverReconciliationTransaction } from './fia-cas-reconciliation-transaction.mjs';

const AUTH_SCHEMA = 'foundation.build.cas-authority-takeover-authorization.v2';
const DISPATCH_SCHEMA = 'foundation.build.cas-authority-dispatcher.v1';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex')}`;
}

function authorizationAuthority(auth) {
  return {
    schema: auth.schema,
    nonce: auth.nonce,
    issuedAt: auth.issuedAt,
    expiresAt: auth.expiresAt,
    publicKeySha256: auth.publicKeySha256,
    lockContentIdentity: auth.lockContentIdentity,
    lockOperationalId: auth.lockOperationalId,
    interruptedOperation: auth.interruptedOperation,
    reconciliationAction: auth.reconciliationAction,
    scope: auth.scope ?? {},
    policy: auth.policy ?? {}
  };
}

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }

function expectedAction(operation) {
  if (operation === 'publish') return 'reconcile-publisher';
  if (['recover', 'quarantine', 'reachability'].includes(operation)) return 'reconcile-reachability';
  throw new Error(`unsupported interrupted operation: ${operation}`);
}

export async function verifySignedAuthorization({ authorizationPath, publicKeyPath, lockPath, now = Date.now() }) {
  const [auth, publicKeyBytes, lock] = await Promise.all([
    readJson(authorizationPath),
    fs.readFile(publicKeyPath),
    readJson(lockPath)
  ]);
  if (auth.schema !== AUTH_SCHEMA) throw new Error('unsupported authorization schema');
  const authority = authorizationAuthority(auth);
  if (auth.identity !== sha256(authority)) throw new Error('authorization identity mismatch');
  if (auth.publicKeySha256 !== sha256(publicKeyBytes)) throw new Error('authorization public key mismatch');
  if (typeof auth.signature !== 'string') throw new Error('authorization signature missing');
  const valid = verifySignature(null, Buffer.from(canonical(authority)), createPublicKey(publicKeyBytes), Buffer.from(auth.signature, 'base64'));
  if (!valid) throw new Error('authorization signature invalid');
  const issued = Date.parse(auth.issuedAt);
  const expires = Date.parse(auth.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) throw new Error('authorization time bounds invalid');
  if (expires - issued > 3600_000) throw new Error('authorization lifetime exceeds policy');
  if (now < issued - 30_000 || now > expires) throw new Error('authorization outside validity window');
  if (lock.contentIdentity !== auth.lockContentIdentity || lock.operationalId !== auth.lockOperationalId) throw new Error('authorization does not bind retained lock');
  if (expectedAction(auth.interruptedOperation) !== auth.reconciliationAction) throw new Error('authorization action does not match interrupted operation');
  if (lock.operation !== auth.interruptedOperation) throw new Error('retained lock operation differs from authorization');
  return { auth, lock, authority, publicKeySha256: auth.publicKeySha256 };
}

export async function executeAuthorizedReconciliation({
  authorizationPath,
  publicKeyPath,
  lockPath,
  intentPath,
  nonceDir,
  evidencePath,
  dispatchers,
  inspectors,
  now = Date.now(),
  failpoint = null
}) {
  const verified = await verifySignedAuthorization({ authorizationPath, publicKeyPath, lockPath, now });
  const action = verified.auth.reconciliationAction;
  const dispatcher = dispatchers?.[action];
  const inspector = inspectors?.[action];
  if (typeof dispatcher !== 'function' || typeof inspector !== 'function') throw new Error(`missing dispatcher or inspector for ${action}`);
  const transaction = await executeReconciliationTransaction({
    authorizationPath,
    intentPath,
    nonceDir,
    evidencePath,
    now,
    failpoint,
    dispatch: async ({ scope, authorization }) => {
      const candidate = await dispatcher({ scope, authorization, lock: verified.lock });
      if (!candidate || candidate.ok !== true || typeof candidate.identity !== 'string') throw new Error('operation dispatcher failed');
      const observed = await inspector({ scope, authorization, lock: verified.lock });
      if (!observed || observed.complete !== true || typeof observed.identity !== 'string') throw new Error('post-dispatch authority incomplete');
      if (observed.identity !== candidate.identity) throw new Error('dispatcher identity differs from independently observed authority');
      return { ok: true, identity: observed.identity };
    }
  });
  return {
    schema: DISPATCH_SCHEMA,
    contentIdentity: sha256({ transactionContentIdentity: transaction.contentIdentity, authorizationIdentity: verified.auth.identity, lockContentIdentity: verified.lock.contentIdentity, action }),
    transaction,
    authorizationIdentity: verified.auth.identity,
    lockContentIdentity: verified.lock.contentIdentity,
    action,
    verification: { signature: true, lockBinding: true, operationBinding: true, postMutationInspection: true }
  };
}

export async function recoverAuthorizedReconciliation({
  authorizationPath,
  publicKeyPath,
  lockPath,
  intentPath,
  nonceDir,
  evidencePath,
  inspectors,
  now = Date.now()
}) {
  const verified = await verifySignedAuthorization({ authorizationPath, publicKeyPath, lockPath, now });
  const action = verified.auth.reconciliationAction;
  const inspector = inspectors?.[action];
  if (typeof inspector !== 'function') throw new Error(`missing inspector for ${action}`);
  return recoverReconciliationTransaction({
    intentPath,
    nonceDir,
    evidencePath,
    inspectMutation: async ({ scope }) => inspector({ scope, authorization: verified.auth, lock: verified.lock })
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('Use exported dispatcher APIs from an owned recovery command.');
  process.exitCode = 2;
}
