import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requirePromotableEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new TypeError('evidence must be an object.');
  }
  if (evidence.promotable !== true || evidence.coherence?.verified !== true) {
    const error = new Error('Stage evidence persistence rejected: evidence is not promotable and coherent.');
    error.code = 'STAGE_EVIDENCE_UNVERIFIED';
    throw error;
  }
  if (!evidence.receipt || typeof evidence.receipt !== 'object' || typeof evidence.receipt.sha256 !== 'string') {
    throw new TypeError('evidence.receipt with sha256 is required.');
  }
  return evidence;
}

export function createRetainedStageEvidenceBundle(evidence) {
  const verified = requirePromotableEvidence(evidence);
  const body = Object.freeze({
    schema_version: 1,
    retained_as_unit: true,
    promotable: true,
    receipt: verified.receipt,
    coherence: verified.coherence,
  });
  return Object.freeze({
    ...body,
    sha256: createHash('sha256').update(canonicalJson(body)).digest('hex'),
  });
}

export function persistRetainedStageEvidence({ evidence, output_path } = {}) {
  if (typeof output_path !== 'string' || !output_path.trim()) {
    throw new TypeError('output_path must be a non-empty string.');
  }
  const bundle = createRetainedStageEvidenceBundle(evidence);
  mkdirSync(dirname(output_path), { recursive: true });
  try {
    writeFileSync(output_path, `${JSON.stringify(bundle, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      const conflict = new Error(`Stage evidence path already exists: ${output_path}.`);
      conflict.code = 'STAGE_EVIDENCE_ALREADY_EXISTS';
      throw conflict;
    }
    throw error;
  }
  return bundle;
}
