const SHA40 = /^[0-9a-f]{40}$/i;

function iso(value, name) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new TypeError(`${name} must be an ISO date-time`);
  return d;
}

export function partitionWorkflowRunWindow(input, options = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  if (!SHA40.test(input.headSha ?? '')) throw new TypeError('headSha must be a 40-character git SHA');
  const start = iso(input.start, 'start');
  const end = iso(input.end, 'end');
  if (start >= end) throw new RangeError('start must precede end');
  const totalCount = input.totalCount;
  if (!Number.isInteger(totalCount) || totalCount < 0) throw new TypeError('totalCount must be a non-negative integer');
  const ceiling = options.ceiling ?? 1000;
  const minimumWindowMs = options.minimumWindowMs ?? 1000;
  if (!Number.isInteger(ceiling) || ceiling < 1) throw new TypeError('ceiling must be a positive integer');
  if (!Number.isInteger(minimumWindowMs) || minimumWindowMs < 1) throw new TypeError('minimumWindowMs must be a positive integer');

  const base = {
    schemaVersion: 1,
    headSha: input.headSha.toLowerCase(),
    created: `${start.toISOString()}..${end.toISOString()}`,
    totalCount,
    ceiling,
    sourceStatus: 'provider_observation'
  };

  if (totalCount < ceiling) {
    return { ...base, classification: 'enumerable', children: [], claimBoundary: 'This window is below the documented filtered-search ceiling; pagination completeness must still be verified independently.' };
  }

  const width = end.getTime() - start.getTime();
  if (width <= minimumWindowMs) {
    return { ...base, classification: 'provider_ceiling_ambiguous', children: [], claimBoundary: 'The provider ceiling persists at the minimum permitted time window; exhaustive coverage is not established.' };
  }

  const midpoint = new Date(start.getTime() + Math.floor(width / 2));
  return {
    ...base,
    classification: 'partition_required',
    children: [
      { start: start.toISOString(), end: midpoint.toISOString(), headSha: base.headSha },
      { start: midpoint.toISOString(), end: end.toISOString(), headSha: base.headSha }
    ],
    claimBoundary: 'Partitioning is a retrieval plan, not evidence of complete enumeration until every leaf is below the ceiling and independently paginated.'
  };
}

export function assessPartitionTree(node) {
  if (!node || typeof node !== 'object') throw new TypeError('node must be an object');
  if (node.classification === 'provider_ceiling_ambiguous') return { exhaustive: false, reason: 'provider_ceiling_ambiguous' };
  if (node.classification === 'enumerable') return { exhaustive: true, reason: null };
  if (node.classification !== 'partition_required' || !Array.isArray(node.children) || node.children.length !== 2) {
    return { exhaustive: false, reason: 'invalid_partition_tree' };
  }
  const assessed = node.children.map(assessPartitionTree);
  const failed = assessed.find((item) => !item.exhaustive);
  return failed ?? { exhaustive: true, reason: null };
}
