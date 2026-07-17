# Foundation Recovery Authority

This directory defines the project-owned admission contract for backups, restores, and disaster recovery.

## Authority model

A backup job is not recovery evidence. A recoverable system requires independently controlled bytes, separately recoverable keys, database-aware backup semantics, and a successful clean-host restoration measured against explicit RPO/RTO objectives.

Canonical recovery state is the combination of:

1. `policy.json` — mandatory recovery invariants.
2. `inventory.json` — declared custody, key, database, bootstrap, and dependency topology.
3. `restore-evidence.json` — signed evidence from a clean-host restore drill.
4. `verify-recovery-contract.mjs` — deterministic admission verifier.
5. `test.mjs` — adversarial mutations proving that unsafe states are rejected.

The checked-in evidence is a test fixture only. It MUST be replaced by signed machine-generated evidence from an actual drill before production admission.

## Surviving design

- Three encrypted copies across at least two failure domains.
- At least one immutable copy and one offline copy.
- No hosted provider is the sole custody domain.
- Decryption keys live outside backup repositories and have two recovery copies.
- PostgreSQL recovery uses base backups, SHA-256 backup manifests, continuous WAL archiving, and point-in-time recovery.
- Integrity scans occur at least weekly.
- A clean-host restore and application smoke test occur at least every 30 days.
- Measured objectives: RPO <= 15 minutes; RTO <= 120 minutes.
- Two distinct operators participate in restore verification.
- Recovery remains reachable without relying on public DNS.

## Build versus buy

Use mature backup and database tools as replaceable mechanisms: Borg or restic for encrypted deduplicated file archives; PostgreSQL native base-backup/WAL/PITR primitives; ZFS or object-lock storage where available. Build and own the recovery policy, custody inventory, signed evidence format, verifier, bootstrap procedure, and drill orchestration.

Do not treat a cloud backup dashboard, filesystem snapshot, replica, registry, or successful cron job as recovery authority.

## Verification

```sh
node platform/recovery/verify-recovery-contract.mjs
node platform/recovery/test.mjs
```

## Required production drill

1. Provision a host from blank media using the documented bootstrap.
2. Recover keys from a separate custody path.
3. Restore application files from one custody domain.
4. Restore PostgreSQL from a verified base backup and replay WAL to a named target.
5. Start the application using digest-pinned release artifacts.
6. Run semantic smoke tests against known records.
7. Record measured RPO/RTO, restored digests, tool versions, operators, and failures.
8. Sign the evidence and verify it before production admission.
9. Repeat after corrupting or deleting the first recovery source.
