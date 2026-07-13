import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEvidenceIndependence } from '../../operations/tools/frontier-evidence-independence-classifier.mjs';

test('classifies GitHub Contents and git ls-tree as method-diverse shared authority', () => {
  const result = classifyEvidenceIndependence([
    {
      method: 'github-contents-at-commit',
      authority: 'github-git-object-database',
      transport: 'github-rest-api',
      operator: 'connector'
    },
    {
      method: 'git-ls-tree-at-commit',
      authority: 'github-git-object-database',
      transport: 'git-protocol',
      operator: 'local-cli'
    }
  ]);

  assert.equal(result.classification, 'method_diverse_shared_authority');
  assert.equal(result.method_diversity_verified, true);
  assert.equal(result.source_independence_verified, false);
  assert.equal(
    result.claim_ceiling,
    'independent-method agreement over a shared authority'
  );
  assert.equal(result.deployment_claim_permitted, false);
});

test('permits independent-source wording only when authorities differ', () => {
  const result = classifyEvidenceIndependence([
    {
      method: 'github-contents-at-commit',
      authority: 'github-git-object-database',
      transport: 'github-rest-api',
      operator: 'connector'
    },
    {
      method: 'retained-build-attestation',
      authority: 'external-artifact-store',
      transport: 'signed-bundle',
      operator: 'ci-runner'
    }
  ]);

  assert.equal(result.classification, 'independent_authority_and_method');
  assert.equal(result.source_independence_verified, true);
  assert.equal(result.method_diversity_verified, true);
  assert.equal(result.claim_ceiling, 'independent-source agreement');
});

test('fails closed on incomplete or singular channel descriptions', () => {
  assert.throws(
    () => classifyEvidenceIndependence([{ method: 'only' }]),
    /at least two evidence channels/
  );

  assert.throws(
    () => classifyEvidenceIndependence([
      { method: 'a', authority: 'x', transport: 't', operator: 'o' },
      { method: 'b', authority: '', transport: 'u', operator: 'p' }
    ]),
    /authority missing/
  );
});
