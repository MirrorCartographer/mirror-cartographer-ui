#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here,"policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here,"inventory.json"),"utf8"));
const verifier = path.join(here,"verify-database-contract.mjs");
const mutations = [
["reject-patroni-authority",x=>x.authority.patroni_authoritative=true],
["reject-cloud-authority",x=>x.authority.cloud_database_authoritative=true],
["reject-unowned-ledger",x=>x.authority.migration_ledger_owned=false],
["reject-two-nodes",x=>x.topology.nodes=x.topology.nodes.slice(0,2)],
["reject-one-domain",x=>x.topology.nodes.forEach(n=>n.domain="site-a")],
["reject-multiwriter",x=>x.topology.single_writer=false],
["reject-async",x=>x.topology.synchronous_mode="off"],
["reject-no-watchdog",x=>x.topology.watchdog=false],
["reject-no-fencing",x=>x.topology.fencing=false],
["reject-app-superuser",x=>x.topology.application_superuser=true],
["reject-no-checksums",x=>x.durability.data_checksums=false],
["reject-no-wal-archive",x=>x.durability.wal_archiving=false],
["reject-unbounded-slot",x=>x.durability.max_slot_wal_keep_size_mb=0],
["reject-local-commit",x=>x.durability.critical_sync_commit="local"],
["reject-client-override",x=>x.durability.client_override_forbidden=false],
["reject-lagged-failover",x=>x.durability.maximum_failover_lag_bytes=1048576],
["reject-untested-loss",x=>x.durability.acknowledged_loss_tested=false],
["reject-one-manual-operator",x=>x.failover.manual_operator_count=1],
["reject-loss-override-shared",x=>x.failover.data_loss_override_separate=false],
["reject-no-timeline-check",x=>x.failover.timeline_check=false],
["reject-unfenced-primary",x=>x.failover.old_primary_fenced=false],
["reject-no-basebackup-fallback",x=>x.failover.fresh_base_backup_fallback=false],
["reject-no-dcs-test",x=>x.failover.dcs_loss_tested=false],
["reject-mutable-migration",x=>x.migrations.immutable_ids=false],
["reject-no-expand-contract",x=>x.migrations.expand_contract=false],
["reject-no-lock-timeout",x=>x.migrations.lock_timeout_ms=0],
["reject-one-destructive-operator",x=>x.migrations.destructive_operator_count=1],
["reject-unbounded-backfill",x=>x.migrations.backfill_rate_limited=false],
["reject-schema-drift",x=>x.migrations.schema_drift_clear=false],
["reject-safe-down-assumption",x=>x.migrations.down_migration_assumed_safe=true],
["reject-ddl-replication-assumption",x=>x.logical_migration.ddl_replication_assumed=true],
["reject-sequence-replication-assumption",x=>x.logical_migration.sequence_replication_assumed=true],
["reject-schema-after-data",x=>x.logical_migration.schema_applied_before_data=false],
["reject-no-replica-identity",x=>x.logical_migration.replica_identity=false],
["reject-old-slot-migration",x=>x.logical_migration.source_version=16],
["reject-no-write-fence",x=>x.logical_migration.cutover_write_fence=false],
["reject-source-deleted",x=>x.logical_migration.source_retained=false],
["reject-provider-restore",x=>x.continuity.original_provider_required=true],
["reject-patroni-restore",x=>x.continuity.patroni_required_for_restore=true],
["reject-stale-restore",x=>x.continuity.last_clean_host_restore_age_days=31],
["reject-one-operator",x=>x.continuity.trained_operators=1],
["reject-lsn-mismatch",x=>x.evidence.replica_flush_lsn="0/4000000"],
["reject-data-loss",x=>x.evidence.data_loss_bytes=128],
["reject-unsigned-evidence",x=>x.evidence.signed=false]
];
function run(inv){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"db-contract-"));
 const f=path.join(d,"inventory.json"); fs.writeFileSync(f,JSON.stringify(inv,null,2));
 const r=spawnSync(process.execPath,[verifier,policy,f],{encoding:"utf8"});
 fs.rmSync(d,{recursive:true,force:true}); return r;
}
let r=run(base); if(r.status!==0){console.error(r.stdout,r.stderr);process.exit(1)} console.log("PASS baseline");
for(const [name,mutate] of mutations){const x=structuredClone(base);mutate(x);r=run(x);if(r.status===0){console.error(`FAIL ${name}`);process.exit(1)}console.log(`PASS ${name}`)}
console.log("PASS adversarial database controls");
