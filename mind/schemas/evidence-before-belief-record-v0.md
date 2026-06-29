# Evidence-Before-Belief Record v0

## Purpose
A privacy-safe record for deciding whether a candidate MC output may become a public artifact.

## Record fields

```yaml
record_id: string
timestamp_utc: string
artifact_path: string | null
source_status:
  file_library: available | unavailable | partial | not_used
  saved_context: architectural_only | not_used | blocked
  github_materials: available | unavailable | partial | not_used
  web_research: available | unavailable | partial | not_used
claim_status:
  claim_class: fact | inference | product_requirement | symbolic_interpretation | speculation | evaluation | implementation_plan
  claim_confidence: low | medium | high
  support_basis: source_bound | architecture_inferred | research_aligned | unverified
privacy_status:
  release_class: public_safe | internal_only | blocked | needs_distillation
  protected_detail_present: true | false
  protected_detail_classes_blocked:
    - personal
    - household
    - health
    - animal_care
    - financial
    - location
    - relationship
    - credential
    - raw_transcript
missingness:
  evidence_completeness: complete_enough | partial | stale | contradicted | unknown
  repo_state_known: true | false
  implementation_verified: true | false
revision_reason: string
belief_pressure:
  repetition_as_proof_risk: low | medium | high
  resonance_as_proof_risk: low | medium | high
  authority_overreach_risk: low | medium | high
release_verdict: publish | publish_with_boundary | quarantine | revise | block
```

## Rule
No public MC claim should bypass this record when it was shaped by private, mixed, stale, symbolic, or high-influence context.
