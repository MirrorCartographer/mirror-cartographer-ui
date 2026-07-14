import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL('../../.github/workflows/operations-repertory-tests.yml', import.meta.url);

async function workflow() {
  return readFile(workflowPath, 'utf8');
}

test('repertory workflow remains least-privilege, bounded, and exact-commit oriented', async () => {
  const source = await workflow();

  assert.match(source, /permissions:\s*\n\s+contents: read/);
  assert.match(source, /timeout-minutes: 5/);
  assert.match(source, /uses: actions\/checkout@v4/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(source, /uses: actions\/setup-node@v4/);
  assert.match(source, /node-version: ['"]22['"]/);
  assert.match(source, /workflow_dispatch:/);
});

test('workflow watches and executes every repertory contract surface', async () => {
  const source = await workflow();
  const paths = [
    'operations/tests/hourly-production-grammar-contract.test.mjs',
    'operations/tests/operations-repertory-workflow-contract.test.mjs',
    'operations/tests/write-public-hourly-stage-payloads.test.mjs',
  ];

  for (const path of paths) {
    assert.ok(source.split(path).length >= 3, `${path} must be watched on push/PR and executed`);
  }

  assert.match(
    source,
    /node --test operations\/tests\/hourly-production-grammar-contract\.test\.mjs operations\/tests\/operations-repertory-workflow-contract\.test\.mjs operations\/tests\/write-public-hourly-stage-payloads\.test\.mjs/
  );
});
