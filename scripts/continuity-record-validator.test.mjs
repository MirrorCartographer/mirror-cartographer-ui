import assert from 'node:assert/strict';
import { validateContinuityRecord } from './continuity-record-validator.mjs';

const base = {
  id: 'continuity-test-001',
  team: 'continuity_mining',
  claimState: 'observed',
  sourceClass: 'direct_original_record',
  privacyBoundary: {
    exposure: 'internal',
    containsPrivateSourceMaterial: false
  },
  revision: {
    commit: 'test-sha',
    changedAt: '2026-07-12T02:54:13Z'
  }
};

assert.equal(validateContinuityRecord(base).valid, true);

const copiedWithoutQualification = validateContinuityRecord({
  ...base,
  sourceClass: 'authenticated_copy'
});
assert.equal(copiedWithoutQualification.valid, false);
assert.match(copiedWithoutQualification.errors.join('\n'), /originQualification/);

const flattenedConflict = validateContinuityRecord({
  ...base,
  conflicts: [{
    claimA: { text: 'A', sourceClass: 'direct_original_record' },
    claimB: { text: 'B' },
    conflictType: 'temporal',
    currentOperationalChoice: 'retain A pending evidence',
    reversalEvidence: 'authenticated original showing B replaced A'
  }]
});
assert.equal(flattenedConflict.valid, false);
assert.match(flattenedConflict.errors.join('\n'), /both claims/);

const publicPrivateLeak = validateContinuityRecord({
  ...base,
  privacyBoundary: {
    exposure: 'public',
    containsPrivateSourceMaterial: true
  }
});
assert.equal(publicPrivateLeak.valid, false);
assert.match(publicPrivateLeak.errors.join('\n'), /cannot expose private source material/);

const proposedAsImplemented = validateContinuityRecord({
  ...base,
  claimState: 'proposed',
  sourceClass: 'proposal',
  implementationStatus: 'implemented'
});
assert.equal(proposedAsImplemented.valid, false);
assert.match(proposedAsImplemented.errors.join('\n'), /cannot be marked implemented/);

console.log('continuity-record-validator: 5 contract cases passed');
