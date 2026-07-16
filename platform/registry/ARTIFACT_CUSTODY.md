# Sovereign Artifact Custody

## Decision

Use a project-operated OCI Distribution registry as the canonical release-artifact store. Release authority refers to immutable manifest digests, never mutable tags. Keep the registry private behind the project reverse proxy; the reference stack binds only to loopback until TLS and authorization are supplied by the networking layer.

## Surviving implementation

- CNCF Distribution Registry v3-compatible service.
- Filesystem-backed object custody on an explicitly selected host path.
- Authentication required through bcrypt htpasswd for the first operational phase.
- Deletion disabled in the registry configuration.
- A mandatory, operator-supplied HTTP secret survives restarts and allows future horizontal replicas to coordinate uploads.
- Health and Prometheus endpoints are loopback-only.
- Read-only container filesystem, dropped capabilities, no-new-privileges, and constrained tmpfs.
- Default outbound OpenTelemetry trace export disabled. Telemetry must be explicitly routed to project-owned collectors.
- Release records must contain `registry/repository@sha256:digest`; tags are navigation aliases only.

## Ownership boundary achieved

The project owns registry configuration, credentials, artifact namespace, release digest selection, storage path, backup copies, restore procedure, and the ability to run the service on any OCI-compatible Linux host. A hosting vendor cannot alter the canonical release without access to project credentials and release records.

This does **not** constitute physical sovereignty. The current host, disks, domain registrar, DNS authority, certificate issuer, upstream network, and internet transit remain external unless separately acquired and operated. The design treats each as replaceable capacity and requires an offline artifact copy plus a second recovery location.

## Build-versus-buy review

### Adopted: CNCF Distribution

Why it survives:

- Implements the OCI/Docker Registry HTTP API rather than a proprietary package protocol.
- Can use local filesystem storage now and S3-compatible storage later.
- Small operational surface compared with Harbor.
- Registry data can be moved with ordinary filesystem tools while preserving the standard API.

Operational cost:

- Project must operate authentication, TLS termination, monitoring, garbage collection, backup, restore, upgrades, and vulnerability response.
- Filesystem storage means one active writer unless shared storage is introduced.

### Rejected for the first phase: Harbor

Harbor adds UI, RBAC, replication, scanning, retention, and policy. It also adds PostgreSQL, Redis, multiple services, migrations, and a materially larger patching and recovery surface. It becomes reasonable when multiple teams and policy domains justify that burden; it is not required to establish artifact custody.

### Rejected as canonical authority: GitHub Container Registry, Docker Hub, cloud registries

They are useful mirrors, but vendor identity, availability, billing, retention rules, and account control would become part of release authority. Exit is possible through OCI copy tools, but sole custody would remain external.

### Deferred: Zot

Zot is OCI-native and attractive for deduplication, sync, and artifact features. It remains a reversible candidate after the Distribution prototype produces measured operational evidence. Adopting it now would substitute feature comparison for restore evidence.

## Adversarial review before adoption

Threats considered:

1. **Mutable-tag substitution** — mitigated by digest-only releases and deployment verification.
2. **Registry credential theft** — not solved by htpasswd alone; requires TLS, short-lived automation credentials, secret rotation, and network restriction.
3. **Host loss or disk corruption** — not solved by a persistent volume; requires independent backups and routine bare restore.
4. **Silent backup corruption** — requires content hashing and pull verification after restore, not merely successful archive creation.
5. **Compromised registry process** — deletion disabled limits accidental removal but does not protect a compromised host from filesystem writes.
6. **Upstream image disappearance** — registry image and all runtime dependencies must themselves be mirrored by digest before declaring air-gap readiness.
7. **Single-person dependency** — bootstrap, credential rotation, backup, restore, and promotion procedures must be executable and documented without private memory.
8. **Capacity exhaustion** — upload failure and garbage-collection behavior need disk-watermark alerts and a tested expansion procedure.

## Verification gate

Run:

```bash
node platform/registry/verify-registry-contract.mjs
```

The static gate verifies the intended hardening invariants. It does not prove the image starts, the health endpoint works, authentication rejects anonymous users, or artifacts survive restoration. Those require a host with an OCI runtime.

The runtime acceptance test is:

1. Generate bcrypt credentials and a random 32-byte HTTP secret.
2. Start the stack with an empty data directory.
3. Push a known image and record its manifest digest.
4. Pull and run by digest.
5. Stop the registry and archive the data directory with a SHA-256 inventory.
6. Destroy the working data directory.
7. Restore onto a second empty host or VM.
8. Start the registry using the same HTTP secret and credentials.
9. Pull by the original digest and compare the image manifest and runnable behavior.
10. Record restore duration, bytes restored, and every manual step.

A backup is not accepted until this destructive restore drill passes.

## Supply-chain boundary

Registry custody proves possession and integrity addressing; it does not prove who built an artifact. The next layer must add project-held signing keys or an offline root with delegated short-lived signing authority, attach build provenance and SBOMs as OCI referrers, and enforce verification before promotion. Keyless signing tied solely to an external identity provider is not sufficient as the sole release authority.

## Remaining dependencies

- OCI container runtime and Linux kernel.
- Registry implementation binaries initially sourced from an upstream project.
- Host hardware, storage media, electricity, and network.
- Reverse proxy, DNS, and TLS for remote access.
- bcrypt credential generation tooling.
- A second geographically separate recovery medium or host.

Each dependency has an exit path: mirror source and images, retain build instructions, export standard OCI content, maintain offline credentials, and keep recovery copies outside the primary failure domain.

## Next falsifiable build step

Implement and run a destructive two-directory restore harness that launches the registry, pushes a fixture artifact, snapshots custody data, deletes the primary copy, restores into a clean location, and proves the original digest can be pulled. Failure of any digest, authentication, or runtime check rejects filesystem custody as operationally ready.
