# Continuity Mining Adversarial Review Protocol

Status: active on `preview`
Owner: `continuity_mining`
Applies to: recovered knowledge, provenance reconciliation, continuity graphs, decision records, queue projections, and handoff artifacts

## Purpose

Continuity mining converts incomplete historical traces into durable project knowledge. Its primary failure mode is not simple omission; it is false continuity: a plausible reconstruction that acquires authority without sufficient provenance. This protocol adds mandatory adversarial review phases at intentional checkpoints while preserving automation schedules, shared-state integrity, irreversible user data, and repository history.

## Non-negotiable boundaries

Adversarial review may destabilize claims, mappings, schemas, candidate identities, evidence envelopes, and proposed repairs. It must not intentionally destabilize:

- automation schedules or platform configuration;
- canonical shared-state files through destructive or speculative rewrites;
- irreversible user data;
- repository history;
- production deployment state;
- privacy boundaries;
- identifiers whose provenance is unresolved.

All experiments must be reversible, branch-contained, and fail closed.

## Checkpoint A — Before committing recovered knowledge

Trigger: before a recovered claim, identifier, relationship, decision, or artifact is promoted from lead-only or unresolved status into durable continuity state.

Required attacks:

1. Contradiction search: identify records that disagree on owner, date, namespace, semantic role, status, or source.
2. Identity collision test: attempt to match the candidate against unrelated objects with similar names or suffixes.
3. Hidden-assumption extraction: list each inference required to treat the candidate as the historical object.
4. Evidence-strength test: distinguish immutable source objects from summaries, automation prose, memory, inferred chronology, and semantic similarity.
5. Counterexample construction: propose at least one alternative history that fits the same available evidence.
6. Coverage challenge: determine whether branch, commit, file-library, chat, or external-source coverage is exhaustive, bounded, or unknown.

Gate:

- Promote only when namespace, owner, semantic role, temporal precedence, and immutable locator agree.
- Otherwise retain `unresolved`, `lead_only`, or `collision_rejected` status.
- Never recreate a historical identifier solely because the expected artifact is missing.

Required record:

- findings;
- repairs made before commit;
- remaining uncertainty;
- final claim status;
- whether the design became stronger and why.

## Checkpoint B — After implementation

Trigger: after adding or changing a continuity schema, ledger, graph projection, validator, reconciliation rule, or durable artifact.

Required attacks:

1. Architecture-drift test: compare the implementation with the repository truth hierarchy and current queue objective.
2. Duplicate-work test: search for equivalent ledgers, graphs, identifiers, and acceptance criteria.
3. Misuse test: attempt to use the artifact to overclaim provenance, overwrite an active owner, expose private material, or convert ambiguity into fact.
4. Edge-case test: include missing source, conflicting source, duplicate identifier, cross-namespace match, stale timestamp, partial branch coverage, and malformed evidence.
5. Rollback test: identify the exact prior commit or file state and verify that reverting the new artifact would not erase unrelated work.
6. Shared-state test: confirm that the change did not overwrite another team's active queue item or mutate automation configuration.

Gate:

- Repairs must be applied before verification when they are local and reversible.
- Critical unresolved defects block promotion.
- Duplicate artifacts must be consolidated by reference, not destructive deletion, unless separately authorized.

Required record:

- attacks attempted;
- observed failures;
- repairs;
- unresolved risks;
- rollback route;
- strength verdict.

## Checkpoint C — During verification

Trigger: before declaring a continuity artifact verified, resolved, authoritative, complete, or ready for handoff.

Required attacks:

1. Independent-path verification: seek a second retrieval or reasoning path that does not reuse the same summary.
2. Falsification-route execution: attempt the artifact's documented disproof condition.
3. Negative-control test: use a known non-match or namespace collision and require rejection.
4. Incompleteness test: remove one required evidence field and require fail-closed behavior.
5. Temporal test: verify that later summaries do not outrank earlier immutable source objects merely because they are newer.
6. Claim-boundary test: ensure verification covers only the claim actually tested.

Gate:

- `verified` requires positive evidence plus successful negative controls.
- Exhaustiveness may be claimed only when coverage is demonstrably exhaustive.
- Failure, ambiguity, skipped checks, or unavailable evidence remains non-success.

Required record:

- evidence inspected;
- negative controls;
- falsification result;
- claim boundary;
- remaining uncertainty;
- stronger/not stronger verdict.

## Safe reversible failure experiments

Allowed examples:

- submit a cross-namespace suffix collision to a validator and require rejection;
- omit an immutable locator and require fail-closed status;
- provide conflicting owner metadata and require quarantine;
- replay the same candidate twice and require duplicate detection;
- test a partial branch inventory and require `coverage_bounded`, not `exhaustive`;
- revert the protocol artifact on `preview` to prove rollback isolation.

Prohibited examples:

- modifying or disabling automations to test resilience;
- corrupting canonical shared-state files;
- deleting source artifacts or history;
- publishing private source material;
- intentionally triggering provider or deployment instability;
- altering production to test rollback.

## Standard adversarial phase record

Each checkpoint record must contain:

```json
{
  "checkpoint": "pre_commit | post_implementation | verification",
  "target": "artifact or claim identifier",
  "attacks": [],
  "findings": [],
  "repairs": [],
  "remaining_uncertainty": [],
  "rollback_route": "commit or file-state reference",
  "claim_status_after_review": "unresolved | lead_only | collision_rejected | coverage_bounded | verified",
  "design_stronger": true,
  "strength_reason": ""
}
```

## Current application to M-RECONCILE-002

M-004, M-005, and M-006 remain unresolved. Existing File Library suffix matches are negative controls demonstrating namespace collision, not provenance resolution. The next safe action remains exhaustive branch and commit traversal followed by immutable-locator reconciliation. Until that coverage exists, no historical identifier may be reconstructed or promoted as verified.
