# Perturbation Robustness Gate

## Purpose

The Perturbation Robustness Gate prevents a scientific, biomedical, animal-health, neuroscience, or mechanistic-biology packet from entering reusable discovery memory unless the packet declares how it behaves under controlled perturbations.

The gate is research-organization infrastructure only. It does not provide medical or veterinary advice.

## Frontier scan date

2026-07-07

## Actionable design implication

Current frontier scientific-agent benchmarks increasingly show that a plausible final result is not enough. A packet should not be promoted into durable memory unless it explicitly records:

1. the original task or hypothesis,
2. the expected output artifact,
3. the perturbation class,
4. the observed failure or robustness signal,
5. whether the claimed evidence survives the perturbation,
6. privacy and data-rights status,
7. missingness and modality limits,
8. a falsification route,
9. the next executable action.

This turns robustness testing into a memory-promotion condition rather than an optional post-hoc audit.

## Source map

| Source | Status | Relevance | Claim status |
|---|---|---|---|
| HeurekaBench, arXiv 2601.01678, 2026-01-04 | Preprint | Evaluates AI co-scientists on realistic end-to-end research workflows grounded in studies and code repositories; reports critic modules improve ill-formed responses. | Supports workflow-grounded evaluation and critique route. |
| BioAgent Bench, arXiv 2601.21800, 2026-01-29 | Preprint / public benchmark claim | Evaluates bioinformatics agents on RNA-seq, variant calling, and metagenomics; includes controlled perturbations such as corrupted inputs, decoy files, and prompt bloat. | Primary basis for perturbation robustness gate. |
| scBench, arXiv 2602.09063, 2026-02-09 | Preprint | Evaluates agents on practical single-cell RNA-seq workflows across platforms; reports platform choice can strongly affect accuracy. | Supports modality/platform-shift field. |
| ABC-Bench, arXiv 2606.11150, 2026-06-09 | Preprint with dual-use caveat | Shows agentic biology capabilities can cross from literature/software tasks into wet-lab-adjacent execution; includes biosecurity-relevant tasks. | Supports risk routing and safe-scope restriction. |
| BioDSA-1K, arXiv 2505.16100, 2025-05-22 | Preprint / benchmark | Includes biomedical hypothesis-validation tasks with insufficient-data cases. | Supports non-verifiable / missingness handling. |

## Required labels

- Source status: preprint-heavy frontier scan; use as design signal, not clinical truth.
- Claim status: infrastructure criterion for research-packet promotion.
- Privacy status: public-safe synthetic implementation only; no patient, pet, or private data.
- Missingness: required field; packets must declare insufficient data, platform gaps, and untested perturbations.
- Revision reason: prior gates validate provenance and workflow, but did not force controlled decoy/corruption/prompt-bloat robustness before memory promotion.
- Implementation status: schema, validator, fixtures, and regression test added in this folder.
- Evidence strength: moderate for engineering design; not medical evidence.
- Falsification route: revise or retire the gate if curator review shows perturbation fields do not reduce unsupported promotions or repeatedly block valid research packets.
- Next executable action: run `python tools/perturbation_robustness_gate/test_validate_perturbation_robustness_packet.py`.

## Promotion rule

A packet passes only if:

- it declares an allowed perturbation class,
- it includes an expected artifact,
- it includes a robustness result,
- it declares whether the claim survived,
- it includes privacy status and missingness,
- it includes a falsification route and next executable action.

If the robustness result is `failed`, the packet may still be stored as a failure case, but not as promoted discovery evidence.
