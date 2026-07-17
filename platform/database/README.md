# Sovereign database authority

This contract defines the minimum admissible PostgreSQL control plane for Foundation Intelligence. It does not claim that a managed database, replica count, or successful backup is sovereignty.

## Surviving design

- Three persistent PostgreSQL nodes across three independently failing domains.
- One fenced writer, at least one synchronous standby, automatic failover, WAL archive, checksums, and bounded replication-slot retention.
- Project-controlled election policy, schema source, migration ledger, upgrade procedure, evidence, and recovery acceptance.
- Immutable checksummed migrations using expand/contract compatibility across at least two releases.
- Rehearsed major upgrades on restored data; preserve the old cluster until acceptance. The first production major upgrade forbids `pg_upgrade --link` because starting the new cluster can make rollback to the old cluster unsafe.
- Logical replication remains an exit and low-downtime migration path, but DDL and sequence state are reconciled separately.
- Diverged former primaries are fenced before `pg_rewind`; failed rewind means rebuild from a fresh backup.

## Adversarial findings

Replica count is not authority. Three nodes sharing one power, storage, controller, network, operator, or failover service remain one failure domain.

Automatic failover without fencing can create two writable primaries. Synchronous replication reduces acknowledged-loss exposure but adds latency and can trade availability for durability during partitions.

Replication slots can retain WAL without bound and exhaust disk. The contract therefore limits retained bytes and requires explicit disk headroom.

Logical replication is not schema migration. PostgreSQL does not automatically replicate DDL or sequence state, and conflicts can halt apply until manually resolved.

`pg_rewind` is an optimization, not recovery custody. It requires checksums or `wal_log_hints`, retained WAL back to divergence, and a cleanly fenced target. A failed rewind can leave the target unusable.

## Ownership boundary

The project owns election and fencing rules, schema and migration source, topology, evidence, failover acceptance, upgrade and exit procedures, credentials policy, and recovery drills. PostgreSQL, Linux, storage, compute, orchestration software, and hosting sites are replaceable mechanisms.

The project does not physically own processor fabrication, firmware, disks unless purchased, datacenter utilities, ISP links, BGP, DNS roots, registries, registrars, public CAs, or internet transit.

## Production evidence still required

The checked-in inventory is a design fixture. Production admission must derive evidence from live PostgreSQL timelines and LSNs, synchronous-standby state, replication lag, fencing actions, socket and role inspection, migration digests, failover timings, WAL archive challenges, `pg_rewind` output, `pg_upgrade --check`, clean-host restore logs, and cryptographic operator signatures.

## Next destructive laboratory

Provision three pinned PostgreSQL nodes; create real business data; force primary loss; prove fencing and bounded RPO/RTO; attempt a partition-induced double promotion; rejoin the old primary with `pg_rewind`; fill a replication slot until the configured cap; rehearse expand/contract schema changes across two application versions; restore production-sized data into the next PostgreSQL major version; run `pg_upgrade --check`; perform a copy-mode upgrade; then migrate through logical replication while reconciling DDL and sequences.
