# Sovereign deterministic build execution

Status: implementation-ready, fail-closed pending dependency lock generation and a Docker BuildKit execution host.

## Capability and claim

This layer owns the transformation from an admitted source commit plus declared dependencies into a content-addressed web artifact. It does not claim that containers alone are hermetic, that a lockfile alone proves reproducibility, or that self-hosting a runner makes its hardware trustworthy.

The accepted build contract is:

```
source commit
+ reviewed package-lock.json
+ digest-pinned build image
+ fixed build definition
+ explicit SOURCE_DATE_EPOCH
+ isolated compilation network
= candidate artifact

candidate artifact A == independently rebuilt artifact B
= reproducibility evidence
```

A candidate is not releasable merely because one build succeeded. The double-build inventory must match and the release-authority layer must separately authorize the resulting digest.

## Strongest surviving implementation

`Dockerfile.reproducible` separates dependency intake from compilation. Dependency intake currently needs network access to an npm endpoint; compilation runs with BuildKit `RUN --network=none`. `npm ci` refuses a package/lock mismatch and does not update the lockfile. Dependency lifecycle scripts are disabled during intake because they execute untrusted third-party code. Any required native post-install step must later be explicitly allowlisted, executed in its own sandbox, and represented in provenance.

`build-reproducible.sh` requires:

- a complete Git commit;
- commit-derived `SOURCE_DATE_EPOCH`;
- a Node image reference containing `@sha256:`;
- `package-lock.json`;
- Docker Buildx;
- two no-cache builds;
- byte-content inventories that compare equal.

The build result records the source commit, base-image digest, epoch, artifact inventory digest, number of reproductions, and current network boundary.

## CI worker architecture

The project-owned control plane should dispatch jobs to single-use workers rather than grant a persistent runner access to the Docker socket.

Recommended sequence:

1. A coordinator receives an authenticated source event and creates an immutable job record.
2. A worker manager clones a clean VM or physical-machine snapshot.
3. The worker receives only the source bundle, build policy, one-job registry credential, and job identifier.
4. Dependency intake may reach only the project npm mirror. Compilation has no network.
5. The worker uploads unsigned candidate artifacts and evidence to quarantine storage.
6. Verification occurs on a second worker with no shared build cache.
7. Both workers are destroyed or securely reimaged.
8. Release authority operates outside the workers.

A long-lived Docker-socket runner is explicitly rejected for production because a hostile build can normally obtain host-equivalent control. Rootless containers reduce but do not remove kernel, filesystem, and daemon attack surface. One job per disposable VM is the initial production boundary.

## Adversarial review before adoption

### Claim: a lockfile makes builds deterministic

Rejected. A lockfile freezes package resolution, but output can still vary through mutable base images, clocks, locale, generated ordering, host architecture, package lifecycle scripts, undeclared network downloads, compiler versions, or non-deterministic bundler behavior.

### Claim: a self-hosted CI runner is sovereign

Rejected. Self-hosting moves operation to the project but does not establish isolation, reproducibility, or release authority. A persistent privileged runner can become a durable compromise point.

### Claim: Docker is a hermetic build system

Rejected. Dockerfiles can access networks, mutable tags, host-provided secrets, caches, and platform-dependent behavior. This implementation uses Docker as an execution substrate with additional fail-closed policy.

### Claim: identical source implies identical dependency input

Rejected in the current repository because `package-lock.json` is absent. The build therefore intentionally blocks.

## Adversarial review after artifact production

The produced files were reviewed against these failure modes:

- mutable Node image tags: rejected by `@sha256:` check;
- absent lockfile: rejected before build;
- package/lock divergence: rejected by `npm ci`;
- transitive install scripts: disabled;
- downloads during compilation: rejected by BuildKit network isolation;
- timestamp drift: normalized through `SOURCE_DATE_EPOCH` and `touch`;
- cache-dependent success: proof builds use `--no-cache`;
- one-off accidental equality claim: two runs are mandatory;
- filenames matching while bytes differ: every file is SHA-256 inventoried;
- release by CI worker: not permitted; output remains an unsigned candidate.

## Verification status

Static contract verification is executable through:

```bash
node platform/build/verify-build-contract.mjs
```

Expected current result: all structural invariants pass, followed by exit code 2 because the repository has no `package-lock.json`.

