# Sovereign package and OCI registry contract

## Purpose

This control plane defines the project-owned authority for package tarballs, OCI blobs, manifests, referrers, indexes, retention, deletion, export, and recovery. A hosted package or image registry may serve as a cache or transport endpoint, but never as the canonical namespace, artifact authority, or sole recovery path.

## Surviving architecture

1. Admit dependency and OCI bytes only after cryptographic digest verification.
2. Record every admitted object in a project-controlled, append-only canonical index.
3. Store three copies across at least two failure domains, including one immutable offline bundle.
4. Deploy OCI objects by digest; tags are navigation only.
5. Preserve exact manifest bytes and referrer relationships for signatures, SBOMs, and provenance.
6. Perform canonical package installs only from a project mirror, with reviewed lockfiles, tarball integrity, metadata snapshots, and lifecycle scripts denied by default.
7. Export OCI content as OCI Image Layout and packages as a complete metadata-plus-tarball bundle.
8. Run garbage collection only after a dry run, in read-only mode, against an admitted protected-digest set.
9. Prove clean-host reconstruction without public DNS or upstream registries and across a different registry implementation.

## Adversarial conclusions

- Registry tags are mutable pointers, not release identity.
- Replication is not custody when every replica shares one account, storage backend, operator, or deletion authority.
- Content addressing does not prevent deletion, malicious garbage collection, missing referrers, or loss of registry metadata.
- An npm lockfile is insufficient when matching tarballs and metadata remain available only from the public registry.
- A registry backup is not portable unless its bytes and namespace can be reconstructed through standard formats on another implementation.
- Registry administration must not possess release signing keys.

## Ownership boundary

Project-owned: namespace index, admitted digests, retention rules, deletion quorum, access policy, package closure, OCI exports, integrity evidence, restore acceptance, and provider-exit procedures.

Replaceable mechanisms: CNCF Distribution, Harbor, Zot, other OCI registries, npm-compatible proxies, object stores, filesystems, virtual machines, and hosted registry mirrors.

Not physically owned: disk and CPU fabrication, firmware, datacenter power, ISP networks, internet transit, DNS registries, domain registrars, and public certificate authorities.

## Production evidence required

The checked-in inventory is a design fixture. Production admission requires machine-generated evidence: OCI conformance results, digest rehashes after pull, complete manifest/referrer traversal, package metadata and tarball closure hashes, store challenge receipts, GC dry-run output, delete audit records, capacity measurements, clean-host restore logs, cross-implementation import results, and operator signatures.

## Next destructive test

Mirror a complete npm dependency closure and an admitted OCI release into two online registries and one offline OCI-layout/package bundle; disable upstream networking and public DNS; build and deploy from each mirror; delete both registries; restore onto a different implementation from offline custody; compare every digest and referrer; corrupt one blob and prove rejection; run GC while a concurrent upload is attempted and prove the registry remains read-only; then repeat after loss of one operator credential.
