# Sovereign Artifact Custody and OCI Registry Plane

## Surviving architecture

The project owns the artifact catalog, recursive descriptor graph, referrer graph, retention and deletion policy, namespace admission, and restoration acceptance.

```text
reproducible build output
        ↓
quarantine registry namespace
        ↓
digest, size, schema and graph verification
        ↓
SBOM + provenance + signature + vulnerability referrers
        ↓
two-party release admission
        ↓
append-only release namespace
        ↓
zot registry in site A
        +
Harbor registry in site B
        +
offline OCI image-layout export
```

The registry is a transport and query mechanism. The canonical project artifact is the signed catalog describing every reachable manifest, index, config, layer and referrer by digest.

## OCI graph boundary

OCI descriptors form a Merkle DAG through digest references. OCI 1.1 also introduces weak `subject` relationships for signatures, SBOMs, attestations and other artifacts. Both strong descriptor edges and weak referrer edges must be retained.

A multi-platform image is incomplete when any platform manifest, config or layer is absent. A release is also incomplete when required referrers are absent.

## Tags

Tags are human interfaces, not artifact identity. Release and deployment use digests. Immutable release tags may exist for usability. Mutable tags such as `latest`, `stable` or environment names are convenience pointers whose resolution is always recorded.

## Registry diversity

Use two registry implementations in separate failure domains. zot is the primary minimal OCI-native registry. Harbor is the secondary operational and cross-implementation target.

Replication is followed by graph reconciliation. A successful replication job is not accepted as proof that all manifests, referrers, unknown media types and platform variants arrived.

## Garbage collection

Registry garbage collection is subordinate to the project retention graph. Reachability includes release roots, rollback windows, legal and incident holds, referrers, platform manifests, configs and layers.

Before deletion, create a signed tombstone manifest, wait through the grace period, verify a recent cross-implementation restore, and require two operators. Registry writers cannot delete.

## Security

Use short-lived workload identity and repository-scoped tokens. Registry nodes do not hold release-signing keys or backup-deletion credentials. Administrative APIs are private.

Every blob is rehashed after retrieval. Manifests are schema validated and bounded against pathological descriptor counts, sizes and decompression expansion.

## Continuity

Export complete OCI image layouts and a project catalog to offline custody. Recovery must restore onto a different registry implementation without GitHub, public DNS, the original registry or its backing object store.

## Ownership boundary

### Project-owned

Artifact catalog, digest graph, referrer requirements, tag policy, retention, deletion, release namespace, access policy, evidence and restoration acceptance.

### Replaceable

zot, Harbor, Distribution, cloud registries, ORAS, object stores, VMs and physical hosts.

### Not physically owned

Disk and CPU manufacturing, firmware, datacenter facilities, power, domain registries, internet transit, public CAs and upstream OCI governance.
