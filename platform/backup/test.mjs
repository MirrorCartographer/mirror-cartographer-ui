#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here, "policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here, "inventory.json"), "utf8"));
const verifier = path.join(here, "verify-backup-contract.mjs");

const mutations = [
  ["reject-provider-authority", x => x.authority.provider_authoritative = true],
  ["reject-replica-count", x => x.copies = x.copies.slice(0, 2)],
  ["reject-one-domain", x => x.copies.forEach(c => c.domain = "site-a")],
  ["reject-no-immutable", x => x.copies.forEach(c => c.immutable = false)],
  ["reject-no-offline", x => x.copies.forEach(c => c.offline = false)],
  ["reject-one-delete-credential", x => x.copies.forEach(c => c.delete_credential = "root")],
  ["reject-dns-required", x => x.restore.public_dns_required = true],
  ["reject-provider-required", x => x.restore.original_provider_required = true],
  ["reject-no-db-native", x => x.capture.database_native = false],
  ["reject-no-wal", x => x.capture.continuous_wal = false],
  ["reject-no-catalog-commit", x => x.capture.catalog_commit_required = false],
  ["reject-unsigned-manifest", x => x.integrity.manifest_signed = false],
  ["reject-stale-read-check", x => x.integrity.last_full_read_check_age_days = 31],
  ["reject-stale-sample-restore", x => x.integrity.last_sample_restore_age_days = 8],
  ["reject-no-corruption-test", x => x.integrity.corruption_injection = false],
  ["reject-canonical-repair", x => x.integrity.repair_target = "canonical-copy"],
  ["reject-no-dry-run", x => x.retention.deletion_dry_run = false],
  ["reject-one-delete-operator", x => x.retention.destructive_operator_count = 1],
  ["reject-writer-can-delete", x => x.retention.writer_append_only = false],
  ["reject-shared-maintenance", x => x.retention.maintenance_separate = false],
  ["reject-no-hold", x => x.retention.hold_supported = false],
  ["reject-dirty-host", x => x.restore.clean_host = false],
  ["reject-same-implementation", x => x.restore.cross_implementation = false],
  ["reject-no-semantic-validation", x => x.restore.semantic_validation = false],
  ["reject-stale-drill", x => x.restore.last_drill_age_days = 31],
  ["reject-no-bare-catalog", x => x.restore.bare_catalog_reconstruction = false],
  ["reject-no-site-loss", x => x.disaster.total_site_loss = false],
  ["reject-no-control-plane-loss", x => x.disaster.control_plane_loss = false],
  ["reject-no-credential-loss", x => x.disaster.credential_loss = false],
  ["reject-no-dns-ca-loss", x => x.disaster.dns_ca_loss = false],
  ["reject-one-operator", x => x.disaster.trained_operators = 1],
  ["reject-shared-keys", x => x.security.key_separation = false],
  ["reject-release-key", x => x.security.release_keys_present = true],
  ["reject-unisolated-restore", x => x.security.isolated_restore = false],
  ["reject-unsigned-evidence", x => x.restore.evidence_signed = false],
  ["reject-no-rpo-rto", x => delete x.evidence.observed_rto_seconds]
];

function run(inv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-contract-"));
  const file = path.join(dir, "inventory.json");
  fs.writeFileSync(file, JSON.stringify(inv, null, 2));
  const r = spawnSync(process.execPath, [verifier, policy, file], {encoding:"utf8"});
  fs.rmSync(dir, {recursive:true, force:true});
  return r;
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
console.log("PASS adversarial backup/DR controls");
