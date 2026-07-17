#!/usr/bin/env node
import fs from "node:fs";

const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) {
  console.error("usage: verify-backup-contract.mjs POLICY INVENTORY");
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const i = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(p.authority.canonical_recovery_catalog_owned_by_project && i.authority.owned_by_project, "project must own canonical recovery catalog");
check(!p.authority.provider_may_be_sole_recovery_authority && !i.authority.provider_authoritative, "provider cannot be recovery authority");
check(!p.authority.replication_is_backup && !p.authority.snapshot_is_backup, "replicas and snapshots cannot be classified as backups");
check(p.scope.all_durable_datasets_classified && i.datasets.length > 0, "durable datasets must be classified");
check(i.datasets.every(d => Number.isFinite(d.rpo_seconds) && Number.isFinite(d.rto_seconds)), "every dataset requires RPO and RTO");
check(p.capture.application_consistent_for_stateful_services && i.datasets.every(d => d.application_consistent), "stateful captures must be application-consistent");
check(p.capture.database_native_backup_required && i.capture.database_native, "database-native backup is required");
check(p.capture.continuous_database_wal_archive_required && i.capture.continuous_wal, "continuous database WAL archive is required");
check(p.capture.configuration_and_schema_captured && i.capture.config_and_schema, "configuration and schema must be captured");
check(p.capture.identity_and_trust_roots_captured_separately && i.capture.trust_roots_separate, "identity roots require separate custody");
check(p.capture.backup_success_requires_catalog_commit && i.capture.catalog_commit_required, "backup success requires catalog commit");

const complete = i.copies.filter(c => c.complete);
check(complete.length >= p.custody.minimum_complete_copies, "insufficient complete backup copies");
check(new Set(complete.map(c => c.domain)).size >= p.custody.minimum_failure_domains, "insufficient backup failure domains");
check(complete.some(c => c.immutable), "immutable copy required");
check(complete.some(c => c.offline), "offline copy required");
check(complete.some(c => c.project_controlled), "project-controlled copy required");
check(new Set(complete.map(c => c.delete_credential)).size > 1, "one credential must not delete every copy");
check(!i.restore.public_dns_required && !i.restore.original_provider_required, "restore must not require public DNS or original provider");

check(i.integrity.manifest_algorithm === "sha256", "SHA-256 object manifest required");
check(i.integrity.manifest_signed, "backup manifest must be signed");
check(i.integrity.last_full_read_check_age_days <= p.integrity.full_data_read_check_max_age_days, "full data read check is stale");
check(i.integrity.last_sample_restore_age_days <= p.integrity.sample_restore_max_age_days, "sample restore is stale");
check(i.integrity.corruption_injection, "corruption injection test required");
check(i.integrity.repair_target === "noncanonical-copy", "repair may modify only a noncanonical copy");

check(i.retention.policy_in_source, "retention policy must be source-controlled");
check(i.retention.deletion_dry_run, "deletion requires dry-run");
check(i.retention.destructive_operator_count >= 2, "destructive retention requires two operators");
check(i.retention.writer_append_only, "backup writer must be append-only");
check(i.retention.maintenance_separate, "maintenance credentials must be separate");
check(i.retention.hold_supported, "legal/incident hold must be supported");

check(i.restore.clean_host, "restore must run on a clean host");
check(i.restore.cross_implementation, "cross-implementation restore required");
check(i.restore.semantic_validation, "semantic restore validation required");
check(Array.isArray(i.restore.dependency_order) && i.restore.dependency_order.length >= 5, "dependency-aware restore order required");
check(i.restore.evidence_signed, "restore evidence must be signed");
check(i.restore.last_drill_age_days <= p.restore.restore_drill_max_age_days, "restore drill is stale");
check(i.restore.bare_catalog_reconstruction, "bare recovery-catalog reconstruction required");

check(i.disaster.total_site_loss, "total site loss must be tested");
check(i.disaster.control_plane_loss, "control-plane loss must be tested");
check(i.disaster.credential_loss, "credential loss must be tested");
check(i.disaster.dns_ca_loss, "DNS and CA loss must be tested");
check(i.disaster.offline_runbook, "offline communications/runbook required");
check(i.disaster.trained_operators >= p.disaster_recovery.minimum_trained_operators, "insufficient trained recovery operators");
check(i.disaster.decision_log, "disaster decision log required");

check(i.security.encrypted_at_rest && i.security.encrypted_in_transit, "backup encryption required");
check(i.security.key_separation, "backup keys must be separated from storage administration");
check(!i.security.release_keys_present, "release keys forbidden on backup workers");
check(i.security.isolated_restore, "restore environment must be isolated");
check(i.security.evidence_redacted, "secret values must be redacted from evidence");

check(i.evidence.machine_generated, "evidence must be machine-generated");
check(i.evidence.object_digests, "evidence must contain object digests");
check(i.evidence.restore_point, "evidence must identify restore point");
check(Number.isFinite(i.evidence.observed_rpo_seconds) && Number.isFinite(i.evidence.observed_rto_seconds), "observed RPO/RTO required");
check(i.evidence.operator_signatures >= 2, "two evidence signatures required");
check(i.evidence.retention_days >= p.evidence.retention_days, "evidence retention is insufficient");

if (failures.length) {
  console.error(`REJECT ${failures.length} backup/DR invariant(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("ACCEPT 53 backup/DR invariants");
