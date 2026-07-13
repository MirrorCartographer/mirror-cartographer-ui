import crypto from 'node:crypto';
import { decideProvenanceStatus } from './decide-provenance-status.mjs';

const IDS = ['M-004', 'M-005', 'M-006'];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function adjudicateProvenanceLedger({ nodes, candidatesByIdentifier, coverageManifest }) {
  const errors = [];
  if (!nodes || typeof nodes !== 'object' || Array.isArray(nodes)) {
    errors.push('nodes must be an object keyed by identifier');
  }
  if (!candidatesByIdentifier || typeof candidatesByIdentifier !== 'object' || Array.isArray(candidatesByIdentifier)) {
    errors.push('candidatesByIdentifier must be an object keyed by identifier');
  }

  const decisions = {};
  for (const identifier of IDS) {
    const node = nodes?.[identifier];
    const candidates = candidatesByIdentifier?.[identifier];

    if (!node || node.identifier !== identifier) {
      errors.push(`missing or mismatched node for ${identifier}`);
      continue;
    }
    if (!Array.isArray(candidates)) {
      errors.push(`candidates for ${identifier} must be an array`);
      continue;
    }

    const decision = decideProvenanceStatus({ node, candidates, coverageManifest });
    decisions[identifier] = decision;

    const declared = coverageManifest?.identifier_results?.[identifier];
    if (declared && declared.status !== decision.status) {
      errors.push(`coverage result disagrees with decision for ${identifier}`);
    }
    if (decision.status === 'located' && declared?.immutable_locator !== decision.immutable_locator) {
      errors.push(`immutable locator disagrees for ${identifier}`);
    }
  }

  const completeSet = IDS.every((identifier) => decisions[identifier]);
  const valid = errors.length === 0 && completeSet &&
    Object.values(decisions).every((decision) => decision.coverage_valid);
  const basis = stable({
    identifiers: IDS,
    decisions,
    errors,
    coverage_manifest: decisions['M-004']?.digest ? coverageManifest : null
  });

  return {
    schema_version: 1,
    queue_item: 'M-RECONCILE-002',
    valid,
    authoritative: false,
    decisions,
    errors,
    claim_ceiling: valid
      ? 'Decision ledger is internally consistent but remains non-authoritative until repository coverage is independently proven.'
      : 'No provenance promotion is permitted.',
    digest: crypto.createHash('sha256').update(JSON.stringify(basis)).digest('hex')
  };
}
