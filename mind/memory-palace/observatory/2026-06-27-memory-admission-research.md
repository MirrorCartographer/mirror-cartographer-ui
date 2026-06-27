# Observatory — Memory Admission as Trust Boundary

Date: 2026-06-27

Status labels

- Source status: synthesized from public-safe MC architecture files, prior GitHub mind patterns, and current external research.
- Claim status: research-grounded product requirement, not implemented runtime behavior.
- Privacy status: public-safe abstraction; no personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript detail included.
- Missingness: needs code implementation, adversarial tests, and release-readiness review.
- Revision reason: created after comparing MC's symbolic-memory design with 2026 agent-memory security research.

## Public-safe finding

Mirror Cartographer should treat memory retrieval as an admission decision, not a relevance decision.

A memory can be semantically close to the current session and still be invalid for the current task because it may be private, stale, cross-domain, emotionally over-weighted, speculative, or action-unsafe.

## External research pressure

Recent personal-agent memory research frames memory search as a trust boundary. It warns that similarity-based retrieval can cause cross-domain leakage, sycophancy, tool-call drift, and unsafe contextualization when persistent memories are injected into the model context without task-conditioned admission.

Relevant anchors:

- Beyond Similarity: Trustworthy Memory Search for Personal AI Agents, 2026-06-04.
- A Survey on Long-Term Memory Security in LLM Agents, 2026-04-17.
- Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers, 2026-03-08.
- W3C PROV: provenance as a way to assess quality, reliability, and trustworthiness.

## MC architecture pressure

Existing public-safe MC files already define:

- mode boundaries: Canonical, Reflective, Mythopoetic.
- uncertainty labels.
- resonance feedback.
- contradiction preservation.
- safety checks before reflection.
- persistent state and trajectory nodes.
- false-progress checks warning that resonance, beauty, and symbolic meaning are not validation by themselves.

The missing piece is an explicit gate between memory retrieval and memory influence.

## Research question

When MC retrieves a prior symbolic state, what must be true before that state is allowed to influence the current reflection, output, public artifact, or action plan?

## Proposed answer

Create `MemoryAdmissionGate`.

It should sit after retrieval and before generation.

It decides whether a remembered symbolic state may be:

- ignored.
- displayed only.
- used as private context.
- used as symbolic pattern evidence.
- used as product-design evidence.
- used in public-safe abstraction.
- blocked from all downstream influence.

## Evaluation criteria

A successful gate should reduce:

- stale-context carryover.
- cross-domain leakage.
- symbolic over-certainty.
- private-detail resurfacing.
- resonance-driven factual drift.
- tool/action drift caused by old state.
- publication of context that was only valid privately.

It should preserve:

- useful continuity.
- contradiction memory.
- user agency.
- symbolic salience.
- explicit missingness.
- traceable provenance.

## Implementation implication

MC memory should not be a simple vector recall layer.

It should be a permissioned, claim-bounded, provenance-bearing admission layer that asks:

1. Why is this memory relevant?
2. Is it admissible for this task?
3. What claim type can it support?
4. What claim type is blocked?
5. What privacy boundary applies?
6. What should decay, stay private, or be forgotten?
