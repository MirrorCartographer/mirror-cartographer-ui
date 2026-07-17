# Foundation Release Authority

This control plane makes a signed, content-addressed release envelope—not a registry tag, CI run, source-host release, or deployment provider—the admission authority for software promotion.

## Surviving design

1. Build an OCI image/layout or other immutable artifact.
2. Hash the exact bytes with SHA-256.
3. Record source commit, build recipe digest, builder identity, reproducibility status, bounded validity, custody locations, and the previous release-envelope digest.
4. Require Ed25519 signatures from at least two distinct operators, including at least one non-online key.
5. Verify bytes, signatures, custody topology, expiry, and ledger continuity before promotion.
6. Store the artifact in three copies across at least two failure domains. Treat OCI registries as replaceable distribution caches.
7. Roll back only by issuing a new signed release that points to an older artifact digest; never mutate history or trust a moving tag.

## Build versus buy

- **Adopt OCI Distribution implementations** for transport interoperability. Do not delegate canonical custody or release authority to them.
- **Adopt TUF role separation later** for production key rotation, timestamp/snapshot freshness, delegated targets, and compromise recovery. This prototype first proves the narrower project-specific admission contract.
- **Adopt SLSA/in-toto provenance envelopes** as evidence inputs. Provenance alone is not release authorization.
- **Reject hosted-registry-only designs** because account loss, deletion, policy changes, or regional failure can remove both delivery and recovery.
- **Reject tag-based promotion** because tags are mutable names, not identities.
- **Reject one CI signing key** because compromise of a continuously online worker would become full release compromise.

## Ownership boundary

Project-owned software and records: policy, trusted public roots, signing ceremony, release envelopes, promotion decisions, artifact digests, custody map, export/restore procedure, verifier, and test corpus.

Commodity and replaceable: registry servers, object-store implementations, disks, cloud VMs, CI execution hosts, and network paths.

Not owned without physical infrastructure: disk controllers, firmware, power, facilities, ISP transit, DNS registry/registrar operation, and the public Internet routing system.

## Unresolved before production

- Replace the compact envelope with compatible TUF/in-toto metadata or prove a migration bridge.
- Define offline root-key ceremony, encrypted media custody, revocation, quorum loss, and operator succession.
- Add deterministic canonical JSON encoding; current signatures cover JavaScript's emitted JSON byte sequence.
- Prove multi-host reproducible builds before requiring `reproduced` for production.
- Implement append-only ledger storage with independent exports and restore drills.
- Exercise registry loss, object-store corruption, stale metadata, key compromise, and clean-host recovery.

## Test

```sh
node platform/release/test.mjs
```
