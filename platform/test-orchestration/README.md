# Sovereign Test Orchestration and Evidence Plane

The project owns the test catalog, test identities, requirement links, fixtures, oracle versions, execution plan, flake decisions, and release gate. CI providers and test frameworks execute adapters only.

## Surviving design

A canonical catalog is compiled into deterministic shards. Each shard has a manifest digest. Runners must prove sharding support, emit canonical result records, retain raw framework output, and reconcile planned versus executed test IDs.

A failed first attempt remains a failed test result. Diagnostic retries produce additional attempts; they cannot rewrite the first failure into a pass. Quarantine expires within 14 days, requires an owner and issue, and needs explicit release-risk acceptance.

Critical release candidates replay required tests in two runner implementations across two failure domains. Missing results, infrastructure errors, undersized samples, and missing telemetry fail closed.

Performance tests use dedicated hardware, hardware fingerprints, warm-up, at least 30 samples, confidence intervals, and both absolute and relative regression limits.

Recovery must work without GitHub Actions, a dashboard, the original runner, or public network access.

## Authority boundary

### Project-owned
Test catalog, requirements mapping, fixture and oracle identity, execution plan, sharding, flake policy, gate decisions, evidence, and replay acceptance.

### Replaceable
Bazel, pytest, JUnit reporters, GitHub Actions, Buildkite, Prow, TestGrid, runners, VMs, containers, and benchmark hosts.

### Not physically owned
Processor fabrication, firmware, operating-system kernels, facilities, power, public networks, and external CI infrastructure.
