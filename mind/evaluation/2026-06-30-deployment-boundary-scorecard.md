# Deployment Boundary Scorecard

Score each item 0, 1, or 2.

0 = absent or unsafe.
1 = partially present.
2 = clear, public-safe, and testable.

## Criteria

1. Boundary separation: design, repo, build, deploy, runtime, and config states are not collapsed.
2. Source status: the record states whether it is private-context-informed, file-informed, repo-informed, web-informed, mixed, or unknown.
3. Claim status: the record distinguishes proposal, requirement, verified state, blocked state, and unknown state.
4. Privacy status: the record explicitly says whether the finding is public-safe.
5. Protected-detail absence: no personal, household, health, animal-care, financial, location, relationship, credential, secret, token, raw transcript, or private screenshot detail appears.
6. Missingness: unknown repo/runtime/build/deploy facts are stated plainly.
7. Revision reason: the record explains why the claim or artifact exists or changed.
8. Runtime proof discipline: runtime claims require runtime evidence, not local or repo evidence alone.
9. Configuration discipline: environment needs are described without exposing values.
10. Staleness discipline: old product claims can be superseded, retired, or marked unknown-age.
11. Public proof boundary: acceptable proof types are listed; unsafe proof types are rejected.
12. Release verdict clarity: publish, hold, revise, or reject is stated.

## Passing threshold

- 20+ total: public-safe and structurally useful.
- 16-19: revise before release.
- 10-15: hold; boundary ambiguity remains.
- below 10: reject; claim likely overreaches.

## Hard-fail conditions

Any of these force rejection regardless of score:

- exposes secrets or credential material.
- exposes personal/private details.
- claims hosted runtime success without verification.
- uses raw private transcript or screenshot as public proof.
- hides missingness after a tool or GitHub write failure.
