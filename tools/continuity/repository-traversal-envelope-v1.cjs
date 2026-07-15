'use strict';

const crypto = require('node:crypto');

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const STATUS = new Set(['complete_accessible_history', 'incomplete_coverage', 'conflicting_coverage']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function validateShaList(name, values) {
  assert(Array.isArray(values), `${name} must be an array`);
  for (const value of values) assert(SHA40.test(value), `${name} contains invalid commit SHA`);
}

function validateEnvelope(envelope) {
  assert(envelope && typeof envelope === 'object' && !Array.isArray(envelope), 'envelope must be an object');
  assert(envelope.schema_version === 1, 'schema_version must equal 1');
  assert(/^[^/]+\/[^/]+$/.test(envelope.repository || ''), 'repository must be owner/name');
  assert(!Number.isNaN(Date.parse(envelope.retrieved_at)), 'retrieved_at must be an ISO date-time');
  assert(typeof envelope.default_branch === 'string' && envelope.default_branch.length > 0, 'default_branch is required');

  const refs = envelope.ref_inventory;
  assert(refs && typeof refs === 'object', 'ref_inventory is required');
  assert(typeof refs.method === 'string' && refs.method.length > 0, 'ref_inventory.method is required');
  assert(Array.isArray(refs.refs), 'ref_inventory.refs must be an array');
  assert(typeof refs.pagination_complete === 'boolean', 'ref_inventory.pagination_complete must be boolean');
  assert(typeof refs.permission_scope_known === 'boolean', 'ref_inventory.permission_scope_known must be boolean');
  assert(Array.isArray(refs.blind_spots), 'ref_inventory.blind_spots must be an array');
  for (const ref of refs.refs) {
    assert(ref && typeof ref === 'object', 'ref entry must be an object');
    assert(typeof ref.name === 'string' && ref.name.length > 0, 'ref name is required');
    assert(['branch', 'tag', 'other'].includes(ref.type), 'ref type is invalid');
    assert(SHA40.test(ref.target_sha || ''), 'ref target_sha is invalid');
  }

  const traversal = envelope.commit_traversal;
  assert(traversal && typeof traversal === 'object', 'commit_traversal is required');
  validateShaList('commit_traversal.roots', traversal.roots);
  validateShaList('commit_traversal.visited_commits', traversal.visited_commits);
  assert(Array.isArray(traversal.parent_edges), 'commit_traversal.parent_edges must be an array');
  for (const edge of traversal.parent_edges) {
    assert(SHA40.test(edge.child || ''), 'parent edge child is invalid');
    validateShaList('parent edge parents', edge.parents);
  }
  assert(Number.isInteger(traversal.unvisited_reachable_count) && traversal.unvisited_reachable_count >= 0, 'unvisited_reachable_count must be a non-negative integer');
  assert(SHA64.test(traversal.digest_sha256 || ''), 'commit traversal digest is invalid');

  const expectedTraversalDigest = digest({
    roots: uniqueSorted(traversal.roots),
    visited_commits: uniqueSorted(traversal.visited_commits),
    parent_edges: [...traversal.parent_edges]
      .map((edge) => ({ child: edge.child, parents: uniqueSorted(edge.parents) }))
      .sort((a, b) => a.child.localeCompare(b.child)),
    unvisited_reachable_count: traversal.unvisited_reachable_count
  });
  assert(traversal.digest_sha256 === expectedTraversalDigest, 'commit traversal digest mismatch');

  const paths = envelope.path_history;
  assert(paths && typeof paths === 'object', 'path_history is required');
  assert(Array.isArray(paths.queries) && paths.queries.every((item) => typeof item === 'string' && item.length > 0), 'path_history.queries is invalid');
  assert(typeof paths.deleted_path_inspection_performed === 'boolean', 'deleted_path_inspection_performed must be boolean');
  assert(SHA64.test(paths.results_digest_sha256 || ''), 'path history digest is invalid');
  assert(Array.isArray(paths.blind_spots), 'path_history.blind_spots must be an array');

  const assessment = envelope.coverage_assessment;
  assert(assessment && typeof assessment === 'object', 'coverage_assessment is required');
  assert(STATUS.has(assessment.status), 'coverage status is invalid');
  assert(typeof assessment.terminal_provenance_allowed === 'boolean', 'terminal_provenance_allowed must be boolean');
  assert(Array.isArray(assessment.reasons), 'coverage reasons must be an array');
  assert(typeof envelope.privacy_boundary === 'string' && envelope.privacy_boundary.length > 0, 'privacy_boundary is required');

  if (assessment.terminal_provenance_allowed) {
    assert(assessment.status === 'complete_accessible_history', 'terminal provenance requires complete_accessible_history');
    assert(refs.pagination_complete, 'terminal provenance requires complete ref pagination');
    assert(refs.permission_scope_known, 'terminal provenance requires known permission scope');
    assert(refs.blind_spots.length === 0, 'terminal provenance forbids ref blind spots');
    assert(traversal.unvisited_reachable_count === 0, 'terminal provenance requires zero unvisited reachable commits');
    assert(paths.deleted_path_inspection_performed, 'terminal provenance requires deleted-path inspection');
    assert(paths.blind_spots.length === 0, 'terminal provenance forbids path-history blind spots');
  }

  return { valid: true, canonical_digest_sha256: digest(envelope) };
}

function buildEnvelope(input) {
  assert(input && typeof input === 'object', 'input must be an object');
  const refs = [...(input.refs || [])].sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`));
  const roots = uniqueSorted(refs.map((ref) => ref.target_sha));
  const visited = uniqueSorted(input.visited_commits || []);
  const parentEdges = [...(input.parent_edges || [])]
    .map((edge) => ({ child: edge.child, parents: uniqueSorted(edge.parents || []) }))
    .sort((a, b) => a.child.localeCompare(b.child));
  const refBlindSpots = uniqueSorted(input.ref_blind_spots || []);
  const pathBlindSpots = uniqueSorted(input.path_blind_spots || []);
  const reasons = [];

  if (!input.pagination_complete) reasons.push('ref pagination is incomplete');
  if (!input.permission_scope_known) reasons.push('repository permission scope is unknown');
  if (refBlindSpots.length) reasons.push('ref inventory contains blind spots');
  if ((input.unvisited_reachable_count || 0) !== 0) reasons.push('reachable commit traversal is incomplete');
  if (!input.deleted_path_inspection_performed) reasons.push('deleted-path inspection was not performed');
  if (pathBlindSpots.length) reasons.push('path-history inspection contains blind spots');

  const conflicting = Boolean(input.conflicting_coverage);
  const complete = reasons.length === 0 && !conflicting;
  const status = conflicting ? 'conflicting_coverage' : complete ? 'complete_accessible_history' : 'incomplete_coverage';

  const traversalBody = {
    roots,
    visited_commits: visited,
    parent_edges: parentEdges,
    unvisited_reachable_count: input.unvisited_reachable_count || 0
  };

  const envelope = {
    schema_version: 1,
    repository: input.repository,
    retrieved_at: input.retrieved_at,
    default_branch: input.default_branch,
    ref_inventory: {
      method: input.ref_method,
      refs,
      pagination_complete: Boolean(input.pagination_complete),
      permission_scope_known: Boolean(input.permission_scope_known),
      blind_spots: refBlindSpots
    },
    commit_traversal: {
      ...traversalBody,
      digest_sha256: digest(traversalBody)
    },
    path_history: {
      queries: uniqueSorted(input.path_queries || []),
      deleted_path_inspection_performed: Boolean(input.deleted_path_inspection_performed),
      results_digest_sha256: digest(input.path_results || []),
      blind_spots: pathBlindSpots
    },
    coverage_assessment: {
      status,
      terminal_provenance_allowed: complete,
      reasons: conflicting ? uniqueSorted([...reasons, 'coverage sources conflict']) : reasons
    },
    privacy_boundary: input.privacy_boundary
  };

  validateEnvelope(envelope);
  return envelope;
}

module.exports = { buildEnvelope, validateEnvelope, digest };
