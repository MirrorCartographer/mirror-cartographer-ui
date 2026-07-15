'use strict';

const { verifyGithubApiVersionPolicy } = require('./verifyGithubApiVersionPolicy.v1.cjs');
const { verifyPaginationProvenance } = require('./verifyPaginationProvenance.v1.cjs');

function verifyWorkflowEnumerationEvidence(input, now = new Date()) {
  const policy = verifyGithubApiVersionPolicy({
    api_version: input?.request?.api_version,
    policy_observed_at: input?.api_version_policy?.observed_at,
    source: input?.api_version_policy?.source
  }, now);

  if (!policy.verified) {
    return {
      schema_version: 1,
      classification: 'rejected',
      verified: false,
      reasons: policy.reasons.map(reason => `api_version_policy:${reason}`),
      api_version_policy: policy,
      pagination_provenance: null,
      head_sha: input?.request?.head_sha || null
    };
  }

  const pagination = verifyPaginationProvenance(input);
  const reasons = pagination.verified
    ? []
    : pagination.reasons.map(reason => `pagination_provenance:${reason}`);

  return {
    schema_version: 1,
    classification: reasons.length ? 'rejected' : 'workflow_enumeration_evidence_verified',
    verified: reasons.length === 0,
    reasons,
    api_version_policy: policy,
    pagination_provenance: pagination,
    head_sha: pagination.head_sha
  };
}

module.exports = { verifyWorkflowEnumerationEvidence };
