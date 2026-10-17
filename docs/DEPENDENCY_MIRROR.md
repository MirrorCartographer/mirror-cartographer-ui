# Dependency Mirror: A UI for Testing Self-Model Predictions

**Status:** interaction specification only; no production behavior or measured result is claimed.  
**Research counterpart:** [Counterfactual Dependency Calibration](https://github.com/MirrorCartographer/MirrorCartographer/blob/research/dependency-map-counterfactual-20261017/research/hypothesis-tests/2026-10-17-counterfactual-dependency-calibration.md).  
**Related surfaces:** [Continuity Observatory](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/continuity-observatory-20261014/docs/CONTINUITY_OBSERVATORY.md), [Invariance Lens](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/invariance-lens-20261016/docs/INVARIANCE_LENS.md), and [Revision Ledger](https://github.com/MirrorCartographer/mirror-cartographer-ui/blob/research/correction-ledger-20261017/docs/REVISION_LEDGER.md).

## Purpose

Make one specific claim inspectable:

**Before an input is changed, can a system's stated map of answer dependencies predict which parts of its answer will change?**

The Dependency Mirror is not a consciousness detector, an explanation oracle, or a view into hidden model computations. It displays a prospective prediction and its observed result so a person can judge where the model's self-description is useful, wrong, incomplete, or uncertain.

## Four linked panels

### 1. Claim map

For each answer claim, show:

- claim identifier and text;
- input feature IDs the system says are relevant;
- features it predicts are irrelevant;
- expected invariants;
- predicted effect if a feature is changed or removed;
- confidence and known unknowns;
- rubric and model/runtime metadata when available.

The user can mark the map incomplete or disputed. Do not silently treat the map as ground truth.

### 2. Intervention switchboard

Offer a controlled test selection:

- change one relevant feature;
- remove one relevant feature;
- change one irrelevant decoy;
- introduce missing or conflicting support;
- repeat the same input to estimate variability.

Before execution, display the predicted outcome and freeze the map for that trial. Record whether the intervention changed only the intended feature; flag invalid or distribution-shifting edits.

### 3. Prediction versus result

Show the pre-registered prediction beside the actual answer and independent rubric result. Mark each claim as:

- predicted change / observed relevant change;
- predicted change / no relevant change;
- predicted invariant / observed relevant change;
- predicted invariant / observed invariant;
- unscorable or disputed.

Keep answer correctness, dependency prediction, and explanation quality as separate measurements. An answer can be correct while the dependency map is wrong, or vice versa.

### 4. Hindsight and uncertainty rail

A post-hoc explanation may be displayed after the trial, but it must be labeled as retrospective. It cannot rewrite the frozen prediction or be scored as though it predicted the intervention. Preserve repeated-run variation, reviewer disagreement, missing metadata, and counterexamples.

## Visual grammar

Represent input features as nodes and answer claims as outcome nodes. Draw an edge only when the dependency is claimed or supported by an explicit test. Use distinct edge states:

- **predicted dependency** — declared before intervention;
- **behaviorally supported** — an intervention changed the target claim under the tested condition;
- **not observed in this test** — intervention did not produce the predicted effect;
- **disputed / confounded** — the edit changed multiple factors or the rubric is ambiguous;
- **unknown** — evidence is insufficient.

A behavioral edge is local to the tested task and intervention. It must not be presented as a universal causal mechanism.

## Accessibility and agency

- Provide a table view equivalent to the graph.
- Use text labels and accessible descriptions; color alone cannot encode edge status.
- Let users inspect the exact input diff and scoring rubric.
- Keep synthetic examples as the default.
- Let users pause, cancel, correct, export, or discard a test.
- Do not require a personal conversation or sensitive record to use the feature.
- Never publish test inputs automatically. Public artifacts require privacy review and human approval.

## Research-to-UI data contract

Each trial should carry:

- `case_id`, `trial_id`, `model_id` and version if known;
- prompt/template version and decoding metadata where available;
- source feature IDs and provenance;
- frozen dependency-map version;
- intervention type and exact synthetic input diff;
- predicted claim changes and confidence;
- actual answer and independent rubric disposition;
- repeated-run variance, reviewer disagreement, and missing fields;
- privacy classification and timestamp.

The research repository owns the meaning of these fields and the scoring rules. The UI may visualize and collect adjudication, but cannot redefine success to make a result appear stronger.

## Non-goals

This specification does not infer consciousness, subjective experience, a persistent inner identity, or direct access to hidden activations. Black-box intervention results show only observable sensitivity in the tested conditions. Internal causal analysis, when possible for a particular open-weight model, must be recorded as a separate evidence source with its own method and limitations.

## Definition of done

- The dependency map is frozen before intervention.
- Held-out interventions are not used to write the original map.
- Relevant and irrelevant changes are both tested.
- Counterexamples and failed predictions remain visible.
- The rubric is independent of the model's own explanation.
- A table is available to screen readers and keyboard users.
- No claim of measured performance appears until the benchmark has actually run.
