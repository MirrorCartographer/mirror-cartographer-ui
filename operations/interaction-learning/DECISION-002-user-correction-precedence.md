# DECISION-002: User Correction Precedence and Supersession

Status: accepted
Scope: interaction-learning and continuity-mining pipelines

## Decision

An explicitly exported `user_correction` event has precedence over any machine-generated interpretation that it directly references. It does not delete the original evidence. It adds a supersession edge so the evidence history remains auditable.

A correction may change only a bounded interaction claim or artifact-local label. It may not create a psychological, diagnostic, identity, or motive claim.

## Required correction shape

```json
{
  "type": "user_correction",
  "at": "ISO-8601",
  "target": "claim-or-event-id",
  "value": {
    "operation": "supersede",
    "replacementClass": "observed_interaction|history_supported_inference|testable_hypothesis|rejected_inference|unknown",
    "replacementCode": "bounded-machine-readable-code"
  },
  "context": {
    "reasonCode": "incorrect|ambiguous|not_applicable|missing_context|other",
    "appliesWithinArtifact": true
  }
}
```

Free-text correction content is not ingested by this adapter. A separate explicit-feedback path may accept user-authored text under its own privacy and retention contract.

## Resolution rules

1. Validate consent and provenance before resolving a correction.
2. Require the referenced target to exist in the same exported artifact unless a later cross-artifact schema explicitly permits otherwise.
3. Preserve the original claim with `status: superseded`.
4. Add `supersededByEventId` and `supersededAt`.
5. Materialize the replacement as a new claim carrying the correction event as evidence.
6. Exclude superseded claims from active design inference counts.
7. Retain superseded claims for audit, contradiction analysis, rollback, and architecture-drift review.
8. Deduplicate corrections by normalized correction-event identity.
9. When two valid corrections conflict, mark the target `correction_conflict` and emit no active replacement until another explicit user-owned artifact resolves it.
10. Never interpret correction frequency as temperament, dissatisfaction, confusion, or another private internal state.

## Claim classes

- `observed_interaction`: the correction event was explicitly exported.
- `history_supported_inference`: repeated correction codes across independent consented artifacts may indicate a component-level mismatch, subject to alternatives, confidence, and limits.
- `testable_hypothesis`: a control, label, default, or navigation structure may be producing the corrected mismatch.
- `rejected_inference`: corrections establish user psychology or motive.
- `unknown`: whether the correction reflects a local mistake, interface ambiguity, changed intent, accessibility workaround, stale artifact, or missing context.

## Durable graph updates

### Semantic grammar

Add relations:

- `supersedes(claim, claim)`
- `corrects(event, claim|event)`
- `correction_reason(event, bounded_reason_code)`
- `active_claim(claim, boolean)`

### Component graph

```text
Exported artifact
  -> consent validator
  -> schema validator
  -> correction target resolver
  -> conflict detector
  -> claim supersession ledger
  -> active evidence view
  -> adversarial checkpoint
  -> decision / experiment queue
```

### Accessibility backlog

- Present the exact claim or event being corrected.
- Make correction possible by keyboard and screen reader.
- Do not require free text.
- Explain that the original record remains in an audit history.
- Provide undo before submission.
- Expose conflict state without forcing a choice.

## Peer-trigger loop

Emit one deduplicated trigger per tuple:

```text
(schemaVersion, componentId, replacementCode, experimentRevision)
```

Routing:

- repeated label corrections -> semantic-grammar team
- repeated navigation corrections -> accessibility-navigation team
- repeated default/value corrections -> composition-design team
- correction conflicts -> continuity-governance team

A trigger must cite evidence IDs and must not contain direct identifiers or free text.

## Adversarial checkpoints

### Before learned knowledge is committed

Check target existence, explicit consent, source class, duplicate correction identity, stale evidence, cross-artifact leakage, forbidden fields, and whether the proposed replacement exceeds the artifact's semantic scope.

### After implementation

Verify that superseded claims are absent from active inference counts, retained in audit output, reversible, and not silently deleted.

### During verification

Inject duplicate corrections, conflicting corrections, stale corrections, missing targets, forbidden private fields, corrections to psychological claims, and corrections whose replacement exceeds the original evidence.

## Alternatives considered

- Delete corrected claims: rejected because it destroys provenance and contradiction evidence.
- Treat corrections as ordinary events only: rejected because downstream inference could continue counting known-invalid claims.
- Give every correction global precedence: rejected because artifact-local context may not generalize across sessions.

## Limits

This decision governs only explicitly exported or submitted correction artifacts. It does not establish that a user saw, understood, or rejected any unexported claim. It does not establish motive or behavior outside the artifact.

## Rollback

Disable correction resolution and restore the pre-resolution active evidence view. Remove supersession edges created under this decision while retaining the immutable original exported artifacts. Recompute all affected interaction-derived claims from the retained artifacts.

## Next falsifiable experiment

Hypothesis: showing a bounded correction control beside generated interaction summaries reduces repeated correction of the same component-level label without reducing export completion.

Reject the hypothesis if, after deduplication and control for artifact version, the repeated-correction rate does not fall or export completion materially declines.