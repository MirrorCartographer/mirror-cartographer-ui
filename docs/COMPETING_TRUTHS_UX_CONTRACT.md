# Competing Truths: UI Contract

**Status:** Proposed UX contract. It is not evidence that the current UI implements these behaviors.

## Required visible states

Every material claim should be inspectable as a versioned card or node with:
- exact statement and scope;
- claim kind (observation, interpretation, hypothesis, decision, symbolic);
- status (unreviewed, supported, disputed, refuted, superseded, retracted, unknown);
- source list and whether each source is available, unavailable, not collected, or redacted;
- valid-time interval and recorded time shown separately;
- perspective/reader and known limitations;
- relations to alternatives, contradictions, qualifications, and superseding versions;
- revision reason, author/authority, and correction history.

## Interaction rules

1. Do not silently pick one version when a contradiction is present.
2. Do not present competing versions as equally supported merely because both exist.
3. Allow a user to compare evidence side by side, mark a source unavailable, correct a statement, add an alternative, and explain a correction.
4. A correction creates a new version or explicit revision relation; it must not erase prior history invisibly.
5. Clearly label superseded claims as historical. Do not use them as current context unless the user asks for historical reconstruction.
6. Distinguish “no evidence found” from “evidence of absence.”
7. Let users mark an interpretation as wrong without having to replace it with a fully formed explanation.
8. Show what changes downstream when a claim is corrected: maps, summaries, memory candidates, action recommendations, and public exports.
9. Private data remains private by default. Public export requires a separate privacy review and must not inherit consent from a private reflection.
10. Provide a low-complexity view and keyboard/screen-reader path; visual proximity, color, animation, or symbols cannot be the only way to express evidence status.

## Avoiding false coherence

A graph edge is a claim about a relationship, not decoration. Each meaningful edge must have a relation type, provenance, and rationale. Spatial proximity is not causality. Symbolic resonance is not factual proof. Repeated interpretation is not independent corroboration when all repetitions derive from the same source.

## User agency and review

The user may reject an interpretation, preserve multiple possibilities, defer a decision, or ask to see only observations. The interface must not pressure the user to resolve uncertainty merely to complete a flow.

## Acceptance tests

Use synthetic data to verify:
- contradictory interpretations remain visible side by side;
- source strength/availability is not hidden;
- valid time and recorded time remain distinct;
- unknown/not-collected is not rendered as false/zero/absent;
- corrections preserve prior versions and explain downstream changes;
- superseded versions do not appear as current without an explicit historical mode;
- export filters private content independently of visual sharing settings.

See the main repository's [Competing Truths and Temporal Continuity Protocol](https://github.com/MirrorCartographer/MirrorCartographer/blob/main/architecture/COMPETING_TRUTHS_AND_TEMPORAL_CONTINUITY.md) for the governing model.
