# Cross Species Translation Gate

## Frontier scan basis

This artifact translates current frontier work on longitudinal healthcare AI, virtual EHR agent evaluation, veterinary AI benchmark infrastructure, privacy-preserving agent memory, and HCI privacy controls into one executable design rule for Mirror Cartographer discovery memory.

### Source map

| Source | Source status | Relevant claim | Claim status | Evidence strength | Caveat |
|---|---|---|---|---|---|
| Stanford HAI / Shah Lab, EHRSHOT, INSPECT, and MedAlign longitudinal EHR benchmark program, 2025 | Research institution + datasets/benchmarks | Healthcare AI evaluation needs longitudinal, de-identified EHR benchmarks and task definitions, not isolated one-off medical QA. | Evaluation infrastructure claim | Strong for human EHR evaluation gap; moderate for MC transfer | Human clinical data only; does not validate veterinary, personal, or mechanistic-memory transfer. |
| Jiang et al., `A Virtual EHR Environment to Benchmark Medical LLM Agents`, NEJM AI, 2025 | Peer-reviewed clinical AI benchmark | Medical agents should be evaluated inside workflow-like EHR environments using APIs and communication infrastructure, not only final-answer accuracy. | Benchmark/method claim | Strong for workflow evaluation; moderate for cross-domain transfer | Human healthcare workflow; not species-general or cure evidence. |
| Cornell CVM, `From Data to Animal Health: Building Benchmarks for AI-Driven Veterinary Innovation`, project period 2025-08 to 2026-05 | Veterinary research institution grant/program | Veterinary AI needs dedicated benchmark infrastructure because animal health data has species, modality, ethics, and practice-context constraints distinct from human medicine. | Infrastructure gap/opportunity | Moderate | Award description; public artifact does not yet provide a released benchmark dataset. |
| Xiao et al., `Review of applications of deep learning in veterinary medicine`, 2025 | Peer-reviewed review | Veterinary AI lacks universally standardized, fully labeled validation datasets. | Field-level gap claim | Moderate | Review evidence; not a specific deployed benchmark. |
| Wu et al., `A Privacy-Focused Protocol for LLM Agents and User Memory`, PMLR 2025 | Open research paper/protocol | Agent memory needs explicit read/write/reasoning boundaries rather than unrestricted persistent memory. | Prototype protocol claim | Moderate | Needs health/veterinary domain validation. |
| Li/Nissenbaum-style contextual privacy seminar, Cornell AI seminar, 2026 | Academic seminar/HCI privacy | Persistent personalized agents need contextual privacy and federated memory boundaries as autonomy and memory deepen. | HCI/privacy design claim | Moderate | Seminar description; conceptual and implementation details must be separately tested. |

## Actionable design implication

Mirror Cartographer should block any reusable discovery-memory claim that transfers evidence between human clinical data, animal-health data, mechanistic biology, personal longitudinal memory, or synthetic fixtures unless the packet declares the exact translation boundary and bridge evidence.

The practical rule: **do not let evidence cross species, site, modality, task, workflow, consent, or endpoint boundaries silently.** A human EHR signal cannot become a veterinary inference; a veterinary benchmark gap cannot become a pet-health conclusion; a mechanistic assay signal cannot become a clinical or cure claim; and a privacy-memory protocol cannot authorize sensitive longitudinal reuse unless the transfer is explicitly scoped.

## Gate definition

A claim fails this gate if any of these are missing:

1. `source_domain`: where the evidence originated.
2. `target_domain`: where the claim would be reused.
3. `translation_boundary`: species, population, site, modality, workflow, endpoint, privacy, and consent differences.
4. `bridge_evidence`: what supports transfer across the boundary.
5. `blocked_inferences`: claims that must not be made from this evidence.
6. `missingness`: missing species/site/modality/workflow/endpoint/consent evidence.
7. `evaluation_criterion`: how successful translation would be judged.
8. `privacy_status`: whether data is public-safe synthetic, de-identified, local-only, blocked, or consent-dependent.
9. `falsification_route`: what would prove the transfer unsafe or unsupported.
10. `next_executable_action`: one concrete next step.

## Implementation status

Implemented as:

- `cross_species_translation.schema.json`
- `validate_cross_species_translation_packet.py`
- `fixtures/valid_cross_species_translation_packet.json`
- `fixtures/invalid_missing_bridge_packet.json`
- `test_validate_cross_species_translation_packet.py`

## Privacy status

Public-safe synthetic only. No personal medical, veterinary, or private memory content is stored in these fixtures.

## Missingness

The artifact does not yet connect to a live MC memory store, veterinary dataset, clinical dataset, Vercel UI, or consent ledger. It is a gate and test harness.

## Revision reason

Prior gates protected consent lineage, evidence portability, counterfactual intervention, perturbation robustness, and context-level claim drift. This revision adds explicit **cross-domain translation control** for human-to-animal, animal-to-human, assay-to-clinical, synthetic-to-real, and memory-to-science transfer.

## Evidence strength

Moderate. The need for domain-specific benchmarks and contextual privacy is strongly supported, but this particular MC gate requires curator review and adversarial transfer tests.

## Falsification route

Revise or reject this gate if:

- Curator review shows it does not reduce unsupported cross-domain claim promotion.
- It blocks valid low-risk source-map entries that make no transferable claim.
- It fails to detect human-clinical-to-veterinary or assay-to-cure overreach in adversarial fixtures.
- Passing packets remain non-reconstructable across source and target domains.

## Next executable action

Run:

`python tools/cross_species_translation_gate/test_validate_cross_species_translation_packet.py`
