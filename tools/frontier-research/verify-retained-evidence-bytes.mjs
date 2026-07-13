import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_ROLES = Object.freeze([
  'primary_raw',
  'independent_raw',
  'independent_command',
  'reconciliation'
]);

function assertSafeRelativePath(value, name) {
  if (typeof value !== 'string' || !value.startsWith('operations/evidence/')) {
    throw new Error(`${name} must be under operations/evidence/`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || value.includes('..') || path.posix.isAbsolute(value)) {
    throw new Error(`${name} is unsafe`);
  }
  return normalized;
}

function assertDigest(value, name) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 digest`);
  }
}

async function readVerifiedArtifact(rootDirectory, artifact, readFile) {
  const relativePath = assertSafeRelativePath(artifact.path, `${artifact.role}.path`);
  assertDigest(artifact.sha256, `${artifact.role}.sha256`);
  if (!Number.isInteger(artifact.byte_length) || artifact.byte_length <= 0) {
    throw new Error(`${artifact.role}.byte_length must be positive`);
  }

  const root = path.resolve(rootDirectory);
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${artifact.role}.path escapes repository root`);
  }

  const bytes = await readFile(absolute);
  const observedDigest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== artifact.byte_length) {
    throw new Error(`${artifact.role}.byte_length mismatch`);
  }
  if (observedDigest !== artifact.sha256) {
    throw new Error(`${artifact.role}.sha256 mismatch`);
  }

  return Object.freeze({
    role: artifact.role,
    path: relativePath,
    sha256: observedDigest,
    byte_length: bytes.byteLength
  });
}

export async function verifyRetainedEvidenceBytes(
  manifest,
  {
    rootDirectory = process.cwd(),
    readFile = fs.readFile
  } = {}
) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new TypeError('manifest must be an object');
  }
  if (manifest.evidence_complete !== true) {
    throw new Error('manifest evidence_complete must be true');
  }
  if (!Array.isArray(manifest.artifacts)) {
    throw new TypeError('manifest.artifacts must be an array');
  }
  if (typeof readFile !== 'function') throw new TypeError('readFile must be a function');

  const byRole = new Map();
  for (const artifact of manifest.artifacts) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      throw new TypeError('artifact must be an object');
    }
    if (!REQUIRED_ROLES.includes(artifact.role)) {
      throw new Error(`unsupported artifact role: ${artifact.role}`);
    }
    if (byRole.has(artifact.role)) throw new Error(`duplicate artifact role: ${artifact.role}`);
    byRole.set(artifact.role, artifact);
  }
  for (const role of REQUIRED_ROLES) {
    if (!byRole.has(role)) throw new Error(`missing required artifact role: ${role}`);
  }

  const verifiedArtifacts = [];
  for (const role of REQUIRED_ROLES) {
    verifiedArtifacts.push(await readVerifiedArtifact(rootDirectory, byRole.get(role), readFile));
  }

  const canonical = JSON.stringify({
    schema_version: 1,
    artifacts: verifiedArtifacts
  });

  return Object.freeze({
    schema_version: 1,
    verified: true,
    deployment_claim_permitted: false,
    verified_artifacts: Object.freeze(verifiedArtifacts),
    verification_sha256: crypto.createHash('sha256').update(canonical).digest('hex'),
    falsification_route:
      'Modify any retained byte, declared byte length, digest, role, or path and rerun verification; acceptance must fail before downstream assessment.'
  });
}
