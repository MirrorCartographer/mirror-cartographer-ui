'use strict';

const REQUIRED_IDS = Object.freeze([
  'archive-afterimage', 'body-constellation', 'coordinate-choir',
  'quiet-machine', 'residual-comet', 'wordless-room-game',
]);
const REQUIRED_FIELDS = Object.freeze([
  'production_id','title','short_synopsis','nonvisual_status','motion_mode',
  'audio_mode','mobile_mode','privacy_boundary',
]);
const SAFE_VALUES = Object.freeze({
  motion_mode: 'reduced_motion_equivalent_required',
  audio_mode: 'silent_by_default_user_gesture_only',
  mobile_mode: 'touch_safe_single_viewport',
});

function verifyPublicStageCards(value) {
  const violations = [];
  if (!value || typeof value !== 'object') return { verified:false, violations:['invalid_document'] };
  if (value.contract_id !== 'vercel-studio-public-stage-cards-v1') violations.push('contract_id_mismatch');
  if (value.activation_status !== 'programming_metadata_only') violations.push('activation_claim_not_fail_closed');
  if (!Array.isArray(value.cards)) return { verified:false, violations:[...violations, 'cards_not_array'] };
  const ids = [];
  for (const card of value.cards) {
    for (const field of REQUIRED_FIELDS) if (typeof card?.[field] !== 'string' || card[field].trim() === '') violations.push(`missing_${field}`);
    if (card?.production_id) ids.push(card.production_id);
    for (const [field, expected] of Object.entries(SAFE_VALUES)) if (card?.[field] !== expected) violations.push(`${card?.production_id || 'unknown'}_${field}_unsafe`);
    if (typeof card?.privacy_boundary === 'string' && /health data|private source|credential/i.test(card.privacy_boundary)) violations.push(`${card.production_id}_privacy_boundary_unsafe`);
  }
  const sorted = [...ids].sort();
  if (new Set(ids).size !== ids.length) violations.push('duplicate_production_id');
  if (JSON.stringify(sorted) !== JSON.stringify(REQUIRED_IDS)) violations.push('production_inventory_mismatch');
  return Object.freeze({ verified: violations.length === 0, card_count: value.cards.length, violations: Object.freeze(violations) });
}
module.exports = { REQUIRED_IDS, REQUIRED_FIELDS, SAFE_VALUES, verifyPublicStageCards };
