import assert from 'node:assert/strict';
import { resolveProvenanceCandidate } from './resolve-provenance-candidate.mjs';

const node = { id: 'M-004', namespace: 'continuity', owner: 'continuity_mining', semantic_role: 'decision_record' };
const good = { namespace: 'continuity', owner: 'continuity_mining', semantic_role: 'decision_record', temporal_precedence: true, immutable_locator: `commit:${'a'.repeat(40)}` };

assert.equal(resolveProvenanceCandidate({ node, candidates: [good] }).status, 'resolved');
assert.equal(resolveProvenanceCandidate({ node, candidates: [{ ...good, namespace: 'proof_machine' }] }).status, 'unresolved');
assert.equal(resolveProvenanceCandidate({ node, candidates: [{ ...good, temporal_precedence: false }] }).status, 'unresolved');
assert.equal(resolveProvenanceCandidate({ node, candidates: [good, { ...good, immutable_locator: `blob:${'b'.repeat(40)}:x.json` }] }).status, 'collision');
assert.equal(resolveProvenanceCandidate({ node, candidates: [good, { ...good }] }).status, 'resolved');
console.log('5 tests passed');
