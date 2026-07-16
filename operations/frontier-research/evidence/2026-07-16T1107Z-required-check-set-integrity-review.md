# Frontier Research adversarial review — required-check set integrity

Date: 2026-07-16T11:07:14Z
Scope: `operations/deployment/validate-promotion-evidence.v1.mjs`
Safety boundary: source inspection and disposable in-memory counterexamples only. No deployment, workflow dispatch, DNS, credential, schedule, automation, infrastructure, or shared-state mutation.
Decision: publication and promotion remain blocked.

## Checkpoint 1 — before adopting the research direction

- **Claim or design under test:** A promotion can be trusted when every name listed in `checklist.required_checks` has fresh, passing, commit-matched evidence.
- **Challenge method:** Inspect the assessor’s trust boundary and construct checklist-level counterexamples rather than mutating provider or deployment state.
- **Evidence:** The assessor normalizes absent or non-array `required_checks` to `[]`, iterates only over the resulting list, and declares promotion successful whenever no other failure is present. It does not require the set to be non-empty or unique. The result count is derived from the same list.
- **Counterexamples found:**
  1. `required_checks: []` produces no required-check failures and can allow `promotable: true` if all non-check evidence passes.
  2. `required_checks: ['build', 'build']` validates the same evidence object twice and reports two passed checks, creating a misleading completeness metric.
  3. A materially weakened checklist can omit security-, accessibility-, rollback-, or adversarial-review checks without the assessor distinguishing intentional policy change from accidental or malicious erosion.
- **Competing explanations considered:** The checklist may be treated as separately trusted policy. That explanation is insufficient because the assessor is the final fail-closed decision point and currently emits no policy-integrity warning or digest that would expose check-set erosion.
- **Repair or refinement:** Require a non-empty, duplicate-free required-check set. Bind the exact normalized set to the result with a deterministic digest or explicit sorted list. Where a canonical baseline exists, require a checklist policy version or baseline digest and reject unrecognized reductions.
- **Remaining uncertainty:** The repository’s canonical checklist producer and all schema-version-6 consumers have not been inventoried. It is not yet established whether variable check profiles are intentional.
- **Outcome:** Research direction adopted: check-set integrity before further freshness or provider work.
- **Robustness increased:** Yes, at the problem-definition level.
- **Next falsifiable step:** Add disposable tests proving an empty set and duplicate names are rejected while an explicitly versioned approved profile passes.

## Checkpoint 2 — after producing the proposal artifact

- **Claim or design under test:** Non-empty and uniqueness checks alone are sufficient.
- **Challenge method:** Attempt policy-erasure and compatibility counterexamples against the proposed repair.
- **Evidence:** A unique one-item set such as `['build']` would satisfy non-empty and uniqueness requirements while silently removing eight checks from the current test fixture’s profile.
- **Failure found:** Set-shape validation prevents zero-check and duplicate-count failures but does not prevent semantic policy erosion.
- **Repair or refinement:** Use a two-layer contract:
  1. Structural integrity: array, non-empty, unique, normalized names.
  2. Policy identity: an approved `required_check_profile` identifier plus a deterministic digest of the ordered or canonically sorted check set. The assessor must reject an unknown profile, digest mismatch, or unexplained reduction. Intentional profile changes require a new profile version and adversarial review evidence.
- **Safer reversible alternative:** Initially emit fail-closed failures for empty/duplicate sets and a non-blocking diagnostic for absent profile identity, then advance the schema only after consumer inventory. This avoids silently changing downstream result parsers.
- **Rollback test:** Because the proposed work is source and fixture only, rollback is a normal commit revert. No provider state requires restoration.
- **Remaining uncertainty:** Whether order is semantically meaningful; whether separate profiles are needed for local preview, provider preview, and production promotion; whether check names should be backed by stable IDs rather than free text.
- **Outcome:** Proposal refined from shape-only validation to profile-bound integrity.
- **Robustness increased:** Yes.
- **Next falsifiable step:** Inventory checklist producers and result consumers, then test both sorted-set and order-sensitive digest models against current artifacts.

## Checkpoint 3 — verification before declaring success

- **Claim or design under test:** This run established an implemented promotion repair.
- **Challenge method:** Re-read the current assessor and test fixture and distinguish observed source behavior from unexecuted or uncommitted claims.
- **Evidence:** Current source still defaults invalid or absent required-check input to an empty list and contains no empty-set, duplicate-name, profile-ID, or digest validation. Current tests use a nine-name list but contain no negative control for empty, duplicate, or reduced check sets.
- **Failure or counterexample found:** The repair is not implemented; only the defect and a stronger design are durably documented. Claiming operational enforcement would be false.
- **Repairs made in this run:** Added this durable adversarial record with explicit counterexamples, a two-layer repair design, rollback boundary, and test plan. No runtime or deployment path was changed.
- **Evidence quality:** Direct source inspection, high confidence for the existence of the gap; no runtime test output; no canonical checklist-producer inventory.
- **Remaining uncertainty:** Exact canonical profile, consumer compatibility, and whether another upstream validator already enforces checklist identity.
- **Outcome:** Success declaration rejected. Promotion remains blocked.
- **Robustness increased:** Yes at the evidence and design level; no operational enforcement increase yet.
- **Rollback route:** Revert this evidence commit if the record is found inaccurate. No other state changed.
- **Evidence required before publication:**
  - Exact-commit passing negative controls for empty, duplicate, unknown-profile, digest-mismatch, and reduced-set cases.
  - Inventory of every checklist producer and schema-version-6 result consumer.
  - Proof that the canonical promotion command invokes the strengthened assessor fail-closed.
  - Fresh, authenticated, commit-matched deployment and required-check evidence after the policy repair.
- **Next falsifiable step:** Implement structural set validation plus profile identity in a disposable branch or additive validator, run exact-commit tests, and prove `required_checks: []` cannot yield `promotable: true`.

## Strongest surviving proposal

Promotion evidence must bind not only each check result but also the integrity and identity of the required-check policy itself. The assessor should reject empty, duplicate, malformed, unknown-profile, digest-mismatched, or unexplained reduced check sets. An approved profile change must be explicit, versioned, adversarially reviewed, and visible in the result schema.

## Rejected alternatives

- Trusting the checklist as infallible input.
- Requiring only a non-empty list.
- Requiring only uniqueness.
- Using the passed-check count as proof of coverage.
- Hard-coding the current nine names without inventorying legitimate profile variants.
- Claiming implementation or verification from a design record alone.

## Unresolved risks

- Canonical checklist location and producer ownership remain unverified.
- A profile digest can still legitimize a weak profile if profile approval is not governed.
- Free-text check names may drift or alias.
- Result schema changes may break uninventoried consumers.
- Runtime passage, canonical invocation, deployment identity, browser behavior, accessibility, privacy, performance, and rollback execution remain unverified.

## Publication or promotion decision

**Blocked.** Deployment evidence status is absent/non-success for this run. No operational repair was implemented or executed.