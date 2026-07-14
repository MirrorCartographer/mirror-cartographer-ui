import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRepositoryHistoryCoverage } from '../continuity/validate-repository-history-coverage.mjs';

function baseEnvelope() {
  return {
    schema_version: 1,
    contract_id: 'CM-1031',
    queue_item: 'M-RECONCILE-002',
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    branch_inventory: {
      complete: true,
      pagination_exhausted: true,
      branches: [{
        branch_name: 'main',
        head_commit_sha: 'b'.repeat(40),
        retrieved_at: '2026-07-14T13:30:00Z',
        retrieval_method: 'github_rest_paginated',
      }],
    },
    commit_history: {
      complete: true,
      provider_boundary: null,
      commits: [
        {
          branch_name: 'main',
          commit_sha: 'a'.repeat(40),
          parent_shas: [],
          committed_at: '2026-01-01T00:00:00Z',
          message: 'root',
          retrieved_at: '2026-07-14T13:30:01Z',
        },
        {
          branch_name: 'main',
          commit_sha: 'b'.repeat(40),
          parent_shas: ['a'.repeat(40)],
          committed_at: '2026-07-14T13:00:00Z',
          message: 'head',
          retrieved_at: '2026-07-14T13:30:01Z',
        },
      ],
    },
    artifact_search: {
      search_complete: true,
      source_classes_searched: ['decision_log', 'language_lexicon', 'project_document', 'chat_history_reference', 'repository_artifact'],
      results: {
        'M-004': { candidate: null, resolution_state: 'unlocated_after_exhaustive_coverage' },
        'M-005': { candidate: null, resolution_state: 'unlocated_after_exhaustive_coverage' },
        'M-006': { candidate: null, resolution_state: 'unlocated_after_exhaustive_coverage' },
      },
    },
  };
}

test('accepts a complete exhaustive envelope', () => {
  const result = validateRepositoryHistoryCoverage(baseEnvelope());
  assert.equal(result.status, 'verified_exhaustive_coverage');
  assert.equal(result.branch_count, 1);
  assert.equal(result.unique_commit_count, 2);
});

test('fails closed on first-page-only branch evidence', () => {
  const envelope = baseEnvelope();
  envelope.branch_inventory.pagination_exhausted = false;
  assert.throws(() => validateRepositoryHistoryCoverage(envelope), /branch pagination is not exhausted/);
});

test('fails closed when a branch root was not retained', () => {
  const envelope = baseEnvelope();
  envelope.commit_history.commits = envelope.commit_history.commits.slice(1);
  assert.throws(() => validateRepositoryHistoryCoverage(envelope), /no reachable root retained/);
});

test('rejects an unlocated claim when identity evidence points to a located artifact', () => {
  const envelope = baseEnvelope();
  envelope.artifact_search.results['M-004'] = {
    candidate: {
      namespace: true,
      owner: true,
      semantic_role: true,
      temporal_precedence: true,
      immutable_locator: true,
      source_object: 'git:blob:1234',
    },
    resolution_state: 'unlocated_after_exhaustive_coverage',
  };
  assert.throws(() => validateRepositoryHistoryCoverage(envelope), /M-004 claims unlocated_after_exhaustive_coverage; expected located/);
});

test('classifies an identity mismatch as a rejected collision', () => {
  const envelope = baseEnvelope();
  envelope.artifact_search.results['M-005'] = {
    candidate: {
      namespace: false,
      owner: true,
      semantic_role: true,
      temporal_precedence: true,
      immutable_locator: true,
      source_object: 'file-library:suffix-match',
    },
    resolution_state: 'collision_rejected',
  };
  const result = validateRepositoryHistoryCoverage(envelope);
  assert.equal(result.resolutions['M-005'], 'collision_rejected');
});
