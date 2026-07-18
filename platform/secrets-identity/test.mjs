#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here, "policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here, "inventory.json"), "utf8"));
const verifier = path.join(here, "verify-secrets-identity-contract.mjs");

const mutations = [
  ["reject-openbao-authority", x => x.authority.openbao_authoritative = true],
  ["reject-spire-authority", x => x.authority.spire_authoritative = true],
  ["reject-cloud-authority", x => x.authority.cloud_iam_authoritative = true],
  ["reject-fixed-adapters", x => x.authority.replaceable = false],
  ["reject-online-root", x => x.roots.online_root_key = true],
  ["reject-four-shares", x => x.roots.shares = x.roots.shares.slice(0,4)],
  ["reject-threshold-one", x => x.roots.threshold = 1],
  ["reject-one-root-domain", x => x.roots.shares.forEach(s => s.domain = "operator-a")],
  ["reject-single-operator-root", x => x.roots.single_operator_recovery = true],
  ["reject-kms-only-root", x => x.roots.provider_kms_sole_path = true],
  ["reject-stale-root-ceremony", x => x.roots.last_recovery_ceremony_age_days = 181],
  ["reject-one-trust-domain", x => x.workload_identity.trust_domains = ["foundation.internal"]],
  ["reject-join-token-default", x => x.workload_identity.join_tokens_production_default = true],
  ["reject-join-token-only", x => x.workload_identity.node_attestation = "join-token-only"],
  ["reject-one-workload-selector", x => x.workload_identity.workload_attestation = ["unix"]],
  ["reject-jwt-preferred", x => x.workload_identity.preferred_svid = "jwt"],
  ["reject-unbounded-jwt-audience", x => x.workload_identity.jwt_audience_bounded = false],
  ["reject-long-x509", x => x.workload_identity.x509_svid_ttl_minutes = 1440],
  ["reject-long-jwt", x => x.workload_identity.jwt_svid_ttl_minutes = 60],
  ["reject-exported-app-key", x => x.workload_identity.app_private_key_export = true],
  ["reject-no-revocation-test", x => x.workload_identity.identity_revocation_tested = false],
  ["reject-static-default", x => x.secret_broker.dynamic_secrets_preferred = false],
  ["reject-long-lease", x => x.secret_broker.default_lease_minutes = 1440],
  ["reject-no-revocation", x => x.secret_broker.revocation = false],
  ["reject-reusable-bootstrap", x => x.secret_broker.unwrap_single_use = false],
  ["reject-secrets-in-ci", x => x.secret_broker.secrets_in_ci = true],
  ["reject-secrets-in-git", x => x.secret_broker.secrets_in_git = true],
  ["reject-secrets-in-image", x => x.secret_broker.secrets_in_images = true],
  ["reject-secrets-in-scheduler", x => x.secret_broker.secrets_in_scheduler_state = true],
  ["reject-two-bao-nodes", x => x.openbao.nodes = x.openbao.nodes.slice(0,2)],
  ["reject-one-bao-domain", x => x.openbao.nodes.forEach(n => n.domain = "site-a")],
  ["reject-cloud-autounseal-only", x => x.openbao.cloud_kms_sole_recovery = true],
  ["reject-one-audit-device", x => x.openbao.audit_devices = ["local"]],
  ["reject-no-audit-failure-test", x => x.openbao.audit_failure_tested = false],
  ["reject-no-snapshot-restore", x => x.openbao.snapshot_restore_tested = false],
  ["reject-persistent-root-token", x => x.openbao.persistent_root_token_use = true],
  ["reject-one-breakglass-operator", x => x.openbao.breakglass_operator_count = 1],
  ["reject-default-allow", x => x.authorization.default_deny = false],
  ["reject-human-workload-collapse", x => x.authorization.human_workload_separate = false],
  ["reject-one-privileged-operator", x => x.authorization.privileged_change_operator_count = 1],
  ["reject-permanent-elevation", x => x.authorization.elevation_max_minutes = 1440],
  ["reject-no-rotation-overlap", x => x.rotation.dual_key_overlap = false],
  ["reject-no-old-key-revocation", x => x.rotation.old_credential_revocation_verified = false],
  ["reject-unbounded-mass-rotation", x => x.rotation.mass_rotation_rate_limit_per_minute = 1000],
  ["reject-unsafe-rotation-order", x => x.rotation.dependency_order = ["revoke-old","issuer","consumer"]],
  ["reject-openbao-root-recovery", x => x.recovery.openbao_required_for_roots = true],
  ["reject-spire-root-recovery", x => x.recovery.spire_required_for_roots = true],
  ["reject-cloud-recovery", x => x.recovery.original_cloud_required = true],
  ["reject-no-offline-export", x => x.recovery.offline_encrypted_secret_export = false],
  ["reject-stale-clean-recovery", x => x.recovery.last_clean_host_recovery_age_days = 31],
  ["reject-one-operator", x => x.recovery.trained_operators = 1],
  ["reject-unsafe-recovery-order", x => x.recovery.restore_order = ["secret-broker","identity-roots"]],
  ["reject-unsigned-evidence", x => x.evidence.signed = false],
  ["reject-no-lease-proof", x => x.evidence.lease_and_revocation_result = false],
  ["reject-one-evidence-operator", x => x.evidence.operator_signatures = 1]
];

function run(inv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-identity-contract-"));
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
console.log("PASS adversarial secrets/identity controls");
