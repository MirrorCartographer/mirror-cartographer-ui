import crypto from 'node:crypto';

const REQUIRED = ['namespace', 'owner', 'semantic_role', 'temporal_precedence', 'immutable_locator'];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function resolveProvenanceCandidate({ node, candidates }) {
  if (!node || typeof node !== 'object') throw new TypeError('node must be an object');
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');

  const valid = candidates.filter((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    if (REQUIRED.some((key) => candidate[key] === undefined || candidate[key] === null)) return false;
    return candidate.namespace === node.namespace &&
      candidate.owner === node.owner &&
      candidate.semantic_role === node.semantic_role &&
      candidate.temporal_precedence === true &&
      typeof candidate.immutable_locator === 'string' &&
      /^(commit|blob|tag):[0-9a-f]{40}(?::.+)?$/i.test(candidate.immutable_locator);
  });

  const unique = new Map(valid.map((candidate) => [candidate.immutable_locator, candidate]));
  const matches = [...unique.values()];
  const basis = stable({ node, matches });
  const digest = crypto.createHash('sha256').update(JSON.stringify(basis)).digest('hex');

  if (matches.length === 1) {
    return { status: 'resolved', candidate: matches[0], digest, authoritative: false };
  }
  if (matches.length > 1) {
    return { status: 'collision', candidates: matches, digest, authoritative: false };
  }
  return {
    status: 'unresolved',
    rejected_count: candidates.length,
    required_agreement: REQUIRED,
    digest,
    authoritative: false
  };
}
