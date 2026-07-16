# Continuity Mining adversarial cycle: evidence binding v4

Decision: **block canonical adoption and publication**

Target branch: `continuity/adversarial-evidence-binding-v4`

Protected systems changed: none. No automation, schedule, deployment, production system, credential, DNS, shared state, or irreversible user data was modified.

## Checkpoint 1 — before recovered-knowledge commitment

- **Claim/design tested:** v3 challenge outcomes are sufficiently grounded because they require an outcome label and rationale.
- **Challenge method:** inspect the validator contract and construct semantic counterexamples.
- **Evidence:** v3 accepts free-text evidence and does not require an outcome to reference any particular evidence item; duplicate evidence is not rejected.
- **Failure/counterexample:** an outcome can cite no inspectable evidence relationship, while repeated copies of one statement can inflate apparent support.
- **Repair:** choose an additive v4 wrapper requiring unique challenge IDs, unique retained evidence, and explicit outcome-to-evidence indices.
- **Remaining uncertainty:** string evidence remains weaker than structured evidence objects; canonical consumers are uninventoried.
- **Robustness increased:** yes, at the design-contract level.
- **Evidence quality:** direct source inspection plus disposable counterexample design; no runtime evidence.
- **Rollback route:** delete this isolated branch.
- **Next falsifiable step:** implement negative controls for missing, duplicate, and out-of-range evidence bindings.

## Checkpoint 2 — immediately after implementation

- **Claim/design tested:** v4 fails closed against evidence laundering without destabilizing prior validators.
- **Challenge method:** add disposable Node fixtures for duplicate challenge IDs, absent evidence references, out-of-range references, duplicate references, case/whitespace-normalized duplicate evidence, and an empty rejected-alternative inventory.
- **Evidence:** committed validator and test source on this isolated branch.
- **Failure/counterexample:** implementation remains source-only; no exact-commit execution output exists. Evidence indices also depend on stable evidence-array ordering.
- **Repair:** preserve v3 composition, reject malformed references, and retain explicit rollback and publication blocking.
- **Remaining uncertainty:** no canonical gate invokes v4; no migration inventory exists; evidence is still free text.
- **Robustness increased:** yes, at the source-contract and negative-control coverage levels.
- **Evidence quality:** commit-bound source identity once re-fetched; runtime quality absent.
- **Rollback route:** delete this branch or revert its three commits in reverse order.
- **Next falsifiable step:** execute `node --test operations/continuity/validate-adversarial-review.v4.test.cjs` from the exact branch head and retain SHA, Node version, stdout, stderr, and exit code.

## Checkpoint 3 — verification before success

- **Claim/design tested:** committed artifacts are sufficient to declare operational enforcement.
- **Challenge method:** distinguish source presence from execution, canonical invocation, and publication-gate coverage.
- **Evidence:** exact branch files and commit identities; no CI run, local runtime transcript, or canonical-path trace.
- **Failure/counterexample:** source can exist while all production or publication paths bypass it.
- **Repair:** keep the decision blocked and state the missing evidence explicitly.
- **Remaining uncertainty:** runtime passage, canonical invocation, producer compatibility, evidence semantic adequacy, and migration behavior are unproven.
- **Robustness increased:** yes epistemically, because false-positive success is prevented; operational robustness is not established.
- **Evidence quality:** high for source identity; absent for runtime and operational enforcement.
- **Rollback route:** delete the isolated branch; no external rollback is required.
- **Next falsifiable step:** execute the exact-commit suite, then route a disposable record with an unbound outcome through the canonical Continuity Mining entrypoint and require a nonzero result.

## Strongest surviving design

Compose v4 over v3. Require every checkpoint to have a unique challenge identity and every declared outcome to reference one or more unique retained evidence entries. Reject duplicate evidence after normalization and require at least one explicitly rejected alternative at run level.

## Rejected alternatives

- Trusting free-text outcome rationale without evidence binding.
- Counting duplicate evidence as independent support.
- Replacing v3 destructively before consumer inventory.
- Declaring success from committed source alone.

## Unresolved risks

- Runtime test passage is unproven.
- Canonical Continuity Mining invocation is unproven.
- Evidence remains free text rather than structured, provenance-bearing objects.
- Index-based references may become fragile if evidence arrays are reordered.
- Existing v1-v3 producers and consumers remain uninventoried.

## Publication decision

Blocked. Required evidence before publication: exact-commit runtime output and proof that every canonical Continuity Mining publication path invokes v4 fail-closed.
