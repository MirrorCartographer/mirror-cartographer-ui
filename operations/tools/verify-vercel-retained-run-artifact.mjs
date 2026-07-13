import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

async function sha256(path) {
  const content = await readFile(path);
  return createHash('sha256').update(content).digest('hex');
}

function isSafeRelativePath(file) {
  if (!file || isAbsolute(file) || file.includes('\\')) return false;
  const normalized = normalize(file).replaceAll('\\', '/');
  return normalized !== '.' && normalized !== '..' && !normalized.startsWith('../') && normalized === file;
}

function parseDigestManifest(text) {
  const entries = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/);
    if (!match) throw new Error(`Invalid SHA-256 manifest line: ${rawLine}`);
    const [, digest, file] = match;
    if (!DIGEST_PATTERN.test(digest)) throw new Error(`Invalid digest for ${file}`);
    if (!isSafeRelativePath(file)) throw new Error(`Unsafe digest manifest path: ${file}`);
    if (entries.has(file)) throw new Error(`Duplicate digest manifest entry: ${file}`);
    entries.set(file, digest);
  }
  if (entries.size === 0) throw new Error('Digest manifest is empty.');
  return entries;
}

export async function verifyRetainedRunArtifact({ directory, expectedSha, expectedRunId, expectedRunAttempt }) {
  if (!SHA_PATTERN.test(String(expectedSha))) {
    throw new Error('expectedSha must be a lowercase 40-character commit SHA.');
  }
  for (const [name, value] of [['expectedRunId', expectedRunId], ['expectedRunAttempt', expectedRunAttempt]]) {
    if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) {
      throw new Error(`${name} must be a positive integer.`);
    }
  }

  const root = resolve(directory);
  const manifestPath = resolve(root, 'vercel-retained-run-manifest.json');
  const artifactDigestPath = resolve(root, 'vercel-retained-run-manifest-artifacts.sha256');
  const sourceDigestPath = resolve(root, 'vercel-retained-run-manifest-sources.sha256');

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schema_version !== 1 || manifest.evidence_class !== 'commit_bound_ci_contract') {
    throw new Error('Unexpected retained run manifest schema or evidence class.');
  }
  if (manifest.sha !== expectedSha) throw new Error('Retained run manifest commit mismatch.');
  if (manifest.run_id !== Number(expectedRunId)) throw new Error('Retained run manifest run_id mismatch.');
  if (manifest.run_attempt !== Number(expectedRunAttempt)) throw new Error('Retained run manifest run_attempt mismatch.');
  if (manifest.artifact_name !== `vercel-retained-run-manifest-${expectedSha}`) {
    throw new Error('Retained run manifest artifact_name mismatch.');
  }

  const requiredArtifacts = new Set([
    'vercel-retained-run-manifest.json',
    'vercel-retained-run-manifest.tap'
  ]);
  const artifactEntries = parseDigestManifest(await readFile(artifactDigestPath, 'utf8'));
  for (const required of requiredArtifacts) {
    if (!artifactEntries.has(required)) throw new Error(`Missing artifact digest: ${required}`);
  }

  const verifiedArtifacts = [];
  for (const [file, expectedDigest] of artifactEntries) {
    const actualDigest = await sha256(resolve(root, file));
    if (actualDigest !== expectedDigest) throw new Error(`Digest mismatch: ${file}`);
    verifiedArtifacts.push({ file, sha256: actualDigest });
  }

  const sourceEntries = parseDigestManifest(await readFile(sourceDigestPath, 'utf8'));
  const requiredSources = new Set([
    '.github/workflows/vercel-retained-run-manifest-contract.yml',
    'operations/tools/vercel-retained-run-manifest.mjs',
    'operations/tools/vercel-retained-run-manifest.test.mjs'
  ]);
  for (const required of requiredSources) {
    if (!sourceEntries.has(required)) throw new Error(`Missing source digest: ${required}`);
  }

  return {
    verified: true,
    verification_class: 'downloaded_commit_bound_ci_artifact',
    claim_boundary: 'This verification proves local checksum and run-identity coherence only. It does not prove Vercel deployment, browser audio, or physical-device audibility.',
    sha: manifest.sha,
    run_id: manifest.run_id,
    run_attempt: manifest.run_attempt,
    artifact_name: manifest.artifact_name,
    artifact_files_verified: verifiedArtifacts.length,
    source_digest_entries: sourceEntries.size,
    manifest_file: basename(manifestPath)
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, expectedSha, expectedRunId, expectedRunAttempt] = process.argv.slice(2);
  try {
    const result = await verifyRetainedRunArtifact({ directory, expectedSha, expectedRunId, expectedRunAttempt });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
