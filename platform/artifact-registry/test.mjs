#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here,"policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here,"inventory.json"),"utf8"));
const verifier = path.join(here,"verify-artifact-registry-contract.mjs");
const graph = path.join(here,"graph-catalog.mjs");
const sample = path.join(here,"sample-graph.json");
const mutations = [
["reject-registry-authority",x=>x.authority.registry_authoritative=true],
["reject-tag-authority",x=>x.authority.tag_authoritative=true],
["reject-cloud-authority",x=>x.authority.cloud_registry_authoritative=true],
["reject-fixed-adapter",x=>x.authority.replaceable=false],
["reject-tag-release",x=>x.identity.release_reference="latest"],
["reject-no-tag-resolution",x=>x.identity.tag_resolution_recorded=false],
["reject-no-index",x=>x.identity.multi_platform_index=false],
["reject-no-platform-closure",x=>x.identity.platform_manifest_closure=false],
["reject-no-layer-closure",x=>x.identity.config_layer_closure=false],
["reject-no-size-check",x=>x.identity.sizes_verified=false],
["reject-no-referrers-api",x=>x.referrers.referrers_api=false],
["reject-no-fallback-reconcile",x=>x.referrers.fallback_tag_reconciliation=false],
["reject-no-sbom",x=>x.referrers.types=x.referrers.types.filter(t=>t!=="sbom")],
["reject-no-provenance",x=>x.referrers.types=x.referrers.types.filter(t=>t!=="provenance")],
["reject-no-signature",x=>x.referrers.types=x.referrers.types.filter(t=>t!=="signature")],
["reject-no-graph-digest",x=>x.referrers.graph_digest=""],
["reject-drop-unknown-types",x=>x.referrers.unknown_types_preserved=false],
["reject-one-registry",x=>x.custody.registries=x.custody.registries.slice(0,1)],
["reject-one-product",x=>x.custody.registries.forEach(r=>r.implementation="zot")],
["reject-one-domain",x=>x.custody.registries.forEach(r=>r.domain="site-a")],
["reject-no-offline-layout",x=>x.custody.offline_oci_layout_export=false],
["reject-gc-authority",x=>x.custody.registry_gc_authoritative=true],
["reject-delete-replication",x=>x.custody.deletion_replication_default=true],
["reject-no-reconcile",x=>x.custody.complete_graph_reconciliation=false],
["reject-no-quarantine",x=>x.publication.quarantine_namespace=false],
["reject-mutable-release",x=>x.publication.release_namespace_append_only=false],
["reject-mutable-release-tag",x=>x.publication.immutable_release_tags=false],
["reject-convenience-authority",x=>x.publication.mutable_convenience_tags_authoritative=true],
["reject-writer-delete",x=>x.publication.writer_can_delete=true],
["reject-release-collapse",x=>x.publication.release_authority_separate=false],
["reject-one-delete-operator",x=>x.publication.destructive_operator_count=1],
["reject-tag-promotion",x=>x.publication.promotion_reference="tag"],
["reject-no-hold",x=>x.retention.release_hold=false],
["reject-short-grace",x=>x.retention.deletion_grace_hours=1],
["reject-no-reachability",x=>x.retention.reachability_analysis=false],
["reject-ignore-referrers",x=>x.retention.referrer_reachability=false],
["reject-no-restore-before-delete",x=>x.retention.recent_restore_before_delete=false],
["reject-no-tombstone",x=>x.retention.tombstone_manifest=false],
["reject-long-lived-token",x=>x.security.short_lived_workload_identity=false],
["reject-public-admin",x=>x.security.admin_api_public=true],
["reject-release-keys-on-registry",x=>x.security.release_signing_keys_on_registry=true],
["reject-backup-delete-keys-on-registry",x=>x.security.backup_deletion_keys_on_registry=true],
["reject-no-read-rehash",x=>x.security.content_digest_recomputed_on_read=false],
["reject-no-schema-validation",x=>x.security.manifest_schema_validation=false],
["reject-scanner-authority",x=>x.security.malware_scan_authoritative=true],
["reject-original-registry",x=>x.continuity.original_registry_required=true],
["reject-original-store",x=>x.continuity.original_object_store_required=true],
["reject-github-required",x=>x.continuity.github_required=true],
["reject-no-cross-restore",x=>x.continuity.cross_implementation_restore=false],
["reject-stale-restore",x=>x.continuity.last_clean_host_restore_age_days=31],
["reject-one-operator",x=>x.continuity.trained_operators=1],
["reject-unsigned-evidence",x=>x.evidence.signed=false],
["reject-no-gc-test",x=>x.evidence.gc_survival_test=false],
["reject-one-evidence-signer",x=>x.evidence.operator_signatures=1]
];
function run(inv){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"artifact-registry-"));
 const f=path.join(d,"inventory.json");fs.writeFileSync(f,JSON.stringify(inv,null,2));
 const r=spawnSync(process.execPath,[verifier,policy,f],{encoding:"utf8"});
 fs.rmSync(d,{recursive:true,force:true});return r;
}
let r=run(base);if(r.status!==0){console.error(r.stdout,r.stderr);process.exit(1)}console.log("PASS baseline");
for(const [name,mutate] of mutations){const x=structuredClone(base);mutate(x);r=run(x);if(r.status===0){console.error(`FAIL ${name}`);process.exit(1)}console.log(`PASS ${name}`)}
const d=fs.mkdtempSync(path.join(os.tmpdir(),"artifact-graph-"));
const o1=path.join(d,"a.json"),o2=path.join(d,"b.json");
let g1=spawnSync(process.execPath,[graph,sample,o1],{encoding:"utf8"});
let g2=spawnSync(process.execPath,[graph,sample,o2],{encoding:"utf8"});
if(g1.status||g2.status||fs.readFileSync(o1,"utf8")!==fs.readFileSync(o2,"utf8")){console.error("FAIL deterministic graph");process.exit(1)}
const catalog=JSON.parse(fs.readFileSync(o1,"utf8"));
if(!catalog.objects.some(x=>x.artifactType==="application/spdx+json")){console.error("FAIL referrer closure");process.exit(1)}
const broken=JSON.parse(fs.readFileSync(sample,"utf8"));broken.objects=broken.objects.filter(x=>!x.digest.endsWith("5".repeat(64)));
const bf=path.join(d,"broken.json");fs.writeFileSync(bf,JSON.stringify(broken));
const br=spawnSync(process.execPath,[graph,bf,path.join(d,"broken-out.json")],{encoding:"utf8"});
if(br.status===0){console.error("FAIL missing blob accepted");process.exit(1)}
fs.rmSync(d,{recursive:true,force:true});
console.log("PASS deterministic graph and missing-object rejection");
console.log("PASS adversarial artifact-registry controls");
