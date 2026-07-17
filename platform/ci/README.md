# Sovereign CI workers and test orchestration

## Decision

The project owns the canonical test graph, dispatcher policy, worker image, evidence format, retry semantics, and release-job authorization. GitHub Actions is one replaceable scheduling adapter, not CI authority.

## Strongest surviving implementation

1. A project dispatcher accepts an exportable job specification containing source, worker-image, toolchain, dependency-closure, and test-manifest digests.
2. Each job receives a fresh single-use microVM or equivalently isolated machine, a clean root filesystem, bounded cgroups, no host Docker socket, no cloud metadata route, and deny-default networking.
3. Dependencies and toolchains come only from admitted project custody. Workflow actions are pinned by immutable commit.
4. Pull-request jobs receive no secrets. Privileged jobs use workload identity and credentials leased for at most 15 minutes. Release signing keys never enter workers.
5. Completion produces signed evidence outside the worker: input digests, worker image, test manifest, exit code, logs, timing, and attempt identity. Retry creates a new attempt rather than rewriting the first.
6. Release-affecting builds require two independent rebuilds and two-operator promotion.
7. Worker images, job specifications, and evidence stores remain recoverable without GitHub or public DNS.

## Adversarial findings

Persistent runners were rejected because job code can retain credentials, processes, filesystem residue, or compromise for later jobs. A container alone was rejected as the default trust boundary when it shares a host kernel or privileged runtime socket. ARC was rejected as the initial canonical plane because it adds Kubernetes, controller, cluster identity, and datastore operations before basic two-domain worker isolation is proven. GitHub-hosted runners remain useful independent rebuilders but cannot be the only evidence or execution path.

## Ownership boundary

Project-owned: dispatcher source, test graph, job schema, worker image definition, admission policy, evidence, recovery exports, and release quorum.

Replaceable: GitHub Actions, GitLab CI, Buildkite adapters, Linux, Firecracker or other VM managers, servers, object stores, and network providers.

Not physically owned: processors and firmware, datacenter power, ISP links, internet transit, DNS roots, registries, and public certificate infrastructure.

## Production evidence required

The checked-in inventory is a design fixture. Production admission requires live worker-image digest verification, network and metadata-route inspection, cgroup measurements, proof of single-job destruction, external log receipt, signature validation, independent-domain execution, and a clean-host bootstrap drill.

## Next destructive test

Provision two worker hosts in separate failure domains; boot the same admitted microVM image on each; execute an offline deterministic build; compare artifacts; attempt metadata, Docker-socket, and internet access; inject a fork secret request; kill a worker mid-job; verify immutable partial evidence; destroy both worker roots; rebuild one host from offline custody; and rerun while GitHub and public DNS are unavailable.
