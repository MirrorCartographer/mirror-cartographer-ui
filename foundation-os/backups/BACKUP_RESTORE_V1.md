# Foundation Backup and Restore v1

Status: policy and validator committed; physical recovery laboratory pending.

## Strongest surviving implementation

Foundation controls schedules, retention, verification evidence, restore acceptance, and recovery exercises. Storage systems hold replaceable replicas only.

Run this topology:

1. Capture PostgreSQL with periodic base backups and continuous WAL archiving.
2. Capture artifacts and configuration with restic content-addressed snapshots.
3. Maintain three copies across at least two failure domains and two sites.
4. Place one copy behind an independent write boundary unavailable to normal production operations.
5. Run repository checks and sample restores every seven days.
6. Run a complete isolated restore and controlled corruption test every ninety days.
7. Record success only when restored data matches expected digests and restored services pass behavior checks.
8. Require a second operator to rebuild on a blank machine.

Recovery targets: fifteen-minute recovery point, four-hour first usable service, and no more than twenty-four hours without verification.

## Build-versus-buy result

Adopt restic as the first snapshot engine. Its repository uses content addressing, authenticated encryption, immutable object writes outside pruning, and multiple storage backends. Adopt PostgreSQL native base-backup and WAL-replay semantics for point-in-time database recovery.

Build and own the policy validator, evidence ledger, restore acceptance gate, provider-exit procedure, and recovery laboratory.

Reject a custom backup format because cryptographic format design, interrupted-write handling, pruning, repair, and compatibility create avoidable risk. Reject provider snapshots as the canonical record because provider identity and restore interfaces remain external. Reject replication as backup because valid but harmful changes propagate.

## Adversarial review

- A production compromise reaches writable replicas. The independent write boundary preserves one recovery path.
- Silent media damage survives unnoticed. Weekly checks and quarterly controlled corruption tests expose it.
- A provider disappears. Filesystem, SFTP, and S3-compatible exit paths preserve transport replacement.
- WAL archives contain a gap. The point-in-time restore gate fails and blocks acceptance.
- Recovery depends on one operator. Blank-machine reconstruction by a second operator becomes a required gate.
- Restore bandwidth misses the objective. The laboratory records throughput and forces local staging or additional replicas.
- Retention removes the last usable snapshot. Restore acceptance records verified generations before pruning.

## Ownership boundary

Foundation owns the software control plane: policy, schedules, manifests, verification, retention decisions, restore acceptance, and recovery execution. Purchased servers add physical custody. They do not create ownership of firmware, semiconductor fabrication, electricity, internet transit, domain registration, or public certificate roots.

## Next falsifiable build step

Create a synthetic PostgreSQL service and artifact tree. Capture them to local storage, an S3-compatible replica, and removable media. Remove the original service and first replica from the exercise. Rebuild on a blank machine, recover PostgreSQL to a selected timestamp, compare artifact digests, introduce controlled damage, confirm detection, and measure recovery point, recovery time, throughput, and operator actions.
