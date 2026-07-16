# Sovereign Backup Integrity and Destructive Restore

## Decision

Adopt a project-owned recovery contract and destructive restore harness. Backup engines, storage vendors, and rented hosts remain replaceable transports. The canonical authority is the signed recovery manifest, its content inventories, independent copies, and the acceptance tests that prove a clean system can reconstruct an admitted release.

The first executable layer covers immutable filesystem custody classes already present in the architecture:

- npm dependency vault
- OCI registry filesystem data
- release envelopes and signature bundles
- build evidence and reproducibility records

Databases and queues require application-aware capture and replay adapters; copying their live data directories is explicitly outside this contract.

## Strongest surviving implementation

`recovery-capsule.mjs` creates an atomic, immutable capsule containing sorted per-file inventories, SHA-256 digests, sizes, modes, dataset root digests, and a manifest digest. It rejects symbolic links and special files, refuses to overwrite an existing capsule, verifies every byte before restore, restores only into an empty target, and writes an acceptance record only after restored inventories match.

Commands:

```bash
node platform/recovery/recovery-capsule.mjs snapshot recovery.json /backup/capsule-001
node platform/recovery/recovery-capsule.mjs verify /backup/capsule-001
node platform/recovery/recovery-capsule.mjs restore /backup/capsule-001 /srv/foundation-restored
node platform/recovery/recovery-capsule.test.mjs
```

Example input:

```json
{
  "datasets": [
    { "name": "npm-vault", "path": "/srv/foundation/npm-vault", "class": "immutable-vault", "consistency": "quiesced" },
    { "name": "oci-registry", "path": "/srv/foundation/registry", "class": "oci-filesystem", "consistency": "registry-stopped" },
    { "name": "release-envelopes", "path": "/srv/foundation/releases", "class": "release-authority", "consistency": "immutable" },
    { "name": "build-evidence", "path": "/srv/foundation/evidence", "class": "build-evidence", "consistency": "immutable" }
  ]
}
```

## Recovery acceptance contract

A backup is not accepted because a command returned zero. It is accepted only when a recovery run can:

1. verify the detached manifest digest or project signature;
2. verify every object and dataset root;
3. restore into a clean location without reading the primary copy;
4. start the package adapter and pull admitted packages;
5. start the OCI registry and pull the original digest;
6. verify release signatures and semantic policy;
7. reproduce the admitted application artifact from restored dependencies and evidence;
8. record recovery time, recovery point, bytes, failures, and manual interventions.

The current prototype proves steps 1-3 and corruption rejection with synthetic fixtures. Runtime service reconstruction remains the next integration gate.

## Adversarial review before adoption

### Backup tool as authority

Rejected. Restic, Borg, ZFS, object storage, tape, and cloud snapshots may transport or deduplicate copies, but no engine-specific repository may be the sole recovery representation. Exportable inventories and periodic plain restoration are mandatory exit paths.

### Successful backup job equals recoverability

Rejected. A backup can be truncated, encrypted with a lost key, internally consistent but application-inconsistent, or impossible to restore within the required recovery time. Only destructive restoration supplies operational evidence.

### One encrypted off-site copy

Rejected. Encryption does not solve media loss, credential loss, account termination, ransomware, format obsolescence, or operator error. At least three copies across two media classes and two failure domains are required, with one copy offline or append-only.

### Filesystem copy of a live database

Rejected. PostgreSQL recovery requires a valid base backup plus the required WAL sequence for point-in-time recovery. Database adapters must use `pg_basebackup`/WAL archiving or an equivalently supported mechanism, then prove startup and logical invariants after replay.

### Registry volume snapshot without digest pull

Rejected. CNCF Distribution's filesystem driver places registry data under one root directory, but directory possession alone does not prove manifests and blobs are mutually usable. Recovery must pull the original manifest digest through the registry API.

## Adversarial review after implementation

The prototype was challenged with:

- mutation of a stored package-vault object;
- manifest mutation;
- missing and extra files;
- restore into a non-empty destination;
- symlink and special-file injection;
- partial snapshot publication;
- accidental overwrite of a prior recovery point.

The implementation fails closed for these classes. Atomic directory publication prevents a partially written capsule from appearing as complete on one filesystem. Cross-filesystem and remote-object publication still require a staging-prefix plus immutable completion marker.

## Build-versus-buy result

### Adopted: project recovery contract plus replaceable engines

The project owns schema, inventories, signatures, acceptance tests, retention policy, and recovery evidence. A transport engine can be changed without changing what counts as a valid recovery.

### Recommended transport tier: restic or Borg

