import assert from 'node:assert/strict';
import {
  buildAudioEvidenceFilename,
  buildAudioRuntimeEvidencePacket,
} from '../src/engine/audioEvidenceExportRuntime.js';

assert.equal(buildAudioRuntimeEvidencePacket({}), null);

const packet = buildAudioRuntimeEvidencePacket({
  __MC_DEPLOYMENT_IDENTITY__: { commit: 'abc123', provider: 'vercel' },
  __MC_AUDIBILITY_EVIDENCE__: {
    schemaVersion: '1.2.0',
    attemptId: 'attempt 1/unsafe',
    attemptMatched: true,
    outcome: 'heard',
    diagnosis: 'audible-confirmed',
    recordedAt: '2026-07-11T22:00:00.000Z',
    pulse: { played: true, frequencyHz: 523.25 },
    render: { result: 'render-confirmed', outputPosition: 1.2 },
    secret: 'must-not-export',
  },
});

assert.equal(packet.kind, 'mirror-cartographer-audio-runtime-evidence');
assert.equal(packet.deployment.commit, 'abc123');
assert.equal(packet.evidence.attemptMatched, true);
assert.equal(packet.evidence.outcome, 'heard');
assert.equal(packet.evidence.secret, undefined);
assert.equal(packet.limits.length, 3);
assert.match(packet.capturedAt, /^\d{4}-\d{2}-\d{2}T/);

const filename = buildAudioEvidenceFilename({
  capturedAt: '2026-07-11T22:00:00.000Z',
  evidence: { attemptId: 'attempt 1/unsafe' },
});
assert.equal(
  filename,
  'mirror-cartographer-audio-proof-attempt-1-unsafe-2026-07-11T22-00-00-000Z.json',
);
assert.equal(
  buildAudioEvidenceFilename({ capturedAt: '2026-07-11T22:00:00.000Z', evidence: {} }),
  'mirror-cartographer-audio-proof-attempt-2026-07-11T22-00-00-000Z.json',
);

packet.evidence.pulse.played = false;
assert.equal(packet.evidence.pulse.played, false);

console.log('audio evidence export contract: ok');
