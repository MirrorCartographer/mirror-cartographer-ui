#!/usr/bin/env node
import fs from "node:fs";
const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) process.exit(2);
const p = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const i = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const failures = [];
const check = (x,m)=>{if(!x) failures.push(m)};
const digest = x => /^sha256:[0-9a-f]{64}$/.test(x ?? "");

check(i.authority.project_owned && i.authority.retention_policy_owned, "project artifact and retention authority required");
check(!i.authority.registry_authoritative && !i.authority.tag_authoritative && !i.authority.cloud_registry_authoritative, "registry/tag/cloud cannot be canonical authority");
check(i.authority.exportable && i.authority.replaceable, "catalog and registry adapters must be portable");

check(digest(i.identity.release_reference) && i.identity.sha256, "digest-only SHA-256 release identity required");
check(i.identity.tag_resolution_recorded, "tag resolution must be recorded");
check(i.identity.multi_platform_index && i.identity.platform_manifest_closure, "multi-platform closure required");
check(i.identity.config_layer_closure && i.identity.media_types_preserved && i.identity.sizes_verified, "complete descriptor closure required");

check(i.referrers.oci_11_subject && i.referrers.referrers_api && i.referrers.fallback_tag_reconciliation, "OCI 1.1 referrer controls required");
for (const t of ["sbom","provenance","signature","vulnerability"]) check(i.referrers.types.includes(t), `missing referrer type: ${t}`);
check(digest(i.referrers.graph_digest) && i.referrers.unknown_types_preserved, "referrer graph digest and unknown type preservation required");

check(i.custody.registries.length >= p.custody.minimum_online_registries, "insufficient online registries");
check(new Set(i.custody.registries.map(x=>x.implementation)).size >= p.custody.minimum_registry_implementations, "registry implementation diversity required");
check(new Set(i.custody.registries.map(x=>x.domain)).size >= p.custody.minimum_failure_domains, "registry failure-domain diversity required");
check(i.custody.object_store_project_custody, "project-custodied object storage required");
check(i.custody.offline_oci_layout_export && i.custody.portable_oras_copy, "offline OCI layout and portable copy required");
check(!i.custody.registry_gc_authoritative && !i.custody.deletion_replication_default, "GC and replicated deletion cannot be authoritative");
check(i.custody.complete_graph_reconciliation, "complete graph reconciliation required");

check(i.publication.quarantine_namespace && i.publication.release_namespace_append_only, "quarantine and append-only release namespaces required");
check(i.publication.immutable_release_tags && !i.publication.mutable_convenience_tags_authoritative, "immutable release tags and non-authoritative convenience tags required");
check(!i.publication.writer_can_delete && i.publication.release_authority_separate, "writer/deleter/release authority separation required");
check(i.publication.destructive_operator_count >= 2, "destructive changes require two operators");
check(i.publication.promotion_reference === "digest" && i.publication.copy_before_publish, "digest promotion and copy-before-publish required");

check(i.retention.source_controlled && i.retention.release_hold && i.retention.legal_incident_hold, "source-controlled hold-aware retention required");
check(i.retention.deletion_grace_hours >= p.retention.minimum_deletion_grace_hours, "deletion grace too short");
check(i.retention.reachability_analysis && i.retention.referrer_reachability, "manifest and referrer reachability analysis required");
check(i.retention.rollback_window && i.retention.recent_restore_before_delete && i.retention.tombstone_manifest, "safe deletion prerequisites required");

check(i.security.short_lived_workload_identity && i.security.repository_scoped_tokens, "short-lived scoped registry credentials required");
check(!i.security.admin_api_public, "registry administration must not be public");
check(!i.security.release_signing_keys_on_registry && !i.security.backup_deletion_keys_on_registry, "high-authority keys forbidden on registry nodes");
check(i.security.content_digest_recomputed_on_read && i.security.manifest_schema_validation, "read-time hashing and manifest validation required");
check(i.security.decompression_bomb_limits && !i.security.malware_scan_authoritative, "resource limits required; scanner cannot be authority");

check(!i.continuity.original_registry_required && !i.continuity.original_object_store_required, "recovery cannot require original registry or object store");
check(!i.continuity.public_dns_required && !i.continuity.github_required, "recovery cannot require public DNS or GitHub");
check(i.continuity.cross_implementation_restore && i.continuity.offline_catalog, "cross-implementation restore and offline catalog required");
check(i.continuity.last_clean_host_restore_age_days <= p.continuity.clean_host_restore_max_age_days, "clean-host restore stale");
check(i.continuity.trained_operators >= p.continuity.minimum_trained_operators, "insufficient trained operators");

check(i.evidence.machine_generated && i.evidence.signed, "signed machine evidence required");
check(digest(i.evidence.catalog_digest), "invalid catalog digest");
for (const k of ["graph_reconciliation","cross_registry_copy","gc_survival_test","clean_host_restore"]) check(i.evidence[k], `missing evidence: ${k}`);
check(i.evidence.operator_signatures >= p.evidence.operator_signatures, "two evidence signatures required");
check(i.evidence.retention_days >= p.evidence.retention_days, "evidence retention insufficient");

if (failures.length) {
  console.error(`REJECT ${failures.length} artifact-registry invariant(s)`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log("ACCEPT 67 artifact-registry invariants");
