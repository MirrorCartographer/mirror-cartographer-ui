import fs from 'node:fs';

const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) {
  console.error('usage: node verify-registry-contract.mjs policy.json inventory.json');
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const i = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const checks = [];
const check = (name, ok) => checks.push({name, ok: Boolean(ok)});

check('project namespace authority', p.authority.project_controls_namespace && !p.authority.hosted_registry_authoritative && i.canonical_index.owner === 'project');
check('canonical index exportable', p.authority.canonical_index_exportable && i.canonical_index.exportable);
check('sha256 content identity', p.content.digest_algorithm === 'sha256');
check('digest-only deployment', p.content.deploy_by_digest_only && !p.content.mutable_tags_authoritative);
check('ingest and read verification', p.content.verify_bytes_on_ingest && p.content.verify_bytes_on_read);
check('manifest and referrer preservation', p.content.preserve_manifest_bytes && p.content.referrers_preserved);
check('three custody copies', i.stores.length >= p.custody.copies);
check('two failure domains', new Set(i.stores.map(x => x.domain)).size >= p.custody.failure_domains);
check('offline custody', !p.custody.offline_copy || i.stores.some(x => x.offline));
check('immutable custody', !p.custody.immutable_copy || i.stores.some(x => x.immutable));
check('project controlled custody', !p.custody.project_controlled_copy || i.stores.some(x => x.project_controlled));
check('OCI distribution compatibility', i.oci.spec === p.oci.distribution_spec);
check('deletion disabled by default', p.oci.deletion_default === false);
check('safe garbage collection', p.oci.gc_requires_read_only && p.oci.gc_dry_run && p.oci.gc_protected_digests && i.oci.gc_mode.includes('read-only') && i.oci.gc_mode.includes('dry-run'));
check('portable OCI export', p.oci.registry_export_format === 'oci-layout' && i.oci.export === 'oci-layout');
check('package lockfile', p.packages.lockfile_required && Boolean(i.packages.lockfile));
check('tarball integrity', p.packages.tarball_integrity_required && ['sha512','sha256'].includes(i.packages.tarball_integrity));
check('metadata snapshot', p.packages.metadata_snapshot_required && i.packages.metadata_snapshot);
check('project package mirror', p.packages.install_from_project_mirror && i.packages.mirror === 'project-controlled');
check('offline canonical build', !p.packages.upstream_network_in_canonical_build && i.packages.canonical_build_network === 'deny');
check('lifecycle scripts denied', p.packages.lifecycle_scripts_default === 'deny' && i.packages.lifecycle_scripts === 'deny-by-default');
check('mirror exportable', p.packages.mirror_exportable);
check('TLS and workload identity', p.access.tls && p.access.workload_identity && i.access.tls && i.access.workload_identity);
check('no anonymous push', !p.access.anonymous_push && !i.access.anonymous_push);
check('no release keys on registry', !p.access.release_keys_present && !i.access.release_keys_present);
check('short lived credentials', i.access.credential_ttl_minutes <= p.access.short_lived_credentials_minutes);
check('fresh signed restore evidence', i.evidence.signed && i.evidence.clean_host && i.evidence.age_days <= p.recovery.clean_host_restore_days);
check('DNS and upstream independent reconstruction', i.evidence.without_public_dns && i.evidence.without_upstreams && p.recovery.reconstruct_without_public_dns && p.recovery.reconstruct_without_upstream_registries);
check('cross implementation restore', p.recovery.cross_implementation_restore && i.evidence.cross_implementation);
check('capacity alert', i.operations.capacity_alert_percent <= p.operations.capacity_alert_percent);
check('weekly integrity scans', i.operations.integrity_scan_days <= p.operations.integrity_scan_days);
check('audited deletes and two operators', i.operations.audit_deletes && i.operations.destructive_operators >= 2);
check('retention manifest', p.operations.retention_manifest_required && i.operations.retention_manifest);

const failed = checks.filter(x => !x.ok);
if (failed.length) {
  for (const f of failed) console.error(`REJECT ${f.name}`);
  process.exit(1);
}
console.log(`ACCEPT ${checks.length} registry invariants`);
