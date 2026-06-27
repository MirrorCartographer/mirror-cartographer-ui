# Workshop Spec — TransitionGate

Date: 2026-06-27

Status labels

- Source status: product specification derived from public-safe MC architecture notes and current external research scan.
- Claim status: implementation plan, not completed code.
- Privacy status: public-safe abstraction; no raw private examples included.
- Missingness: needs schema implementation, UI design, automated tests, and adversarial review.
- Revision reason: added to operationalize the boundary between symbolic reflection and outward action.

## Purpose

`TransitionGate` decides whether a captured MC state can move into another system surface.

It protects three things at once:

- symbolic specificity
- evidence discipline
- privacy boundaries

## Inputs

- `state_id`
- `state_summary_public_safe`
- `source_status`
- `claim_status`
- `privacy_status`
- `missingness`
- `revision_reason`
- `requested_transition`
- `target_surface`
- `evidence_required`
- `consent_requirement`
- `allowed_payload`
- `blocked_payload`

## Transition types

- `reflection_to_private_memory`
- `reflection_to_public_method`
- `reflection_to_research_question`
- `reflection_to_product_requirement`
- `reflection_to_implementation_task`
- `reflection_to_external_action`
- `reflection_to_no_save`

## Gate verdicts

- `allow`
- `allow_abstracted`
- `allow_with_evidence_note`
- `hold_for_review`
- `private_only`
- `discard`

## Required checks

1. Source boundary
   - Is the state derived from direct user content, model synthesis, external research, code, or mixed sources?

2. Claim boundary
   - Is the state metaphor, observation, product hypothesis, research claim, implementation claim, or evaluation result?

3. Privacy boundary
   - Does the state contain private details, sensitive content, or raw transcript residue?

4. Evidence boundary
   - What would make the claim stronger, weaker, or invalid?

5. Action boundary
   - What changes if this becomes an issue, file, public note, product requirement, or external action?

## Output object

```json
{
  "transition_gate": {
    "state_id": "string",
    "requested_transition": "reflection_to_public_method",
    "target_surface": "github_mind",
    "verdict": "allow_abstracted",
    "source_status": "mixed: private architecture context + public research",
    "claim_status": "product hypothesis",
    "privacy_status": "public-safe abstraction only",
    "missingness": "not implemented or user-tested",
    "revision_reason": "boundary protocol added after provenance work",
    "allowed_payload": ["method", "schema", "evaluation criteria"],
    "blocked_payload": ["raw transcript", "personal example", "identifying details"],
    "evidence_required": ["privacy review", "implementation test", "user evaluation"],
    "next_action": "create public-safe product requirement"
  }
}
```

## UI implication

MC should show the user which layer is moving:

- meaning layer
- memory layer
- method layer
- research layer
- product layer
- action layer

The user should be able to see when the system is preserving a private state versus abstracting it into a reusable public method.

## Test plan

Run the same symbolic input through three paths:

1. no gate
2. source-status labels only
3. full TransitionGate

Compare:

- preservation of symbolic specificity
- correctness of claim labels
- boundary safety
- usefulness of resulting product requirement
- user trust and control
