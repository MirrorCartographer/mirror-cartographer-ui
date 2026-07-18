# Sovereign Storage Substrate

## Surviving architecture

The storage plane is deliberately split by semantics rather than forcing every workload onto one distributed filesystem.

```text
stateful database and queue nodes
        ↓
local mirrored OpenZFS pools
        ↓
application-native replication
        ↓
database/queue-native backup and recovery

registries, evidence, exports, and large immutable objects
        ↓
Ceph RADOS + RGW
        ↓
three replicated copies across three hosts
        ↓
portable object catalog and offline export
```

The project owns the storage catalog, dataset classification, placement intent, capacity model, device inventory, encryption policy, object manifests, lifecycle authority, and recovery acceptance. OpenZFS and Ceph execute these rules but do not define canonical storage truth.

## Why the architecture is split

Shared distributed block storage beneath PostgreSQL, queues, or consensus systems compounds failure modes: the application replication layer and storage replication layer can disagree about durability, fencing, ordering, and recovery. The initial design therefore gives each stateful service direct local mirrored storage and relies on its native replication protocol.

Ceph is used first for object workloads whose semantics are naturally shared, content-addressed, replicated, and exportable. CephFS and general RBD are deferred until a measured workload proves they are necessary.

## Local durable storage

Each admitted host pool uses:

- OpenZFS on direct-attached devices,
- mirrored vdevs,
- end-to-end checksums,
- native encryption,
- ECC memory on new project-owned hardware,
- direct HBA/JBOD rather than hardware RAID,
- monthly or more frequent scrubs,
- SMART/NVMe health monitoring,
- independent key recovery,
- explicit capacity thresholds,
- held snapshots for local rollback points.

Snapshots remain local temporal references, not independent backups.

## Shared object storage

The initial Ceph object cluster requires:

- three storage hosts in three real failure domains,
- six OSDs minimum,
- one raw device per OSD,
- replicated pools with size 3 and min_size 2,
- host-level CRUSH placement,
- PG autoscaling,
- regular deep scrubbing,
- object versioning for canonical buckets,
- object lock for immutable custody,
- at least 20 percent recovery capacity reserve,
- no erasure coding in the first six-OSD deployment.

Erasure coding is deferred because small clusters have poor failure-domain geometry, higher recovery fan-out, more complex capacity math, and greater operational burden. It can be reconsidered when the cluster has enough hosts and disks to survive the selected k+m profile while rebuilding.

## Capacity authority

Usable capacity is not raw disk capacity. Admission accounts for:

- mirror or replication amplification,
- filesystem and object-store metadata,
- snapshots and retained versions,
- largest admitted host/device failure,
- recovery and backfill space,
- workload growth,
- scrub and rebuild bandwidth,
- temporary migration copies,
- offline export requirements.

The storage plane fails writes visibly before silent eviction or unsafe emergency reclamation.

## Integrity and repair

A scrub verifies storage-layer checksums. It does not establish application correctness. Repair acceptance requires:

1. preserve the damaged evidence;
2. identify an independent good copy;
3. quarantine the damaged copy or device;
4. reconstruct onto a noncanonical target;
5. verify byte digests;
6. run an application-semantic restore;
7. admit the repaired copy only after signed evidence.

## Device lifecycle

Every device is bound to serial, model, firmware, host, slot, purchase batch, burn-in record, error history, and secure-erasure receipt. Device replacement requires capacity admission and a safe-to-destroy result. The removed device remains retained until redundancy, scrub, and restore validation complete.

## Ownership boundary

### Project-owned

Storage catalog, dataset classes, placement rules, CRUSH intent, ZFS dataset properties, capacity policy, encryption policy, device inventory, scrub policy, repair authority, destruction authority, object manifests, portable exports, and recovery evidence.

### Replaceable

OpenZFS, Ceph, object gateways, HBAs, SSDs/HDDs, VMs, physical hosts, cloud disks, cloud object storage, and colocation facilities.

### Not physically owned

Drive and controller fabrication, firmware supply chains, semiconductor manufacturing, utility power, building and fire protection, internet transit, BGP, DNS roots, public CAs, and commodity shipping networks.

## Unproven production evidence

The repository fixture does not prove real hardware independence, flush durability, scrub detection, Ceph quorum behavior, CRUSH placement, capacity reserve, rebuild time, encryption-key recovery, object-lock enforcement, disk replacement, or cross-implementation restoration.

## Run

```sh
node platform/storage/verify-storage-contract.mjs platform/storage/policy.json platform/storage/inventory.json
node platform/storage/test.mjs
```
