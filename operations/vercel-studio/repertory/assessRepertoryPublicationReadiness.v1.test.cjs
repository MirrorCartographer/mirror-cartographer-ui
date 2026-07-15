'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { assessRepertoryPublicationReadiness } = require('./assessRepertoryPublicationReadiness.v1.cjs');

const repertory = JSON.parse(readFileSync(join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'));
const sha = 'a'.repeat(40);
const pipelineSha = 'b'.repeat(64);
const hostname = 'mirror-cartographer-ready.example.vercel.app';

function verifiedPipeline() {
  const deployment = {
    id: 'dpl_PublicationReadiness1',
    projectId: 'prj_mirrorcartographer',
    url: hostname,
    gitSource: { sha },
  };
  return {
    verified: true,
    violations: [],
    claim_boundary: 'authenticated_retrieval_and_immutable_deployment_identity_verified_only',
    pipeline_sha256: pipelineSha,
    retrieval: { verified: true },
    identity: {
      verified: true,
      normalized: {
        expected_commit_sha: sha,
        observed_at: '2026-07-15T21:30:00Z',
        deployment,
      },
    },
    normalized: { expected_commit_sha: sha },
  };
}

function directObservation() {
  return {
    requested_url: `https://${hostname}`,
    final_url: `https://${hostname}`,
    method: 'HEAD',
    status_code: 200,
    redirect_count: 0,
    tls_verified: true,
    observed_at: '2026-07-15T21:31:00Z',
    duration_ms: 41,
  };
}

test('marks publication preconditions ready while preserving runtime_activation_performed=false', () => {
  const result = assessRepertoryPublicationReadiness({
    repertory,
    expected_commit_sha: sha,
    verified_deployment_pipeline: verifiedPipeline(),
    generated_hostname_observation: directObservation(),
  });

  assert.equal(result.ready, true, JSON.stringify(result.violations));
  assert.equal(result.runtime_activation_performed, false);
  assert.equal(result.immutable_deployment_verified, true);
  assert.equal(result.generated_hostname_https_verified, true);
  assert.equal(result.claim_boundary, 'publication_preconditions_verified_only_runtime_activation_not_performed');
  assert.match(result.evidence.hostname_observation_sha256, /^[0-9a-f]{64}$/);
});

test('rejects identity evidence without an independent hostname observation', () => {
  const result = assessRepertoryPublicationReadiness({
    repertory,
    expected_commit_sha: sha,
    verified_deployment_pipeline: verifiedPipeline(),
  });

  assert.equal(result.ready, false);
  assert.equal(result.immutable_deployment_verified, true);
  assert.equal(result.generated_hostname_https_verified, false);
  assert.equal(result.violations.includes('hostname:direct_https_observation_unverified'), true);
});

test('rejects redirecting hostname observations', () => {
  const observation = directObservation();
  observation.redirect_count = 1;
  observation.final_url = 'https://mirror-cartographer-ui.vercel.app/';

  const result = assessRepertoryPublicationReadiness({
    repertory,
    expected_commit_sha: sha,
    verified_deployment_pipeline: verifiedPipeline(),
    generated_hostname_observation: observation,
  });

  assert.equal(result.ready, false);
  assert.equal(result.evidence.hostname_violations.includes('observation:redirects_present'), true);
  assert.equal(result.evidence.hostname_violations.includes('binding:final_url_mismatch'), true);
});

test('rejects deployment pipeline commit mismatch', () => {
  const pipeline = verifiedPipeline();
  pipeline.identity.normalized.deployment.gitSource.sha = 'c'.repeat(40);

  const result = assessRepertoryPublicationReadiness({
    repertory,
    expected_commit_sha: sha,
    verified_deployment_pipeline: pipeline,
    generated_hostname_observation: directObservation(),
  });

  assert.equal(result.ready, false);
  assert.equal(result.evidence.deployment_violations.includes('binding:deployment_commit_mismatch'), true);
});

test('rejects a weakened runtime boundary even with verified external evidence', () => {
  const weakened = structuredClone(repertory);
  weakened.activation_boundary.runtime_integration = 'performed';

  const result = assessRepertoryPublicationReadiness({
    repertory: weakened,
    expected_commit_sha: sha,
    verified_deployment_pipeline: verifiedPipeline(),
    generated_hostname_observation: directObservation(),
  });

  assert.equal(result.ready, false);
  assert.equal(result.runtime_activation_performed, false);
  assert.equal(result.violations.includes('repertory:runtime_boundary_not_fail_closed'), true);
});