# Cloudflare Research Team adversarial review — decision vocabulary and provider structure

Decision: **block publication and promotion**
Deployment evidence status: **absent; non-success**
Protected systems changed: **none**

## Checkpoint 1 — before deployment or architectural commitment

- **Claim/design tested:** provider-role validation fails closed for every publication decision and provider structure.
- **Challenge method:** inspected v1 control flow and constructed misspelled/missing decision, unsupported schema, malformed provider, duplicate requirement, duplicate state, and role-authority contradiction counterexamples.
- **Evidence:** v1 applies authority-count consistency only when `current_decision` exactly equals one of two strings; it dereferences each provider before validating provider shape.
- **Failures/counterexamples found:** an unknown decision such as `block_publication` bypassed both decision branches and could return `ok: true`; a `null` provider could throw instead of returning a blocked result. Duplicate control requirements and duplicate state declarations were accepted.
- **Repairs made:** selected an additive v2 preflight validator rather than altering v1 in place. No provider, workflow, deployment, DNS, credential, automation, schedule, or shared state was touched.
- **Remaining uncertainty:** repository-local vocabulary is not yet bound to the canonical publication command or provider APIs.
- **Evidence quality:** direct source inspection plus deterministic disposable fixtures; no authenticated provider evidence.
- **Rollback route:** revert the v2 test commit, then the v2 validator commit.
- **Robustness increased:** yes, at source-contract level.
- **Next falsifiable step:** run the committed v2 suite from an exact `preview` checkout and retain SHA, Node version, stdout, stderr, and exit code.

## Checkpoint 2 — immediately after implementation

- **Claim/design tested:** v2 rejects malformed control-plane input without weakening v1 authority exclusivity.
- **Challenge method:** ran eight safe local Node fixtures covering valid fail-closed state, unknown and missing decisions, schema drift, null provider, duplicate requirements, duplicate non-success states, and authority assigned to a provider whose declared role is `none`.
- **Evidence:** local content-matched execution returned 8/8 passing tests with exit code 0; committed artifacts are `operations/deployment/validate-provider-role-matrix.v2.cjs` and `.v2.test.cjs`.
- **Failures/counterexamples found:** malformed providers required structural preflight before composing v1; otherwise v1 could throw. The repair now returns errors before delegation.
- **Repairs made:** require schema version 2, exact decision vocabulary, a non-empty provider object, object-shaped provider entries, unique non-empty `success_requires`, unique optional branch mappings, unique non-success states, and no authoritative provider with `declared_role: none`.
- **Remaining uncertainty:** tests were content-matched but not executed from the exact committed branch head; canonical gate integration is absent.
- **Evidence quality:** deterministic local runtime evidence plus committed source, but not immutable exact-commit CI evidence.
- **Rollback route:** revert commits `5706646e8357e55d042d470f9f819a619564df5f` and `9d99223f742b164b14de95c05f1e28d16290a776` in reverse order.
- **Robustness increased:** yes; semantic typos and malformed provider entries now fail closed rather than bypassing or crashing validation.
- **Next falsifiable step:** execute `node --test operations/deployment/validate-provider-role-matrix.v2.test.cjs` at exact preview head.

## Checkpoint 3 — verification before declaring success

- **Claim/design tested:** source and local fixture success are sufficient to declare Cloudflare/provider publication enforcement successful.
- **Challenge method:** separated content-matched local execution from exact-commit execution, canonical invocation, provider authentication, deployment identity, branch mapping, quota/cancellation status, stale/superseded state, and rollback execution.
- **Evidence:** committed v2 source and tests; no exact-head runtime transcript, canonical gate binding, authenticated Cloudflare project, commit-matched deployment, quota evidence, cancellation evidence, hostname/DNS authority, or executed rollback.
- **Failures/counterexamples found:** a standalone v2 validator remains bypassable by publication paths that invoke v1 or no matrix validator. A passing local fixture cannot establish deployment success.
- **Repairs made:** no success declaration; Cloudflare remains read-only and non-authoritative; publication and promotion remain blocked.
- **Remaining uncertainty:** direct v1 consumers, canonical publication command integration, Vercel/GitHub Pages reconciliation, provider quotas, cancellation/supersession handling, branch/output mappings, DNS ownership, and rollback execution.
- **Evidence quality:** source-level and content-matched local runtime evidence only; deployment evidence absent and therefore non-success.
- **Rollback route:** revert this evidence commit, then the test and validator commits in reverse order.
- **Robustness increased:** yes at source level; operational robustness remains unproven.
- **Next falsifiable step:** bind v2 into a disposable canonical-gate test and prove an unknown `current_decision` produces a nonzero result before any production integration.

## Strongest surviving Cloudflare design

Keep Cloudflare non-authoritative. Use a provider-neutral, fail-closed role matrix whose schema, decision vocabulary, provider structures, branch mappings, success requirements, authority-role consistency, and non-success states are machine validated before existing authority-exclusivity logic runs. Treat absent, queued, canceled, skipped, superseded, rate-limited, stale, malformed, commit-mismatched, branch-mismatched, repository-mismatched, project-mismatched, failed, error, unknown, or authority-unresolved states as non-success.

## Rejected alternatives

- Trust unrecognized decision strings as blocked by implication.
- Let malformed provider input throw and rely on callers to interpret the exception safely.
- Modify v1 destructively before inventorying consumers.
- Treat duplicate requirements or state declarations as harmless.
- Infer Cloudflare authority from team naming or research artifacts.
- Trigger a deployment to discover configuration.

## Unresolved risks

V2 is not proven to run in the canonical publication path. Vercel and GitHub Pages authority remains unreconciled. No authenticated Cloudflare project, deployment, quota, cancellation, branch, build-output, hostname, DNS, or tested rollback evidence exists.
