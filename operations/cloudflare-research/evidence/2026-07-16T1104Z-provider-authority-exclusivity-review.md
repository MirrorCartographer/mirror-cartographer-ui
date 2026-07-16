# Cloudflare Research Team adversarial review — provider authority exclusivity

Decision: **block publication and promotion**
Deployment evidence status: **absent; non-success**
Protected systems changed: **none**

## Checkpoint 1 — before deployment or architectural commitment

- **Claim/design tested:** `PROVIDER_ROLE_MATRIX.json` fail-closes publication until exactly one canonical publisher exists.
- **Challenge method:** inspected the matrix as an executable contract; constructed zero-authority, dual-authority, ambiguous-authority, and terminal-state omission counterexamples.
- **Evidence:** schema v1 contained a prose precedence rule but no validator; `failed`, `error`, and `unknown` were absent from global non-success states.
- **Failure/counterexample found:** prose did not prevent a future consumer from accepting two authoritative providers or permitting publication with none. A failed or unrecognized provider state was not explicitly classified as non-success.
- **Repair/refinement:** selected an additive validator plus disposable fixtures; no provider, workflow, deployment, DNS, credential, schedule, automation, or shared state was touched.
- **Remaining uncertainty:** the authority vocabulary is repository-local and not yet bound to provider APIs or the canonical publication command.
- **Rollback route:** revert the validator and matrix-policy commits.
- **Robustness increased:** yes, at source-contract level.
- **Next falsifiable step:** execute the validator test suite at the exact preview commit and retain stdout, stderr, exit code, runtime version, and SHA.

## Checkpoint 2 — immediately after implementation

- **Claim/design tested:** the additive validator rejects authority contradictions without accidentally authorizing Cloudflare or another provider.
- **Challenge method:** added safe in-memory negative controls for dual authority, zero authority during an allow decision, authority hidden under a blocked decision, unknown authority vocabulary, and omission of `failed`, `error`, or `unknown`.
- **Evidence:** `validate-provider-role-matrix.v1.cjs`, its Node test file, and schema-v2 matrix changes on `preview`.
- **Failure/counterexample found:** the initial matrix itself lacked the three terminal/indeterminate non-success states required by the new validator.
- **Repair/refinement:** matrix schema advanced to v2 and now explicitly classifies `failed`, `error`, and `unknown` as non-success.
- **Remaining uncertainty:** validator integration into `test:local-gate`, promotion assessment, and any Pages workflow is not established.
- **Rollback route:** revert test commit, matrix-v2 commit, then validator commit.
- **Robustness increased:** yes; authority exclusivity and fail-closed state vocabulary are now machine-checkable.
- **Next falsifiable step:** run the suite, then prove the canonical publication path fails when a disposable matrix names both Vercel and GitHub Pages authoritative.

## Checkpoint 3 — verification before declaring success

- **Claim/design tested:** committed artifacts are sufficient to declare provider-role enforcement successful.
- **Challenge method:** distinguish source presence from runtime execution, canonical integration, provider identity, and deployment evidence; treat all missing or stale evidence as non-success.
- **Evidence:** committed source and fixtures only. No retained runtime output, authenticated Cloudflare project metadata, commit-matched provider deployment, quota state, cancellation state, hostname/DNS authority, or tested rollback exists.
- **Failure/counterexample found:** a standalone validator can be bypassed by any publication path that does not invoke it. Committed tests are not executed evidence.
- **Repair/refinement:** success is not declared; publication and promotion remain blocked. Cloudflare remains read-only and non-authoritative.
- **Remaining uncertainty:** canonical invocation, provider-role reconciliation with GitHub Pages and Vercel, exact project identity, quotas, cancellations, branch mappings, output mappings, DNS ownership, and rollback execution.
- **Rollback route:** revert this evidence commit, the test commit, the matrix-v2 commit, and the validator commit in reverse order.
- **Robustness increased:** yes at source level; operational robustness remains unproven.
- **Next falsifiable step:** execute `node --test operations/deployment/validate-provider-role-matrix.v1.test.cjs` at exact preview head and integrate it fail-closed into the canonical gate only after passing evidence is retained.

## Strongest surviving Cloudflare design

Cloudflare has no publication authority. Maintain a provider-neutral, fail-closed role matrix that permits publication only with exactly one explicit canonical publisher, or a separately validated multi-provider design with precedence, domain ownership, evidence equivalence, cancellation behavior, and rollback semantics. All absent, queued, building, canceled, skipped, superseded, rate-limited, stale, failed, error, unknown, commit-mismatched, branch-mismatched, repository-mismatched, project-mismatched, or authority-unresolved states remain non-success.

## Rejected alternatives

- Rely on prose precedence without executable validation.
- Infer Cloudflare authority from the team name or historical artifacts.
- Treat `declared_but_not_runtime_verified` as canonical authority.
- Permit publication with zero or multiple authoritative providers.
- Treat failed, error, or unknown provider states as implicit success.
- Trigger a deployment merely to discover provider configuration.

## Unresolved risks

The validator has not been executed with retained exact-commit evidence and is not proven to be in the canonical publication path. Vercel and GitHub Pages authority remains unreconciled. No authenticated Cloudflare project, deployment, quota, cancellation, branch, build-output, hostname, DNS, or rollback evidence exists.
