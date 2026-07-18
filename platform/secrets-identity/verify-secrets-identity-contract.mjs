#!/usr/bin/env node
import fs from "node:fs";

const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) {
  console.error("usage: verify-secrets-identity-contract.mjs POLICY INVENTORY");
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const i = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const digest = value => /^sha256:[0-9a-f]{64}$/.test(value ?? "");

check(i.authority.project_owned, "project-owned identity and secret policy required");
check(!i.authority.openbao_authoritative && !i.authority.spire_authoritative && !i.authority.cloud_iam_authoritative, "mechanisms cannot be canonical authority");
check(i.authority.exportable && i.authority.replaceable, "identity and broker adapters must be portable");

check(i.roots.offline_root, "offline root required");
check(i.roots.shares.length >= p.roots.minimum_root_shares, "insufficient root shares");
check(i.roots.threshold >= p.roots.minimum_root_threshold && i.roots.threshold < i.roots.shares.length, "invalid root threshold");
check(new Set(i.roots.shares.map(x=>x.domain)).size >= p.roots.minimum_root_failure_domains, "insufficient root failure domains");
check(!i.roots.single_operator_recovery, "single-operator root recovery forbidden");
check(!i.roots.provider_kms_sole_path && !i.roots.online_root_key, "provider-only or online root forbidden");
check(i.roots.rotation_overlap, "root rotation overlap required");
check(i.roots.last_recovery_ceremony_age_days <= p.roots.recovery_ceremony_max_age_days, "root recovery ceremony stale");

check(i.workload_identity.spiffe_ids && i.workload_identity.security_boundary_separation, "SPIFFE IDs and trust-domain separation required");
check(i.workload_identity.trust_domains.length >= 3, "separate production/build/recovery trust domains required");
check(i.workload_identity.node_attestation !== "join-token-only", "strong node attestation required");
check(i.workload_identity.workload_attestation.length >= 2, "multi-signal workload attestation required");
check(!i.workload_identity.join_tokens_production_default, "join tokens cannot be production default");
check(i.workload_identity.preferred_svid === "x509", "X.509-SVID preferred");
check(i.workload_identity.jwt_audience_bounded, "JWT-SVID audience must be bounded");
check(i.workload_identity.x509_svid_ttl_minutes <= p.workload_identity.maximum_x509_svid_ttl_minutes, "X.509-SVID TTL too long");
check(i.workload_identity.jwt_svid_ttl_minutes <= p.workload_identity.maximum_jwt_svid_ttl_minutes, "JWT-SVID TTL too long");
check(!i.workload_identity.app_private_key_export, "workload private keys must not be exported to application storage");
check(i.workload_identity.bundle_rotation_overlap && i.workload_identity.identity_revocation_tested, "bundle rotation and identity revocation proof required");

check(i.secret_broker.dynamic_secrets_preferred && i.secret_broker.static_exception_expiry, "dynamic secrets and expiring static exceptions required");
check(i.secret_broker.default_lease_minutes <= p.secret_broker.maximum_default_lease_minutes, "default lease too long");
check(i.secret_broker.renewal_bounded && i.secret_broker.revocation, "bounded renewal and revocation required");
check(i.secret_broker.response_wrapping && i.secret_broker.unwrap_single_use, "single-use response wrapping required");
check(!i.secret_broker.secrets_in_ci && !i.secret_broker.secrets_in_git && !i.secret_broker.secrets_in_images && !i.secret_broker.secrets_in_scheduler_state, "secret values leaked into durable control state");

check(i.openbao.nodes.length >= p.openbao.minimum_nodes, "insufficient OpenBao nodes");
check(new Set(i.openbao.nodes.map(x=>x.domain)).size >= p.openbao.minimum_failure_domains, "insufficient OpenBao failure domains");
check(i.openbao.integrated_storage, "integrated storage required");
check(i.openbao.autounseal_key === "project-threshold-key", "autounseal must use project-controlled threshold key");
check(!i.openbao.cloud_kms_sole_recovery, "cloud KMS cannot be sole unseal recovery path");
check(i.openbao.audit_devices.length >= p.openbao.minimum_audit_devices, "multiple audit devices required");
check(i.openbao.audit_externalized && i.openbao.audit_failure_tested, "externalized audit and failure test required");
check(i.openbao.raft_snapshot && i.openbao.snapshot_restore_tested, "Raft snapshot and restore proof required");
check(!i.openbao.persistent_root_token_use, "persistent root token use forbidden");
check(i.openbao.breakglass_operator_count >= 2, "break-glass requires two operators");

check(i.authorization.default_deny && i.authorization.mapping_source_controlled, "default-deny source-controlled authorization required");
check(i.authorization.least_privilege && i.authorization.deny_overrides_allow, "least privilege and deny precedence required");
check(i.authorization.environment_separation && i.authorization.human_workload_separate, "environment and principal separation required");
check(i.authorization.production_write_strong_auth, "strong authentication required for production writes");
check(i.authorization.privileged_change_operator_count >= 2, "privileged changes require two operators");
check(i.authorization.elevation_max_minutes > 0 && i.authorization.elevation_max_minutes <= 60, "privilege elevation must be time bounded");

check(i.rotation.schedule_source_controlled && i.rotation.consumer_compatibility_window, "source-controlled rotation and compatibility window required");
check(i.rotation.dual_key_overlap && i.rotation.old_credential_revocation_verified, "overlap and old-key revocation proof required");
check(i.rotation.rollback, "rotation rollback required");
check(i.rotation.mass_rotation_rate_limit_per_minute > 0 && i.rotation.mass_rotation_rate_limit_per_minute <= 100, "mass rotation rate must be bounded");
check(JSON.stringify(i.rotation.dependency_order) === JSON.stringify(["trust-bundle","issuer","broker","consumer","revoke-old"]), "unsafe rotation dependency order");

check(!i.recovery.openbao_required_for_roots && !i.recovery.spire_required_for_roots, "root recovery cannot require OpenBao or SPIRE");
check(!i.recovery.public_dns_required && !i.recovery.original_cloud_required, "recovery cannot require public DNS or original cloud");
check(i.recovery.offline_policy_copy && i.recovery.offline_encrypted_secret_export, "offline policy and encrypted secret export required");
check(i.recovery.last_clean_host_recovery_age_days <= p.recovery.clean_host_recovery_max_age_days, "clean-host recovery stale");
check(i.recovery.trained_operators >= p.recovery.minimum_trained_operators, "insufficient trained operators");
check(JSON.stringify(i.recovery.restore_order) === JSON.stringify(["identity-roots","workload-identity","secret-broker","consumers"]), "unsafe recovery order");

check(i.evidence.machine_generated && i.evidence.signed, "signed machine evidence required");
for (const key of ["policy_digest","identity_registry_digest","trust_bundle_digest"]) check(digest(i.evidence[key]), `invalid evidence digest: ${key}`);
for (const key of ["attestation_result","lease_and_revocation_result","audit_continuity_result","rotation_result","recovery_result"]) check(i.evidence[key], `missing evidence: ${key}`);
check(i.evidence.operator_signatures >= p.evidence.operator_signatures, "two evidence signatures required");
check(i.evidence.retention_days >= p.evidence.retention_days, "evidence retention insufficient");

if (failures.length) {
  console.error(`REJECT ${failures.length} secrets/identity invariant(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("ACCEPT 69 secrets/identity invariants");
