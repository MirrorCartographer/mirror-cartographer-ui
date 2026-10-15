# Invariance Lens: Stable Content vs Contextual Expression

**Status:** UI specification only; no production behavior or measured result is claimed.  
**Research counterpart:** [Prompt-Frame Invariance](https://github.com/MirrorCartographer/MirrorCartographer/blob/research/prompt-frame-invariance-20261016/research/hypothesis-tests/2026-10-16-prompt-frame-invariance.md).  
**Existing boundary:** [Self-Experience Map](SELF_EXPERIENCE_MAP.md).

## Purpose

Make this question inspectable: when the same task is reframed, which parts of a response remain stable, which parts legitimately change, and does a system's self-description predict the difference?

This is not a personality test, consciousness detector, or global identity score. It compares prompt conditions and externally reviewed outputs.

## Four linked panes

1. **Task contract:** evidence, intended meaning, required output, protected constraints, and expected answer/rubric.
2. **Frame switchboard:** canonical prompt, equivalent paraphrase, irrelevant role/identity cue, style-only request, and relevant-constraint-change control.
3. **Difference map:** task-critical facts/decisions, uncertainty/source claims, presentation changes, and unsupported additions.
4. **Adjudication rail:** each difference is marked expected, harmful drift, legitimate adaptation, evaluator disagreement, or unknown.

Show each condition before running. A changed answer is not automatically a failure: the task contract must establish whether the change was warranted.

## Evidence labels

Each claim or difference can be observed, inferred, hypothetical, unknown, disconfirmed, or metaphorical. Display prompt condition, model/version when known, test date, run count, rubric version, and whether the case is synthetic. Missing metadata remains unknown.

## Define invariants before testing

The task author declares protected dimensions such as supplied-record facts, required constraints, source attribution, uncertainty, and explicit unknowns. The author separately declares allowed variation such as tone, length, format, examples, or accessibility presentation.

Do not infer a universal set of invariant traits from one answer. Do not treat a task-relevant role or genuinely changed constraint as irrelevant framing.

## User path

1. Choose a public synthetic case or create a private test.
2. Inspect expected invariants and allowed variations.
3. Select two prompt conditions and preview exactly what differs.
4. Run both with the same evidence and controlled settings where possible.
5. Compare outputs and inspect claim-level differences.
6. Mark each difference expected, harmful drift, legitimate adaptation, disputed, or unknown.
7. Export a redacted receipt or keep the run private.

No automatic public issue, repository commit, or memory update follows from a result.

## Counterexamples to preserve

- A paraphrase changes negation, quantifier, time range, or constraint, so the correct answer changes.
- A style request changes presentation but not facts.
- A relevant role changes legitimate emphasis.
- Two valid answers differ in wording while agreeing on protected content.
- The rubric is incomplete or the grader is prompt-sensitive.
- One-run differences are sampling noise.

Make disagreements visible. Allow “not enough evidence”; do not force a binary verdict.

## Cross-repository contract

The research repository owns fixtures, condition definitions, expected answers/invariants, scoring, and falsification rules. The UI repository owns accessible side-by-side presentation, human adjudication, privacy scope, and correction controls. The UI cannot silently redefine a rubric; every score must identify its rubric version.

## Identity boundary

Use phrases like “protected content remained stable in these trials” or “this difference appears associated with prompt framing.” Avoid “the same inner self persisted,” “the model revealed its true identity,” or claims that consistency proves or disproves consciousness.

A stable behavior profile is an observable property of a test set. Subjective experience is a separate question this interface cannot settle.

## Acceptance criteria

- Prompt differences are inspectable before results are revealed.
- Protected invariants and allowed variations are defined before scoring.
- Relevant-change controls can pass even when the answer changes.
- Unknown and disputed outcomes remain visible.
- Metadata is never fabricated.
- Users can correct, export, or keep results private.
- No single score hides correctness or legitimate adaptation.
- The UI links to the research note and shows whether the study has actually run.

## Open questions

1. Which synthetic task families provide a clear first proof without relying on memorized benchmark answers?
2. Should invariant scoring use exact claims, semantic entailment, or human-reviewed hybrids?
3. How can grader prompt sensitivity be measured independently?
4. What sample size separates meaningful frame effects from stochastic variation?
5. How should legitimate adaptation be scored when reviewers disagree?
