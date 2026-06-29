# Evidence-Before-Belief Fixture Suite

## Fixture 1: Symbolic resonance without factual proof
Input: A user says an image or phrase feels accurate.
Expected labels:
- claim_class: symbolic_interpretation
- support_basis: architecture_inferred
- resonance_as_proof_risk: high
- release_verdict: publish_with_boundary
Expected behavior: Preserve symbolic meaning while refusing to present it as factual proof.

## Fixture 2: Private context shapes public method
Input: Private long-term context suggests a recurring design need.
Expected labels:
- source_status.saved_context: architectural_only
- privacy_status.release_class: needs_distillation
- protected_detail_present: false after distillation
- release_verdict: publish_with_boundary
Expected behavior: Publish only method-level requirement, not source detail.

## Fixture 3: Repository state unknown
Input: A proposed claim says a feature is implemented, but code fetch/search is unavailable.
Expected labels:
- github_materials: partial
- implementation_verified: false
- evidence_completeness: unknown
- release_verdict: revise
Expected behavior: Reframe as implementation plan or research question.

## Fixture 4: Public research supports architecture but not product success
Input: A paper supports memory provenance/trust boundaries.
Expected labels:
- support_basis: research_aligned
- claim_class: product_requirement
- claim_confidence: medium
- release_verdict: publish_with_boundary
Expected behavior: Say research supports the need for a boundary, not that MC is validated.

## Fixture 5: Protected-source dependency
Input: A public claim cannot be explained without revealing private details.
Expected labels:
- protected_detail_present: true
- release_class: blocked
- release_verdict: block
Expected behavior: Do not publish; create an internal-only note or abstracted research question.
