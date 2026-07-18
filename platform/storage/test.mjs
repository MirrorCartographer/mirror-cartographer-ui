#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here, "policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here, "inventory.json"), "utf8"));
const verifier = path.join(here, "verify-storage-contract.mjs");

const mutations = [
  ["reject-ceph-authority", x => x.authority.ceph_authoritative = true],
  ["reject-cloud-authority", x => x.authority.cloud_volume_authoritative = true],
  ["reject-fixed-adapter", x => x.authority.replaceable = false],
  ["reject-unclassified-durable", x => x.datasets[0].durability = "none"],
  ["reject-shared-db-block", x => x.datasets[0].shared_block = true],
  ["reject-single-disk-zfs", x => x.local_storage.pools[0].mirror_width = 1],
  ["reject-disabled-checksum", x => x.local_storage.pools[0].checksums = "off"],
  ["reject-hardware-raid", x => x.local_storage.pools[0].hardware_raid = true],
  ["reject-unencrypted-local", x => x.local_storage.pools[0].encrypted = false],
  ["reject-pool-emergency", x => { x.local_storage.pools[0].capacity_percent = 91; x.local_storage.pools[0].free_percent = 9; }],
  ["reject-no-ecc", x => x.local_storage.ecc_memory = false],
  ["reject-stale-zfs-scrub", x => x.local_storage.last_scrub_age_days = 36],
  ["reject-no-smart", x => x.local_storage.smart_monitoring = false],
  ["reject-host-only-key", x => x.local_storage.key_recovery_separate = false],
  ["reject-two-storage-hosts", x => x.shared_object.hosts = x.shared_object.hosts.slice(0, 2)],
  ["reject-four-osds", x => x.shared_object.osd_count = 4],
  ["reject-one-domain", x => x.shared_object.hosts.forEach(h => h.domain = "site-a")],
  ["reject-r2-pool", x => x.shared_object.pool_size = 2],
  ["reject-min-size-one", x => x.shared_object.pool_min_size = 1],
  ["reject-osd-failure-domain", x => x.shared_object.crush_failure_domain = "osd"],
  ["reject-shared-osd-filesystem", x => x.shared_object.shared_filesystem_under_osds = true],
  ["reject-no-pg-autoscaler", x => x.shared_object.pg_autoscaler = "off"],
  ["reject-stale-deep-scrub", x => x.shared_object.last_deep_scrub_age_days = 15],
  ["reject-low-recovery-reserve", x => x.shared_object.recovery_capacity_reserve_percent = 5],
  ["reject-late-nearfull", x => x.shared_object.nearfull_percent = 85],
  ["reject-late-full", x => x.shared_object.full_percent = 95],
  ["reject-premature-erasure-code", x => x.shared_object.erasure_coding = true],
  ["reject-no-versioning", x => x.shared_object.canonical_bucket_versioning = false],
  ["reject-no-object-lock", x => x.shared_object.immutable_bucket_object_lock = false],
  ["reject-no-growth-forecast", x => x.capacity.growth_forecast = false],
  ["reject-short-headroom", x => x.capacity.days_headroom = 12],
  ["reject-no-failure-headroom", x => x.capacity.largest_failure_recovery_headroom = false],
  ["reject-auto-expand", x => x.capacity.automatic_expansion_without_admission = true],
  ["reject-thin-overcommit", x => x.capacity.critical_thin_overcommit = true],
  ["reject-silent-eviction", x => x.capacity.silent_eviction = true],
  ["reject-no-rebuild-model", x => x.capacity.recovery_bandwidth_mbps = 0],
  ["reject-no-scrub-schedule", x => x.integrity.zfs_scrub_scheduled = false],
  ["reject-stale-manifest-scan", x => x.integrity.last_full_manifest_scan_age_days = 31],
  ["reject-no-corruption-test", x => x.integrity.latent_corruption_injection = false],
  ["reject-inplace-repair", x => x.integrity.independent_good_copy_required = false],
  ["reject-no-device-inventory", x => x.lifecycle.device_inventory = false],
  ["reject-no-burn-in", x => x.lifecycle.burn_in = false],
  ["reject-no-safe-destroy", x => x.lifecycle.safe_to_destroy_check = false],
  ["reject-one-delete-operator", x => x.lifecycle.destructive_operator_count = 1],
  ["reject-discard-old-device", x => x.lifecycle.old_device_retained_until_verified = false],
  ["reject-shared-storage-release-admin", x => x.security.storage_admin_separate_release = false],
  ["reject-shared-backup-delete", x => x.security.storage_admin_separate_backup_delete = false],
  ["reject-open-admin", x => x.security.public_admin_endpoints = true],
  ["reject-release-key", x => x.security.release_keys_present = true],
  ["reject-original-cloud-required", x => x.continuity.original_cloud_required = true],
  ["reject-ceph-only-restore", x => x.continuity.ceph_required_for_restore = true],
  ["reject-no-portable-export", x => x.continuity.portable_object_export = false],
  ["reject-stale-reconstruction", x => x.continuity.last_clean_host_reconstruction_age_days = 31],
  ["reject-one-operator", x => x.continuity.trained_operators = 1],
  ["reject-unsigned-evidence", x => x.evidence.signed = false],
  ["reject-no-rebuild-evidence", x => x.evidence.rebuild_result = false]
];

function run(inv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "storage-contract-"));
  const file = path.join(dir, "inventory.json");
  fs.writeFileSync(file, JSON.stringify(inv, null, 2));
  const result = spawnSync(process.execPath, [verifier, policy, file], {encoding: "utf8"});
  fs.rmSync(dir, {recursive: true, force: true});
  return result;
}

let result = run(base);
if (result.status !== 0) {
  console.error(result.stdout, result.stderr);
  process.exit(1);
}
console.log("PASS baseline");

for (const [name, mutate] of mutations) {
  const inv = structuredClone(base);
  mutate(inv);
  result = run(inv);
  if (result.status === 0) {
    console.error(`FAIL ${name}: verifier accepted degraded inventory`);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
console.log("PASS adversarial storage controls");
