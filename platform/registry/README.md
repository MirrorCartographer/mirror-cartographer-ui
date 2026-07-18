# Sovereign package and OCI registry contract

## Surviving architecture

The project owns a signed artifact catalog above every registry implementation. The catalog binds release manifests, OCI descriptors, blob digests and sizes, tags, referrers, package metadata, custody copies, retention holds, and restoration evidence.

```text
normalized artifact + attestations
        ↓
digest and size verification
        ↓
signed project artifact catalog
        ↓
Harbor publication
        ↓
cross-product registry replica
        ↓
portable OCI/package export
        ↓
deployment by manifest digest
```

Harbor is the first operational registry because it supplies project isolation, robot accounts, replication, tag immutability, audit integration, scanning hooks, and garbage collection. A different OCI implementation such as zot is required as the second online copy to prove that the catalog is not Harbor-specific. ORAS-compatible portable export is the offline exit and disaster-recovery path.

## Package custody

Canonical builds install only from the project mirror. A lockfile is necessary but insufficient: the matching tarballs, integrity values, package metadata, transitive closure, and admitted lifecycle-script decisions must all remain in project custody. An upstream deletion, account suspension, or package-registry outage must not prevent clean-host reconstruction.

## Deletion boundary

Registry writers are append-only. They cannot delete artifacts or run garbage collection. Retention and deletion use separate credentials, a signed release-reachability graph, dry-run output, a minimum 48-hour grace period, proof of an independently readable offline copy, and two operators. Replication of deletions is disabled by default.

Tags remain convenience pointers. Release and deployment authority use manifest digests only. Release tags are immutable, but tag immutability is not artifact custody: a privileged registry administrator, object-store failure, or unsafe garbage collection can still remove bytes.

## Ownership boundary

### Project-owned

Artifact catalog, package closure, OCI graph inventory, digest policy, referrer relationships, retention holds, publication policy, replication reconciliation, deletion authority, portable exports, evidence, and recovery acceptance.

### Replaceable

Harbor, zot, CNCF Distribution, ORAS, npm-compatible mirrors, object stores, filesystems, scanners, VMs, physical hosts, cloud registries, and network transports.

### Not physically owned

Storage-hardware and CPU fabrication, firmware, facilities, utility power, transit, BGP, DNS roots, registrars, public CAs, and upstream package publishers.

## Production evidence still required

The checked-in inventory is a design fixture. A real multi-architecture image plus SBOM, provenance, and signature must be pushed to Harbor, reconciled into a different registry, exported with every referrer, garbage-collected under failure injection, and restored from offline custody without Harbor, public DNS, a public CA, or the original object store. A complete npm closure must also build after the public registry and upstream package versions are unavailable.
