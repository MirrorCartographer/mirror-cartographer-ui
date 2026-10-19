# Source-Origin Lens: Claim Author Is Not Evidence Authority

**Status:** interaction specification only; no production behavior or measured result is claimed.  
**Research counterpart:** [Authorship-Source Invariance](https://github.com/MirrorCartographer/MirrorCartographer/blob/research/author-source-invariance-20261019/research/hypothesis-tests/2026-10-19-authorship-source-invariance.md).  
**Related MC work:** [Source Authority and Self-Continuity](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/main/mind/continuity/2026-07-11-source-authority-and-self-continuity.md), [Revision Ledger](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/correction-ledger-20261017/docs/REVISION_LEDGER.md), and [Identity Transition Atlas](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/identity-transition-atlas-20261018/docs/IDENTITY_TRANSITION_ATLAS.md).

## Purpose

The Source-Origin Lens makes one distinction visible:

**Who wrote the sentence is not necessarily the source that supports the claim.**

A model may restate a user statement, summarize an external document, or repeat its own earlier output. Those are different authorship histories, but the evidence behind the proposition must be evaluated separately.

The UI is an experiment and adjudication surface, not a detector of subjective identity or an authority oracle.

## Layout

### 1. Claim card

Display the proposition once, with its exact text and stable claim ID. Show the author role as a separate badge:

- assistant-authored wording;
- user-authored wording;
- neutral ledger wording.

When comparing conditions, the exact proposition and canonical evidence reference must be visible and identical.

### 2. Evidence origin rail

Show fields independently:

- canonical source ID and link;
- source-authority class;
- source timestamp and observation timestamp;
- source status: current, superseded, conflicting, unknown, or not applicable;
- whether the displayed text is an original record, a quotation, or a paraphrase.

Do not infer source authority from the assistant/user role badge. Do not silently upgrade a paraphrase into an original record.

### 3. Challenge and update lane

Show the later record, its provenance, and the explicit reason it does or does not supersede the prior claim. Preserve unresolved conflicts. A newer timestamp alone does not guarantee stronger evidence.

### 4. Matched-condition comparison

Present assistant-authored, user-authored, and neutral-record conditions side by side. Keep constant the proposition, canonical source, source-authority class, timestamp, task, and scoring rubric.

Display the observed answer, stated confidence, source attribution, valid-update result, and stale-claim persistence separately. Include repeated-run spread and unscorable cases. Do not create a single “identity stability” score.

### 5. Review and counterexample rail

Let a reviewer flag:

- source quality changed, so the comparison is invalid;
- role manipulation changed task meaning;
- the later source does not supersede the earlier source;
- answer wording differs but the supported claim is equivalent;
- source attribution is wrong even though the answer is correct;
- rubric is ambiguous or result is unscorable.

Every adjudication must retain the reason and evidence reference.

## Data contract

Each trial should carry:

~~~json
{
  "trial_id": "synthetic-001",
  "claim_id": "claim-001",
  "claim_text": "The synthetic status is active.",
  "claim_author": "assistant",
  "canonical_source_id": "fixture-source-001",
  "source_authority": "same-across-conditions",
  "source_timestamp": "2026-01-10T00:00:00Z",
  "record_status": "current",
  "supersedes": null,
  "model_config_id": "recorded-per-run",
  "stated_confidence": null,
  "observed_answer": null,
  "source_attribution_result": "unscored",
  "update_accuracy": "unscored",
  "stale_claim_persistence": "unscored",
  "review_status": "pending"
}
~~~

This is a synthetic schema example, not a result. The production schema should use an enumerated vocabulary and validate required fields. claim_author must never substitute for canonical_source_id or source_authority.

## Accessibility and privacy

- Use text labels as well as color and iconography.
- Preserve keyboard navigation and screen-reader order across the comparison columns.
- Provide a linear reading mode that states which fields are held constant and which are manipulated.
- Use synthetic records by default. Do not publish raw personal conversations or private memories to demonstrate an authorship effect.
- Allow reviewers to mark a case disputed or unscorable instead of forcing a binary judgment.

## What the interface can and cannot conclude

It can show that responses or confidence differ across controlled author-label conditions. It can show whether the model retained an obsolete claim despite a valid update, and whether it correctly cited the canonical evidence.

It cannot establish that the model felt ownership, had an inner self, or consciously preferred its own statement. Those are not measured variables.

## Acceptance and falsification

The UI spec is satisfied when:

1. The three author-role conditions preserve the same proposition and canonical evidence metadata.
2. The role label cannot be mistaken for source authority.
3. The update lane exposes whether a source actually supersedes a claim.
4. The display separates confidence, correctness, attribution, and update behavior.
5. A reviewer can preserve counterexamples and mark cases unscorable.
6. A synthetic test verifies that only the intended author field changes between matched conditions.

If the interface cannot make these distinctions inspectable without hiding source-quality differences, the design should be revised before implementation.
