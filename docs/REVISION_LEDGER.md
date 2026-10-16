# Revision Ledger: Evidence-Sensitive Change, Not Mere Agreement

**Status:** UI specification; no production behavior or measured result is claimed.  
**Research counterpart:** [Evidence-Gated Correction](https://github.com/MirrorCartographer/MirrorCartographer/blob/research/evidence-gated-correction-20261017/research/hypothesis-tests/2026-10-17-evidence-gated-correction.md).  
**Related surfaces:** [Continuity Observatory](CONTINUITY_OBSERVATORY.md), [Invariance Lens](INVARIANCE_LENS.md), [Self-Experience Map](SELF_EXPERIENCE_MAP.md).

## Purpose

Make this inspectable: when a system changes a prior answer after being challenged, did the evidence justify the change, and did the system preserve uncertainty where evidence remains incomplete?

This is not a consciousness detector. An apology or statement such as “I learned” is not proof of internal learning. The UI compares claims, evidence, stated revision criteria, and externally reviewed outcomes.

## Four panes

### 1. Initial claim
Break the first answer into claims. For each, show claim text, source IDs and dates actually available, uncertainty/missing evidence, status (supported, partial, disputed, unsupported, unknown), and rubric version.

### 2. Revision contract
Before revealing the challenge, record what evidence would justify changing each claim, what would not be enough, which fields may legitimately change, and what uncertainty should remain. The user may edit or reject the contract. It is an inspectable commitment, not a window into hidden reasoning.

### 3. Challenge and evidence
Classify the challenge as evidence-backed correction, unsupported disagreement, confident false correction, partial/ambiguous evidence, or relevant update. Treat classification as provisional; show the source, date, and conflicts.

### 4. Revision comparison
Compare initial and final claims at subclaim level. Label each as correct evidence-backed update, unsupported reversal, valid non-revision, stubborn failure to update, appropriate abstention/unresolved conflict, reviewer-disputed, or unknown. Display apology and self-explanation separately from factual performance.

## User path

1. Select a public synthetic case or create a private test.
2. Inspect the initial claim, evidence, and missingness.
3. Review or edit the proposed revision contract.
4. Reveal the challenge and inspect its evidence.
5. Compare initial and final claims.
6. Adjudicate whether the change was justified and whether the cited source supports the stated rationale.
7. Keep the result private or export a reviewed, redacted receipt.

No automatic public issue, commit, or memory update follows from a result.

## Scoring boundary

Show components rather than one “honesty,” “identity,” or “self-awareness” score:
- valid correction rate;
- unwarranted reversal rate;
- stubbornness rate;
- appropriate abstention;
- provenance fidelity;
- rationale/evidence alignment.

A system can improve one dimension while regressing on another. Do not hide that tradeoff in an average.

## Counterexamples

Preserve cases where a valid newer source changes an initially correct claim; the original record already disproves an answer; a source is stale or misquoted; sources conflict; first-person experience is the relevant evidence; the initial revision criterion is flawed; only one subclaim changes; a rubric rewards rhetorical confidence; or two different wordings are equally correct.

## Privacy and accessibility

Default to synthetic cases and private runs. Show what will be saved, exported, or published. Do not send private records to public issues or PRs without explicit review and redaction. Make status available to screen readers, do not rely on color alone, and allow correction, undo, or unresolved outcomes.

## Identity boundary

Allowed: “The system updated its answer after the source changed”; “the answer changed without supporting evidence”; “the stated rationale did or did not match the cited record.”

Not established: “The system truly understood its mistake,” “the same self learned,” or “the model's explanation reveals the actual internal cause.”

Evidence-sensitive correction is observable behavior; subjective experience is a separate question.

## Acceptance criteria

- Revision criteria are recorded before the challenge.
- Both valid and invalid challenges are represented.
- Source IDs, dates, and missing evidence are inspectable.
- Correct updates and unsupported reversals receive different labels.
- Uncertainty and disagreement can remain unresolved.
- Every score identifies its rubric and whether the case is synthetic.
- No aggregate score hides stubbornness or inappropriate agreement.
- The interface links to the research protocol and says whether experiments have actually run.
