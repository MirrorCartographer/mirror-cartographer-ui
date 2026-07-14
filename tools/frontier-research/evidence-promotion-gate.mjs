import { verifyRetainedRawOutputBinding } from './retained-raw-output-binding.mjs';
import { verifyIndependentExecutionProvenance } from './execution-provenance-binding.mjs';
import { validateEvidenceTemporalCoherence } from './evidence-temporal-coherence.mjs';
import { validateEvidenceObservationWindow } from './evidence-observation-window.mjs';

function rejected(stage, result) {
  return { verified: false, reason: 'evidence_promotion_rejected', failed_stage: stage, gate_result: result };
}

export async function validateEvidencePromotion(input, { cwd = process.cwd() } = {}) {
  const retained = await verifyRetainedRawOutputBinding(input, { cwd });
  if (!retained.verified) return rejected('retained_raw_output_binding', retained);

  const provenance = verifyIndependentExecutionProvenance(input);
  if (!provenance.verified) return rejected('independent_execution_provenance', provenance);

  const temporal = validateEvidenceTemporalCoherence(input);
  if (!temporal.verified) return rejected('temporal_coherence', temporal);

  const observation = validateEvidenceObservationWindow(input);
  if (!observation.verified) return rejected('observation_window', observation);

  return {
    verified: true,
    reason: 'evidence_promotion_ready',
    commit_sha: input.commit_sha,
    gates: { retained, provenance, temporal, observation },
    claim_boundary: {
      permits_manifest_promotion: true,
      proves_authenticated_execution: false,
      proves_clock_authenticity: false,
      proves_repository_quiescence: false,
      proves_provider_consistency: false
    }
  };
}
