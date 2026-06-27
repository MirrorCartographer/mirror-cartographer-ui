# Bridge Synthesis — Memory Admission Gate

Date: 2026-06-27

Status labels

- Source status: synthesized from MC public-safe implementation files, prior memory-palace concepts, and current agent-memory research.
- Claim status: bridge synthesis and product hypothesis.
- Privacy status: public-safe abstraction only.
- Missingness: no production gate, benchmark, or UI review has been completed.
- Revision reason: added because retrieval relevance is not sufficient for symbolic-state safety.

## Inner-world claim

MC depends on continuity.

Without memory, it becomes a one-off symbolic mirror rather than a cartography system.

## Research-world pressure

Current agent-memory research warns that persistent memory is not only utility. It can become a durable control channel that changes interpretation, tone, safety judgment, and tool behavior. Similarity search is therefore insufficient: a memory can be close to a query while still being illegitimate for the task.

## Conflict

MC wants rich continuity.

MC also wants consent, uncertainty, and public-safe abstraction.

If memory enters too freely, symbolic history may overrule present task boundaries.

If memory is blocked too aggressively, the system loses its cartographic advantage.

## Synthesis

The solution is not less memory.

The solution is memory admission.

A remembered symbolic state should pass through a gate that separates:

1. retrieval relevance.
2. contextual admissibility.
3. claim type allowed.
4. privacy boundary.
5. action boundary.
6. public-release boundary.
7. forgetting or decay rule.

## Bridge verdict

- Preserve: MC's long-term symbolic continuity.
- Refine: memory must be admitted by task, claim, privacy, and action boundary.
- Split: semantic similarity is separate from admissibility.
- Test: compare ungated retrieval against gated retrieval on privacy leakage, over-personalization, stale context, and symbolic over-certainty.
- Product translation: implement `MemoryAdmissionGate` between retrieval and generation.

## New light

The memory layer is not just storage.

It is a permissions layer, evidence layer, and safety layer.

For MC, the safest memory is not the memory that is closest.

It is the memory that is closest, permitted, current enough, claim-compatible, privacy-compatible, and useful without becoming coercive.
