import { createHash } from 'node:crypto';

const TARGETS = new Set(['M-004', 'M-005', 'M-006']);
const RESOLUTIONS = new Set(['located', 'unlocated', 'unresolved', 'collision_rejected']);

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

export function validateCoverageEvent(event) {
  assert(event?.schema_version === 1, 'schema-version');
  assert(nonEmpty(event.event_id), 'event-id');
  assert(event.owner === 'continuity_mining', 'owner');
  assert(event.queue_item === 'M-RECONCILE-002', 'queue-item');
  assert(nonEmpty(event.repository), 'repository');
  assert(nonEmpty(event.observed_at), 'observed-at');

  const refs = event.coverage?.refs;
  const commits = event.coverage?.reachable_commits;
  assert(Array.isArray(refs) && refs.length > 0, 'refs-required');
  assert(Array.isArray(commits) && commits.length > 0, 'reachable-commits-required');
  assert(event.coverage.pagination_complete === true, 'pagination-incomplete');
  assert(event.coverage.provider_ceiling_ambiguous === false, 'provider-ceiling-ambiguous');
  assert(Array.isArray(event.coverage.permission_errors), 'permission-errors-required');
  assert(event.coverage.permission_errors.length === 0, 'permission-errors-present');
  assert(event.coverage.ref_inventory_complete === true, 'ref-inventory-incomplete');
  assert(event.coverage.reachable_history_complete === true, 'reachable-history-incomplete');

  const refNames = new Set();
  for (const ref of refs) {
    assert(nonEmpty(ref.name), 'ref-name');
    assert(/^[0-9a-f]{40}$/.test(ref.tip_sha), 'ref-tip-sha');
    assert(!refNames.has(ref.name), 'duplicate-ref');
    refNames.add(ref.name);
  }

  const commitSet = new Set();
  for (const sha of commits) {
    assert(/^[0-9a-f]{40}$/.test(sha), 'commit-sha');
    assert(!commitSet.has(sha), 'duplicate-commit');
    commitSet.add(sha);
  }
  for (const ref of refs) assert(commitSet.has(ref.tip_sha), 'tip-not-reachable');

  assert(Array.isArray(event.resolutions) && event.resolutions.length === TARGETS.size, 'resolution-count');
  const seenTargets = new Set();
  for (const item of event.resolutions) {
    assert(TARGETS.has(item.identifier), 'unexpected-identifier');
    assert(!seenTargets.has(item.identifier), 'duplicate-identifier');
    assert(RESOLUTIONS.has(item.status), 'invalid-status');
    assert(Array.isArray(item.candidates_rejected), 'rejected-candidates-required');
    if (item.status === 'located') {
      assert(nonEmpty(item.assigning_source?.path), 'assigning-path');
      assert(/^[0-9a-f]{40}$/.test(item.assigning_source?.commit_sha || ''), 'assigning-commit');
      assert(commitSet.has(item.assigning_source.commit_sha), 'assigning-commit-outside-coverage');
    }
    if (item.status === 'unlocated') {
      assert(item.assigning_source == null, 'unlocated-has-source');
      assert(item.coverage_relative === true, 'unlocated-not-coverage-relative');
    }
    seenTargets.add(item.identifier);
  }

  const digest = createHash('sha256').update(canonical({
    repository: event.repository,
    coverage: event.coverage,
    resolutions: event.resolutions
  })).digest('hex');
  assert(event.coverage_digest === digest, 'coverage-digest-mismatch');

  return Object.freeze({ valid: true, coverage_digest: digest, targets: [...seenTargets].sort() });
}

export function computeCoverageDigest(event) {
  return createHash('sha256').update(canonical({
    repository: event.repository,
    coverage: event.coverage,
    resolutions: event.resolutions
  })).digest('hex');
}
