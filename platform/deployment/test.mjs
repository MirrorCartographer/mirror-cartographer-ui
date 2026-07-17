#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here, "policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here, "inventory.json"), "utf8"));
const verifier = path.join(here, "verify-deployment-contract.mjs");

const mutations = [
  ["reject-provider-authority", x => x.authority.provider_authoritative = true],
  ["reject-scheduler-authority", x => x.authority.scheduler_authoritative = true],
  ["reject-unsigned-release", x => x.release.signature_verified = false],
  ["reject-mutable-tag", x => x.desired_state.image_reference = "registry.internal/app:production"],
  ["reject-unverified-host-artifact", x => x.release.artifact_verified_on_host = false],
  ["reject-nonexportable-state", x => x.desired_state.exportable = false],
  ["reject-fixed-adapter", x => x.desired_state.adapter_replaceable = false],
  ["reject-secret-in-state", x => x.desired_state.contains_secret_values = true],
  ["reject-schema-incompatible", x => x.admission.schema_compatible = false],
  ["reject-no-capacity", x => x.admission.capacity_available = false],
  ["reject-one-domain", x => x.admission.failure_domains_available = 1],
  ["reject-unsafe-time", x => x.admission.time_uncertainty_within_policy = false],
  ["reject-no-canary", x => x.strategy.canary_count = 0],
  ["reject-auto-promote", x => x.strategy.manual_promotion = false],
  ["reject-short-health", x => x.strategy.minimum_healthy_seconds = 30],
  ["reject-long-deadline", x => x.strategy.progress_deadline_seconds = 3600],
  ["reject-wide-rollout", x => x.strategy.maximum_parallel_fraction = 1],
  ["reject-no-auto-revert", x => x.strategy.automatic_revert = false],
  ["reject-no-old-revision", x => x.strategy.old_revision_retained = false],
  ["reject-nonatomic-shift", x => x.strategy.traffic_shift_atomic = false],
  ["reject-no-drain", x => x.strategy.connection_draining = false],
  ["reject-no-semantic-probe", x => x.health.semantic = false],
  ["reject-no-external-probe", x => x.health.external = false],
  ["reject-no-error-budget-gate", x => x.health.error_budget_gate = false],
  ["reject-missing-evidence", x => x.health.all_evidence_present = false],
  ["reject-unsigned-rollback", x => x.rollback.signed_decision = false],
  ["reject-unadmitted-rollback", x => x.rollback.target_release_admitted = false],
  ["reject-db-incompatible-rollback", x => x.rollback.database_compatible = false],
  ["reject-dns-rollback", x => x.rollback.requires_dns_change = true],
  ["reject-registry-rollback", x => x.rollback.requires_registry = true],
  ["reject-slow-rollback", x => x.rollback.observed_seconds = 600],
  ["reject-one-runtime-domain", x => x.runtime.failure_domains = ["site-a"]],
  ["reject-one-ready-replica", x => x.runtime.ready_replicas = 1],
  ["reject-rootful", x => x.runtime.rootless = false],
  ["reject-writable-rootfs", x => x.runtime.read_only_rootfs = false],
  ["reject-host-socket", x => x.runtime.host_runtime_socket = true],
  ["reject-open-network", x => x.runtime.default_deny_network = false],
  ["reject-host-drift", x => x.runtime.host_drift_clear = false],
  ["reject-unsigned-evidence", x => x.evidence.signed = false],
  ["reject-provider-only-path", x => x.continuity.provider_independent_path = false],
  ["reject-github-required", x => x.continuity.github_required = true],
  ["reject-original-registry-required", x => x.continuity.original_registry_required = true],
  ["reject-stale-reconstruction", x => x.continuity.last_clean_host_reconstruction_age_days = 31],
  ["reject-one-operator", x => x.continuity.trained_operators = 1]
];

function run(inv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-contract-"));
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
console.log("PASS adversarial deployment controls");
