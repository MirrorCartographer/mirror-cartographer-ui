import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCoverageReceipt } from './validate-provenance-coverage-receipt.mjs';

const base = () => ({
  schema_version: 1,
  receipt_id: 'CM-COVERAGE-1016',
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  generated_at: '2026-07-13T22:37:00Z',
  tool_identity: { name: 'test', version_or_runtime: 'node', authentication_scope: 'connector_limited' },
  target_identifiers: ['M-004', 'M-005', 'M-006'],
  ref_inventory: { method: 'connector search', complete: false, refs: [] },
  history_traversal: { method: 'equivalent_documented_traversal', complete: false, reachable_commit_count: 0, searched_object_types: ['commit'], command_or_procedure: 'connector-limited search' },
  source_classes: [
    { class: 'decision_log', searched: true, method: 'repository search', result_count: 0 },
    { class: 'language_lexicon', searched: true, method: 'repository search', result_count: 0 },
    { class: 'project_document', searched: true, method: 'repository search', result_count: 0 },
    { class: 'continuity_artifact', searched: true, method: 'repository search', result_count: 0 }
  ],
  coverage_result: 'incomplete',
  claim_transitions: ['M-004', 'M-005', 'M-006'].map(identifier => ({ identifier, prior_status: 'unresolved', next_status: 'unresolved', immutable_locator: null, reason: 'coverage incomplete' })),
  privacy_boundary: { included_classes: ['repository metadata'], excluded_classes: ['private chat content'], redaction_applied: false },
  known_exclusions: ['all-ref inventory unavailable'],
  reproduction: { steps: ['repeat repository search'], expected_evidence: ['connector result'] }
});

test('incomplete coverage preserves unresolved claims', () => {
  assert.equal(validateCoverageReceipt(base()).valid, true);
});

test('incomplete coverage cannot become unlocated', () => {
  const item = base();
  item.claim_transitions[0].next_status = 'unlocated';
  assert.equal(validateCoverageReceipt(item).valid, false);
});

test('complete coverage can classify unlocated', () => {
  const item = base();
  item.coverage_result = 'complete';
  item.known_exclusions = [];
  item.ref_inventory.complete = true;
  item.history_traversal.complete = true;
  item.claim_transitions = item.claim_transitions.map(entry => ({ ...entry, next_status: 'unlocated' }));
  assert.equal(validateCoverageReceipt(item).valid, true);
});

test('located claims require immutable locators', () => {
  const item = base();
  item.coverage_result = 'complete_with_declared_exclusions';
  item.claim_transitions[1].next_status = 'located';
  assert.equal(validateCoverageReceipt(item).valid, false);
});

test('malformed target identifiers are rejected', () => {
  const item = base();
  item.target_identifiers = ['M-4'];
  assert.equal(validateCoverageReceipt(item).valid, false);
});
