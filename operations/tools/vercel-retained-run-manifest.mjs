import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

export function buildRetainedRunManifest(input) {
  const required = [
    'repository',
    'workflow',
    'run_id',
    'run_attempt',
    'event_name',
    'ref',
    'sha',
    'artifact_name',
    'retention_days',
    'generated_at'
  ];

  for (const key of required) {
    if (input[key] === undefined || input[key] === null || String(input[key]).trim() === '') {
      throw new Error(`Missing required run manifest field: ${key}`);
    }
  }

  if (!SHA_PATTERN.test(String(input.sha))) {
    throw new Error('Run manifest sha must be a lowercase 40-character commit SHA.');
  }

  for (const key of ['run_id', 'run_attempt', 'retention_days']) {
    if (!POSITIVE_INTEGER_PATTERN.test(String(input[key]))) {
      throw new Error(`Run manifest ${key} must be a positive integer.`);
    }
  }

  const generatedAt = new Date(String(input.generated_at));
  if (Number.isNaN(generatedAt.getTime())) {
    throw new Error('Run manifest generated_at must be an ISO-8601 timestamp.');
  }

  return {
    schema_version: 1,
    evidence_class: 'commit_bound_ci_contract',
    claim_boundary: 'This manifest identifies the CI run and retained contract artifact only. It does not prove a Vercel deployment, browser audio, or physical-device audibility.',
    repository: String(input.repository),
    workflow: String(input.workflow),
    run_id: Number(input.run_id),
    run_attempt: Number(input.run_attempt),
    event_name: String(input.event_name),
    ref: String(input.ref),
    sha: String(input.sha),
    artifact_name: String(input.artifact_name),
    retention_days: Number(input.retention_days),
    generated_at: generatedAt.toISOString()
  };
}

function readEnvironment() {
  return {
    repository: process.env.GITHUB_REPOSITORY,
    workflow: process.env.GITHUB_WORKFLOW,
    run_id: process.env.GITHUB_RUN_ID,
    run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    event_name: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
    artifact_name: process.env.VERCEL_RETAINED_ARTIFACT_NAME,
    retention_days: process.env.VERCEL_RETAINED_RETENTION_DAYS,
    generated_at: process.env.VERCEL_RETAINED_GENERATED_AT
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(buildRetainedRunManifest(readEnvironment()), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
