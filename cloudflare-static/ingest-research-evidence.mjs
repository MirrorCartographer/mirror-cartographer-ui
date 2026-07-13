import { verifyPagesEvidence } from './verify-pages-evidence.mjs';
import { classifyReportedObject } from './verify-reported-github-object.mjs';

function reject(code, detail, object_results = []) {
  return {
    schema_version: 1,
    accepted: false,
    code,
    detail,
    object_results,
    promotion_permitted: false,
    deployment_claim_permitted: false,
    scientific_truth_established: false
  };
}

export function ingestResearchEvidence(input) {
  if (!input || typeof input !== 'object') {
    return reject('INVALID_INPUT', 'Evidence packet must be an object.');
  }
  if (!Array.isArray(input.reported_objects)) {
    return reject('REPORTED_OBJECTS_MISSING', 'reported_objects must be an array.');
  }

  const object_results = input.reported_objects.map((entry) => classifyReportedObject(entry ?? {}));
  const failed_index = object_results.findIndex((result) => result.verified !== true);
  if (failed_index !== -1) {
    return reject(
      'REPORTED_OBJECT_UNVERIFIED',
      `Reported object at index ${failed_index} is not verified.`,
      object_results
    );
  }

  const pages_result = verifyPagesEvidence(input.pages_evidence);
  if (pages_result?.ok !== true) {
    return reject(
      'PAGES_EVIDENCE_REJECTED',
      pages_result?.code ?? 'Pages evidence verifier rejected the packet.',
      object_results
    );
  }

  return {
    schema_version: 1,
    accepted: true,
    code: 'RESEARCH_EVIDENCE_ACCEPTED',
    object_results,
    pages_result,
    promotion_permitted: true,
    deployment_claim_permitted: true,
    scientific_truth_established: false
  };
}
