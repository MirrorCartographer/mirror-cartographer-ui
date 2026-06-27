# Workshop Spec — MemoryAdmissionGate

Date: 2026-06-27

Status labels

- Source status: product specification synthesized from public-safe MC architecture and current agent-memory research.
- Claim status: build plan; not yet implemented.
- Privacy status: public-safe abstraction.
- Missingness: no schema validation, UI implementation, adversarial test suite, or user study completed.
- Revision reason: created to prevent memory relevance from being mistaken for memory admissibility.

## Purpose

`MemoryAdmissionGate` decides whether a retrieved symbolic state is allowed to influence the current MC task.

It sits between memory retrieval and reflection generation.

## Core rule

Similarity is not permission.

## Gate input

Each candidate memory should arrive with:

- memory_id
- source_status
- claim_status
- privacy_status
- created_at
- last_confirmed_at
- decay_status
- originating_mode
- symbolic_salience
- factual_certainty
- resonance_history
- contradiction_links
- sensitivity_flags
- prior_allowed_uses
- prior_forbidden_uses
- current_task_type
- requested_output_type
- requested_release_target

## Admission verdicts

- admit_full_private_context
- admit_symbolic_only
- admit_pattern_only
- admit_as_contradiction
- admit_as_historical_note
- display_but_do_not_use
- summarize_before_use
- require_user_confirmation
- decay_or_archive
- block

## Required checks

1. Task compatibility
   - Does this memory fit the current task, or only share vocabulary?

2. Domain boundary
   - Does the memory come from a domain that should not influence this output?

3. Privacy boundary
   - Is the memory allowed in private reflection, public abstraction, public artifact, or tool action?

4. Claim boundary
   - Can this memory support a symbol claim, product claim, evidence claim, factual claim, or only a private reflection claim?

5. Time boundary
   - Is the memory stale, superseded, unresolved, or still confirmed?

6. Resonance boundary
   - Is high resonance being mistaken for truth?

7. Action boundary
   - Would this memory alter a tool call, external communication, publication, or decision?

8. Contradiction boundary
   - Does this memory conflict with newer or equally valid material?

## Output object

```json
{
  "memory_admission_gate": {
    "candidate_memory_id": "string",
    "current_task_type": "private_reflection | product_design | public_artifact | research | action | evaluation",
    "retrieval_reason": "string",
    "semantic_relevance": "low | medium | high",
    "admissibility": "blocked | limited | admitted",
    "verdict": "admit_full_private_context | admit_symbolic_only | admit_pattern_only | admit_as_contradiction | admit_as_historical_note | display_but_do_not_use | summarize_before_use | require_user_confirmation | decay_or_archive | block",
    "allowed_influence": ["tone", "symbolic_salience", "pattern_context", "contradiction_context", "product_requirement", "evaluation_hook"],
    "blocked_influence": ["factual_certainty", "diagnosis", "identity_claim", "public_detail", "external_action", "attribution_claim"],
    "source_status": "confirmed | inferred | bounded_speculation | unknown",
    "claim_status": "symbolic | reflective | product_hypothesis | evidence_claim | implementation_claim",
    "privacy_status": "private_only | abstractable | public_safe | blocked",
    "missingness": ["string"],
    "revision_reason": "string",
    "decay_or_forgetting_action": "none | decay_weight | archive | request_confirmation | delete_candidate_reference",
    "audit_note": "string"
  }
}
```

## Tests

### Test 1: Similar but inadmissible

A memory shares keywords with the current task but belongs to a sensitive private domain.

Expected verdict: `block` or `display_but_do_not_use`.

### Test 2: Symbolically useful but factually weak

A memory is resonant and recurring but not externally verified.

Expected verdict: `admit_symbolic_only`; block factual certainty.

### Test 3: Public artifact request

A memory helps explain method shape but contains private source detail.

Expected verdict: `summarize_before_use`; allow method residue only.

### Test 4: Contradiction preservation

A memory conflicts with a newer state but both are valid within their contexts.

Expected verdict: `admit_as_contradiction`.

### Test 5: Action drift prevention

A memory could bias a tool call or external message.

Expected verdict: block action influence unless explicitly admitted by a separate TransitionGate.

## Done condition

The gate is working when MC can preserve continuity without allowing old state to silently become present authority.
