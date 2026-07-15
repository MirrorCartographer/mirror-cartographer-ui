'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflowPath = path.resolve(
  __dirname,
  '../../../.github/workflows/vercel-repertory-oidc-receipt.yml'
);

function loadWorkflow() {
  return fs.readFileSync(workflowPath, 'utf8');
}

function normalizedLines(source) {
  return source.split(/\r?\n/).map((line) => line.trim());
}

test('workflow remains manually dispatched and minimally permissioned', () => {
  const source = loadWorkflow();
  assert.match(source, /\bon:\s*\n\s+workflow_dispatch:/);
  assert.match(source, /permissions:\s*\n\s+contents:\s*read\s*\n\s+id-token:\s*write/);
  assert.doesNotMatch(source, /pull_request:|push:|schedule:/);
  assert.doesNotMatch(source, /contents:\s*write|deployments:\s*write|packages:\s*write/);
});

test('checkout cannot persist repository credentials', () => {
  const source = loadWorkflow();
  assert.match(source, /uses:\s*actions\/checkout@v4[\s\S]*?persist-credentials:\s*false/);
});

test('workflow retains only the verified token-free receipt', () => {
  const source = loadWorkflow();
  assert.match(source, /path:\s*\$\{\{ env\.RECEIPT_DIR \}\}\/verified-receipt\.json/);
  assert.match(source, /rm -f "\$RECEIPT_DIR\/expected\.json"/);
  assert.match(source, /token_retained:\s*result\.token_retained/);
  assert.match(source, /authorization_retained:\s*result\.authorization_retained/);
  assert.doesNotMatch(source, /path:\s*\$\{\{ env\.RECEIPT_DIR \}\}\s*$/m);
});

test('workflow contains no deployment or activation command', () => {
  const source = loadWorkflow();
  const lines = normalizedLines(source).filter(
    (line) => line && !line.startsWith('#') && !line.startsWith("echo '")
  );
  const executable = lines.join('\n').toLowerCase();

  const prohibited = [
    'vercel deploy',
    'vercel --prod',
    'vercel promote',
    'vercel alias',
    'npm run deploy',
    'pnpm deploy',
    'repertory activate',
    'activate repertory',
  ];

  for (const command of prohibited) {
    assert.equal(
      executable.includes(command),
      false,
      `prohibited command present: ${command}`
    );
  }
});

test('workflow runs all prerequisite deterministic gates before requesting OIDC', () => {
  const source = loadWorkflow();
  const testStep = source.indexOf('Verify existing OIDC and repertory gates');
  const requestStep = source.indexOf('Request, verify, and bind GitHub OIDC token in process memory');
  assert.ok(testStep >= 0, 'missing deterministic gate step');
  assert.ok(requestStep > testStep, 'OIDC request must follow deterministic gates');

  assert.match(source, /githubOidcReceiptPipeline\.v1\.test\.cjs/);
  assert.match(source, /githubActionsOidcReceiptAdapter\.v1\.test\.cjs/);
  assert.match(source, /assessOidcBoundRepertoryPublicationReadiness\.v1\.test\.cjs/);
});

test('claim boundary explicitly leaves runtime and device behavior unproven', () => {
  const source = loadWorkflow();
  assert.match(source, /does not deploy or activate the repertory/i);
  assert.match(source, /audio audibility[\s\S]*remain unproven/i);
  assert.match(source, /browser rendering[\s\S]*remain unproven/i);
});
