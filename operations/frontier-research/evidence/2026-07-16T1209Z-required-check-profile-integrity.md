# Frontier Research adversarial cycle: required-check profile integrity

Date: 2026-07-16
Branch: `preview`
Implementation commit: `97e640d2b62a99fae7efdb70e04700ba8f703d32`
Test commit: `ab4abf42a8dc4fe2e88293773315daaeed728a27`
Claim boundary: source-level enforcement and committed disposable tests only; runtime passage is not claimed.
Publication/promotion decision: BLOCK.
Protected systems changed: none. No deployment, workflow dispatch, infrastructure, automation, schedule, DNS, credential, production, or irreversible user-data mutation occurred.

## Checkpoint 1 — before adopting the research direction

- Claim or design under test: Fresh, passing, commit-matched required-check evidence is sufficient to prove the promotion policy was actually enforced.
- Challenge method: Constructed policy-erasure and policy-duplication counterexamples against the existing assessor: `required_checks: []`; duplicated identifiers; a reduced set with all remaining checks passing; and malformed identifiers capable of confusing object lookup or review.
- Evidence: `operations/deployment/validate-promotion-evidence.v1.mjs` previously converted absent/non-array `required_checks` to `[]`, iterated only listed names, and returned the list length as coverage. The existing test fixture used nine checks but had no empty, duplicate, reduced, malformed, profile, or digest negative control.
- Counterexample or failure found: Empty required checks could bypass all check-specific failures. Duplicate names could revalidate one evidence object and inflate the count. A reduced list could silently erase accessibility, rollback, or adversarial-review coverage while remaining internally passing.
- Repair or refinement selected: Add structural integrity plus a versioned profile-set digest. Require a non-empty array, unique normalized identifiers, a non-empty profile ID, positive integer profile version, and a SHA-256 digest of the normalized set.
- Stronger competing explanation considered: Hard-code the current nine names. Rejected because legitimate profiles may evolve and hard-coding would create duplicate policy authority inside the assessor.
- Remaining uncertainty: A self-declared profile ID and digest prove internal set integrity, not institutional approval of that profile.
- Outcome: Refined design.
- Robustness increased: yes, at the design level.
- Evidence quality: direct source inspection plus explicit counterexamples; no runtime execution.
- Rollback route: revert the implementation and test commits in reverse order.
- Next falsifiable step: prove an empty list and a reduced list under the prior digest cannot produce `promotable: true`.

## Checkpoint 2 — immediately after implementation

- Claim or design under test: The new profile contract prevents policy erasure, duplication, identifier ambiguity, and silent reduction without duplicating deployment or check-result validation.
- Challenge method: Added disposable in-memory fixtures for empty, duplicate, malformed, absent-profile, reduced-set/digest-mismatch, and arbitrary digest-mutation cases. Re-read the exact committed source from `preview` after the write.
- Evidence: implementation commit `97e640d2b62a99fae7efdb70e04700ba8f703d32`; test commit `ab4abf42a8dc4fe2e88293773315daaeed728a27`; exact source blob `6c53e6abe3e5f10bd6accf9dd0bb96d202e45d6c`.
- Counterexample or failure found: The digest alone is not an approval registry. A caller can intentionally create a new reduced set and matching new digest, then label it with an arbitrary profile ID/version. The design detects unexplained mutation relative to a retained profile but cannot independently know whether a newly declared profile is authorized.
- Repair or refinement: Kept the assessor limited to structural and identity integrity. Did not fabricate an approval registry or hard-code policy names without inventorying canonical checklist producers and legitimate profile variants.
- Remaining uncertainty: Canonical profile approval, profile-version governance, and migration compatibility are unresolved. Existing checklist producers do not yet demonstrably emit `required_check_profile`.
- Outcome: Safer reversible implementation plus documented unresolved governance question.
- Robustness increased: yes, at the source-contract level.
- Evidence quality: exact committed source and committed deterministic fixtures; tests not executed.
- Rollback route: revert `ab4abf42a8dc4fe2e88293773315daaeed728a27`, then `97e640d2b62a99fae7efdb70e04700ba8f703d32`.
- Next falsifiable step: execute the exact test suite at the test commit and retain stdout, stderr, exit code, Node version, and commit SHA.

## Checkpoint 3 — verification before declaring success

- Claim or design under test: The work is ready to be described as verified operational enforcement.
- Challenge method: Distinguished committed source from executed evidence; checked whether the canonical checklist, evidence producers, and promotion command are proven to supply and consume the new profile contract; attempted no deployment or live workflow experiment.
- Evidence: Source and test commits exist on `preview`; exact updated source was re-read. No retained Node test output, canonical checklist migration evidence, provider-authenticated deployment object, or commit-matched live verification evidence was produced in this run.
- Counterexample or failure found: Current canonical checklist data may omit the new profile field and therefore fail closed. That is safe but means adoption is incomplete. A matching self-declared digest still cannot establish that the profile was approved by policy owners.
- Repair or refinement: Publication remains blocked. The result is classified as source-level hardening, not verified promotion readiness.
- Remaining uncertainty: Runtime passage; canonical checklist path and producer inventory; schema-version-6 consumer compatibility with schema 7; approved-profile authority; live deployment and rollback evidence.
- Outcome: Documented unresolved questions and a safer fail-closed boundary.
- Robustness increased: yes, because empty, duplicate, malformed, and digest-mismatched policies are now rejected by source contract.
- Evidence quality: medium for source behavior, low for runtime and operational adoption.
- Rollback route: revert this evidence commit, then the test and implementation commits in reverse order.
- Next falsifiable step: run `node --test operations/deployment/validate-promotion-evidence.v1.test.mjs` at exact commit `ab4abf42a8dc4fe2e88293773315daaeed728a27`; then inventory every canonical checklist producer and require an approved profile registry or policy-owned manifest before promotion.

## Strongest surviving proposal

Promotion evidence must be bound to a non-empty, unique, normalized required-check set with an explicit profile ID, positive version, and deterministic set digest. A second policy-owned layer must authorize profile ID/version/digest tuples; the assessor must not infer approval from a self-declared digest alone.

## Rejected alternatives

- Trusting the checklist as infallible input.
- Checking only non-emptiness.
- Checking only uniqueness.
- Treating passed-check count as coverage proof.
- Hard-coding the current nine checks inside the assessor before producer and profile inventory.
- Treating a self-declared digest as institutional approval.
- Triggering deployments or workflows to discover policy behavior.

## Unresolved risks

- Tests are committed but not executed with retained exact-commit output.
- Canonical checklist producers are not migrated or inventoried.
- No approved-profile registry or policy-owned manifest is established.
- Schema 7 compatibility is not inventoried.
- No authenticated, fresh, commit-matched deployment or live rollback evidence exists.

## Final decision

Promotion and publication remain blocked. The design is stronger at the source-contract level, but operational success is not established.
