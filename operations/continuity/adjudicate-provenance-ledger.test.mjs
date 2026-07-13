import assert from 'node:assert/strict';
import { adjudicateProvenanceLedger } from './adjudicate-provenance-ledger.mjs';

const ids = ['M-004', 'M-005', 'M-006'];
const nodes = Object.fromEntries(ids.map((identifier) => [identifier, {
  identifier,
  namespace: 'continuity',
  owner: 'continuity_mining',
  semantic_role: 'artifact'
}]));
const emptyCandidates = Object.fromEntries(ids.map((identifier) => [identifier, []]));

function coverage(identifierResults) {
  return {
    schema_version: 1,
    queue_item: 'M-RECONCILE-002',
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    coverage_status: 'complete',
    branch_enumeration: { exhaustive: true, provider_ceiling_ambiguous: false },
    branches: [{ name: 'main', head_sha: 'a'.repeat(40) }],
    traversals: [{
      branch: 'main',
      commit_count: 1,
      ordered_commit_sha256: 'b'.repeat(64),
      method: 'deterministic-test-vector',
      retrieved_at: '2026-07-13T21:00:00Z'
    }],
    identifier_results: identifierResults
  };
}

const unlocatedResults = Object.fromEntries(ids.map((identifier) => [identifier, { status: 'unlocated' }]));
let result = adjudicateProvenanceLedger({
  nodes,
  candidatesByIdentifier: emptyCandidates,
  coverageManifest: coverage(unlocatedResults)
});
assert.equal(result.valid, true);
assert.equal(result.decisions['M-004'].status, 'unlocated');

const locator = `commit:${'c'.repeat(40)}`;
result = adjudicateProvenanceLedger({
  nodes,
  candidatesByIdentifier: {
    ...emptyCandidates,
    'M-004': [{
      namespace: 'continuity',
      owner: 'continuity_mining',
      semantic_role: 'artifact',
      temporal_precedence: true,
      immutable_locator: locator
    }]
  },
  coverageManifest: coverage({
    ...unlocatedResults,
    'M-004': { status: 'located', immutable_locator: locator }
  })
});
assert.equal(result.valid, true);
assert.equal(result.decisions['M-004'].immutable_locator, locator);

result = adjudicateProvenanceLedger({
  nodes,
  candidatesByIdentifier: emptyCandidates,
  coverageManifest: coverage({
    ...unlocatedResults,
    'M-004': { status: 'located', immutable_locator: `commit:${'d'.repeat(40)}` }
  })
});
assert.equal(result.valid, false);
assert.match(result.errors.join(' '), /coverage result disagrees/);

result = adjudicateProvenanceLedger({
  nodes: { ...nodes, 'M-006': undefined },
  candidatesByIdentifier: emptyCandidates,
  coverageManifest: coverage(unlocatedResults)
});
assert.equal(result.valid, false);
assert.match(result.errors.join(' '), /M-006/);

console.log('adjudicate-provenance-ledger: 4 tests passed');
