'use strict';

const { verifyGithubApiVersionPolicy } = require('./verifyGithubApiVersionPolicy.v1.cjs');
const { verifyGithubApiResponseVersion } = require('./verifyGithubApiResponseVersion.v1.cjs');
const { verifyPaginationProvenance } = require('./verifyPaginationProvenance.v1.cjs');

function rejected(input, policy, responseVersion, reasons) {
  return {
    schema_version: 1,
    classification: 'rejected',
    verified: false,
    reasons,
    api_version_policy: policy,
    api_response_version: responseVersion,
    pagination_provenance: null,
    head_sha: input?.request?.head_sha || null
  };
}

function verifyWorkflowEnumerationEvidence(input, now = new Date()) {
  const policy = verifyGithubApiVersionPolicy({
    api_version: input?.request?.api_version,
    policy_observed_at: input?.api_version_policy?.observed_at,
    source: input?.api_version_policy?.source
  }, now);

  if (!policy.verified) {
    return rejected(
      input,
      policy,
      null,
      policy.reasons.map(reason => `api_version_policy:${reason}`)
    );
  }

  const responseVersion = verifyGithubApiResponseVersion({
    request: input?.request,
    response: input?.response
  });

  if (!responseVersion.verified) {
    return rejected(
      input,
      policy,
      responseVersion,
      responseVersion.reasons.map(reason => `api_response_version:${reason}`)
    );
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
    api_response_version: responseVersion,
    pagination_provenance: pagination,
    head_sha: pagination.head_sha
  };
}

module.exports = { verifyWorkflowEnumerationEvidence };