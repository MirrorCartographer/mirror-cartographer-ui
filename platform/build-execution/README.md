# Sovereign Compiler, Build Graph, and Deterministic Execution Plane

## Authority

The project owns the canonical action graph, action-key algorithm, toolchain and platform identities, execution policy, output contracts, reproducibility policy, and evidence. Bazel, BuildStream, REAPI executors, CI services, and caches are replaceable mechanisms.

## Action identity

Each action digest binds the command, declared environment, platform image, toolchain closure, execution policy, input-root digest, and output declaration. Ambient host variables, network access, undeclared reads, host names, current time, and filesystem enumeration order are forbidden or normalized.

## Execution

Canonical actions run in a network-disabled sandbox with read-only inputs, an ephemeral output root, fixed locale/timezone/umask, bounded resources, and `SOURCE_DATE_EPOCH`. High-risk builds use a microVM or dedicated host. Ordinary workers contain no release-signing or registry-deletion authority.

## Remote execution

Use the open Bazel Remote Execution API as the first distributed execution interface. Retain the Action, Command, InputRoot, platform properties, stdout/stderr digests, and output digests. Rehash all CAS objects after transfer. A remote Execute success is operational evidence, never release authorization.

## Reproducibility

Build every release candidate independently in at least two worker domains with caches disabled. Perturb file creation order, locale, timezone, parallelism, temporary paths, and worker implementation. Byte mismatches trigger diffoscope and quarantine. Exceptions expire and require two operators.

## Cache boundary

CAS and action caches accelerate execution but are not canonical artifact custody. Cache eviction must be harmless. Recovery must rebuild with an empty cache and restore cache content into a different implementation.

## Ownership boundary

### Project-owned

Action schema, graph compiler, action digest, toolchain identity, sandbox policy, reproducibility decisions, evidence, and release handoff.

### Replaceable

Bazel, BuildStream, Buildbarn, Buildfarm, BuildGrid, Nix, bubblewrap, Firecracker, CI providers, CAS implementations, VMs, and physical workers.

### Not physically owned

CPU fabrication, firmware, kernels, hypervisors, datacenter power, public networks, upstream compiler projects, and external hardware supply chains.
