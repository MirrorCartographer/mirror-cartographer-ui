# Sovereign Dependency and Toolchain Supply Chain

## Authority

The project owns the dependency catalog, exact admitted bytes, metadata snapshots, patch set, toolchain closure, revocation decisions, and offline reconstruction evidence.

A lockfile is a resolver record. A registry is a distribution mechanism. A scanner is an evidence producer. A Nix binary cache is an acceleration store. None is canonical supply-chain authority.

## Surviving architecture

```text
upstream registry / VCS / release site
              ↓ isolated networked intake
exact transport bytes + redirect chain
              ↓
content digest + unpacked-tree digest
              ↓
metadata, signature, license, script,
patch, platform, and dependency analysis
              ↓ quarantine
              ↓
two-person admission
              ↓
canonical dependency catalog
              ↓
two online cross-implementation mirrors
              +
offline portable closure export
              ↓
network-disabled canonical build
```

## Identity

Package name and version do not uniquely identify dependency content. The catalog binds ecosystem, source URI, resolved revision, archive digest, unpacked-tree digest, metadata snapshot, license digest, build-script digest, patch digest, platform variants, and dependency reason.

## Ecosystem controls

### npm

Use `package-lock.json`, recorded integrity, and `npm ci`. Lifecycle scripts are disabled by default. A linked or otherwise isolated install is tested to expose undeclared phantom dependencies. Exact tarballs and registry metadata are retained.

### Go

Retain `go.mod`, `go.sum`, proxy-format `.info`, `.mod`, and `.zip` files, plus checksum evidence. Canonical builds use only the project proxy and prohibit `direct` fallback. `go mod verify` and offline reconstruction are mandatory.

### Python

Retain wheels, source distributions, hashes, normalized Simple API pages, yanked markers, project status, metadata, and attestations when available. Resolution uses hashes and no public-index fallback.

### Nix

Export the complete store closure, derivations, sources, NAR metadata, and signatures. Verify contents and require two project-controlled signatures for substituted non-content-addressed paths. A cache hit is not source-rebuild evidence.

## Update admission

Automated tools may discover updates but cannot admit them. Every update produces a diff manifest covering owner or maintainer changes, scripts, licenses, native code, transitive dependency count, vulnerability delta, platform outputs, and reproducible rebuild results.

## Revocation

Upstream yanking or deletion does not automatically delete project bytes. A project revocation ledger blocks known-bad digests while retaining quarantined forensic custody. Emergency use of revoked content requires two operators and expires automatically.

## TUF boundary

TUF metadata protects project mirrors against rollback, freeze, and key-compromise classes. Root and targets roles use thresholds; root keys remain offline; timestamp is online and separate; snapshot and expiry are mandatory. TUF authorizes catalog objects but does not replace byte hashing or source review.

## Recovery

Recovery must work without GitHub, public registries, public checksum databases, public Nix caches, or the original mirror products. A clean host reconstructs the dependency and toolchain closure from offline export, verifies the catalog and TUF metadata, and rebuilds with the network disabled.

## Ownership boundary

### Project-owned

Dependency identity, exact bytes, metadata snapshots, admission, revocation, mirror policy, TUF trust, patching, closure exports, and rebuild acceptance.

### Replaceable

Verdaccio, devpi, Athens, Goproxy, Nix binary-cache servers, TUF implementations, object stores, registries, VCS hosts, scanners, and physical hosts.

### Not physically owned

Upstream projects, maintainer identities, language standards, public registries, certificate authorities, hardware fabrication, facilities, electricity, DNS, BGP, and internet transit.
