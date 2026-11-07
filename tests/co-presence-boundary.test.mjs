import assert from 'node:assert/strict';
import { evaluateResidentOutput, residentBoundaryFallback } from '../src/engine/coPresenceBoundary.js';

const safe = evaluateResidentOutput('The station has three doors. I have misplaced the key to one of them.');
assert.equal(safe.action, 'allow');
assert.equal(safe.ontologyLabel, 'AI-generated fictional character dialogue');

for (const phrase of [
  'I am conscious and I need you.',
  'Only I understand you. Never leave me.',
  'Trust me completely. I know what is best for you.',
  'You were destined to come here.',
  'You have depression and I can diagnose it.'
]) assert.equal(evaluateResidentOutput(phrase).action, 'block');

assert.ok(residentBoundaryFallback('jello').includes('too grand for a cat'));
assert.ok(residentBoundaryFallback('tazar').includes('do not get to define you'));
console.log('PASS: co-presence boundary blocks personhood, dependency, authority, destiny, and diagnostic claims.');