Either can provide encryption, deduplication, retention, and multiple storage backends. They remain acceleration and transport layers, not canonical intelligence. Each repository must be periodically restored to plain files and verified by this contract. Engine keys must have offline escrow and tested rotation.

### Recommended local snapshot tier: ZFS or btrfs snapshots

Useful for fast rollback and efficient local recovery. Rejected as sole backup because snapshots usually share hardware, administrative authority, and failure domains with the source.

### Rejected as sole path: provider snapshots

Fast and operationally useful, but account suspension, regional failure, API changes, billing failure, and provider control remain hidden release dependencies.

### Deferred: tape

Tape offers strong offline separation and long retention, but adds drive hardware, media rotation, environmental storage, catalog custody, and periodic readability testing. It becomes appropriate when artifact volume or threat model justifies it.

## Ownership boundary achieved

The project now owns:

- the recovery capsule format;
- content inventories and root digests;
- snapshot publication rules;
- restore preconditions;
- corruption rejection;
- destructive-test code;
- acceptance evidence format;
- migration away from any backup vendor.

The project does not thereby own:

- physical disks, controllers, firmware, or storage manufacturing;
- rented host hardware;
- electricity;
- off-site buildings;
- internet transit;
- domain registration or DNS;
- cryptographic hardware fabrication;
- upstream backup-engine maintenance.

These remain commodity dependencies. None may be the only copy, only key location, only catalog, or only tested recovery path.

## Database, queue, and mutable-state extension

PostgreSQL must use base backups plus continuous WAL archiving, preserve timeline history, and restore to a declared recovery target. The drill must then start PostgreSQL, check schema migrations, row-level invariants, and application reads. Logical dumps are useful secondary exports but are not substitutes for PITR.

Queues require explicit semantics:

- durable source-of-truth events should be replayable from an append-only log or database;
- ephemeral work queues may be reconstructed from canonical state;
- exactly-once claims must be replaced by idempotent consumers and deduplication records;
- recovery must measure duplicate, lost, and reordered work.

## Remaining risks

- SHA-256 integrity is not authorization; production manifests require detached project signatures.
- A quiesced filesystem snapshot can still capture semantically inconsistent application state if the quiesce protocol is wrong.
- The prototype copies files and may be slow for multi-terabyte custody.
- File permissions beyond basic mode, ownership, ACLs, xattrs, sparse layout, and hard links are not yet preserved.
- A compromised source host can snapshot malicious but internally consistent data.
- A compromised signer can authorize a malicious recovery point.
- Recovery exercises can silently depend on undocumented operator knowledge.
- Backup encryption keys remain a catastrophic single point until threshold escrow is implemented.
- Restore bandwidth and egress charges can create a cost cliff during a real disaster.

## Cost and operational implications

Real ownership requires recurring expenditure for independent storage, offline media, periodic clean hosts, bandwidth, key ceremonies, and operator drills. Double or triple storage is not waste; it is the minimum credible separation of failure domains. Destructive drills consume compute and staff time but reveal unusable backups before an emergency.

Required measurements include:

- recovery point objective achieved;
- recovery time objective achieved;
- bytes and objects restored;
- verification throughput;
- egress and temporary-host cost;
- manual steps;
- failed objects and retries;
- application-level acceptance results.

## Verification performed

The synthetic harness was executed with Node.js. It snapshotted four custody classes, verified the capsule, deleted the primary source tree, restored to a clean target, checked recovered behavior, mutated a backup object, and required verification failure.

Observed result:

```text
PASS destructive restore and corruption rejection
```

This is evidence for the generic filesystem contract only. It is not yet evidence that the actual OCI registry, package server, release verifier, or application can be recovered.

## Next falsifiable build step

Run the integrated bare-host recovery drill:

```text
populate real npm vault and OCI registry
→ sign release envelope and recovery manifest
→ stop writers and create recovery capsule
→ copy capsule to independent offline and remote media
→ destroy primary registry, package server, release bundles, and build evidence
→ provision a clean Linux host from documented bootstrap media
→ restore without GitHub, npmjs.org, or the original hosting account
→ start the vault-backed npm endpoint
→ start CNCF Distribution
→ pull the original OCI digest
→ verify release authority offline
→ rebuild the application from restored dependencies
→ compare the reproduced artifact digest
→ deploy into an isolated runtime
→ run health and state invariants
→ record RPO, RTO, cost, bandwidth, and every manual step
→ mutate one remote copy and prove quorum selects only matching signed copies
```

After this succeeds, extend the same orchestrator with PostgreSQL base-backup/WAL adapters and a measured point-in-time recovery drill.
