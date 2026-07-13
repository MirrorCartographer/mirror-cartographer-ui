import assert from 'node:assert/strict';
import { encodeScore, decodeScore, scoreFromHash } from './weather-score-capsules.mjs';

const score = ['ash','rain','moths','static','','','','','ash','rain','moths','static','','','',''];
assert.equal(encodeScore(score), 'ws1.1234000012340000');
assert.deepEqual(decodeScore('ws1.1234000012340000'), score);
assert.deepEqual(scoreFromHash('#ws1.1234000012340000'), score);
assert.equal(scoreFromHash(''), null);
assert.throws(() => decodeScore('ws1.1234'), /invalid_score_capsule/);
assert.throws(() => encodeScore([...score.slice(0, 15), 'fog']), /unknown_weather/);
console.log('6 passed, 0 failed');
