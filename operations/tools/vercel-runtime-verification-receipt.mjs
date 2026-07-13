const SHA40 = /^[0-9a-f]{40}$/;
const SAFE_PATH = /^(operations|tools)\/[A-Za-z0-9._/-]+$/;

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
}

export function createRuntimeVerificationReceipt(input) {
  assertObject(input, 'input');
  if (input.command !== 'node --test operations/tools/vercel-retained-evidence-pipeline.test.mjs') {
    throw new Error('unapproved test command');
  }
  if (!Number.isInteger(input.exit_code)) throw new TypeError('exit_code must be an integer');
  if (!Number.isInteger(input.tests) || input.tests <= 0) throw new Error('tests must be positive');
  if (!Number.isInteger(input.passed) || !Number.isInteger(input.failed)) throw new TypeError('passed and failed must be integers');
  if (input.passed + input.failed !== input.tests) throw new Error('test count mismatch');
  if (!Array.isArray(input.sources) || input.sources.length < 2) throw new Error('at least two source bindings required');

  const seen = new Set();
  const sources = input.sources.map((source, index) => {
    assertObject(source, `sources[${index}]`);
    if (!SAFE_PATH.test(source.path) || source.path.includes('..')) throw new Error(`unsafe source path: ${source.path}`);
    if (seen.has(source.path)) throw new Error(`duplicate source path: ${source.path}`);
    seen.add(source.path);
    if (!SHA40.test(source.blob_sha ?? '')) throw new Error(`invalid blob sha: ${source.path}`);
    return Object.freeze({ path: source.path, blob_sha: source.blob_sha });
  });

  const verified = input.exit_code === 0 && input.failed === 0 && input.passed === input.tests;
  return Object.freeze({
    schema_version: 1,
    queue_item: 'V-001',
    verification_state: verified ? 'runtime_test_verified' : 'runtime_test_failed',
    command: input.command,
    exit_code: input.exit_code,
    tests: input.tests,
    passed: input.passed,
    failed: input.failed,
    sources: Object.freeze(sources),
    application_deployment_attempted: false,
    deployment_claim_permitted: false,
    rollback: 'Delete only the additive receipt artifact or revert its commit; no application path is modified.'
  });
}
