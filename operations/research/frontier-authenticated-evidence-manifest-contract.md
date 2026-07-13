# Authenticated workflow evidence manifest contract

Status: implementation-ready research handoff
Owner: frontier_research
Queue: R-021

## Finding

The remaining evidence gap is not another pagination algorithm. It is a provenance contract for one exact-commit execution that binds two independent complete enumerations, their retained raw outputs, a quiet-interval stability check, and the reconciliation result.

## Required manifest fields

- repository: `MirrorCartographer/mirror-cartographer-ui`
- commit_sha: exactly 40 lowercase hexadecimal characters
- captured_at: UTC timestamp
- primary method: repository workflow-run enumeration using Link-header pagination and exact `head_sha`
- independent method: retained `gh api --paginate --slurp` traversal for the same commit
- each method: complete flag, page count, record count, retained raw-output path, SHA-256 of exact retained bytes
- stabilization: first and second snapshot timestamps, declared minimum quiet interval, stable=true
- reconciliation: verified=true, provider_ceiling_ambiguous=false, normalized record-set SHA-256
- claim boundary: authenticated workflow enumeration only; no deployment identity, browser audibility, or physical-device claim
- falsification route: recompute both raw-output hashes, repeat normalization, and reject if commit identity, record set, terminal status, or count differs

## Fail-closed rules

1. Reject mixed commit identities.
2. Reject missing raw outputs or hashes.
3. Reject incomplete pagination.
4. Reject duplicate or missing workflow-run identifiers.
5. Reject nonterminal records at stabilization time.
6. Reject divergent normalized record sets.
7. Reject provider-ceiling ambiguity, including a filtered result count at or above 1000.
8. Reject overwrite of an existing evidence manifest.
9. Never persist secrets in the manifest, command transcript, or retained output.

## Source status

Observed repository state: R-020 and R-021 already implement enumeration, reconciliation, pagination-envelope validation, and stabilization gates. Their remaining acceptance criteria require authenticated exact-commit execution and retained evidence.

External behavior status: GitHub API and CLI behavior is treated as changeable. Execution must retain the concrete command/tool identity and raw responses used during the run rather than relying on this document as proof of current provider behavior.

## Design implication

The next implementation should be a no-overwrite manifest validator and writer placed after stabilization and reconciliation. It should consume existing artifacts rather than introduce a third enumeration path.

## Verification plan

A deterministic test suite should include: valid manifest; commit mismatch; missing raw hash; unstable snapshots; nonterminal record; divergent digest; provider-ceiling ambiguity; and existing-output rejection.
