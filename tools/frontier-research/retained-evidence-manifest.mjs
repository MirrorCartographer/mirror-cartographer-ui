import crypto from 'node:crypto';

const REQUIRED_ROLES = Object.freeze([
  'primary_raw',
  'independent_raw',
  'independent_command',
  'reconciliation'
]);

const FORBIDDEN_KEYS = /(^|_)(token|authorization|cookie|secret|password|private_key|access_key)($|_)/i;

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
}

function assertSafeTree(value, path = 'manifest') {
  if (Array.isArray(value)) return value.forEach((entry, index) => assertSafeTree(entry, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`forbidden secret-bearing field: ${path}.${key}`);
    assertSafeTree(child, `${path}.${key}`);
  }
}

function assertSha(value, name) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) throw new Error(`${name} must be a lowercase 40-character commit SHA`);
}

function assertDigest(value, name) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error(`${name} must be a lowercase SHA-256 digest`);
}

function parseTime(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be an ISO timestamp`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be an ISO timestamp`);
  return parsed;
}

export function buildRetainedEvidenceManifest(input, { maxCaptureWindowMs = 15 * 60 * 1000 } = {}) {
  assertObject(input, 'input');
  assertSafeTree(input);
  assertSha(input.commit_sha, 'commit_sha');
  if (!Array.isArray(input.artifacts)) throw new TypeError('artifacts must be an array');
  if (!Number.isInteger(maxCaptureWindowMs) || maxCaptureWindowMs <= 0) throw new Error('maxCaptureWindowMs must be a positive integer');

  const byRole = new Map();
  const paths = new Set();
  const digests = new Set();
  const times = [];

  for (const [index, artifact] of input.artifacts.entries()) {
    assertObject(artifact, `artifacts[${index}]`);
    const { role, path, sha256, byte_length: byteLength, captured_at: capturedAt, method } = artifact;
    if (!REQUIRED_ROLES.includes(role)) throw new Error(`unsupported artifact role: ${role}`);
    if (byRole.has(role)) throw new Error(`duplicate artifact role: ${role}`);
    if (typeof path !== 'string' || !path.startsWith('operations/evidence/') || path.includes('..')) throw new Error(`unsafe retained path for ${role}`);
    if (paths.has(path)) throw new Error(`duplicate retained path: ${path}`);
    assertDigest(sha256, `${role}.sha256`);
    if (digests.has(sha256)) throw new Error(`duplicate artifact digest: ${sha256}`);
    if (!Number.isInteger(byteLength) || byteLength <= 0) throw new Error(`${role}.byte_length must be positive`);
    const capturedMs = parseTime(capturedAt, `${role}.captured_at`);
    if (typeof method !== 'string' || method.length < 3) throw new Error(`${role}.method is required`);

    byRole.set(role, { role, path, sha256, byte_length: byteLength, captured_at: new Date(capturedMs).toISOString(), method });
    paths.add(path);
    digests.add(sha256);
    times.push(capturedMs);
  }

  for (const role of REQUIRED_ROLES) if (!byRole.has(role)) throw new Error(`missing required artifact role: ${role}`);
  if (byRole.get('primary_raw').method === byRole.get('independent_raw').method) {
    throw new Error('primary and independent raw evidence must use distinct methods');
  }

  const captureWindowMs = Math.max(...times) - Math.min(...times);
  if (captureWindowMs > maxCaptureWindowMs) throw new Error('artifact capture window exceeds allowed bound');

  const canonical = JSON.stringify({
    schema_version: 1,
    commit_sha: input.commit_sha,
    artifacts: REQUIRED_ROLES.map((role) => byRole.get(role))
  });

  return Object.freeze({
    schema_version: 1,
    commit_sha: input.commit_sha,
    evidence_complete: true,
    deployment_claim_permitted: false,
    capture_window_ms: captureWindowMs,
    manifest_sha256: crypto.createHash('sha256').update(canonical).digest('hex'),
    artifacts: REQUIRED_ROLES.map((role) => Object.freeze(byRole.get(role))),
    falsification_route: 'Recompute every digest from retained bytes, rerun both enumerators for the same commit, and reject on any mismatch, missing role, method collision, or capture-window violation.'
  });
}
