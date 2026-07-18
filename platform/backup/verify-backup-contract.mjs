#!/usr/bin/env node
import fs from 'node:fs';
const [policyPath, inventoryPath, graphPath] = process.argv.slice(2);
if (!graphPath) { console.error('usage: verify-backup-contract.mjs POLICY INVENTORY RESTORE_GRAPH'); process.exit(2); }
const p=JSON.parse(fs.readFileSync(policyPath)); const i=JSON.parse(fs.readFileSync(inventoryPath)); const g=JSON.parse(fs.readFileSync(graphPath));
const failures=[]; const check=(x,m)=>{if(!x)failures.push(m)}; const digest=x=>/^sha256:[0-9a-f]{64}$/.test(x??'');
check(i.authority.project_owned,'project recovery catalog required');
check(!i.authority.backup_tool_authoritative&&!i.authority.cloud_snapshot_authoritative&&!i.authority.provider_catalog_authoritative,'tools/providers cannot be recovery authority');
check(i.authority.restore_plan_exportable&&i.authority.adapter_replaceable&&i.authority.evidence_project_custody,'portable project custody required');
check(Array.isArray(i.datasets)&&i.datasets.length>0,'dataset catalog required');
for(const d of i.datasets){check(d.id&&d.class,'dataset identity/class required');check(Number.isFinite(d.rpo_seconds)&&d.rpo_seconds>=0,'dataset RPO required');check(Number.isFinite(d.rto_seconds)&&d.rto_seconds>0,'dataset RTO required');check(d.consistency&&d.retention,'consistency and retention required');check(Array.isArray(d.dependencies),'dataset dependencies required')}
check(new Set(i.datasets.map(d=>d.id)).size===i.datasets.length,'duplicate dataset IDs');
check(i.custody.copies.length>=p.custody.minimum_copies,'insufficient backup copies');
check(new Set(i.custody.copies.map(x=>x.failure_domain)).size>=p.custody.minimum_failure_domains,'insufficient backup failure domains');
check(new Set(i.custody.copies.map(x=>x.admin_domain)).size>=p.custody.minimum_administrative_domains,'insufficient administrative domains');
check(i.custody.copies.some(x=>x.immutable),'immutable backup copy required');
check(i.custody.offline_or_airgapped&&i.custody.cross_implementation,'offline and cross-implementation custody required');
check(!i.custody.shared_credentials&&!i.custody.shared_key_path&&!i.custody.original_provider_sole_path,'copies must not share total compromise path');
check(i.integrity.content_digests&&i.integrity.signed_manifests,'signed content manifests required');
check(i.integrity.last_full_read_age_days<=p.integrity.full_read_verification_days,'full-read verification stale');
check(i.integrity.metadata_reconciliation&&i.integrity.corruption_injection&&i.integrity.partial_restore_rejected,'integrity controls required');
check(i.integrity.tool_success_not_sufficient,'backup tool status is not verification');
for(const k of ['physical_base_backup','continuous_wal_archive','wal_continuity_verified','logical_export','timeline_history_retained','pitr_target_tested','restore_without_ha_controller'])check(i.database[k],`database backup missing ${k}`);
for(const k of ['broker_snapshot','portable_event_export','consumer_state_export','cross_broker_replay','event_digest_reconciliation'])check(i.queue[k],`queue backup missing ${k}`);
for(const k of ['versions','delete_markers','retention_state','referrer_graph','portable_inventory'])check(i.objects[k],`object backup missing ${k}`);
check(i.secrets_identity.encrypted_backup&&i.secrets_identity.key_recovery_separate&&i.secrets_identity.root_material_offline&&i.secrets_identity.threshold_recovery&&i.secrets_identity.restore_ceremony_tested,'secret/root recovery controls required');
check(!i.secrets_identity.release_keys_in_backup_system,'release keys forbidden in backup plane');
check(!i.deletion.writer_can_delete&&i.deletion.operator_count>=2,'backup deletion authority separation required');
check(i.deletion.grace_hours>=p.deletion.minimum_grace_hours&&i.deletion.hold_check&&i.deletion.last_known_good_restore&&i.deletion.mass_delete_detection,'safe expiration controls required');
for(const k of ['clean_room','initial_network_isolation','malware_scan','semantic_verification','dependency_order_enforced','partial_restore_scoped','target_noncanonical_until_acceptance','signed_promotion'])check(i.restore[k],`restore control missing ${k}`);
for(const k of ['site_loss','provider_loss','credential_loss','dns_loss','catalog_loss','key_service_loss','operator_unavailability'])check(i.dr[k],`DR scenario untested ${k}`);
check(i.dr.last_drill_age_days<=p.dr.maximum_drill_age_days,'DR drill stale');check(i.dr.trained_operators>=p.dr.minimum_trained_operators,'insufficient trained operators');
check(i.evidence.machine_generated&&i.evidence.signed,'signed machine evidence required');
for(const k of ['catalog_digest','backup_manifest_digest','restore_graph_digest'])check(digest(i.evidence[k]),`invalid evidence digest ${k}`);
check(i.evidence.measured_rpo_seconds<=Math.max(...i.datasets.map(d=>d.rpo_seconds)),'measured RPO exceeds catalog');
check(i.evidence.measured_rto_seconds<=Math.max(...i.datasets.map(d=>d.rto_seconds)),'measured RTO exceeds catalog');
check(i.evidence.semantic_verification&&i.evidence.operator_signatures>=2&&i.evidence.retention_days>=p.evidence.retention_days,'evidence incomplete');
const nodes=new Map(g.nodes.map(n=>[n.id,n])); check(nodes.size===g.nodes.length,'duplicate restore graph nodes');
for(const n of g.nodes){check(Array.isArray(n.depends_on)&&Array.isArray(n.verify)&&n.verify.length>0,`invalid restore node ${n.id}`);for(const dep of n.depends_on)check(nodes.has(dep),`unknown dependency ${dep}`)}
const visiting=new Set(),visited=new Set(); let cycle=false; function visit(id){if(visiting.has(id)){cycle=true;return}if(visited.has(id))return;visiting.add(id);for(const d of nodes.get(id)?.depends_on??[])visit(d);visiting.delete(id);visited.add(id)} for(const id of nodes.keys())visit(id);check(!cycle,'restore graph contains cycle');
for(const d of i.datasets)check(nodes.has(d.id),`dataset absent from restore graph: ${d.id}`);
if(failures.length){console.error(`REJECT ${failures.length} backup/restore invariant(s)`);for(const f of failures)console.error(`- ${f}`);process.exit(1)}
console.log('ACCEPT 78 backup/restore invariants');
