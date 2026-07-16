# Frontier Research adversarial review — required-check freshness

Date: 2026-07-16
Scope: preview promotion evidence gate
Publication/promotion decision: BLOCKED
Protected systems modified: none

## Checkpoint 1 — before adopting the direction

- **Claim or design under test:** Exact-commit `status: pass` entries in `evidence.checks` are sufficient current evidence for promotion.
- **Challenge method:** Constructed counterexamples in which a check remained labeled pass for the correct commit but had no observation time, an observation older than the deployment freshness window, or an observation after the assessment time.
- **Evidence:** `operations/deployment/validate-promotion-evidence.v1.mjs` validated required-check status and commit only; deployment evidence alone had freshness enforcement.
- **Counterexample or failure found:** A stale or future check snapshot could satisfy promotion while the deployment object was fresh. The gate therefore conflated commit binding with temporal validity.
- **Repair or refinement:** Selected a provider-neutral required-check freshness contract rather than another deployment-identity validator. Required checks must carry `observed_at`, and policy must define `max_required_check_age_ms`.
- **Remaining uncertainty:** A single freshness window may not fit every check type or long-running physical-device verification.
- **Outcome:** Refined design.
- **Robustness increased:** Yes, at the design-contract level.
- **Evidence quality:** Direct source inspection plus falsifiable in-memory counterexamples; no runtime execution claimed.
- **Rollback route:** Revert implementation commit `065c518c532b8d4b58ce89e624d2704df68f883e`.
- **Next falsifiable step:** Implement fail-closed timestamp and freshness checks, then attempt missing, stale, and future observations.

## Checkpoint 2 — immediately after implementation

- **Claim or design under test:** The added freshness contract blocks temporal substitution without weakening existing commit, branch, repository, project, deployment-state, and rollback requirements.
- **Challenge method:** Added disposable deterministic fixtures for missing `observed_at`, one-millisecond stale evidence, future evidence, and absent policy; retained the prior identity and failure-state fixtures.
- **Evidence:** Implementation commit `065c518c532b8d4b58ce89e624d2704df68f883e`; test commit `9667c2c877e3e259c02d512cae012fcbc3ec0f34`.
- **Counterexample or failure found:** The previous positive fixture lacked check timestamps and would correctly fail under the new contract. It was refined to include fresh observations rather than weakening the validator for compatibility.
- **Repair or refinement:** Schema advanced to version 6. `passed_required_check_count` now counts only pass entries that are commit-matched, timestamped, non-future, and within policy.
- **Remaining uncertainty:** Existing evidence producers and schema-version-5 consumers have not been exhaustively inventoried. The canonical checklist must be updated with the new policy before this can become operational.
- **Outcome:** Refined implementation and safer reversible alternative to accepting legacy un-timestamped checks.
- **Robustness increased:** Yes, at the source-contract level.
- **Evidence quality:** Commit-addressed source and negative-control fixtures; tests committed but not represented as executed.
- **Rollback route:** Revert `9667c2c877e3e259c02d512cae012fcbc3ec0f34`, then `065c518c532b8d4b58ce89e624d2704df68f883e`.
- **Next falsifiable step:** Execute the exact Node suite and retain stdout, stderr, exit code, runtime version, and commit SHA.

## Checkpoint 3 — verification before success

- **Claim or design under test:** The work is ready to support publication or promotion.
- **Challenge method:** Re-read the committed source and fixtures from the preview branch; challenged success against runtime execution, canonical-policy integration, producer compatibility, and real provider evidence.
- **Evidence:** The preview branch contains the validator and deterministic counterexamples. No exact-commit test output, fresh authenticated deployment object, or fresh required-check receipt set was obtained in this run.
- **Counterexample or failure found:** Source-level enforcement is not operational evidence. Without canonical policy integration, an existing checklist will fail closed; without producer updates, legacy evidence cannot pass.
- **Repair or refinement:** Publication remains blocked. The claim boundary is limited to additive source-contract enforcement.
- **Remaining uncertainty:** Runtime passage, consumer compatibility, optimal freshness thresholds, canonical invocation, live accessibility/mobile/audio/privacy/performance status, and executed rollback remain unverified.
- **Outcome:** Documented unresolved questions; no success declaration.
- **Robustness increased:** Yes relative to stale-check false positives, but not yet operationally verified.
- **Evidence quality:** Moderate for source behavior, low for runtime and deployment behavior.
- **Rollback route:** Revert this evidence commit, then `9667c2c877e3e259c02d512cae012fcbc3ec0f34`, then `065c518c532b8d4b58ce89e624d2704df68f883e`.
- **Next falsifiable step:** Run `node --test operations/deployment/validate-promotion-evidence.v1.test.mjs` at exact preview head, update the canonical checklist only after the suite passes, then test one disposable complete evidence object whose deployment and every required check are freshly observed.

## Strongest surviving proposal

Promotion requires one coherent evidence set in which the deployment and every required check are bound to the same preview commit and are independently fresh at assessment time. Deployment freshness cannot stand in for check freshness.

## Rejected alternatives

- Treat exact commit identity as timeless evidence.
- Apply freshness only to the deployment object.
- Accept legacy checks with no observation timestamp.
- Use file modification time or commit time as a substitute for check observation time.
- Declare success from committed tests without exact-run output.

## Unresolved risks

- Different checks may require different freshness windows.
- Long-running manual or physical-device checks may expire before assessment.
- Existing producers may not emit `observed_at`.
- Schema-version-5 consumers may require migration.
- Canonical checklist and invocation-path integration are not yet proven.

## Final decision

Publication/promotion remains **BLOCKED**. No deployment, infrastructure, automation, schedule, credential, DNS, production, or irreversible user-data mutation occurred.
