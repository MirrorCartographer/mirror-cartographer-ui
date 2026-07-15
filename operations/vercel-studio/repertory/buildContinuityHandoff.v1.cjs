'use strict';

const { createHash } = require('node:crypto');

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
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
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('continuity_state must be an object');
  if (state.privacy_class !== 'public_abstract') throw new Error('continuity_state.privacy_class must be public_abstract');
  const serialized = canonicalize(state);
  const forbidden = ['source_excerpt', 'private_source', 'chat_text', 'medical_record', 'credential'];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(state, key)) throw new Error(`continuity_state contains forbidden field: ${key}`);
  }
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

  return Object.freeze({
    schema_version: 1,
    contract_id: 'vercel-studio-continuity-handoff-v1',
    evidence_class: 'operations_only_programmed_handoff_identity',
    from: Object.freeze({ utc_hour: previousReceipt.utc_hour, production_id: previousReceipt.production_id }),
    to: Object.freeze({ utc_hour: currentReceipt.utc_hour, production_id: currentReceipt.production_id }),
    source_commit: currentReceipt.source_commit,
    repertory_sha256: currentReceipt.repertory_sha256,
    continuity_state: Object.freeze({ ...continuityState }),
    continuity_state_sha256: createHash('sha256').update(canonicalState, 'utf8').digest('hex'),
    runtime_activation_claimed: false,
    deployment_claimed: false,
    browser_execution_claimed: false,
    audio_claimed: false,
    reversible: true,
  });
}

module.exports = { buildContinuityHandoff, canonicalize };
