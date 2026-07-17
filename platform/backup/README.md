# Sovereign Backup, Restore, and Disaster-Recovery Plane

## Surviving architecture

The project owns a signed recovery catalog that maps every durable dataset to:

- its canonical source and semantic validator,
- capture method,
- RPO and RTO,
- dependency order,
- cryptographic object manifest,
- retention and hold policy,
- custody copies and failure domains,
- required keys and recovery quorum,
- clean-host restoration procedure,
- observed recovery evidence.

Backups are not declared successful when a tool exits zero. Success requires the complete capture to be committed to the recovery catalog and independently readable from the required custody topology.

## Initial implementation choice

Use database-native physical backup plus continuous WAL archiving for PostgreSQL. Use a content-addressed encrypted backup implementation such as restic for portable files, configuration, registry exports, evidence, and application objects. Keep the project recovery catalog and manifests implementation-neutral so restic, Borg, Kopia, object storage, or removable media can be replaced.

The backup writer receives append-only authority. Retention, forget, prune, repair, and destructive maintenance use separate credentials and two operators.

## Why replication and snapshots are rejected as backups

Replication preserves availability but can replicate deletion, corruption, ransomware, and operator error. A snapshot beside its source shares storage, credentials, keys, administration, and site risk. Both may be useful inputs, but neither satisfies independent recovery custody.

## Restore order

1. Establish trustworthy time and offline operator communications.
2. Recover identity roots and bootstrap credentials.
3. Recover secrets authority and storage keys.
4. Reconstruct storage and the signed recovery catalog.
5. Restore PostgreSQL base backup and required WAL to the selected timeline or restore point.
6. Restore queues, registries, release metadata, and application objects.
7. Rebuild runtime, networking, and TLS from project-owned configuration.
8. Restore observability early enough to record recovery verification.
9. Run semantic tests before declaring service recovered.

## Adversarial boundaries

A repository integrity check is not a restore. A readable archive is not a correct application. A successful database startup is not proof of the intended timeline. Restore acceptance requires application invariants, counts, sequence reconciliation, release-manifest verification, identity-chain verification, and measured RPO/RTO.

Repair is performed only against a noncanonical copy. The original damaged evidence is retained until the failure mode is understood.

## Ownership boundary

### Project-owned

Recovery catalog, dataset classification, dependency graph, RPO/RTO, capture policy, retention, object manifests, deletion authority, recovery keys and quorum, restore semantics, drill evidence, and disaster decision log.

### Replaceable software and resources

PostgreSQL backup tools, restic, Borg, Kopia, filesystems, object stores, removable media, VMs, physical hosts, cloud storage, couriers, and colocation.

### Not physically owned

Drive and CPU fabrication, firmware, facilities, utility power, public networks, DNS roots, domain registries, public CAs, and external transit. These can carry backup bytes but cannot be the sole recovery path.

## Production evidence still required

- Live PostgreSQL base backup and continuous WAL archive.
- Point-in-time restore before and after an injected destructive transaction.
- Full encrypted backup repository and signed object manifest.
- Full-data repository read check.
- Intentional corruption with detection and isolated repair.
- Restore with original provider, public DNS, and public CA unavailable.
- Cross-implementation import.
- Total-site-loss reconstruction.
- Loss of one storage credential and one recovery key.
- Two independently trained operators completing the runbook.
