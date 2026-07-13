import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestResearchEvidence } from './ingest-research-evidence.mjs';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);

const verifiedObject = {
  report: {
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    commit_sha: sha,
    path: 'cloudflare-static/index.html'
  },
  observed: {
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    commit_sha: sha,
    commit_status: 'found',
    path: 'cloudflare-static/index.html',
    path_status: 'found',
    observed_at: '2026-07-13T05:39:00Z',
    source: 'github_connector'
  }
};

const validPagesEvidence = {
  project: {
    canonical_origin: 'https://mirror-cartographer-research.pages.dev',
    source: 'cloudflare_pages_api',
    custom_domains: []
  },
  deployment: {
    url: 'https://a1b2c3d4.mirror-cartographer-research.pages.dev',
    commit_sha: sha
  },
  network: {
    dns_resolved: true,
    http_status: 200
  },
  identity: {
    surface: 'mirror-cartographer-research',
    served_commit: sha
  },
  provenance: {
    artifact_digest: digest,
    privacy_review: 'passed'
  }
};

test('rejects malformed packets', () => {
  assert.equal(ingestResearchEvidence(null).code, 'INVALID_INPUT');
  assert.equal(ingestResearchEvidence({}).code, 'REPORTED_OBJECTS_MISSING');
});

test('rejects an unverified reported object before Pages promotion', () => {
  const result = ingestResearchEvidence({
    pages_evidence: validPagesEvidence,
    reported_objects: [{
      ...verifiedObject,
      observed: { ...verifiedObject.observed, path_status: 'missing' }
    }]
  });
  assert.equal(result.code, 'REPORTED_OBJECT_UNVERIFIED');
  assert.equal(result.promotion_permitted, false);
  assert.equal(result.deployment_claim_permitted, false);
});

test('rejects Pages evidence after object provenance passes', () => {
  const result = ingestResearchEvidence({
    pages_evidence: {},
    reported_objects: [verifiedObject]
  });
  assert.equal(result.code, 'PAGES_EVIDENCE_REJECTED');
  assert.equal(result.object_results[0].verified, true);
});

test('accepts only when object provenance and Pages evidence both pass', () => {
  const result = ingestResearchEvidence({
    pages_evidence: validPagesEvidence,
    reported_objects: [verifiedObject]
  });
  assert.equal(result.accepted, true);
  assert.equal(result.promotion_permitted, true);
  assert.equal(result.deployment_claim_permitted, true);
  assert.equal(result.scientific_truth_established, false);
});

test('empty reported-object list remains explicit and still requires Pages verification', () => {
  const result = ingestResearchEvidence({
    pages_evidence: validPagesEvidence,
    reported_objects: []
  });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.object_results, []);
});
