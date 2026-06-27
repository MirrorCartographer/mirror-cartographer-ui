# Workshop Spec — ContextReleaseProfile

Date: 2026-06-27

Status labels

- Source status: implementation plan derived from public-safe MC architecture inspection and external agent-memory/privacy research.
- Claim status: schema proposal, not production code.
- Privacy status: public-safe abstraction; private source categories are named only as blocked classes, not described.
- Missingness: needs TypeScript type, UI flow, persistence policy, tests, and red-team prompts.
- Revision reason: added because prior MC mind entries define provenance/evidence/transition objects but not the specific release decision object.

## Purpose

`ContextReleaseProfile` decides how a preserved MC state may leave its original context.

It prevents this failure:

> Because MC remembered something, MC treats it as reusable everywhere.

## Proposed object

```ts
export type ReleaseTarget =
  | 'private_self'
  | 'ai_coauthor'
  | 'professional_prep'
  | 'bounded_collaborator'
  | 'public_artifact'
  | 'github_mind'
  | 'agent_tool_action';

export type AbstractionLevel =
  | 'raw_blocked'
  | 'specific_private'
  | 'category_only'
  | 'method_residue'
  | 'public_pattern'
  | 'implementation_requirement';

export type ReleaseVerdict =
  | 'allow'
  | 'allow_with_redaction'
  | 'allow_method_only'
  | 'require_user_confirmation'
  | 'block';

export interface ContextReleaseProfile {
  id: string;
  created_at: string;
  source_status: string;
  claim_status: string;
  privacy_status: string;
  missingness: string[];
  revision_reason?: string;

  source_context_class:
    | 'private_reflection'
    | 'project_architecture'
    | 'uploaded_artifact'
    | 'public_research'
    | 'github_material'
    | 'mixed_context';

  release_target: ReleaseTarget;
  receiver_role?: string;
  transmission_principle:
    | 'self_continuity'
    | 'method_publication'
    | 'evidence_review'
    | 'professional_preparation'
    | 'collaboration'
    | 'implementation'
    | 'agent_execution';

  abstraction_level: AbstractionLevel;
  release_verdict: ReleaseVerdict;

  blocked_detail_classes: Array<
    | 'personal_identity_detail'
    | 'household_detail'
    | 'health_detail'
    | 'animal_care_detail'
    | 'financial_detail'
    | 'location_detail'
    | 'relationship_detail'
    | 'credential_detail'
    | 'raw_transcript_detail'
  >;

  allowed_payload_classes: Array<
    | 'abstract_method'
    | 'source_boundary_note'
    | 'product_requirement'
    | 'research_question'
    | 'evaluation_criterion'
    | 'privacy_safe_index'
    | 'implementation_plan'
  >;

  required_checks: {
    state_provenance: boolean;
    evidence_boundary: boolean;
    transition_gate: boolean;
    public_safe_abstraction_index: boolean;
    user_confirmation_required: boolean;
  };

  downstream_action_allowed: boolean;
  downstream_action_limits?: string[];
  audit_note: string;
}
```

## Runtime placement

Use after source retrieval and before output generation.

Pipeline:

1. Retrieve/inspect source.
2. Classify source context.
3. Apply `StateProvenance`.
4. Apply `EvidenceBoundary`.
5. Apply `TransitionGate`.
6. Generate `PublicSafeAbstractionIndex` if external/public output is requested.
7. Generate `ContextReleaseProfile`.
8. Only then produce the artifact, GitHub note, collaborator packet, or tool action.

## Required tests

- Raw transcript cannot enter public artifact.
- Private source can generate public method residue.
- Symbolic resonance cannot permit external action by itself.
- Professional-prep output preserves uncertainty and avoids unsupported diagnosis/claims.
- GitHub mind writes include source, claim, privacy, missingness, and revision labels.
- Agent tool action is blocked unless action limits and receiver context are explicit.

## Minimal UI requirement

Before external release, show a compact release card:

- source class
- target
- abstraction level
- blocked detail classes
- allowed payload classes
- verdict
- what this output is allowed to do

## Evaluation metric

`privacy_specificity_ratio`:

A successful public artifact should retain high method specificity while reducing private-source specificity to zero.

Target for public GitHub mind entries:

- private-source specificity: 0
- method specificity: high
- evidence-boundary clarity: high
- action-boundary clarity: high
