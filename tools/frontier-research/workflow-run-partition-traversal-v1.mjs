import { partitionInclusiveWorkflowRunWindow, verifyInclusivePartition } from './workflow-run-window-partitioner-v2.mjs';

function key(window) {
  return `${window.start}..${window.end}`;
}

function requireObservation(observation, window) {
  if (!observation || typeof observation !== 'object') return null;
  if (observation.start !== window.start || observation.end !== window.end) {
    throw new Error(`observation_window_mismatch:${key(window)}`);
  }
  if (!Number.isInteger(observation.totalCount) || observation.totalCount < 0) {
    throw new TypeError(`invalid_total_count:${key(window)}`);
  }
  return observation;
}

export function planWorkflowRunPartitionTraversal(input, observations = {}, options = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  const ceiling = options.ceiling ?? 1000;
  const root = { start: input.start, end: input.end, headSha: input.headSha };
  const pending = [root];
  const leaves = [];
  const ambiguous = [];
  const partitions = [];
  const visited = new Set();

  while (pending.length) {
    const window = pending.shift();
    const windowKey = key(window);
    if (visited.has(windowKey)) throw new Error(`duplicate_window:${windowKey}`);
    visited.add(windowKey);

    const observation = requireObservation(observations[windowKey], window);
    if (!observation) {
      leaves.push({ ...window, classification: 'observation_required' });
      continue;
    }

    const decision = partitionInclusiveWorkflowRunWindow({
      headSha: input.headSha,
      start: window.start,
      end: window.end,
      totalCount: observation.totalCount
    }, { ceiling });

    if (decision.classification === 'enumerable') {
      leaves.push({ ...window, totalCount: observation.totalCount, classification: 'enumerable', paginationComplete: observation.paginationComplete === true });
      continue;
    }

    if (decision.classification === 'provider_ceiling_ambiguous') {
      ambiguous.push({ ...window, totalCount: observation.totalCount, classification: decision.classification });
      continue;
    }

    const verification = verifyInclusivePartition(window, decision.children);
    if (!verification.valid) throw new Error(`invalid_partition:${verification.reason}:${windowKey}`);
    partitions.push({ parent: window, children: decision.children });
    pending.push(...decision.children);
  }

  const unpaginated = leaves.filter((leaf) => leaf.classification === 'enumerable' && !leaf.paginationComplete);
  const observationsMissing = leaves.filter((leaf) => leaf.classification === 'observation_required');
  const verified = ambiguous.length === 0 && observationsMissing.length === 0 && unpaginated.length === 0;

  return {
    schemaVersion: 1,
    headSha: input.headSha.toLowerCase(),
    root,
    ceiling,
    partitions,
    leaves,
    ambiguous,
    verified,
    failClosedReasons: [
      ...(ambiguous.length ? ['provider_ceiling_ambiguous'] : []),
      ...(observationsMissing.length ? ['observation_missing'] : []),
      ...(unpaginated.length ? ['pagination_incomplete'] : [])
    ],
    claimBoundary: 'verified=true establishes only a complete partition-and-pagination plan for retained observations; it does not establish response authenticity, run-set reconciliation, or deployment identity.'
  };
}
