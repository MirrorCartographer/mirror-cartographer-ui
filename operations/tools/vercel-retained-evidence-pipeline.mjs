import crypto from 'node:crypto';
import { buildRetainedEvidenceManifest } from '../../tools/frontier-research/retained-evidence-manifest.mjs';
import { decideVercelDeploymentWithRetainedEvidence } from './vercel-deployment-evidence-decision.mjs';

const REQUIRED_ROLES = Object.freeze([
  'primary_raw',
  'independent_raw',
  'independent_command',
  'reconciliation'
]);

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function toBuffer(value, name) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new TypeError(`${name} must be a string or Buffer`);
}

function parseJson(buffer, name) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new Error(`${name} must contain valid JSON`);
  }
}

function verifyReconciliation(reconciliation, expectedCommit) {
  assertObject(reconciliation, 'reconciliation');
  const commit = reconciliation.commit_sha ?? reconciliation.expected_commit_sha;
  return reconciliation.verified === true
    && commit === expectedCommit
    && reconciliation.provider_ceiling_ambiguous === false;
}

export function evaluateRetainedEvidenceDeploymentPipeline(input) {
  assertObject(input, 'input');
  assertObject(input.deployment, 'input.deployment');
  if (!Array.isArray(input.artifacts)) throw new TypeError('input.artifacts must be an array');

  const seen = new Set();
  const retained = input.artifacts.map((artifact, index) => {
    assertObject(artifact, `input.artifacts[${index}]`);
    if (!REQUIRED_ROLES.includes(artifact.role)) throw new Error(`unsupported artifact role: ${artifact.role}`);
    if (seen.has(artifact.role)) throw new Error(`duplicate artifact role: ${artifact.role}`);
    seen.add(artifact.role);

    const bytes = toBuffer(artifact.bytes, `${artifact.role}.bytes`);
    return {
      descriptor: {
        role: artifact.role,
        path: artifact.path,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        byte_length: bytes.length,
        captured_at: artifact.captured_at,
        method: artifact.method
      },
      bytes
    };
  });

  for (const role of REQUIRED_ROLES) {
    if (!seen.has(role)) throw new Error(`missing required artifact role: ${role}`);
  }

  const manifest = buildRetainedEvidenceManifest({
    commit_sha: input.deployment.commit_sha,
    artifacts: retained.map(({ descriptor }) => descriptor)
  }, input.manifest_options);

  const reconciliationEntry = retained.find(({ descriptor }) => descriptor.role === 'reconciliation');
  const reconciliation = parseJson(reconciliationEntry.bytes, 'reconciliation bytes');
  const reconciliationVerified = verifyReconciliation(reconciliation, input.deployment.commit_sha);
  const providerCeilingAmbiguous = reconciliation.provider_ceiling_ambiguous !== false;

  const decision = decideVercelDeploymentWithRetainedEvidence({
    handoff: {
      expected_commit_sha: input.deployment.commit_sha,
      manifest,
      raw_bytes_reverified: true,
      reconciliation_verified: reconciliationVerified,
      provider_ceiling_ambiguous: providerCeilingAmbiguous
    },
    deployment: input.deployment
  });

  return Object.freeze({
    schema_version: 1,
    manifest,
    reconciliation_verified: reconciliationVerified,
    decision,
    deployment_claim_permitted: false,
    retained_artifact_digests: Object.freeze(Object.fromEntries(
      retained.map(({ descriptor }) => [descriptor.role, descriptor.sha256])
    ))
  });
}
