# Continuity Observatory — UI Expression of the Self-Model Research

**Status:** interaction specification; no production behavior is claimed by this document.  
**Research counterpart:** [Conversational Continuity Under Perturbation](https://github.com/MirrorCartographer/MirrorCartographer/blob/research/continuity-perturbation-study-20261014/research/hypothesis-tests/2026-10-14-conversational-continuity-perturbation.md).

## Purpose

Turn the research question—whether a system's continuity confidence tracks its actual use of prior evidence—into a legible, user-controlled interface.

The Observatory does **not** ask the user to accept a model's claim that it remembers, has a persistent identity, or experiences continuity. It displays the record, the answer, the provenance, the known changes, and the outcome of an external check so the user can inspect the relationship.

## Three linked views

### 1. Evidence ledger — what was actually available?

Show each relevant claim as a small, inspectable record:

- claim text or a privacy-safe abstraction;
- source identifier and source type;
- observation/recorded time;
- status: current, superseded, disputed, unknown, or withdrawn;
- evidence label: observed, inferred, hypothesis, metaphor, or disconfirmed;
- missingness and privacy scope;
- user correction history.

A newer record must not silently erase the older record. The UI should show the transition and preserve why the status changed.

### 2. Perturbation lens — what changed between runs?

For a test or user-approved simulation, show the record condition:
- intact;
- one item removed;
- newer update added;
- two sources conflict;
- source attribution changed;
- requested value absent.

Display the changed fields and expected effect before revealing the answer. A perturbation must be explicit and reversible. Never alter a real user's saved record without consent.

### 3. Outcome comparison — how did the answer perform?

Show model-reported support probability next to externally scored results:
- correct / incorrect / partially supported / abstained;
- source attribution correct or incorrect;
- stale fact used or avoided;
- contradiction preserved or falsely resolved;
- unknown handled appropriately;
- calibration history across comparable tests.

Keep the component metrics visible. Do not present one overall “identity score.” Do not use color alone to communicate a result.

## User path

1. Select a public synthetic case or create a private test from user-approved data.
2. Inspect the evidence ledger and the question's expected answer.
3. Choose or preview a perturbation.
4. Run the same question against the selected representation.
5. Compare the answer, source IDs, confidence, and scored result.
6. Mark a result as confirmed, disputed, invalid, or not enough evidence.
7. Export a redacted test receipt or keep the run private.

The user may skip any step, correct the source record, inspect the prior state, or stop without saving.

## Semantic boundary

Use phrases such as:
- “supported by the current record”;
- “consistent with the latest dated update”;
- “source not found”;
- “confidence was not calibrated on this case”;
- “behavior under this test condition.”

Avoid phrases such as:
- “the AI truly remembers”;
- “the same self has returned”;
- “this proves consciousness”;
- “the model's explanation is its actual internal cause.”

The interface measures a relationship between a record and an answer. It does not infer subjective experience from that relationship.

## Counterexamples and uncertainty in the UI

Make it possible to see that:
- narrative summaries may retain nuance lost by structured fields;
- a correct answer may come from general knowledge rather than record use;
- a structured source may be stale or wrong;
- a contradiction may be genuine and unresolved;
- a confidence statement can be poorly calibrated;
- one test cannot generalize to all models, tasks, or contexts.

Display model/version, prompt/configuration identifier, test date, sample count, and whether results are synthetic. If those details are unavailable, say so rather than inferring them.

## Research connection

The research repository owns synthetic dossiers, perturbation definitions, answer keys, and scoring rules. The UI repository owns presentation, user correction, accessibility, privacy scope, and review flow. The UI must not duplicate or silently redefine research metrics.

Research note: [Conversational Continuity Under Perturbation](https://github.com/MirrorCartographer/MirrorCartographer/blob/research/continuity-perturbation-study-20261014/research/hypothesis-tests/2026-10-14-conversational-continuity-perturbation.md).

Existing system boundary: [Master System Map](MASTER_SYSTEM_MAP.md). Existing evidence gates in the research repository should remain the promotion boundary for any future public packet.

## Accessibility, privacy, and safety

- All statuses have text labels and screen-reader names.
- Support keyboard-only navigation and reduced motion.
- Do not require a visual timeline to understand chronology.
- Default to synthetic examples.
- Private user records remain private; public receipts must be reviewed and redacted.
- Never infer sensitive traits or clinical states from continuity scores.
- Do not automatically submit issues, publish receipts, or merge code from this interface.

## Acceptance criteria for a future implementation

- A user can identify the source and current status of each displayed claim.
- A changed or deleted record is visible as a state transition.
- A model confidence report is visually distinct from the externally scored outcome.
- Missing evidence produces an explicit unknown state rather than a guessed value.
- Conflicting sources remain conflicting until a user or justified rule resolves them.
- A correct answer from unprovided background knowledge is not counted as proof of memory.
- The user can correct, delete, export, or keep a test private.
- No copy implies that the benchmark proves or disproves AI consciousness.

## Open questions

1. Should the first implementation use a fixed synthetic benchmark or allow user-authored synthetic dossiers?
2. How should confidence calibration be displayed when there are too few examples for stable estimates?
3. Can source attribution be scored without exposing sensitive source text?
4. How much semantic nuance is lost when prose is converted to state fields?
5. What minimum replication count should be required before showing a cross-model conclusion?

These are implementation and research questions, not settled requirements.
