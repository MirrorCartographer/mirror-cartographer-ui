#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVercelStatusEvidence } from './vercel-status-evidence.mjs';

const EXPECTED_COMMIT = '277bb9a2f8d72b7f1d60765b6548332ac21990c1';
const GENERATED_AT = '2026-07-12T00:13:21.000Z';

test('classifies Vercel build-rate limit without claiming source regression', () => {
  const evidence = buildVercelStatusEvidence({
    result: {
      statuses: [
        {
          context: 'Vercel',
          state: 'failure',
          target_url: 'https://vercel.com/mirror-cartographers-projects?upgradeToPro=build-rate-limit',
        },
      ],
    },
  }, {
    expectedCommit: EXPECTED_COMMIT,
    generatedAt: GENERATED_AT,
  });

  assert.equal(evidence.expected_commit, EXPECTED_COMMIT);
  assert.equal(evidence.generated_at, GENERATED_AT);
  assert.equal(evidence.classification.classification, 'transient_provider_rate_limit');
  assert.equal(evidence.classification.retryable, true);
  assert.equal(evidence.claims.deployment_verified, false);
  assert.equal(evidence.claims.source_regression_proven, false);
  assert.equal(evidence.claims.served_commit_identity_verified, false);
});

test('accepts a direct status object and preserves provider success uncertainty', () => {
  const evidence = buildVercelStatusEvidence({
    context: 'Vercel',
    state: 'success',
    target_url: 'https://vercel.com/example/deployment',
    description: 'Deployment completed',
  }, {
    expectedCommit: EXPECTED_COMMIT,
    generatedAt: GENERATED_AT,
  });

  assert.equal(evidence.classification.classification, 'provider_reports_success');
  assert.equal(evidence.claims.deployment_verified, false);
  assert.equal(evidence.claims.served_commit_identity_verified, false);
});

test('reports insufficient evidence when no Vercel status exists', () => {
  const evidence = buildVercelStatusEvidence({
    statuses: [{ context: 'lint', state: 'success' }],
  }, {
    generatedAt: GENERATED_AT,
  });

  assert.equal(evidence.observed_status, null);
  assert.equal(evidence.classification.classification, 'insufficient_status_evidence');
});

test('rejects malformed expected commit identity', () => {
  assert.throws(
    () => buildVercelStatusEvidence({}, { expectedCommit: 'abc' }),
    /40-character lowercase hexadecimal SHA/,
  );
});
