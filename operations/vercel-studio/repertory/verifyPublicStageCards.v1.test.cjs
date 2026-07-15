'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyPublicStageCards } = require('./verifyPublicStageCards.v1.cjs');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'PUBLIC_STAGE_CARDS.v1.json'), 'utf8'));

test('accepts the complete public-safe repertory card contract', () => {
  const result = verifyPublicStageCards(fixture);
  assert.equal(result.verified, true);
  assert.equal(result.card_count, 6);
});
test('rejects missing repertory identities', () => {
  const copy = structuredClone(fixture); copy.cards.pop();
  assert.equal(verifyPublicStageCards(copy).verified, false);
});
test('rejects autoplay-capable audio metadata', () => {
  const copy = structuredClone(fixture); copy.cards[0].audio_mode = 'autoplay';
  assert.match(verifyPublicStageCards(copy).violations.join(','), /audio_mode_unsafe/);
});
test('rejects activation claims', () => {
  const copy = structuredClone(fixture); copy.activation_status = 'live';
  assert.match(verifyPublicStageCards(copy).violations.join(','), /activation_claim_not_fail_closed/);
});
test('rejects missing nonvisual equivalents', () => {
  const copy = structuredClone(fixture); copy.cards[1].nonvisual_status = '';
  assert.match(verifyPublicStageCards(copy).violations.join(','), /missing_nonvisual_status/);
});
