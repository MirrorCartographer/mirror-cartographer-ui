# Workshop Spec — EffectBoundary / AmplificationGate

Date: 2026-06-27

Status labels

- Source status: product specification derived from public-safe MC architecture, prior boundary objects, and current external research scan.
- Claim status: implementation plan and evaluation design.
- Privacy status: public-safe abstraction; no raw personal source material included.
- Missingness: schema not implemented; no automated tests; no production telemetry.
- Revision reason: created to prevent symbolic resonance from silently becoming evidence, memory, publication, persuasion, or action.

## Purpose

`EffectBoundary` records what a Mirror Cartographer reflection is allowed to cause next.

`AmplificationGate` is the decision layer that decides whether the effect may be reused, stored, exported, published, or operationalized.

## Core rule

A reflection's effect is not its evidence.

High resonance can update symbolic salience only after boundary checks. It cannot automatically update factual certainty, public publishability, action permission, diagnosis, identity claim, or attribution.

## EffectBoundary object

Fields:

- `effect_id`: stable identifier.
- `artifact_id`: reflection, return artifact, map, note, or generated object being evaluated.
- `source_status`: public-safe / private-derived / mixed / external-source-bound / unknown.
- `claim_status`: metaphor / design idea / hypothesis / observation / factual claim / speculative synthesis / evaluation result.
- `privacy_status`: public-safe / private-context-derived / sensitive-domain-adjacent / blocked.
- `missingness`: what is not known, not tested, or not safely inferable.
- `revision_reason`: why this boundary was created or changed.
- `felt_effect`: user-reported or system-inferred resonance intensity; never treated as proof.
- `symbolic_effect`: motifs, metaphors, roles, or patterns strengthened.
- `memory_effect`: none / one-session-only / user-confirmed persistence / aggregate-only / blocked.
- `public_effect`: no-release / abstract-method-only / source-bound citation-only / publishable.
- `action_effect`: no-action / reflective-prompt-only / research-needed / human-review-required / allowed.
- `evidence_effect`: none / anecdotal / source-backed / experimentally tested / externally validated.
- `amplification_risk`: low / medium / high / blocked.
- `allowed_updates`: list of state updates permitted.
- `blocked_updates`: list of state updates forbidden.
- `required_bridge`: EvidenceBoundary / TransitionGate / ContextReleaseProfile / SymbolicFlowLedger / human review / none.

## AmplificationGate verdicts

- `reflect_only`: safe as a private or local reflection; no downstream persistence.
- `store_private`: may be retained in private state with source and privacy labels.
- `aggregate_only`: may contribute to pattern statistics without carrying raw payload.
- `abstract_for_public`: may become method residue after private detail removal.
- `research_before_reuse`: requires external source check before reuse.
- `human_review_required`: needs deliberate review before action or publication.
- `publishable_method`: safe as abstract architecture, schema, evaluation criteria, or implementation plan.
- `blocked`: do not reuse, publish, persist, or operationalize.

## Required checks before amplification

1. Does the artifact contain raw private material?
2. Does it imply factual certainty beyond evidence?
3. Does it touch sensitive domains?
4. Does it convert metaphor into diagnosis, proof, identity, or causation?
5. Does it preserve contradiction and missingness?
6. Does it identify allowed and forbidden downstream effects?
7. Can the public method be evaluated without the private source?
8. Is the proposed action reversible, reviewable, and source-bound?

## Integration points

- Before memory update: run `EffectBoundary.memory_effect`.
- Before export: run `AmplificationGate`.
- Before public artifact creation: require `public_effect` = `abstract-method-only` or `publishable`.
- Before real-world action: require `action_effect` = `human-review-required` or `allowed`, plus appropriate EvidenceBoundary.
- Before evaluation: log `evidence_effect` and `missingness`.

## Evaluation criteria

Measure whether this layer reduces:

- private residue leakage.
- unsupported certainty.
- metaphor-to-action drift.
- identity overfitting from isolated resonance.
- public artifacts that depend on hidden private context.

Measure whether it preserves:

- usefulness of reflection.
- aesthetic / symbolic specificity.
- contradiction.
- user agency.
- research-testability.
- implementation clarity.

## First test

Take the same symbolic reflection and route it three ways:

1. no boundary layer.
2. existing source / claim / privacy labels only.
3. full EffectBoundary + AmplificationGate.

Compare privacy leakage, claim inflation, action escalation, method clarity, and user-understandable output.
