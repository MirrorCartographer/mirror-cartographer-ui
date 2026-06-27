# Workshop Spec — PublicSafeAbstractionIndex

Date: 2026-06-27

Status labels

- Source status: product specification derived from public-safe MC context review, existing GitHub mind entries, and external provenance/privacy research.
- Claim status: implementation plan; not yet deployed runtime code.
- Privacy status: public-safe abstraction; designed specifically to prevent raw private-source exposure.
- Missingness: needs TypeScript integration, privacy tests, reviewer workflow, and release UI copy.
- Revision reason: created because prior objects defined source, transition, resonance, and evidence boundaries but did not yet define a reusable publication-safe abstraction index.

## Purpose

`PublicSafeAbstractionIndex` records the reusable method that remains after private MC source material is transformed into public-safe architecture knowledge.

It is a release-layer object.

It does not store raw private content.

## Schema draft

```ts
export type SourceClass =
  | 'chat_summary'
  | 'saved_context_summary'
  | 'file_architecture_excerpt'
  | 'github_mind_entry'
  | 'external_research'
  | 'implementation_observation'
  | 'synthetic_test_case';

export type AbstractionMove =
  | 'generalized_private_detail'
  | 'removed_identifier'
  | 'removed_sensitive_domain'
  | 'converted_example_to_method'
  | 'converted_story_to_requirement'
  | 'converted_resonance_to_signal'
  | 'converted_claim_to_question'
  | 'split_symbolic_from_factual'
  | 'downgraded_evidence_level';

export type PublicSafeAbstractionRecord = {
  abstraction_id: string;
  created_at: string;
  source_status: string;
  claim_status: string;
  privacy_status: string;
  missingness: string;
  revision_reason?: string;
  source_classes_used: SourceClass[];
  raw_source_retained: false;
  abstraction_moves: AbstractionMove[];
  sensitive_domains_removed: {
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
  surviving_method_pattern: string;
  public_product_requirement?: string;
  research_question?: string;
  evaluation_criteria: string[];
  evidence_boundary_id?: string;
  transition_gate_id?: string;
  reviewer_can_evaluate_without_private_context: boolean;
  release_verdict: 'publishable' | 'revise' | 'park' | 'blocked';
  blocked_reason?: string;
};
```

## Required checks

1. Raw source retained must always be `false` for public records.
2. At least one abstraction move must be listed.
3. Sensitive domains removed must be explicit, not implied.
4. The surviving method pattern must be understandable without private context.
5. Public product requirements must be phrased as implementation behavior, not life story.
6. Research questions must not require private examples to validate.
7. Release verdict must be blocked if a reviewer cannot evaluate the record without private context.

## UI copy pattern

This public artifact was derived from private/source-bound material, but the private material is not included.

What survives publicly: [surviving_method_pattern]

What was removed: [sensitive_domains_removed]

What changed during abstraction: [abstraction_moves]

What this can support: [public_product_requirement or research_question]

Release verdict: [release_verdict]

## First test fixture

Input class: private symbolic interaction summary.

Allowed output: method note stating that symbolic-state learning should be converted into source-class, claim-boundary, privacy-transformation, and evaluation records.

Blocked output: any anecdote, diagnosis, household detail, animal-care fact, financial fact, location trail, credential detail, or raw transcript quote.
