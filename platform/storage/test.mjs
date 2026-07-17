import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
const here=path.dirname(new URL(import.meta.url).pathname); const p=path.join(here,'policy.json'); const baseline=JSON.parse(fs.readFileSync(path.join(here,'inventory.json'),'utf8'));
const cases=[
['baseline',()=>{},true],['reject-provider-authority',x=>x.provider_authoritative=true],['reject-ephemeral-durable',x=>x.data_classes.durable_on_ephemeral=true],
['reject-no-db-native',x=>x.data_classes.database_native_durability=false],['reject-no-checksums',x=>x.integrity.checksums=''],['reject-stale-scrub',x=>x.integrity.last_scrub_age_days=8],
['reject-unsafe-repair',x=>x.integrity.repair_only_with_redundancy=false],['reject-two-replicas',x=>x.volumes.pop()],['reject-one-domain',x=>x.volumes.forEach(v=>v.failure_domain='site-a')],
['reject-low-headroom',x=>x.capacity.free_percent=20],['reject-no-reservation',x=>x.capacity.hard_reservations=false],['reject-queue-on-full',x=>x.capacity.thin_fail_mode='queue'],
['reject-no-metadata-alert',x=>x.capacity.metadata_alerts=false],['reject-crash-only-snapshot',x=>x.snapshots.application_consistent_stateful=false],
['reject-snapshot-as-backup',x=>x.snapshots.treated_as_backup=true],['reject-no-retention-manifest',x=>x.snapshots.retention_manifest=false],
['reject-no-portable-export',x=>x.exports.portable=false],['reject-same-implementation-only',x=>x.exports.cross_implementation_verified=false],
['reject-two-backups',x=>x.backups.pop()],['reject-one-backup-domain',x=>x.backups.forEach(b=>b.failure_domain='site-a')],
['reject-no-offline',x=>x.backups.forEach(b=>b.offline=false)],['reject-no-immutable',x=>x.backups.forEach(b=>b.immutable=false)],
['reject-stale-restore',x=>x.restore_evidence.age_days=31],['reject-unsigned-restore',x=>x.restore_evidence.signed=false],
['reject-dns-dependent',x=>x.restore_evidence.without_dns=false],['reject-no-key-separation',x=>x.security.keys_separate=false],
['reject-no-rebuild-metric',x=>x.metrics.rebuild=false],['reject-one-operator',x=>x.destructive_actions.minimum_operators=1]];
for(const [name,mutate,accept=false] of cases){const d=structuredClone(baseline);mutate(d);const f=path.join(os.tmpdir(),`storage-${process.pid}-${name}.json`);fs.writeFileSync(f,JSON.stringify(d));const r=spawnSync(process.execPath,[path.join(here,'verify-storage-contract.mjs'),p,f],{encoding:'utf8'});fs.unlinkSync(f);const ok=r.status===0;if(ok!==accept){console.error(`FAIL ${name}\n${r.stdout}${r.stderr}`);process.exit(1);}console.log(`PASS ${name}`);}
console.log('PASS adversarial storage controls');
