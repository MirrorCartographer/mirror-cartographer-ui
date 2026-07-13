import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, normalize, sep } from 'node:path';

const SHA256_RE = /^[a-f0-9]{64}$/;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeRepositoryPath(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('subject_path_missing');
  if (isAbsolute(value)) throw new Error('absolute_subject_path_rejected');
  const normalized = normalize(value).split(sep).join('/');
  if (normalized === '..' || normalized.startsWith('../')) throw new Error('subject_path_escape_rejected');
  if (normalized === '.' || normalized.startsWith('./')) throw new Error('noncanonical_subject_path_rejected');
  return normalized;
}

function assertUnique(values, reason) {
  if (new Set(values).size !== values.length) throw new Error(reason);
}

export async function buildEvidenceSubjectManifest({
  repository,
  source_commit_sha,
  generated_at,
  artifacts
}) {
  if (typeof repository !== 'string' || !repository.includes('/')) throw new Error('repository_invalid');
  if (typeof source_commit_sha !== 'string' || !/^[a-f0-9]{40}$/.test(source_commit_sha)) {
    throw new Error('source_commit_sha_invalid');
  }
  if (!Number.isFinite(Date.parse(generated_at))) throw new Error('generated_at_invalid');
  if (!Array.isArray(artifacts) || artifacts.length === 0) throw new Error('artifacts_missing');

  const subjects = [];
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) throw new Error('artifact_invalid');
    const name = normalizeRepositoryPath(artifact.name);
    const bytes = await readFile(artifact.path);
    const digest = sha256(bytes);
    if (!SHA256_RE.test(digest)) throw new Error('digest_invalid');
    subjects.push(Object.freeze({ name, digest: Object.freeze({ sha256: digest }), size_bytes: bytes.byteLength }));
  }

  assertUnique(subjects.map(({ name }) => name), 'duplicate_subject_name');
  assertUnique(subjects.map(({ digest }) => digest.sha256), 'duplicate_subject_digest');
  subjects.sort((a, b) => a.name.localeCompare(b.name));

  return Object.freeze({
    _type: 'https://in-toto.io/Statement/v1',
    subject: Object.freeze(subjects),
    predicateType: 'https://mirrorcartographer.dev/attestation/evidence-subject-manifest/v1',
    predicate: Object.freeze({
      schema_version: 1,
      repository,
      source_commit_sha,
      generated_at,
      claim_ceiling: 'artifact identity and byte integrity only; runtime, deployment, workflow outcome, and human observation remain unproven'
    })
  });
}
