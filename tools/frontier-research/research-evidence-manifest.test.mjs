import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = JSON.parse(await readFile(new URL('../../operations/frontier/research-evidence-manifest.schema.json', import.meta.url)));

function validate(manifest) {
  const errors = [];
  const required = schema.required;
  for (const key of required) if (!(key in manifest)) errors.push(`missing:${key}`);
  if (manifest.owner !== 'frontier_research') errors.push('owner');
  if (!/^R-[0-9]{3}$/.test(manifest.queue_item ?? '')) errors.push('queue_item');
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) errors.push('sources');

  const sourceIds = new Set((manifest.sources ?? []).map((source) => source.id));
  const categories = ['observed', 'inferred', 'proposed', 'superseded', 'unresolved'];
  const claimIds = new Set();
  for (const category of categories) {
    if (!Array.isArray(manifest.claims?.[category])) {
      errors.push(`claims:${category}`);
      continue;
    }
    for (const claim of manifest.claims[category]) {
      if (claimIds.has(claim.id)) errors.push(`duplicate-claim:${claim.id}`);
      claimIds.add(claim.id);
      for (const sourceId of claim.source_ids ?? []) {
        if (!sourceIds.has(sourceId)) errors.push(`unknown-source:${sourceId}`);
      }
    }
  }

  for (const claimId of manifest.falsification?.target_claim_ids ?? []) {
    if (!claimIds.has(claimId)) errors.push(`unknown-falsification-target:${claimId}`);
  }
  if (!['passed', 'failed', 'not_run', 'partial'].includes(manifest.verification?.status)) errors.push('verification');
  return errors;
}

const valid = {
  schema_version: 1,
  artifact_id: 'R-007:research-evidence-contract',
  queue_item: 'R-007',
  owner: 'frontier_research',
  created_at: '2026-07-12T07:43:00Z',
  sources: [{ id: 'repo-state', kind: 'repository', status: 'verified', locator: 'operations/ACTIVE_QUEUE.json', accessed_at: '2026-07-12T07:43:00Z' }],
  claims: {
    observed: [{ id: 'c1', text: 'The canonical queue has no Frontier-owned item.', source_ids: ['repo-state'], strength: 'direct' }],
    inferred: [], proposed: [], superseded: [], unresolved: []
  },
  falsification: { target_claim_ids: ['c1'], test: 'Read the canonical queue.', failure_condition: 'A Frontier-owned item is present.' },
  verification: { status: 'passed', method: 'Deterministic fixture validation.', evidence_refs: [], limits: [] }
};

assert.deepEqual(validate(valid), []);
assert(validate({ ...valid, owner: 'other' }).includes('owner'));
assert(validate({ ...valid, sources: [] }).includes('sources'));
assert(validate({ ...valid, claims: { ...valid.claims, observed: [{ ...valid.claims.observed[0], source_ids: ['missing'] }] } }).includes('unknown-source:missing'));
assert(validate({ ...valid, falsification: { ...valid.falsification, target_claim_ids: ['missing'] } }).includes('unknown-falsification-target:missing'));
assert(validate({ ...valid, claims: { ...valid.claims, inferred: [{ ...valid.claims.observed[0] }] } }).includes('duplicate-claim:c1'));

console.log('research evidence manifest tests passed: 6');
