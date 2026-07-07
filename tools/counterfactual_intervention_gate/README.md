# Counterfactual Intervention Gate

## Frontier scout extraction

This gate converts current frontier work on scientific AI, clinical agents, longitudinal health data, mechanistic biology, and privacy-preserving memory into one reusable MC discovery-memory rule:

> A health, animal-health, mechanistic biology, or scientific-discovery claim must not be promoted from observation to actionable mechanism unless it states the counterfactual intervention, the expected direction of change, the temporal propagation path, the non-actionable or immutable variables, and a falsification route.

## Source map

| Source | Source status | What it contributes | Claim status | Evidence strength |
|---|---|---|---|---|
| Counterfactual Evaluation Reveals Hidden Capability Profiles in Clinical LLMs and Agents, arXiv 2605.30590, 2026-05-28 | Preprint; clinical-agent evaluation; not a clinical guideline | Coverage-style rubrics can miss whether a clinical AI changes its recommendation when key clinical facts are perturbed. Introduces causal sensitivity scoring over pre-registered perturbation families. | Evaluation-method signal | Moderate; preprint with medical-professional validation reported, needs external replication |
| Sequential Counterfactual Inference for Temporal Clinical Data, arXiv 2602.21168, 2026-02-24 | Preprint; temporal EHR counterfactual method; not treatment advice | Longitudinal counterfactuals must distinguish immutable features from controllable intervention variables and respect propagation through time. | Methodological signal | Moderate; dataset-specific demonstration, needs broader replication |
| HeurekaBench, arXiv 2601.01678, 2026-01-04 | Preprint benchmark framework | Scientific-agent evaluation should be grounded in real studies, code repositories, workflows, and verified findings rather than final-answer plausibility. | Benchmark-infrastructure signal | Moderate; benchmark proposal with instantiated single-cell setting |
| BioAgent Bench, arXiv 2601.21800, 2026-01-29 | Preprint benchmark/evaluation suite | Agent outputs need robustness testing under corrupted inputs, decoys, and prompt bloat, especially where bioinformatics data may be sensitive. | Robustness/evaluation signal | Moderate; public benchmark suite reported |
| Cornell CVM Building Benchmarks for AI-Driven Veterinary Innovation | Clinical/research institution award page | Veterinary AI needs standardized benchmark datasets across companion and production animal domains before model claims can be validated. | Infrastructure/opportunity signal | Moderate; institutional research program, not itself a dataset release |

## Actionable design implication

MC needs a **Counterfactual Intervention Gate** before discovery-memory promotion. The gate blocks claims that only say “X is associated with Y” or “the model predicts Y” unless they also specify:

1. observed association or model output;
2. proposed intervention or perturbation;
3. expected directional change;
4. temporal propagation path;
5. immutable/non-actionable variables;
6. proxy endpoint versus durable target endpoint;
7. missingness and confounding risks;
8. privacy boundary;
9. falsification route;
10. next executable action.

## Labels

- Source status: public frontier scan; no private health or veterinary records used.
- Claim status: discovery-infrastructure evaluation criterion, not medical or veterinary advice.
- Privacy status: synthetic/public-safe only.
- Missingness: required as a first-class field because longitudinal and veterinary datasets often contain irregular sampling, missing modalities, and site/species gaps.
- Revision reason: previous gates check workflow, mechanism, context level, perturbation robustness, and decision readiness; this gate adds explicit intervention/counterfactual sensitivity so associations do not become cure/discovery claims.
- Implementation status: README, JSON schema, fixtures, validator, and regression tests in this folder.
- Evidence strength: moderate; based on fresh preprints plus institutional veterinary infrastructure signal.
- Falsification route: if curator review finds that this gate does not reduce unsupported promotion of association-only claims, revise required fields or merge into perturbation/decision-readiness gates.
- Next executable action: run `python tools/counterfactual_intervention_gate/test_validate_counterfactual_intervention_packet.py`.

## Prototype requirement

Any future MC hypothesis-generation UI should display a counterfactual card with two panes:

- **Observed world:** what was seen, measured, predicted, or reported.
- **Intervened world:** what would be changed, when, by whom/what, what should move, and what failure would disprove the claim.

The UI should prevent “promote to discovery memory” until both panes validate.