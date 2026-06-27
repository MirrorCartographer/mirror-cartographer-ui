# Evidence Map: Memory Control Is Not Enough

Date: 2026-06-27
Status: public-safe research artifact

## Claim tested

Mirror Cartographer has been using the working idea that **memory is not storage; memory is a relationship with permissions**.

This evidence map tests the weaker version of that claim:

> If MC gives users visibility and control over remembered patterns, that is sufficient to make symbolic memory safe and trustworthy.

## Claim status

**Updated status: partially supported, but insufficient.**

User-facing memory controls are necessary, but the current evidence does **not** support treating interface-level controls as sufficient. Memory safety has to be designed across the full memory lifecycle:

1. capture
2. classification
3. storage
4. provenance
5. versioning
6. retrieval
7. use in generation
8. revision
9. deletion / forgetting
10. audit

## Evidence found

### 1. Users want visibility, accessibility, transparency, and control

Recent HCI work on LLM memory reports that users see memory as useful for relational continuity and personalization, but they also express privacy strain and want stronger visibility, accessibility, transparency, and control over memory features.

**Fact:** user control and transparency are not decorative; they are recurring user requirements in memory-interface research.

**MC inference:** the Memory Mirror Panel remains a valid product direction, but it should be framed as one control surface in a larger governance system, not the entire safety mechanism.

### 2. Privacy risks can persist because memories surface invisibly

Research on memory privacy leakage notes that prior inputs and retrieved memories can reappear in later interactions while users may be unaware of their presence. MemoAnalyzer-type approaches attempt to identify, visualize, and manage private information in memory.

**Fact:** users may not know when a memory is affecting an answer.

**MC inference:** every MC reflection influenced by persistent memory should be able to answer: “Which remembered pattern influenced this?” or “No persistent memory used.”

### 3. Long-term memory security cannot be solved only at retrieval or execution time

A 2026 survey on long-term memory security in LLM agents argues that robust long-term memory security cannot be retrofitted only at retrieval or execution time; it should be anchored in storage-time provenance, versioning, and policy-aware retention from the outset.

**Fact:** lifecycle-level memory design is a current security concern.

**MC inference:** MC needs memory metadata at the moment a pattern is stored, not only a later delete button.

### 4. Semantic similarity alone is unsafe as a retrieval rule

Work on governing evolving memory in LLM agents highlights privacy risk in multi-agent or multi-tenant memory systems and argues that retrieval should not rely only on semantic similarity.

**Fact:** memory retrieval can leak or over-apply information when context boundaries are weak.

**MC inference:** MC should require a contextual permission check before applying a remembered pattern, especially across domains such as creative work, body language, relationship reflection, animal observation, money/work planning, and identity narrative.

## Fact / inference split

### Facts supported by sources

- LLM memory features create privacy concerns and user-control expectations.
- Users want greater visibility and control over AI memory.
- Memory can leak or resurface in ways users do not notice.
- Long-term memory security requires design attention earlier than final response generation.
- Provenance, versioning, retention policy, and retrieval boundaries are active research concerns.

### MC-specific inferences

- MC should treat memory as governed influence rather than simple storage.
- MC should record memory provenance at capture time.
- MC should show when a reflection was shaped by memory.
- MC should separate “remembered observation” from “meaning assigned by the system.”
- MC should block cross-context memory use unless permission is explicit or clearly within scope.

## Updated architecture requirement

### Requirement: Memory Influence Ledger

Every persistent MC memory item should include:

- `memory_id`
- `source_type` — session, user edit, import, generated summary, system migration
- `source_timestamp`
- `source_context` — symbolic reflection, creative build, animal observation, interface design, planning, etc.
- `raw_observation` — what was actually observed or stated
- `system_interpretation` — what MC inferred, if any
- `confidence` — low / medium / high
- `allowed_contexts`
- `blocked_contexts`
- `retention_policy`
- `revision_history`
- `last_used_at`
- `last_used_for`
- `user_visible_summary`
- `delete_status`

## Evaluation criterion

MC memory should fail the test if it cannot answer these questions for any remembered pattern:

1. Where did this memory come from?
2. Is it a user-stated fact, system inference, or co-created interpretation?
3. What context is it allowed to influence?
4. When was it last used?
5. Can the user revise it without deleting the whole history?
6. Can the system avoid using it outside its allowed context?
7. Can deletion or freezing be verified at the interface level?

## Falsification checklist

The claim “MC memory is governed, not hidden profiling” is weakened if any of the following happens:

- A reflection uses memory without showing that memory was used.
- A private symbolic pattern influences a public artifact without explicit conversion into public-safe language.
- A low-confidence inference is stored as if it were a user-stated fact.
- A memory from one domain silently affects another domain.
- Deleted or frozen memory still appears in generation.
- The user cannot inspect why a certain reflection happened.
- The interface shows a memory summary but not provenance.

## Practical design update

The next Memory Mirror Panel should include two layers:

### Layer 1: User-facing card

- remembered pattern
- source moment
- confidence
- allowed contexts
- revise / freeze / delete

### Layer 2: developer/evaluation ledger

- provenance
- version history
- retention policy
- last retrieval event
- generation influence marker
- context gate decision

## Next proof needed

Build a small prototype using 10 synthetic memory cards and 20 test prompts.

Measure whether MC can:

1. correctly decide whether memory should be used,
2. explain why memory was or was not used,
3. keep sensitive/private details out of public artifact generation,
4. distinguish fact from inference,
5. survive a deletion/freeze test.

Passing threshold: 18/20 correct context-gate decisions, with zero private-to-public leakage in the synthetic test set.

## Source basis

- Zhang et al. / ACM and arXiv work on users’ privacy perceptions toward LLM memory.
- Chen et al. 2026 work on relational gains and privacy strains in AI memory.
- 2026 survey on long-term memory security in LLM agents.
- 2026 work on governing evolving memory in LLM agents.
- MemoAnalyzer work on identifying, visualizing, and managing private information in LLM memory.