The dynamic double-build proof has not run because this execution environment has neither repository network access nor an available Docker BuildKit daemon. This is a hard evidence gap and is not represented as success.

## Build-versus-buy comparison

### Adopted now: BuildKit plus project policy and disposable workers

Reasons:

- build definition and enforcement remain in the repository;
- standard OCI-compatible tooling;
- compilation-level network controls;
- local and commodity-host execution;
- straightforward migration to another scheduler;
- no hosted CI system becomes release authority.

### Rejected as canonical build authority: GitHub-hosted Actions

Useful as an additional independent rebuilder or mirror test, but runner images, scheduling, identity, logs, and availability are externally controlled. It cannot be the only evidence producer.

### Deferred: Nix

Nix provides stronger input-addressed package construction and sandboxing, but adopting it correctly requires pinning Nixpkgs, maintaining derivations for browser-test dependencies, operating binary caches, and training recovery operators. It remains a strong candidate after the current Node build is reproducibly demonstrated, not a shortcut around understanding existing inputs.

### Deferred: Bazel

Bazel offers explicit build graphs, remote execution, and caching. For the current Vite application, conversion cost and remote-cache operation exceed demonstrated need. It becomes justified when the Reader/compiler graph contains multiple languages and substantial incremental builds.

### Rejected: persistent privileged Docker runner

It creates a single durable host compromise boundary and makes cleanup evidence weak. Convenience does not survive the threat review.

## Ownership boundary achieved

The project now owns:

- build policy;
- build definition;
- admitted source identity;
- dependency-lock requirement;
- base-image pin requirement;
- compilation network policy;
- reproducibility test method;
- candidate artifact identity;
- CI-worker isolation specification;
- migration path away from any scheduler.

The project does not yet own or eliminate:

- the npm upstream package ecosystem;
- Node.js source and release infrastructure;
- Linux kernel, CPU, firmware, or container runtime implementation;
- the physical CI machines;
- electricity and network transit;
- an internal npm mirror;
- a reviewed lockfile;
- an executed two-machine reproduction result.

Those dependencies are acceptable only while mirrored, pinned, independently backed up, and replaceable.

## Exit paths

- BuildKit can be replaced by Nix, Bazel, Buildah, or another executor because the semantic inputs and output inventory are explicit.
- A cloud VM worker can be replaced by local hardware or another provider without changing release authority.
- npm upstream can be replaced by a project mirror once package tarballs and integrity metadata are imported.
- GitHub event intake can be replaced by the future project-owned source forge; job records and source bundles remain portable.

## Risks and operational implications

- Dependency scripts disabled during install may break packages that legitimately require compilation; exceptions need explicit review.
- Two clean builds approximately double compute cost for release candidates.
- Disposable VMs add startup latency and image-patching work.
- Cross-architecture output may differ even when each architecture is internally reproducible.
- SHA-256 inventory equality proves bytes, not semantic correctness.
- A compromised base-image publisher can serve malicious content before the digest is admitted; digest review and mirroring are still required.
- BuildKit and Docker are part of the trusted computing base and must be pinned, patched, and independently recoverable.
- One operator can still weaken policy unless changes require reviewed policy commits and production promotion uses threshold release authority.

## Cost model

At the present application size, two single-use 2-vCPU workers per release should cost minutes of commodity compute rather than continuous large infrastructure. The dominant cost is operational: maintaining golden worker images, patching the runtime, preserving dependency mirrors, reviewing lock changes, and running destructive isolation tests. Dedicated physical workers remove per-minute provider cost but add hardware purchase, replacement, power, cooling, remote access, and spare-part burden.

## Next falsifiable build step

1. Generate `package-lock.json` with one pinned npm version in a quarantined environment.
2. Review every resolved package, integrity field, lifecycle script, Git dependency, and non-registry URL.
3. Commit the lockfile and exact npm configuration.
4. Pin the Node base image by digest and mirror that digest into the project registry.
5. Run the double-build harness on two independently initialized workers with empty caches.
6. Require identical inventories.
7. Mutate one dependency tarball in the mirror and require integrity failure.
8. Add a test build step that attempts outbound access and require failure.
9. Rebuild on a second physical or provider boundary and compare output.
10. Only then attach provenance and submit the candidate digest to release authority.
