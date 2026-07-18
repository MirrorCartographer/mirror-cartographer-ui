#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here, "policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here, "inventory.json"), "utf8"));
const verifier = path.join(here, "verify-runtime-contract.mjs");
const mutations = [
  ["reject-scheduler-authority", x => x.authority.scheduler_authoritative = true],
  ["reject-cloud-authority", x => x.authority.cloud_instance_state_authoritative = true],
  ["reject-fixed-adapter", x => x.authority.adapter_replaceable = false],
  ["reject-one-domain", x => x.nodes.forEach(n => n.domain = "site-a")],
  ["reject-floating-host-image", x => x.nodes[0].image_digest = "latest"],
  ["reject-host-drift", x => x.nodes[0].drift_clear = false],
  ["reject-mutable-host", x => x.node_admission.immutable_host_image = false],
  ["reject-no-secure-boot-evidence", x => x.node_admission.secure_boot_measured_or_exception = false],
  ["reject-bad-time", x => x.node_admission.time_healthy = false],
  ["reject-stale-rebuild", x => x.node_admission.clean_host_rebuild_age_days = 31],
  ["reject-cgroup-v1", x => x.isolation.cgroup_v2 = false],
  ["reject-no-cpu-limit", x => x.isolation.cpu_max = false],
  ["reject-no-memory-limit", x => x.isolation.memory_max = false],
  ["reject-no-pids-limit", x => x.isolation.pids_max = false],
  ["reject-rootful-default", x => x.isolation.rootless_default = false],
  ["reject-writable-rootfs", x => x.isolation.read_only_rootfs_default = false],
  ["reject-host-pid", x => x.isolation.host_pid_namespace = true],
  ["reject-host-network", x => x.isolation.host_network_default = true],
  ["reject-runtime-socket", x => x.isolation.host_runtime_socket = true],
  ["reject-one-privileged-operator", x => x.isolation.privileged_exception_operator_count = 1],
  ["reject-no-seccomp", x => x.isolation.seccomp = false],
  ["reject-no-workload-identity", x => x.isolation.workload_identity = false],
  ["reject-one-critical-replica", x => x.placement.critical_replicas = 1],
  ["reject-no-antiaffinity", x => x.placement.anti_affinity = false],
  ["reject-no-requests", x => x.placement.resource_requests = false],
  ["reject-no-limits", x => x.placement.resource_limits = false],
  ["reject-no-overcommit-policy", x => x.placement.overcommit_policy = ""],
  ["reject-no-stateful-locality", x => x.placement.stateful_locality = ""],
  ["reject-low-maintenance-reserve", x => x.placement.maintenance_reserve_percent = 10],
  ["reject-no-semantic-probe", x => x.runtime_health.semantic = false],
  ["reject-no-psi", x => x.runtime_health.pressure_stall = false],
  ["reject-missing-health", x => x.runtime_health.all_evidence_present = false],
  ["reject-no-cordon", x => x.maintenance.cordon_before_drain = false],
  ["reject-no-quorum-check", x => x.maintenance.stateful_quorum_check = false],
  ["reject-unbounded-eviction", x => x.maintenance.eviction_timeout_seconds = 0],
  ["reject-one-force-operator", x => x.maintenance.force_evict_operator_count = 1],
  ["reject-no-old-node", x => x.maintenance.old_node_retained = false],
  ["reject-scheduler-stops-workloads", x => x.scheduler_continuity.running_workloads_survive_scheduler_loss = false],
  ["reject-no-local-start", x => x.scheduler_continuity.manual_local_start = false],
  ["reject-provider-required", x => x.scheduler_continuity.provider_api_required = true],
  ["reject-registry-required", x => x.scheduler_continuity.original_registry_required = true],
  ["reject-no-secondary-adapter", x => x.scheduler_continuity.secondary_adapter_proven = false],
  ["reject-one-operator", x => x.scheduler_continuity.trained_operators = 1],
  ["reject-autoscaler-authority", x => x.scaling_guardrails.autoscaler_advisor_only = false],
  ["reject-no-capacity-recheck", x => x.scaling_guardrails.capacity_recheck = false],
  ["reject-fast-scale-down", x => x.scaling_guardrails.scale_down_stabilization_seconds = 30],
  ["reject-large-scale-down", x => x.scaling_guardrails.maximum_scale_down_fraction = 0.5],
  ["reject-missing-metrics-scale-down", x => x.scaling_guardrails.missing_metrics_forbid_scale_down = false],
  ["reject-provider-only-scale", x => x.scaling_guardrails.provider_capacity_sole_path = true],
  ["reject-no-oob", x => x.security.out_of_band_access = false],
  ["reject-release-key", x => x.security.release_keys_present = true],
  ["reject-backup-delete-key", x => x.security.backup_delete_keys_present = true],
  ["reject-no-decommission-revoke", x => x.security.decommission_revokes_identity = false],
  ["reject-local-audit", x => x.security.audit_externalized = false],
  ["reject-unsigned-evidence", x => x.evidence.signed = false],
  ["reject-no-scheduler-loss-proof", x => x.evidence.scheduler_loss_result = false],
  ["reject-one-evidence-operator", x => x.evidence.operator_signatures = 1]
];

function run(inv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-contract-"));
  const file = path.join(dir, "inventory.json");
  fs.writeFileSync(file, JSON.stringify(inv, null, 2));
  const result = spawnSync(process.execPath, [verifier, policy, file], {encoding:"utf8"});
  fs.rmSync(dir, {recursive:true, force:true});
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
console.log("PASS adversarial runtime controls");
