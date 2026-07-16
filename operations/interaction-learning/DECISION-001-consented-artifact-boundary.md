# Decision 001 — Consented Interaction Artifact Boundary

Status: implemented on `preview`

## Decision

Interaction learning may consume only artifacts that a user explicitly exports or submits with `consent.interactionLearning=true`.

A single artifact may produce only `observed_interaction` claims. Cross-artifact claims must be separately constructed as `history_supported_inference`, include alternatives, confidence below 1, limits, and supporting event identifiers. Psychological motive, diagnosis, identity, and unexported telemetry are outside scope.

## Accepted event grammar

- `composition_exported`
- `feedback_submitted`
- `pattern_saved`
- `navigation_selected`
- `mood_selected`
- `tempo_changed`
- `artifact_replayed`
- `artifact_erased`
- `artifact_returned`
- `user_correction`

## Adversarial checkpoints

Before knowledge commit:
- reject absent consent;
- reject direct identifiers, raw free text, transcripts, device fingerprints, psychological labels, and diagnoses;
- deduplicate identical events using stable SHA-256 identifiers;
- label export-selection bias as unknown.

After implementation:
- run contract cases for duplicate removal, consent failure, privacy leakage, valid bounded inference, and overclaim rejection.

During verification:
- treat contradictory behavior as unresolved until multiple consented artifacts exist;
- reject stale evidence from active design decisions unless recency is recorded;
- prevent architecture drift by preserving the five claim classes exactly.

## Durable graph effects

- Semantic grammar gains explicit interaction event verbs and five claim classes.
- Component graph gains `consented-artifact -> normalizer -> deduplicated-evidence -> labeled-claims`.
- Accessibility backlog must test whether export/consent controls are keyboard, screen-reader, and reduced-cognition accessible.
- Future composition experiments may compare replay/erase/return behavior only after export and must not interpret motive.

## Rollback

Delete:
- `src/interaction-learning/interaction-learning-adapter.mjs`
- `scripts/interaction-learning-adapter.test.mjs`
- this decision file

No stored user data migration is required because this change introduces a normalizer and contract only; it does not activate collection or persistence.
