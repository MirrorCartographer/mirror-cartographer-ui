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

test('workflow watches and executes both repertory test surfaces', async () => {
  const source = await workflow();
  const contractPath = 'operations/tests/operations-repertory-workflow-contract.test.mjs';
  const repertoryPath = 'operations/tests/write-public-hourly-stage-payloads.test.mjs';

  assert.ok(source.split(contractPath).length >= 3, 'contract test must be watched on push/PR and executed');
  assert.ok(source.split(repertoryPath).length >= 3, 'repertory test must be watched on push/PR and executed');
  assert.match(
    source,
    /node --test operations\/tests\/operations-repertory-workflow-contract\.test\.mjs operations\/tests\/write-public-hourly-stage-payloads\.test\.mjs/
  );
});
