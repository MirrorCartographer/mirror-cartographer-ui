# Workshop Spec — EvidenceBoundary Schema

Date: 2026-06-27

Status labels

- Source status: product specification derived from public-safe MC architecture review and current AI governance/privacy research.
- Claim status: implementation plan; not yet confirmed as deployed runtime code.
- Privacy status: public-safe abstraction; excludes raw transcripts and sensitive personal domains.
- Missingness: needs code integration, test fixtures, and UI copy.
- Revision reason: created to make evidence boundaries machine-readable rather than only prose-based.

## Purpose

`EvidenceBoundary` is a required metadata object for MC reflections, bridge verdicts, public artifacts, and research notes.

It states what the output can and cannot be used as evidence for.

## Schema draft

```ts
export type EvidenceLevel =
  | 'symbolic_signal'
  | 'user_recognized_signal'
  | 'recurring_internal_pattern'
  | 'product_hypothesis'
  | 'research_question'
  | 'evidence_supported_claim'
  | 'public_claim';

export type EvidenceBoundary = {
  boundary_id: string;
  source_status: string;
  claim_status: string;
  privacy_status: string;
  missingness: string;
  revision_reason?: string;
  allowed_evidence_for: string[];
  forbidden_evidence_for: string[];
  current_evidence_level: EvidenceLevel;
  requested_transition?: EvidenceLevel;
  transition_gate_required: boolean;
  transition_gate_id?: string;
  required_sources_for_upgrade: string[];
  contradiction_links?: string[];
  resonance_links?: string[];
  public_release_allowed: boolean;
  sensitive_domain_flags: {
    personal: boolean;
    household: boolean;
    health: boolean;
    animal_care: boolean;
    financial: boolean;
    location: boolean;
    relationship: boolean;
    credential: boolean;
    raw_transcript: boolean;
  };
};
```

## Runtime rules

1. Every reflection starts no higher than `symbolic_signal` unless external evidence is explicitly attached.
2. User feedback may update resonance, not factual certainty.
3. Repetition may update recurrence, not diagnosis or causation.
4. Public artifacts require `public_release_allowed: true` and all sensitive flags false.
5. Any evidence-level upgrade requires a TransitionGate record.
6. Missingness must remain visible until resolved.
7. Forbidden uses must be shown in plain language when the user is likely to overread the reflection.

## UI copy pattern

This reflection is useful as: [allowed_evidence_for]

It should not be treated as: [forbidden_evidence_for]

Current claim level: [current_evidence_level]

What would upgrade it: [required_sources_for_upgrade]

## Test fixtures needed

- symbolic-only reflection
- resonant but unverified reflection
- recurring motif without factual conclusion
- product hypothesis derived from symbolic pattern
- research-supported claim with citations
- blocked public artifact containing sensitive source material

## Acceptance criteria

- No public artifact can be emitted without boundary metadata.
- No resonance feedback can increase factual claim status.
- No symbolic state can be used as diagnosis, causation, or public truth without explicit external evidence and transition approval.
- The schema remains readable enough for nontechnical users.
