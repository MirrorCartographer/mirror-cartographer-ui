import assert from 'node:assert/strict';
import { normalizeConsentedInteractionArtifact, validateLearningClaim } from '../src/interaction-learning/interaction-learning-adapter.mjs';

const valid = normalizeConsentedInteractionArtifact({
  artifactId: 'session-export-001',
  exportedAt: '2026-07-16T17:00:00Z',
  consent: { interactionLearning: true, consentedAt: '2026-07-16T16:59:00Z' },
  events: [
    { type: 'mood_selected', at: '2026-07-16T16:55:00Z', target: 'mood', value: 'still' },
    { type: 'mood_selected', at: '2026-07-16T16:55:00Z', target: 'mood', value: 'still' },
    { type: 'tempo_changed', at: '2026-07-16T16:56:00Z', target: 'tempo', value: 72 }
  ]
});
assert.equal(valid.valid, true);
assert.equal(valid.record.events.length, 2);
assert.equal(valid.record.adversarialChecks.duplicateEventsRemoved, 1);
assert.equal(valid.record.claims.every((claim) => claim.claimClass === 'observed_interaction'), true);

const noConsent = normalizeConsentedInteractionArtifact({ artifactId: 'x', exportedAt: '2026-07-16T17:00:00Z', events: [{ type: 'artifact_replayed', at: '2026-07-16T17:00:00Z' }] });
assert.equal(noConsent.valid, false);
assert.match(noConsent.errors.join('\n'), /consent/);

const privacyLeak = normalizeConsentedInteractionArtifact({
  artifactId: 'x', exportedAt: '2026-07-16T17:00:00Z', consent: { interactionLearning: true },
  email: 'person@example.com', events: [{ type: 'feedback_submitted', at: '2026-07-16T17:00:00Z' }]
});
assert.equal(privacyLeak.valid, false);
assert.match(privacyLeak.errors.join('\n'), /forbidden private fields/);

const inference = validateLearningClaim({
  claimClass: 'history_supported_inference', statement: 'Users may prefer slower tempo after selecting still mood',
  evidenceEventIds: ['a','b'], confidence: 0.62,
  alternatives: ['tempo change may be incidental'], limits: ['small consented sample']
});
assert.equal(inference.valid, true);

const overclaim = validateLearningClaim({
  claimClass: 'history_supported_inference', statement: 'User is anxious', evidenceEventIds: ['a'], confidence: 0.9,
  alternatives: [], limits: []
});
assert.equal(overclaim.valid, false);

console.log('interaction-learning-adapter: 5 adversarial contract cases passed');
