# Consent Revision Lineage Gate

## Frontier scan basis

This artifact translates current frontier work on longitudinal health agents, privacy-preserving memory, longitudinal EHR benchmarks, veterinary AI benchmark infrastructure, and contextual privacy into one executable design rule for Mirror Cartographer discovery memory.

### Source map

| Source | Source status | Relevant claim | Claim status | Evidence strength | Caveat |
|---|---|---|---|---|---|
| Lin et al., `A longitudinal health agent framework`, arXiv 2604.12019, 2026-04-13 | Preprint | Longitudinal health agents require adaptation, coherence, continuity, agency, consent, accountability, and revision/deletion support across repeated interactions. | Architecture guidance, not clinical validation | Moderate | Preprint; representative use cases, not deployed clinical trial evidence. |
| Chen et al., `MemPrivacy`, arXiv 2605.09530, 2026-05-10 | Preprint + benchmark | Type-aware placeholders can preserve memory utility while reducing cloud-side exposure of sensitive spans. | Prototype method + benchmark claim | Moderate | Needs independent replication and domain-specific health/veterinary tests. |
| Stanford HAI / Shah Lab EHRSHOT, INSPECT, MedAlign longitudinal EHR benchmark program, 2025 | Research institution + datasets | Healthcare AI needs longitudinal, reproducible benchmark datasets and explicit evaluation gaps rather than isolated vignette testing. | Dataset/benchmark infrastructure claim | Strong for evaluation gap; moderate for MC transfer | Human EHR setting; does not directly validate personal/veterinary memory. |
| Cornell CVM, `From Data to Animal Health: Building Benchmarks for AI-Driven Veterinary Innovation`, 2026 | Veterinary research institution award page | Veterinary AI lacks FAIR benchmark infrastructure and faces species, modality, ethical, regulatory, and socioeconomic barriers distinct from human medicine. | Infrastructure gap/opportunity | Moderate | Award description; not yet completed dataset. |
| Cornell AI seminar on federated memory/contextual privacy/personalized agents, 2026 | Academic seminar | Persistent memory and autonomy require contextual privacy norms, not just generic masking or longer context. | Conceptual/HCI/privacy claim | Moderate | Seminar description; implementation details not enough alone. |

## Actionable design implication

Discovery memory should not store or promote a longitudinal health, medical, veterinary, biological, or personal claim unless it carries a **consent-revision lineage**: who/what the memory is about, what operation produced it, why reuse is allowed, when consent or evidence changed, what can be deleted or revised, what downstream contexts are blocked, and how the claim could be falsified.

## Gate definition

A claim fails this gate if any of these are missing:

1. `subject_boundary`: whether the claim refers to a person, animal, cohort, species, dataset, model, assay, site, or synthetic fixture.
2. `consent_state`: allowed operation and reuse scope.
3. `revision_lineage`: prior version, revision reason, evidence cutoff, and what changed.
4. `deletion_or_redaction_route`: exact pathway to remove or redact the memory without destroying auditability.
5. `contextual_integrity_boundary`: source context, destination context, allowed transfer, and blocked transfer.
6. `privacy_loss_route`: how repeated retrieval or rare feature combinations could leak sensitive information.
7. `missingness`: missing evidence, missing consent, missing data, missing species/site/modality bridge.
8. `falsification_route`: what would make the claim unsafe, unsupported, or non-portable.
9. `next_executable_action`: one concrete next step.

## Implementation status

Implemented as:

- `consent_revision_lineage.schema.json`
- `validate_consent_revision_lineage_packet.py`
- `fixtures/valid_consent_revision_lineage_packet.json`
- `fixtures/invalid_missing_revision_lineage_packet.json`
- `test_validate_consent_revision_lineage_packet.py`

## Privacy status

Public-safe synthetic only. No personal medical, veterinary, or private memory content is stored in these fixtures.

## Missingness

The artifact does not yet connect to a live MC memory store, Vercel UI, or real consent ledger. It is a gate and test harness.

## Revision reason

Prior gates protected evidence routes, assay fitness, privacy loss, context level, and memory operation boundaries. This revision adds the temporal governance layer: consent, revision, deletion, and contextual reuse lineage.

## Evidence strength

Moderate. The gate is strongly motivated by convergent frontier work, but its impact on MC quality must be evaluated by curator review and false-promotion reduction.

## Falsification route

Revise or reject this gate if:

- Curator review shows it adds paperwork without improving unsafe-memory detection.
- It blocks useful synthetic/scientific hypotheses that contain no personal or sensitive context.
- It fails to detect cross-context leakage in adversarial retrieval tests.
- Longitudinal packets remain non-reconstructable after passing.

## Next executable action

Run:

`python tools/consent_revision_lineage_gate/test_validate_consent_revision_lineage_packet.py`
