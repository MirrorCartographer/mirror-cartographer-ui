'use strict';

const { createHash } = require('node:crypto');
const { buildProgrammedStageReceipt } = require('./buildProgrammedStageReceipt.v1.cjs');

function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function sha256CanonicalJson(value) {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

/**
 * Produces a fail-closed, operations-only programmed-stage receipt bound to
 * both an exact source commit and the canonical repertory content. It does not
 * claim deployment, runtime activation, browser execution, audio playback, or
 * physical-device verification.
 */
function buildCommitBoundProgrammedStageReceipt(repertory, date, sourceCommit) {
  if (typeof sourceCommit !== 'string' || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error('sourceCommit must be a lowercase 40-character commit SHA');
  }

  const receipt = buildProgrammedStageReceipt(repertory, date, {
    source_commit: sourceCommit,
  });

  return Object.freeze({
    ...receipt,
    evidence_class: 'commit_and_repertory_bound_programmed_stage_identity_only',
    repertory_sha256: sha256CanonicalJson(repertory),
    exact_commit_bound: true,
    repertory_content_bound: true,
  });
}

module.exports = {
  buildCommitBoundProgrammedStageReceipt,
  canonicalize,
  sha256CanonicalJson,
};
