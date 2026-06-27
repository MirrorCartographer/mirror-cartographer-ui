# Workshop Spec — ContradictionTriage

Date: 2026-06-27

Status labels

- Source status: synthesized from MC public-safe architecture materials and current agent-memory/privacy research.
- Claim status: product requirement and schema proposal.
- Privacy status: public-safe; no raw private examples, identities, transcripts, household details, health details, animal-care details, financial details, location details, relationship details, or credentials.
- Missingness: not implemented in runtime; requires evaluator tests and consent-bound session trials.
- Revision reason: created to formalize how MC should handle unresolved contradiction before memory, action, evidence, or publication.

## Purpose

`ContradictionTriage` decides what an unresolved contradiction is allowed to influence.

It does not solve every contradiction.

It prevents unresolved contradiction from silently becoming certainty, action permission, public claim, or memory drift.

## Schema draft

```json
{
  "contradiction_triage": {
    "id": "ct_<id>",
    "created_at": "<iso8601>",
    "source_status": "private_source_abstracted | public_source | user_confirmed | model_inferred | external_evidence | mixed",
    "claim_status": "symbolic | experiential | factual | design_hypothesis | implementation_claim | evidence_claim | action_claim",
    "privacy_status": "private_only | public_safe_abstraction | blocked_from_release | needs_review",
    "missingness": [
      "evidence_missing",
      "user_confirmation_missing",
      "time_depth_missing",
      "counterexample_missing",
      "implementation_missing",
      "consent_scope_missing"
    ],
    "revision_reason": "why this triage object exists or changed",
    "claim_a": {
      "summary": "public-safe summary only",
      "claim_type": "symbolic | factual | experiential | design | action | evidence",
      "confidence": "low | medium | high | unknown"
    },
    "claim_b": {
      "summary": "public-safe summary only",
      "claim_type": "symbolic | factual | experiential | design | action | evidence",
      "confidence": "low | medium | high | unknown"
    },
    "conflict_type": "meaning_vs_fact | resonance_vs_evidence | privacy_vs_utility | memory_vs_consent | action_vs_reflection | public_vs_private | design_vs_validation | unknown",
    "triage_verdict": "hold_open | split_lanes | evidence_review | salience_only | memory_quarantine | public_abstraction | product_requirement | reject_do_not_use",
    "allowed_influence": {
      "reflection": true,
      "memory_retrieval": false,
      "factual_confidence": false,
      "public_release": false,
      "action_recommendation": false,
      "product_design": true,
      "research_question": true
    },
    "blocked_influence": [
      "diagnosis",
      "identity_claim",
      "attribution_claim",
      "external_proof",
      "automated_action",
      "public_detail_release"
    ],
    "required_next_check": [
      "source_boundary_check",
      "evidence_boundary_check",
      "transition_gate_check",
      "memory_admission_check",
      "effect_boundary_check",
      "public_safe_abstraction_check"
    ],
    "bridge_note": "short reason for verdict",
    "review_after": "event | time | new_evidence | user_feedback | implementation_test | never"
  }
}
```

## Runtime rule

No contradiction may increase factual certainty unless it passes an evidence review.

No contradiction may influence public release unless it passes public-safe abstraction.

No contradiction may influence action unless it passes TransitionGate and EffectBoundary checks.

No contradiction may influence future memory solely because it is similar, repeated, or emotionally charged.

## UI requirement

When a contradiction appears, MC should show a simple user-facing state:

- still open,
- split into lanes,
- needs evidence,
- symbolic only,
- saved but restricted,
- safe to abstract,
- turned into a product/test idea,
- not safe to use.

## Evaluation criteria

A `ContradictionTriage` implementation should be tested on:

- false certainty reduction,
- privacy leakage reduction,
- preservation of useful ambiguity,
- user comprehension,
- downstream action safety,
- memory drift resistance,
- public artifact safety,
- implementation usefulness.
