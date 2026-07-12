import fs from 'node:fs';

const epistemicStates = new Set(['observed','inferred','proposed','superseded','unresolved']);
const lifecycleStates = new Set(['active','inactive','historical','conflicted','withdrawn']);
const transitionKinds = new Set(['confirm','refine','contradict','supersede','retract','reopen']);
const evidenceStrengths = new Set(['none','weak','moderate','strong','direct']);
const reviewStates = new Set(['unreviewed','reviewed','conflict','accepted','rejected']);
const visibilities = new Set(['public','internal','private']);

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateClaim(claim, label, errors) {
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
    errors.push(`${label} must be an object`);
    return;
  }
  if (!nonempty(claim.claim_id)) errors.push(`${label}.claim_id must be non-empty`);
  if (!nonempty(claim.statement_summary)) errors.push(`${label}.statement_summary must be non-empty`);
  if (!epistemicStates.has(claim.epistemic_state)) errors.push(`${label}.epistemic_state is invalid`);
  if (!lifecycleStates.has(claim.lifecycle_state)) errors.push(`${label}.lifecycle_state is invalid`);
  const allowed = new Set(['claim_id','statement_summary','epistemic_state','lifecycle_state']);
  for (const key of Object.keys(claim)) if (!allowed.has(key)) errors.push(`${label}.${key} is not allowed`);
}

export function validateClaimTransition(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, errors: ['record must be an object'] };
  const allowed = new Set(['schema_version','transition_id','subject_id','recorded_at','from_claim','to_claim','transition_kind','reason','provenance','privacy']);
  for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`${key} is not allowed`);
  if (record.schema_version !== 1) errors.push('schema_version must equal 1');
  for (const key of ['transition_id','subject_id','reason']) if (!nonempty(record[key])) errors.push(`${key} must be non-empty`);
  if (!nonempty(record.recorded_at) || Number.isNaN(Date.parse(record.recorded_at))) errors.push('recorded_at must be an ISO date-time');
  if (!transitionKinds.has(record.transition_kind)) errors.push('transition_kind is invalid');
  validateClaim(record.from_claim, 'from_claim', errors);
  validateClaim(record.to_claim, 'to_claim', errors);

  const p = record.provenance;
  if (!p || typeof p !== 'object' || Array.isArray(p)) errors.push('provenance must be an object');
  else {
    const allowedP = new Set(['source_refs','evidence_strength','review_state']);
    for (const key of Object.keys(p)) if (!allowedP.has(key)) errors.push(`provenance.${key} is not allowed`);
    if (!Array.isArray(p.source_refs) || p.source_refs.length < 1 || p.source_refs.some(ref => !nonempty(ref)) || new Set(p.source_refs).size !== p.source_refs.length) errors.push('provenance.source_refs must contain unique non-empty strings');
    if (!evidenceStrengths.has(p.evidence_strength)) errors.push('provenance.evidence_strength is invalid');
    if (!reviewStates.has(p.review_state)) errors.push('provenance.review_state is invalid');
  }

  const privacy = record.privacy;
  if (!privacy || typeof privacy !== 'object' || Array.isArray(privacy)) errors.push('privacy must be an object');
  else {
    const allowedPrivacy = new Set(['visibility','contains_raw_private_content','content_hash']);
    for (const key of Object.keys(privacy)) if (!allowedPrivacy.has(key)) errors.push(`privacy.${key} is not allowed`);
    if (!visibilities.has(privacy.visibility)) errors.push('privacy.visibility is invalid');
    if (privacy.contains_raw_private_content !== false) errors.push('privacy.contains_raw_private_content must be false');
    if (privacy.visibility === 'private' && !nonempty(privacy.content_hash)) errors.push('private transitions require privacy.content_hash');
  }

  if (record.transition_kind === 'contradict') {
    if (record.to_claim?.lifecycle_state !== 'conflicted') errors.push('contradict requires to_claim.lifecycle_state=conflicted');
    if (record.provenance?.review_state !== 'conflict') errors.push('contradict requires provenance.review_state=conflict');
  }
  if (record.transition_kind === 'supersede' || record.transition_kind === 'retract') {
    if (record.from_claim?.epistemic_state !== 'superseded') errors.push(`${record.transition_kind} requires from_claim.epistemic_state=superseded`);
  }

  return { valid: errors.length === 0, errors };
}

if (process.argv[1] && process.argv[1].endsWith('validate-claim-transition.mjs') && process.argv[2]) {
  const record = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const result = validateClaimTransition(record);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}
