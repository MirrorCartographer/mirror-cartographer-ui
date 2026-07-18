#!/usr/bin/env node
import fs from "node:fs";

const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) {
  console.error("usage: verify-storage-contract.mjs POLICY INVENTORY");
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const i = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const digest = value => /^sha256:[0-9a-f]{64}$/.test(value ?? "");

check(p.authority.project_owned_storage_catalog && i.authority.project_owned, "project must own canonical storage catalog");
check(!i.authority.ceph_authoritative && !i.authority.zfs_authoritative && !i.authority.cloud_volume_authoritative, "storage mechanisms cannot be canonical authority");
check(i.authority.replaceable && i.authority.catalog_exportable, "storage adapters and catalog must be portable");

check(i.datasets.length > 0, "durable datasets must be classified");
check(i.datasets.every(d => ["block-local","file-local","object-shared","local-ephemeral"].includes(d.class)), "invalid storage class");
check(i.datasets.filter(d => !d.ephemeral).every(d => d.durability !== "none"), "durable data requires durability mechanism");
check(i.datasets.filter(d => d.id.includes("postgres") || d.id.includes("queue")).every(d => !d.shared_block), "database and queue shared block is forbidden");
check(i.datasets.some(d => d.ephemeral), "ephemeral storage must be explicit");

check(i.local_storage.filesystem === p.local_storage.filesystem, "OpenZFS local storage required");
check(i.local_storage.pools.every(x => x.mirror_width >= p.local_storage.minimum_mirror_width), "local pools require mirrored devices");
check(i.local_storage.pools.every(x => x.checksums !== "off"), "ZFS checksums cannot be disabled");
check(i.local_storage.pools.every(x => !x.hardware_raid), "hardware RAID beneath ZFS forbidden");
check(i.local_storage.pools.every(x => x.encrypted), "local durable pools must be encrypted");
check(i.local_storage.pools.every(x => x.capacity_percent <= p.local_storage.pool_emergency_percent), "local pool exceeds emergency capacity");
check(i.local_storage.pools.every(x => x.free_percent >= p.local_storage.minimum_free_percent_for_replacement), "insufficient replacement headroom");
check(i.local_storage.ecc_memory, "ECC memory required for admitted hardware");
check(i.local_storage.last_scrub_age_days <= p.local_storage.monthly_scrub_max_age_days, "ZFS scrub is stale");
check(i.local_storage.smart_monitoring, "SMART monitoring required");
check(i.local_storage.key_recovery_separate, "storage key recovery must be separate from host");
check(i.local_storage.protected_snapshot_holds, "protected snapshots require holds");

check(i.shared_object.hosts.length >= p.shared_object.minimum_storage_hosts, "insufficient object-storage hosts");
check(i.shared_object.osd_count >= p.shared_object.minimum_osds, "insufficient OSD count");
check(new Set(i.shared_object.hosts.map(h => h.domain)).size >= p.shared_object.minimum_failure_domains, "insufficient object-storage failure domains");
check(i.shared_object.pool_size === p.shared_object.replicated_pool_size, "replicated pool size mismatch");
check(i.shared_object.pool_min_size === p.shared_object.replicated_pool_min_size, "replicated pool min_size mismatch");
check(i.shared_object.crush_failure_domain === p.shared_object.crush_failure_domain, "CRUSH failure domain must be host");
check(i.shared_object.one_raw_device_per_osd, "one raw device per OSD required");
check(!i.shared_object.shared_filesystem_under_osds, "shared filesystem beneath OSDs forbidden");
check(i.shared_object.pg_autoscaler === "on", "PG autoscaler required");
check(i.shared_object.last_deep_scrub_age_days <= p.shared_object.deep_scrub_max_age_days, "Ceph deep scrub is stale");
check(i.shared_object.recovery_capacity_reserve_percent >= p.shared_object.recovery_capacity_reserve_percent, "insufficient recovery capacity reserve");
check(i.shared_object.nearfull_percent <= p.shared_object.nearfull_max_percent, "nearfull ratio too high");
check(i.shared_object.backfillfull_percent <= p.shared_object.backfillfull_max_percent, "backfillfull ratio too high");
check(i.shared_object.full_percent <= p.shared_object.full_max_percent, "full ratio too high");
check(!i.shared_object.erasure_coding, "erasure coding not admitted for initial small cluster");
check(i.shared_object.canonical_bucket_versioning, "canonical buckets require versioning");
check(i.shared_object.immutable_bucket_object_lock, "immutable buckets require object lock");

check(i.capacity.growth_forecast, "capacity growth forecast required");
check(i.capacity.days_headroom >= 30, "less than thirty days of capacity headroom");
check(i.capacity.largest_failure_recovery_headroom, "capacity must survive largest admitted failure");
check(!i.capacity.automatic_expansion_without_admission, "automatic expansion without admission forbidden");
check(!i.capacity.critical_thin_overcommit, "thin overcommit forbidden for critical state");
check(!i.capacity.silent_eviction, "silent eviction forbidden");
check(i.capacity.recovery_bandwidth_mbps > 0 && i.capacity.estimated_single_host_rebuild_hours > 0, "recovery bandwidth model required");

check(i.integrity.zfs_scrub_scheduled && i.integrity.ceph_deep_scrub_scheduled, "scheduled scrubs required");
check(i.integrity.last_full_manifest_scan_age_days <= p.integrity.full_object_manifest_scan_max_age_days, "object-manifest scan is stale");
check(i.integrity.latent_corruption_injection, "latent corruption injection required");
check(i.integrity.mismatch_quarantines_copy, "checksum mismatch must quarantine copy");
check(i.integrity.independent_good_copy_required, "repair requires independent good copy");
check(i.integrity.post_repair_semantic_restore, "post-repair semantic restore required");

check(i.lifecycle.device_inventory && i.lifecycle.firmware_inventory, "device and firmware inventory required");
check(i.lifecycle.burn_in, "device burn-in required");
check(i.lifecycle.safe_to_destroy_check, "safe-to-destroy check required");
check(i.lifecycle.destructive_operator_count >= 2, "destructive device action requires two operators");
check(i.lifecycle.secure_erasure_evidence, "secure erasure evidence required");
check(i.lifecycle.old_device_retained_until_verified, "old device must remain until rebuild verified");
check(i.lifecycle.replacement_runbook, "device replacement runbook required");

check(i.security.storage_admin_separate_release, "storage admin must be separate from release authority");
check(i.security.storage_admin_separate_backup_delete, "storage admin must be separate from backup deletion authority");
check(i.security.cephx && i.security.bucket_credentials_scoped, "storage authentication and scoped credentials required");
check(i.security.management_network_separate, "storage management network must be separate");
check(!i.security.public_admin_endpoints, "public storage administration forbidden");
check(i.security.encryption_in_transit, "storage traffic encryption required");
check(!i.security.release_keys_present, "release keys forbidden on storage hosts");
check(i.security.audit_externalized, "storage audit logs must be externalized");

check(!i.continuity.original_vendor_required && !i.continuity.original_cloud_required, "recovery must survive original vendor/cloud loss");
check(!i.continuity.public_dns_required, "storage recovery must not require public DNS");
check(!i.continuity.ceph_required_for_restore && !i.continuity.zfs_required_for_object_restore, "object recovery must be implementation-independent");
check(i.continuity.portable_object_export, "portable object export required");
check(i.continuity.last_clean_host_reconstruction_age_days <= p.continuity.clean_host_reconstruction_max_age_days, "clean-host reconstruction is stale");
check(i.continuity.trained_operators >= p.continuity.minimum_trained_operators, "insufficient trained storage operators");

check(i.evidence.machine_generated && i.evidence.signed, "signed machine-generated evidence required");
for (const key of ["storage_catalog_digest","device_map_digest","crush_map_digest"]) check(digest(i.evidence[key]), `invalid evidence digest: ${key}`);
for (const key of ["scrub_results","capacity_recovery_model","corruption_test","rebuild_result"]) check(i.evidence[key], `missing evidence: ${key}`);
check(i.evidence.operator_signatures >= 2, "two operator signatures required");
check(i.evidence.retention_days >= p.evidence.retention_days, "storage evidence retention insufficient");

if (failures.length) {
  console.error(`REJECT ${failures.length} storage invariant(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("ACCEPT 75 storage invariants");
