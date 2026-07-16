# Frontier Research adversarial cycle: challenge-outcome contract

## Scope

Target: `operations/continuity/validate-adversarial-review.v3.cjs`

Decision: **block adoption, publication, and canonicalization pending exact-commit runtime evidence and canonical-entrypoint integration evidence**.

Protected systems changed: none. This cycle modified only additive source, disposable test fixtures, and this retained evidence record. No automation, schedule, deployment, infrastructure, credential, DNS, shared state, or irreversible user data was changed.

## Checkpoint 1 — before adopting the research direction

- **Claim or design tested:** A structurally complete adversarial-review record is sufficient to represent a meaningful Frontier Research result.
- **Challenge method:** Re-read v1 and v2 contracts and construct a counterexample where every required field is present, but no phase states which permitted Frontier outcome it produced and the run has no strongest surviving proposal or rejected alternatives.
- **Evidence:** `validate-adversarial-review.v1.cjs`; `validate-adversarial-review.v2.cjs`; disposable semantic counterexample.
- **Failure or counterexample found:** The record could validate while omitting the required research outcome and run-level conclusion. Structural completeness was being mistaken for epistemic completeness.
- **Repair or refinement:** Add an additive v3 layer requiring an enumerated `challenge_outcome` per phase plus `strongest_surviving_proposal`, `rejected_alternatives`, `unresolved_risks`, and a run-level `next_falsifiable_step`.
- **Remaining uncertainty:** Outcome labels may still become empty ceremony unless their semantic basis is constrained.
- **Outcome:** `refined_design`.
- **Robustness increased:** Yes, at the source-contract level.
- **Evidence quality:** Direct source inspection plus deterministic in-memory counterexample; not runtime or canonical-path evidence.
- **Rollback route:** Revert implementation commit `1fb26d6d57edfbc71eefebdd52a1ef384c6ec83f`.
- **Next falsifiable step:** Attempt to validate a phase with a recognized outcome label but no supporting repair, uncertainty, evidence, or rationale.

## Checkpoint 2 — immediately after implementation

- **Claim or design tested:** Enumerating the four permitted Frontier outcomes is sufficient to prevent outcome laundering.
- **Challenge method:** Construct safe fixtures for an unknown outcome, `refined_design` with no repair, `documented_unresolved_question` with no uncertainty, publication with unresolved run-level risk, and a recognized outcome with no explanation.
- **Evidence:** Implementation commits `1fb26d6d57edfbc71eefebdd52a1ef384c6ec83f` and `0c51151fee7254589592e431bdd9fc80e66c6fba`; test commits `594c8804677ec700988a970ecc6f89c0e4ae8291` and `be4bf401f41788df5252cd486ad5b966c72c3880`.
- **Failure or counterexample found:** The first v3 implementation allowed a permitted outcome label without any explicit rationale; `safer_reversible_alternative` could also collapse into merely repeating an existing rollback string.
- **Repair or refinement:** Require non-empty `challenge_outcome_detail` for every phase and retain outcome-specific consistency checks. The detail does not prove truth, but prevents an unexplained label from satisfying the contract.
- **Remaining uncertainty:** Free-text rationale can still be vague or unsupported. A future version may need evidence locators or stable challenge IDs.
- **Outcome:** `refined_design`.
- **Robustness increased:** Yes. A concrete semantic bypass was removed before verification.
- **Evidence quality:** Committed source and disposable test definitions; tests are not represented as executed.
- **Rollback route:** Revert `be4bf401f41788df5252cd486ad5b966c72c3880`, then `0c51151fee7254589592e431bdd9fc80e66c6fba`, `594c8804677ec700988a970ecc6f89c0e4ae8291`, and `1fb26d6d57edfbc71eefebdd52a1ef384c6ec83f`.
- **Next falsifiable step:** Execute the v3 suite at the exact repository head and retain stdout, stderr, exit code, Node version, and commit SHA.

## Checkpoint 3 — verification before declaring success

- **Claim or design tested:** Committed v3 source and fixtures establish operational Frontier Research enforcement.
- **Challenge method:** Separate source presence from execution and canonical invocation; inspect exact committed files and seek a package script or canonical Continuity Mining entrypoint that invokes v3 fail-closed.
- **Evidence:** Exact repository file contents at the retained head; commit metadata for the v3 implementation and tests.
- **Failure or counterexample found:** No retained exact-commit runtime output is available, and no canonical command is yet proven to invoke v3. Therefore operational enforcement and success are not established.
- **Repair or refinement:** Keep the decision blocked and classify this run as source-contract hardening only.
- **Remaining uncertainty:** Runtime compatibility, canonical invocation, consumer migration, and factual adequacy of free-text outcome detail remain unresolved.
- **Outcome:** `documented_unresolved_question`.
- **Robustness increased:** Yes at the design and source-contract level; operational robustness remains unproven.
- **Evidence quality:** Commit-matched source evidence; no execution, CI, deployment, or canonical-path evidence.
- **Rollback route:** Revert this evidence commit, then the commits listed in checkpoint 2 in reverse order.
- **Next falsifiable step:** Run `node --test operations/continuity/validate-adversarial-review.v3.test.cjs` at the exact head and then prove a disposable canonical invocation rejects a record lacking `challenge_outcome_detail`.

## Strongest surviving proposal

Compose v3 over v2. Require every adversarial phase to declare one permitted challenge outcome, explain why that outcome follows, and satisfy outcome-specific consistency constraints. Require the run itself to retain the strongest surviving proposal, rejected alternatives, unresolved risks, and the next falsifiable step. Keep adoption and publication fail-closed while unresolved risks remain.

## Rejected alternatives

- Treating structural completeness as a meaningful research outcome.
- Allowing arbitrary or missing outcome vocabulary.
- Accepting `refined_design` without a retained repair.
- Accepting an unresolved-question outcome without a documented uncertainty.
- Treating a recognized outcome label as self-justifying.
- Claiming runtime or canonical enforcement from committed source alone.

## Unresolved risks

- The v3 test suite has not been executed with retained exact-commit evidence.
- No canonical Continuity Mining or publication path is proven to invoke v3.
- Existing v1/v2 producers and consumers have not been inventoried.
- Free-text `challenge_outcome_detail` may remain weak evidence without locators, challenge IDs, or claim binding.

## Publication decision

**Blocked.**

## Next falsifiable step

```bash
node --test operations/continuity/validate-adversarial-review.v3.test.cjs
```

Retain exact stdout, stderr, exit code, Node version, and repository SHA. Then route a disposable record missing `challenge_outcome_detail` through the canonical Continuity Mining command and require a nonzero result.
