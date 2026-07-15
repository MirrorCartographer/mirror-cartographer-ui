const SHA40 = /^[0-9a-f]{40}$/i;
const SECOND_MS = 1000;

function instant(value, name) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new TypeError(`${name} must be an ISO date-time`);
  if (date.getUTCMilliseconds() !== 0) throw new RangeError(`${name} must be aligned to whole-second precision`);
  return date;
}

function format(date) {
  return date.toISOString().replace('.000Z', 'Z');
}

export function partitionInclusiveWorkflowRunWindow(input, options = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  if (!SHA40.test(input.headSha ?? '')) throw new TypeError('headSha must be a 40-character git SHA');
  const start = instant(input.start, 'start');
  const end = instant(input.end, 'end');
  if (start > end) throw new RangeError('start must not follow end');
  if (!Number.isInteger(input.totalCount) || input.totalCount < 0) throw new TypeError('totalCount must be a non-negative integer');
  const ceiling = options.ceiling ?? 1000;
  if (!Number.isInteger(ceiling) || ceiling < 1) throw new TypeError('ceiling must be a positive integer');

  const base = {
    schemaVersion: 2,
    headSha: input.headSha.toLowerCase(),
    created: `${format(start)}..${format(end)}`,
    totalCount: input.totalCount,
    ceiling,
    intervalSemantics: 'inclusive_second_precision',
    sourceStatus: 'provider_observation'
  };

  if (input.totalCount < ceiling) {
    return { ...base, classification: 'enumerable', children: [], claimBoundary: 'Below-ceiling status does not establish complete Link-header pagination.' };
  }

  const startSecond = start.getTime() / SECOND_MS;
  const endSecond = end.getTime() / SECOND_MS;
  if (startSecond === endSecond) {
    return { ...base, classification: 'provider_ceiling_ambiguous', children: [], claimBoundary: 'The provider ceiling persists for one inclusive UTC second; exhaustive retrieval is not established.' };
  }

  const midpointSecond = Math.floor((startSecond + endSecond) / 2);
  const leftEnd = new Date(midpointSecond * SECOND_MS);
  const rightStart = new Date((midpointSecond + 1) * SECOND_MS);
  return {
    ...base,
    classification: 'partition_required',
    children: [
      { start: format(start), end: format(leftEnd), headSha: base.headSha },
      { start: format(rightStart), end: format(end), headSha: base.headSha }
    ],
    partitionInvariant: 'left.end + 1 second = right.start; inclusive children are disjoint and cover the parent exactly',
    claimBoundary: 'Partitioning is only a retrieval plan until every leaf is below the ceiling and fully paginated.'
  };
}

export function verifyInclusivePartition(parent, children) {
  if (!parent || !Array.isArray(children) || children.length !== 2) return { valid: false, reason: 'invalid_shape' };
  const parentStart = instant(parent.start, 'parent.start');
  const parentEnd = instant(parent.end, 'parent.end');
  const leftStart = instant(children[0].start, 'left.start');
  const leftEnd = instant(children[0].end, 'left.end');
  const rightStart = instant(children[1].start, 'right.start');
  const rightEnd = instant(children[1].end, 'right.end');
  if (leftStart.getTime() !== parentStart.getTime() || rightEnd.getTime() !== parentEnd.getTime()) return { valid: false, reason: 'coverage_mismatch' };
  if (leftEnd.getTime() + SECOND_MS !== rightStart.getTime()) return { valid: false, reason: 'overlap_or_gap' };
  if (leftStart > leftEnd || rightStart > rightEnd) return { valid: false, reason: 'empty_child' };
  return { valid: true, reason: null };
}
