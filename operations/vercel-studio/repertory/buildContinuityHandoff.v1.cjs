'use strict';

const { createHash } = require('node:crypto');

const FORBIDDEN_PRIVATE_KEYS = new Set([
  'source_excerpt',
  'private_source',
  'chat_text',
  'medical_record',
  'credential',
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
  }
}

function canonicalize(value, seen = new Set(), path = 'continuity_state') {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new Error(`${path} contains an unsupported value`);
  if (seen.has(value)) throw new Error(`${path} contains a circular reference`);
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = `[${value.map((entry, index) => canonicalize(entry, seen, `${path}[${index}]`)).join(',')}]`;
  } else {
    assertPlainObject(value, path);
    result = `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], seen, `${path}.${key}`)}`).join(',')}}`;
  }
  seen.delete(value);
  return result;
}

function assertNoPrivateFields(value, path = 'continuity_state', seen = new Set()) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) throw new Error(`${path} contains a circular reference`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoPrivateFields(entry, `${path}[${index}]`, seen));
  } else {
    assertPlainObject(value, path);
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_PRIVATE_KEYS.has(key)) throw new Error(`${path} contains forbidden field: ${key}`);
      assertNoPrivateFields(entry, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const entry of Object.values(value)) deepFreeze(entry, seen);
  return Object.freeze(value);
}

function assertReceipt(receipt, label) {
  if (!receipt || typeof receipt !== 'object') throw new Error(`${label} receipt is required`);
  if (!Number.isInteger(receipt.utc_hour) || receipt.utc_hour < 0 || receipt.utc_hour > 23) {
    throw new Error(`${label}.utc_hour must be an integer from 0 through 23`);
  }
  for (const field of ['production_id', 'source_commit', 'repertory_sha256']) {
    if (typeof receipt[field] !== 'string' || receipt[field].length === 0) throw new Error(`${label}.${field} is required`);
  }
  if (!/^[0-9a-f]{40}$/.test(receipt.source_commit)) throw new Error(`${label}.source_commit must be a lowercase 40-character SHA`);
  if (!/^[0-9a-f]{64}$/.test(receipt.repertory_sha256)) throw new Error(`${label}.repertory_sha256 must be a lowercase SHA-256`);
}

function assertPublicAbstractState(state) {
  assertPlainObject(state, 'continuity_state');
  if (state.privacy_class !== 'public_abstract') throw new Error('continuity_state.privacy_class must be public_abstract');
  assertNoPrivateFields(state);
  const serialized = canonicalize(state);
  if (Buffer.byteLength(serialized, 'utf8') > 4096) throw new Error('continuity_state exceeds 4096-byte public handoff limit');
  return serialized;
}

function buildContinuityHandoff(previousReceipt, currentReceipt, continuityState) {
  assertReceipt(previousReceipt, 'previous');
  assertReceipt(currentReceipt, 'current');
  if (previousReceipt.source_commit !== currentReceipt.source_commit) throw new Error('source commit mismatch');
  if (previousReceipt.repertory_sha256 !== currentReceipt.repertory_sha256) throw new Error('repertory digest mismatch');
  if ((previousReceipt.utc_hour + 1) % 24 !== currentReceipt.utc_hour) throw new Error('receipts are not adjacent hourly slots');
  const canonicalState = assertPublicAbstractState(continuityState);
  const retainedState = structuredClone(continuityState);

  return deepFreeze({
    schema_version: 1,
    contract_id: 'vercel-studio-continuity-handoff-v1',
    evidence_class: 'operations_only_programmed_handoff_identity',
    from: { utc_hour: previousReceipt.utc_hour, production_id: previousReceipt.production_id },
    to: { utc_hour: currentReceipt.utc_hour, production_id: currentReceipt.production_id },
    source_commit: currentReceipt.source_commit,
    repertory_sha256: currentReceipt.repertory_sha256,
    continuity_state: retainedState,
    continuity_state_sha256: createHash('sha256').update(canonicalState, 'utf8').digest('hex'),
    runtime_activation_claimed: false,
    deployment_claimed: false,
    browser_execution_claimed: false,
    audio_claimed: false,
    reversible: true,
  });
}

module.exports = { buildContinuityHandoff, canonicalize };
