# Sovereign storage control plane

This contract defines project-owned authority for persistent block, file, and object storage. Storage products and hosting sites are replaceable mechanisms; the project owns the canonical data-class inventory, integrity rules, capacity policy, retention manifests, portable exports, destructive-action authority, and restore acceptance.

## Surviving design

Use checksummed hot storage with three persistent replicas across three independently failing domains for workloads that require online continuity. Keep database durability inside PostgreSQL rather than presenting a shared filesystem as a substitute for WAL, replication, and PITR. Produce portable, checksummed exports into three recovery copies across at least two administrative domains, including one immutable and one offline copy. Restore onto a clean host and a different compatible implementation at least every 30 days.

Snapshots are operational rollback points, not backups. Replicas are availability copies, not independent recovery custody. Repair is admitted only while healthy redundancy exists, because an automatic repair process can otherwise overwrite the last good copy with corrupted state.

## Initial mechanisms

OpenZFS is the preferred first local storage mechanism for snapshots, strong checksums, scrubbing, quotas, reservations, and send/receive replication. Ceph is deferred until capacity, object count, or multi-host access justifies its distributed control-plane burden. Standard tar plus SHA-256 manifests and OCI image layouts remain the portable exit formats; database data uses database-native backup and recovery formats.

## Rejected directions

- RAID or replication presented as backup.
- One distributed storage cluster as both primary and sole recovery path.
- Thin provisioning that queues writes indefinitely at exhaustion.
- Capacity plans without rebuild headroom.
- Snapshots stored only beside the source dataset.
- Provider snapshots as canonical custody.
- Automatic repair when no independently verified healthy replica exists.
- Ceph as the first implementation before a smaller replicated ZFS laboratory is benchmarked.

## Production evidence required

The checked-in inventory is a design fixture. Production admission requires machine-derived device identities, pool topology, active failure-domain mapping, checksum and scrub results, capacity and metadata-space measurements, snapshot and export manifests, corruption-injection results, encrypted-copy custody receipts, clean-host restore logs, semantic application checks, and two operator signatures for destructive actions.

## Ownership boundary

The project owns storage policy, data classification, integrity verification, allocation and retention rules, encryption and key-separation requirements, exports, restore acceptance, and migration procedures. It may rent servers, disks, object stores, and network links. It does not physically own CPU or drive fabrication, firmware, datacenter power, ISP transit, BGP, DNS registries, or public certificate infrastructure unless it separately acquires and operates those physical resources.

## Run

```sh
node platform/storage/verify-storage-contract.mjs platform/storage/policy.json platform/storage/inventory.json
node platform/storage/test.mjs
```
