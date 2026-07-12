import assert from 'node:assert/strict';
import { classifyAudioRouting } from '../src/engine/audioRoutingEvidenceRuntime.js';

assert.deepEqual(
  classifyAudioRouting({ context: {} }),
  { status: 'unsupported', browserConfirmed: false, physicalOutputProven: false },
);

const blockedContext = { sinkId: 'speaker-1', setSinkId() {} };
assert.deepEqual(
  classifyAudioRouting({
    context: blockedContext,
    permissionsPolicy: { allowsFeature: () => false },
  }),
  { status: 'policy-blocked', browserConfirmed: false, physicalOutputProven: false },
);

assert.deepEqual(
  classifyAudioRouting({ context: { sinkId: '', setSinkId() {} } }),
  { status: 'default-or-undisclosed', browserConfirmed: false, physicalOutputProven: false, sinkId: null },
);

assert.deepEqual(
  classifyAudioRouting({ context: blockedContext }),
  { status: 'selected-unverified', browserConfirmed: false, physicalOutputProven: false, sinkId: 'speaker-1' },
);

assert.deepEqual(
  classifyAudioRouting({ context: blockedContext, sinkChangeObserved: true }),
  { status: 'selected-confirmed', browserConfirmed: true, physicalOutputProven: false, sinkId: 'speaker-1' },
);

console.log('audio routing evidence contract: ok');
