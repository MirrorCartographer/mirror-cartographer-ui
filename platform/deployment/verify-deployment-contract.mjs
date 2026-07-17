#!/usr/bin/env node
import fs from "node:fs";

const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) {
  console.error("usage: verify-deployment-contract.mjs POLICY INVENTORY");
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const i = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const digest = value => /^sha256:[0-9a-f]{64}$/.test(value ?? "");

check(p.authority.project_owned_deployment_controller && i.authority.project_owned, "project must own deployment controller");
check(!p.authority.provider_deployment_state_authoritative && !i.authority.provider_authoritative, "provider cannot be deployment authority");
check(!p.authority.scheduler_state_authoritative && !i.authority.scheduler_authoritative, "scheduler state cannot be canonical deployment truth");
check(digest(i.release.manifest_digest) && i.release.signature_verified, "signed release-manifest digest required");
check(Number.isInteger(i.release.sequence) && i.release.sequence > 0 && i.admission.sequence_monotonic, "monotonic release sequence required");
check(digest(i.release.artifact_digest) && i.release.artifact_verified_on_host, "artifact must be reverified on target host");
check(digest(i.release.policy_digest) && i.release.policy_verified, "deployment policy digest must be verified");
check(i.desired_state.source_controlled && i.desired_state.exportable, "desired state must be project-controlled and exportable");
check(typeof i.desired_state.immutable_revision === "string" && i.desired_state.immutable_revision.length > 0, "immutable desired-state revision required");
check(i.desired_state.adapter_replaceable, "runtime adapter must be replaceable");
check(/@sha256:[0-9a-f]{64}$/.test(i.desired_state.image_reference), "image must be digest pinned");
check(digest(i.desired_state.configuration_digest), "configuration digest required");
check(!i.desired_state.contains_secret_values, "desired state must not contain secret values");
check(i.admission.schema_compatible, "schema compatibility evidence required");
check(i.admission.capacity_available, "capacity admission required");
check(i.admission.failure_domains_available >= p.runtime.minimum_failure_domains, "insufficient deployment failure domains");
check(i.admission.time_uncertainty_within_policy, "unsafe clock state blocks deployment");
check(i.strategy.mode === p.strategy.critical_default, "critical deployment strategy mismatch");
check(i.strategy.canary_count >= 1, "canary required");
check(i.strategy.manual_promotion, "manual canary promotion required");
check(i.strategy.minimum_healthy_seconds >= p.strategy.minimum_healthy_seconds, "canary health duration too short");
check(i.strategy.progress_deadline_seconds <= p.strategy.progress_deadline_seconds, "progress deadline too long");
check(i.strategy.maximum_parallel_fraction <= p.strategy.maximum_parallel_fraction, "parallel rollout exceeds policy");
check(i.strategy.automatic_revert, "automatic revert on health failure required");
check(i.strategy.old_revision_retained, "previous revision must remain available");
check(i.strategy.traffic_shift_atomic, "traffic shift must be atomic");
check(i.strategy.connection_draining, "connection draining required");
for (const key of ["startup","readiness","liveness","semantic","external","error_budget_gate","dependencies"]) check(i.health[key], `${key} health evidence required`);
check(i.health.all_evidence_present, "missing health evidence must fail closed");
check(i.rollback.signed_decision, "rollback requires new signed decision");
check(i.rollback.target_release_admitted, "rollback target must be previously admitted");
check(i.rollback.database_compatible, "rollback requires database compatibility");
check(!i.rollback.requires_dns_change, "rollback must not require DNS change");
check(!i.rollback.requires_registry, "rollback must survive registry outage");
check(i.rollback.artifact_in_project_custody, "rollback artifact must remain in project custody");
check(i.rollback.observed_seconds <= p.rollback.maximum_target_seconds, "rollback target exceeded");
check(new Set(i.runtime.failure_domains).size >= p.runtime.minimum_failure_domains, "runtime failure domains insufficient");
check(i.runtime.ready_replicas >= p.runtime.critical_minimum_ready_replicas, "insufficient ready replicas");
check(i.runtime.rootless, "rootless execution required");
check(i.runtime.read_only_rootfs, "read-only root filesystem required");
check(!i.runtime.host_runtime_socket, "host runtime socket forbidden");
check(i.runtime.default_deny_network, "default-deny workload network required");
check(i.runtime.resource_limits, "resource limits required");
check(i.runtime.workload_identity, "workload identity required");
check(i.runtime.host_drift_clear, "host drift must block deployment");
for (const key of ["machine_generated","signed","release_digest","runtime_state_digest","health_results","traffic_shift_record","operator_identity","rollback_point"]) check(i.evidence[key], `deployment evidence missing ${key}`);
check(i.evidence.retention_days >= p.evidence.retention_days, "deployment evidence retention insufficient");
check(i.continuity.provider_independent_path, "provider-independent deployment path required");
check(!i.continuity.public_dns_required, "deployment cannot require public DNS");
check(!i.continuity.github_required, "deployment cannot require GitHub");
check(!i.continuity.original_registry_required, "deployment cannot require original registry");
check(i.continuity.last_clean_host_reconstruction_age_days <= p.continuity.clean_host_reconstruction_days, "clean-host reconstruction is stale");
check(i.continuity.trained_operators >= p.continuity.minimum_trained_operators, "insufficient trained deployment operators");
if (failures.length) {
  console.error(`REJECT ${failures.length} deployment invariant(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("ACCEPT 58 deployment invariants");
