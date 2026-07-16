# Sovereign PostgreSQL PITR plane

## Decision

Adopt PostgreSQL-native full base backups plus continuous WAL archiving, with project-owned immutable WAL custody and destructive clean-host recovery tests. Do not adopt incremental backups initially: PostgreSQL 18 requires retaining and tracking the complete dependency chain and WAL summaries; for the expected early database size, that added restore graph is a net reliability loss.

## Ownership claim

The project owns backup policy, WAL archive format, integrity checks, retention graph, restore procedure, recovery targets, verification evidence, and database release admission. It does not thereby own disks, firmware, electricity, rented hosts, domain registration, DNS roots, certificate authorities, or internet transit. Commodity storage providers may carry encrypted replicas, but no provider snapshot, account, API, or proprietary backup catalog is the sole recovery path.

## Production contract

1. Enable `wal_level=replica`, `archive_mode=on`, `full_page_writes=on` and delegate `archive_command` to `archive-wal.sh`.
2. Take a full `pg_basebackup` with SHA-256 manifest checksums. Retain the base backup, its backup manifest, backup history, timeline history, and every required WAL segment.
3. Run version-matched `pg_verifybackup` against every base backup. This is preflight evidence only, not restore proof.
4. Sign a project recovery envelope containing PostgreSQL major version, system identifier, backup-manifest digest, WAL inventory root, start/end LSN, timeline, intended recovery target, and custody locations.
5. Copy each accepted recovery point to one online independent store and one offline or append-only store.
6. On a clean host, verify signatures and hashes, restore the base backup, configure `restore_command`, create `recovery.signal`, recover to the named target, then run schema, row-count, invariant, and application behavior tests.
7. Accept the recovery point only after the drill. Record RPO, RTO, bytes restored, replay duration, bandwidth, cost, manual interventions, and the exact target reached.

## Adversarial review before adoption

Rejected claims:

- **A filesystem snapshot is a database backup.** It may be crash-consistent or provider-coupled and does not establish independent WAL continuity.
- **`pg_verifybackup` proves recoverability.** PostgreSQL explicitly states it cannot perform every check a running server will perform; test restores remain mandatory.
- **Replication is backup.** A replica propagates deletion, corruption, and malicious transactions.
- **WAL archive success means durable custody.** A command can return success after partial, mutable, or provider-local storage unless immutability and read-back verification are enforced.
- **Incremental backup is automatically safer or cheaper.** It adds chain tracking and `pg_combinebackup` dependencies; missing predecessors or WAL summaries can block recovery.

## Post-artifact adversarial review

The scripts were challenged with an existing WAL filename containing different bytes and with post-archive corruption. Both are rejected. Remaining gaps:

- local `sync` does not prove remote media durability;
- SHA-256 proves integrity, not authorization;
- sidecar checksums can be modified by a fully compromised archive host;
- no live PostgreSQL backup was executed in this environment;
- tablespaces, ACLs, ownership, encryption, key escrow, retention, and WAL pruning are not yet automated;
- no target-time ambiguity test has been executed across clock skew or DST boundaries.

Production therefore requires detached signatures, independent inventory copies, object-lock/append-only replication, version-matched tools, and a live destructive recovery drill.

## Build versus buy

### Strongest surviving implementation

PostgreSQL native `pg_basebackup`, continuous WAL archiving, `pg_verifybackup`, project scripts, and project-controlled restore acceptance. This minimizes format lock-in and keeps the canonical recovery contract executable without a backup vendor.

### Replaceable transport options

- **pgBackRest**: strong candidate for compression, parallelism, retention, repository encryption, and multi-repository operation. Treat it as transport/orchestration, not sole canonical authority.
- **Barman**: strong candidate when operating several clusters and centralized backup servers. Higher control-plane burden.
- **restic/Borg/object storage**: suitable for copying already-complete base backups and WAL archives across failure domains, not for defining PostgreSQL consistency.
- **provider snapshots**: fast local recovery aid only.

### Rejected as sole recovery plane

Managed-database automated backups, cloud snapshots, one replica, logical dumps alone, and any proprietary catalog that cannot be reconstructed into ordinary PostgreSQL base-backup and WAL files.

## Security and failure boundaries

- Archive credentials are write-only where possible; restore credentials are read-only.
- Production database credentials cannot delete backup history.
- WAL names are validated; existing names are immutable and byte-compared.
- Recovery is performed on an isolated network before promotion.
- A recovery target uses a named restore point plus recorded LSN when possible, not wall-clock time alone.
- Promotion requires independent approval; the restore host cannot authorize its own production deployment.
- Retention deletion requires proof that no retained backup depends on the WAL range.

## Cost and operations

Costs are storage, WAL write amplification, base-backup I/O, clean-host drills, cross-site transfer, object-lock retention, monitoring, and operator training. Full backups are intentionally favored until measured size and restore time justify incremental chains. Two operators must be able to perform recovery from written procedure; otherwise the system remains dependent on one person.

## Verification executed in this change

`test.sh` verifies successful archive/restore, immutable filename collision rejection, corrupted archive rejection, and nine configuration/script invariants. It does not claim live PostgreSQL recovery.

## Next falsifiable build step

Start a pinned PostgreSQL 18 instance, create a fixture schema and named restore point, take and verify a full base backup, make transactions before and after the target, destroy the cluster, restore on a separately initialized host with outbound network blocked, recover to the named target, prove pre-target rows exist and post-target rows do not, then corrupt or remove one required WAL segment and require recovery failure. Repeat from each independent custody copy and record measured RPO/RTO.
