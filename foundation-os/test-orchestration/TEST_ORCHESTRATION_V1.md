# Foundation Test Orchestration V1

## Authority chain

Foundation compiles a content-addressed test plan from admitted source, release policy, dependency metadata, and declared risk classes. Replaceable schedulers and workers execute the plan. Foundation accepts or rejects the resulting evidence graph.

`admitted source -> test-plan digest -> hermetic actions -> complete evidence graph -> Foundation release gate`

## Concrete rules

1. Bind every plan to source, artifact, toolchain, environment, target, shard, timeout, and resource-class digests.
2. Run actions in isolated single-use workers with public-network access denied by default.
3. Record every attempt. Never convert a retry into an unqualified pass.
4. Classify product failure, test defect, infrastructure error, timeout, cancellation, flake, quarantine, and not-run separately.
5. Reject release when any required target or shard lacks an accepted terminal result.
6. Reject release when artifact or plan digests differ from the admitted values.
7. Set the release flake budget to zero. Preserve flaky outcomes as evidence and repair the test or product.
8. Require a named owner and expiry for quarantine. Expire quarantine within seven days.
9. Store logs, outputs, attempt records, and result digests outside the executor.
10. Replay critical tests on a second executor implementation before production authorization.

## First implementation

Use Bazel as the first graph compiler and test runner. Its test protocol defines isolated temporary directories, controlled environment variables, timeouts, undeclared-output capture, and sharding contracts. Use a Remote Execution API compatible service only after the local action graph passes completeness and hermeticity tests. Keep Foundation policy and acceptance outside Bazel, Buildbarn, Buildfarm, GitHub Actions, or Forgejo.

## Build versus buy

### Adopt Bazel incrementally

Adopt Bazel for the canonical test-plan graph, target identity, sandbox execution, sharding, timeouts, and Build Event Protocol evidence. Wrap existing npm, Playwright, Node, and Python commands as explicit targets instead of rewriting their test frameworks immediately.

### Adopt Remote Execution API compatibility

Use the open Remote Execution API as the executor boundary. Preserve action and result digests so Buildbarn, Buildfarm, another compatible implementation, or local execution can replace one another.

### Retain native test frameworks

Retain Playwright, Node test runners, pytest, and repository validators as test implementations. Do not let their ad hoc command ordering define the canonical release gate.

### Reject workflow YAML as the test authority

GitHub or Forgejo workflow files invoke the Foundation plan. They never define complete test coverage or result acceptance.

### Reject silent retry and permanent quarantine

Retries reveal nondeterminism. Quarantine remains temporary debt with an owner, expiry, and release consequence.

### Reject a custom distributed executor

Do not build scheduling, CAS, streaming logs, worker leases, retries, cancellation, and garbage collection before measured constraints justify that burden.

## Pre-adoption adversarial review

- A provider reports green after a required job is skipped. The completeness validator rejects missing target evidence.
- A shard crashes and the remaining shards pass. The gate rejects incomplete shard accounting.
- A retry passes after an initial failure. The result remains flaky and blocks release.
- A remote cache returns evidence for another artifact. Digest binding rejects the result.
- A test writes undeclared files or reads ambient state. Hermetic execution and undeclared-output rules expose the dependency.
- A scheduler suppresses logs. Evidence stored outside the executor and replay on a replacement executor detect the gap.
- A broad integration test becomes permanently quarantined. Seven-day expiry forces repair or explicit release rejection.
- One operator understands the plan compiler. Blank-host reconstruction by a second operator remains a required laboratory.

## Post-artifact adversarial review

The policy and validator prove declared invariants only. They do not prove that the current repository has a complete target graph, hermetic browser tests, stable sharding, representative coverage, or executor replacement. A green policy validator never proves product correctness.

## Ownership boundary

Foundation owns test policy, plan compilation, target inventory, result-state semantics, completeness checks, evidence acceptance, quarantine rules, and release gating. Foundation does not own CPU fabrication, firmware, electricity, internet transit, Linux, Bazel, browser engines, language runtimes, or upstream test frameworks. Physical worker ownership increases custody but does not eliminate these dependencies.

## Operational cost

Track graph size, critical-path duration, cache hit rate, missing-result count, infrastructure-error rate, flake rate, quarantine age, replay divergence, executor replacement time, and operator interventions. Bazel migration adds target-definition and toolchain-maintenance work. Remote execution adds CAS capacity, scheduler patching, worker diversity, and garbage collection.

## Exit paths

Export the canonical plan manifest and evidence schema. Preserve native test commands behind explicit targets. Run the same plan locally and through a Remote Execution API implementation. Replace Bazel only after another compiler reproduces target identities, dependencies, and acceptance evidence.

## Next falsifiable laboratory

1. Inventory every current repository test command.
2. Compile them into explicit targets with declared inputs, outputs, timeouts, and risk classes.
3. Generate a plan digest.
4. Run the plan on clean local workers.
5. Inject one missing target, one missing shard, one infrastructure error, one timeout, one flaky pass-after-failure, one expired quarantine, and one artifact-digest mismatch.
6. Require the acceptance gate to reject every mutation.
7. Replay critical targets through a second executor.
8. Compare result and output digests.
9. Destroy the first scheduler.
10. Reconstruct the plan and evidence service from repository-controlled artifacts with a second operator.

Pass only when every required target is accounted for, every hostile mutation fails closed, and a replacement executor reproduces accepted critical results.
