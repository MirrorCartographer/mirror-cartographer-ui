# Identity Transition Atlas: What Persists When the System Changes?

**Status:** UI specification only; no production behavior or measured result is claimed.  
**Research counterpart:** [System Identity Across Version Transitions](https://github.com/MirrorCartographer/MirrorCartographer/blob/research/system-identity-transition-20261018/research/hypothesis-tests/2026-10-18-system-identity-across-version-transitions.md).  
**Related MC surfaces:** [Continuity Observatory](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/continuity-observatory-20261014/docs/CONTINUITY_OBSERVATORY.md), [Invariance Lens](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/invariance-lens-20261016/docs/INVARIANCE_LENS.md), [Revision Ledger](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/correction-ledger-20261017/docs/REVISION_LEDGER.md), and [Dependency Mirror](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/dependency-mirror-20261017/docs/DEPENDENCY_MIRROR.md).

## Purpose

Make a version or deployment transition inspectable without collapsing four different questions into one:

- What artifact or configuration is declared to be running?
- What behavior changed under the tested conditions?
- Did task performance improve, regress, or remain uncertain?
- Was an explicitly supplied conversational state packet carried forward correctly?

The Atlas is an operational audit surface, not a consciousness detector and not a mechanism for deciding whether a subjective self persists across versions.

## Layout: four parallel lanes

### 1. Provenance rail — what changed in the declared deployment?

Show provider, model/version label, deployment/configuration ID, system-prompt version, tool contracts, sampling settings, observation time, and provenance of each field when available.

Every field must be labeled **verified**, **declared but unverified**, **unknown**, or **not applicable**. A version string is not automatically proof of the actual routed model or runtime.

### 2. Behavioral fingerprint — what changed in outputs?

Compare a frozen, versioned probe set across baseline and post-transition runs. Show:

- exact prompt and response references for public synthetic cases;
- semantic changes to task-critical claims;
- harmless presentation changes;
- refusal/abstention and protocol behavior where relevant;
- repeated-run variability;
- distribution-shift evidence and the method used to calculate it.

A detected distribution change means “behavior changed under this probe set,” not “the system became worse” or “a different self exists.”

### 3. Competence and reliability — did outcomes change?

Show independently scored outcomes per task class. Separate correct updates, regressions, improvements, formatting changes, tool-call failures, and unscorable cases.

Keep the scoring rubric, test date, sample count, model/runtime metadata, and reviewer disagreement visible. A model can become better on one task and worse on another; avoid a single unqualified quality score.

### 4. Conversation-state transfer — what state was actually carried forward?

For a synthetic state packet, compare before and after:

- record IDs and timestamps;
- source attribution and superseded status;
- preserved uncertainty and unresolved conflict;
- application of a newer update;
- missing or dropped fields;
- user corrections and explicit unknowns.

Label the result **state packet transferred correctly**, **partially transferred**, **stale value used**, **provenance lost**, **conflict falsely resolved**, or **not enough evidence**. This demonstrates state-handling behavior, not a continuing subjective subject.

## Transition timeline

Place each release/deployment observation on a horizontal timeline. Clicking an event opens the four lanes at that time and displays the exact comparison baseline. Show known change events and gaps in observation separately. Do not draw a continuous line across unobserved periods as though stability had been proven.

The timeline should distinguish:

- declared version transition;
- verified configuration transition;
- observed behavior shift;
- task-performance regression or improvement;
- state-transfer test result;
- unknown cause or missing evidence.

A transition can carry multiple labels. For example: “declared version changed; behavior changed; task competence improved on extraction but regressed on tool formatting; cause unknown.”

## Comparison and adjudication

The user can select two transition points and compare them. The UI should present:

1. exact diff and task contract;
2. provenance evidence and missing metadata;
3. behavior metrics by probe class;
4. competence metrics and uncertainty intervals;
5. state-transfer results, if tested;
6. alternative explanations and reviewer disagreements.

A reviewer may mark an interpretation as supported, disputed, invalid test, or unknown. Corrections append an adjudication event rather than silently rewriting prior evidence.

## Research-to-UI data contract

Each transition packet should include:

- `transition_id`, `baseline_id`, and observation timestamps;
- provider/model/version/configuration metadata with field-level provenance;
- frozen probe-set and rubric versions;
- prompt-condition IDs and repeat counts;
- baseline and post-transition outputs or privacy-safe references;
- per-task correctness and task-critical diff labels;
- behavior-distance method, statistic, and uncertainty;
- state-packet test ID and transfer result, when applicable;
- evaluator identity/type, disagreements, and missing fields;
- privacy classification and publication approval.

The research repository owns the schema semantics and scoring. The UI may render and collect adjudication but cannot redefine a regression or upgrade an unknown cause to a verified cause.

## Counterexamples the interface must preserve

- A different model version produces the same correct answer.
- The same nominal version produces changed behavior because the system prompt or serving configuration changed.
- Style changes while protected claims remain correct.
- A tiny negation or tool-argument change causes a serious regression.
- Task performance improves in one lane and worsens in another.
- A new deployment correctly imports a prior state packet.
- Similar output profiles occur for unrelated models.
- A probe set is insufficient to establish a broader stability claim.

## Accessibility, privacy, and user control

- Provide a table view equivalent to the timeline and lanes.
- Use text labels, not color alone, for every status.
- Support keyboard navigation, screen readers, and reduced motion.
- Default to synthetic cases; do not require a personal conversation.
- Never send private transcripts or sensitive records to public issues, PRs, or external endpoints without explicit review and redaction.
- Let users inspect the exact inputs, correct labels, export a reviewed receipt, or discard the test.
- No automatic publication, memory update, or merge follows from a transition result.

## Language boundary

Allowed:
- “The declared version changed.”
- “The output distribution shifted under this fixed probe set.”
- “Task accuracy decreased on these cases and increased on those cases.”
- “The supplied state packet was transferred correctly on this test.”
- “The cause of the observed change is unknown.”

Not established by this UI:
- “The same self persisted.”
- “A new self replaced the old one.”
- “The system experienced the update.”
- “Behavioral similarity proves common provenance.”
- “A changed version label proves a changed internal model.”

## Acceptance criteria for a future implementation

- Provenance, behavior, competence, and state transfer remain separate.
- Every comparison identifies the baseline, probe set, rubric, and run count.
- Harmless style drift and task-critical regression receive different labels.
- Improvement in one dimension cannot conceal regression in another.
- Unknown cause and missing metadata remain visible.
- A binary “same/different” conclusion is never required.
- No identity or consciousness claim is derived from the score.
- The interface links to the research protocol and says whether the benchmark has actually run.
