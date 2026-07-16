# Sovereign Dependency and Supply-Chain Custody

## Decision

Adopt a project-owned immutable package vault as the canonical dependency source for release builds. Each accepted npm tarball is copied once into content-addressed storage under `blobs/sha512/<digest>.tgz`, verified against the `package-lock.json` SHA-512 SRI, independently hashed with SHA-256, and bound into a canonical index.

A proxy registry may serve the vault, but it is not the authority. The authority is the reviewed lockfile plus the immutable tarballs plus the independently backed-up index.

## Threat model

The system must detect or contain:

- upstream package replacement or deletion;
- DNS, registry, CDN, or TLS-path compromise during intake;
- weak SHA-1-only lock entries;
- Git, branch, local-path, or arbitrary-host dependencies;
- mutable semver resolution during CI;
- lifecycle-script execution during intake;
- cache eviction or corruption;
- compromised proxy-registry metadata;
- tarball mutation after mirroring;
- incomplete backups that preserve metadata but omit package bytes;
- a single operator silently adding an unreviewed dependency.

The vault does not prove that upstream source is benign. It proves that reviewed bytes remain available and unchanged.

## Intake sequence

1. Generate `package-lock.json` with one digest-pinned Node/npm toolchain.
2. Run `dependency-vault.mjs audit`.
3. Review the dependency graph, licenses, lifecycle scripts, native code and transitive additions.
4. Run `dependency-vault.mjs mirror` in a quarantined network-enabled intake worker.
5. Disconnect the worker from upstream networks.
6. Run `dependency-vault.mjs verify`.
7. Sign the canonical index hash with release-authority-adjacent dependency-intake authority.
8. Copy the vault to at least two independent storage domains.
9. Permit release builders to read only the admitted vault snapshot.

Commands:

```bash
node platform/dependency-custody/dependency-vault.mjs audit package-lock.json
node platform/dependency-custody/dependency-vault.mjs mirror package-lock.json /srv/foundation/npm-vault
node platform/dependency-custody/dependency-vault.mjs verify package-lock.json /srv/foundation/npm-vault
node platform/dependency-custody/dependency-vault.test.mjs
```

## Adversarial review before adoption

### npm cache as canonical custody

Rejected. npm documents its cache as a cache rather than a reliable persistent store, allows automatic removal of corrupted content, and exposes no supported direct content-management interface. It can accelerate an install but cannot be the sole recovery source.

### Verdaccio as canonical authority

Rejected in that role. Verdaccio is useful as a replaceable serving and metadata compatibility layer, but a warmed proxy can still be incomplete, mutable by configuration, and operationally coupled to its storage format. It may front the immutable vault after an import/restore test.

### public npm registry plus lockfile

Rejected. A lockfile records identity and resolution, but does not guarantee future availability. Registry account actions, package deletion, network failure, policy changes and upstream compromise remain outside project control.

### committing `node_modules`

Rejected. It mixes platform-specific generated state with source, hides package provenance, creates large diffs, and does not preserve original canonical tarballs or installation semantics.

### committing all tarballs directly to Git

Rejected as the primary design. Git is inefficient for large immutable binary histories and makes source-forge availability part of package recovery. Small emergency fixtures are acceptable; the canonical vault belongs in independently replicated object or filesystem storage.

## Adversarial review after implementation

The implementation fails closed on:

- absent lockfiles;
- lockfile formats below version 3;
- missing exact package versions;
- missing resolved tarball URLs;
- non-HTTPS resolution;
- registry hosts outside the policy allowlist;
- missing or malformed SRI;
- SHA-1 or other non-SHA-512 integrity;
- lockfile/index disagreement;
- missing vault blobs;
- SHA-256, SHA-512 or SRI mismatch;
- canonical index mutation.

The current policy deliberately rejects Git and arbitrary tarball dependencies. A future exception requires vendoring the bytes, recording source provenance and approving a new policy version.

## Verification status

A deterministic adversarial test harness is committed. It constructs a valid one-package vault and then requires rejection for weak integrity, blob corruption and a foreign registry host.

The repository itself remains blocked because it has no `package-lock.json`; therefore no real dependency graph has been admitted or mirrored. The mirror path also requires a network-enabled intake worker and durable storage, neither of which is available in the repository connector.

## Serving design

Release workers should not contact npmjs.org. They should consume a read-only snapshot through one of two replaceable adapters:

1. a minimal project-owned HTTPS package endpoint generated from the admitted index; or
2. Verdaccio populated only from admitted snapshots, with all upstream uplinks disabled for release workers.

The vault and index remain canonical so either adapter can be destroyed and reconstructed.

## Backup and restore contract

A valid backup contains:

- the reviewed `package-lock.json`;
- `policy.json`;
- every indexed tarball;
- `index.json`;
- the detached index signature and public verification material;
- inventory hashes for the backup container itself.

Restore succeeds only when a clean host can verify the index, verify every blob, install with upstream networking denied, build twice, and reproduce the authorized artifact digest.

## Ownership boundary achieved

The project now owns the package-admission policy, content-addressed layout, integrity verifier, canonical index format, mirror procedure, mutation tests and recovery contract.

It does not yet own or control npm publishing, upstream maintainer accounts, original source repositories, public certificate authorities, network transit, storage hardware, CPU/firmware, or a complete mirrored dependency set. Those remain external dependencies during intake, but none is intended to remain the sole build-time or recovery path.

## Operational burden and cost

Storage cost is modest for the current application but grows monotonically across admitted versions and browser binaries. The real cost is review and maintenance: dependency updates, vulnerability triage, lifecycle-script analysis, native-build review, index signing, storage replication, restore drills and proxy patching.

Browser automation is the largest likely package and bandwidth cliff. Playwright browser archives should be admitted as a separate content-addressed class rather than being silently downloaded by package lifecycle scripts.

## Strongest surviving implementation

- immutable SHA-512-addressed tarball vault;
- SHA-512 lockfile verification plus independent SHA-256 inventory;
- canonical index detached from any registry implementation;
- quarantined network-enabled intake;
- networkless release builds;
- replaceable serving adapter;
- multiple independent backups;
- fail-closed restore verification.

## Next falsifiable build step

Generate the repository lockfile with a pinned npm release, audit all resolved entries and lifecycle scripts, mirror the complete graph, then execute this destructive test:

```text
install and build from the vault with internet denied
→ delete the serving registry and primary vault copy
→ restore from an independent backup
→ verify every tarball and the signed index
→ reinstall with internet denied
→ rebuild twice on clean workers
→ require the original artifact digest
→ mutate one tarball and require failure before extraction
```

The dependency layer is not operationally sovereign until that test passes.
