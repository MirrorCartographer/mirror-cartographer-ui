# Memory Saturation Triage Gate

## Purpose

This gate prevents longitudinal health, veterinary, HCI, scientific-AI, or discovery-memory packets from being promoted into reusable memory when added context is likely to degrade retrieval quality, reasoning fidelity, privacy safety, or falsification clarity.

The design implication comes from current frontier work moving away from static memory benchmarks toward streaming, long-horizon, environment-based evaluation. The operational rule is simple: a memory write is not ready just because it is true or useful in isolation. It must also be tested against accumulated context pressure.

## Frontier source map

| Source | Source status | Relevant claim | Claim status | Evidence strength | Caveat |
|---|---|---|---|---|---|
| MedMemoryBench, arXiv 2605.11814, 2026-05-12 | preprint / benchmark proposal | Personalized healthcare memory needs streaming evaluate-while-constructing protocols and explicitly measures memory saturation. | directly relevant benchmark claim | moderate | synthetic trajectories; not clinical deployment proof |
| MemPrivacy, arXiv 2605.09530, 2026-05-10 | preprint / privacy-memory method | Type-aware placeholders can preserve utility while reducing cloud exposure in edge-cloud agent memory. | method claim | moderate | benchmark-specific; privacy guarantees depend on local detection quality |
| HealthAgentBench, arXiv 2606.31179, 2026-06-30 | preprint / benchmark + open-source suite | Realistic healthcare agents should be evaluated inside long-horizon task environments; frontier success remains limited. | benchmark claim | moderate-high | benchmark release and tasks require independent replication |
| MedPriv-Bench, arXiv 2603.14265, 2026-03-15 | preprint / privacy-utility benchmark | Medical RAG can leak identity through contextual combinations even without explicit identifiers. | safety evaluation claim | moderate | synthetic contexts and automated leakage judge need external validation |
| HeurekaBench, arXiv 2601.01678, 2026-01-04 | preprint / scientific agent benchmark | Co-scientist systems need workflow-grounded, end-to-end evaluation and critic modules. | evaluation-design claim | moderate | instantiated in single-cell biology; transfer to personal memory systems is a design inference |

## Actionable design implication

MC should add a **Memory Saturation Triage Gate** before reusable memory promotion.

A candidate memory packet must declare:

1. what new information is being written;
2. the existing memory region it will collide with;
3. whether the write increases retrieval ambiguity, contradiction load, privacy linkage risk, or reasoning overfit;
4. what will be forgotten, summarized, sharded, redacted, or converted to a pointer instead of stored verbatim;
5. how the memory write can be falsified or revised later.

## Required labels

- **source_status:** public source, preprint, benchmark, institution, dataset, code, or synthetic implementation.
- **claim_status:** observation, benchmark result, method claim, design inference, prototype requirement, or unvalidated hypothesis.
- **privacy_status:** public-safe, synthetic-only, sensitive, redacted, placeholderized, local-only, or blocked.
- **missingness:** absent fields, unknown provenance, incomplete timeline, unavailable raw data, unmeasured confounders.
- **revision_reason:** why the packet was created or changed.
- **implementation_status:** proposed, schema-only, fixture-tested, integrated, deprecated.
- **evidence_strength:** weak, moderate, strong, or blocked.
- **falsification_route:** concrete condition that would force revision.
- **next_executable_action:** one runnable command, review step, or data-collection step.

## Privacy posture

This artifact uses synthetic fixtures only. It is safe for public repository storage. It does not contain personal medical or veterinary data.

## Falsification route

The gate should be revised or removed if curator tests show that passing packets do not improve retrieval precision, reduce contradiction collisions, reduce contextual privacy linkage, or improve later reconstruction accuracy compared with ungated memory writes.

## Next executable action

Run:

```bash
python tools/memory_saturation_triage_gate/test_validate_memory_saturation_triage_packet.py
```
