import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const baseP = JSON.parse(fs.readFileSync(path.join(root,'policy.json'),'utf8'));
const baseI = JSON.parse(fs.readFileSync(path.join(root,'inventory.json'),'utf8'));
const clone = x => structuredClone(x);
const cases = [
 ['baseline',()=>{} ,true],
 ['reject-hosted-authority',(p)=>{p.authority.hosted_registry_authoritative=true},false],
 ['reject-nonexportable-index',(p,i)=>{i.canonical_index.exportable=false},false],
 ['reject-tags-authoritative',(p)=>{p.content.mutable_tags_authoritative=true},false],
 ['reject-no-read-verification',(p)=>{p.content.verify_bytes_on_read=false},false],
 ['reject-no-referrers',(p)=>{p.content.referrers_preserved=false},false],
 ['reject-two-copies',(p,i)=>{i.stores=i.stores.slice(0,2)},false],
 ['reject-one-domain',(p,i)=>{i.stores.forEach(x=>x.domain='site-a')},false],
 ['reject-no-offline',(p,i)=>{i.stores.forEach(x=>x.offline=false)},false],
 ['reject-no-immutable',(p,i)=>{i.stores.forEach(x=>x.immutable=false)},false],
 ['reject-unsafe-gc',(p,i)=>{i.oci.gc_mode='online-delete'},false],
 ['reject-no-oci-export',(p,i)=>{i.oci.export='vendor-snapshot'},false],
 ['reject-no-lockfile',(p,i)=>{i.packages.lockfile=''},false],
 ['reject-weak-integrity',(p,i)=>{i.packages.tarball_integrity='sha1'},false],
 ['reject-no-metadata',(p,i)=>{i.packages.metadata_snapshot=false},false],
 ['reject-public-package-source',(p,i)=>{i.packages.mirror='registry.npmjs.org'},false],
 ['reject-build-network',(p,i)=>{i.packages.canonical_build_network='allow'},false],
 ['reject-lifecycle-scripts',(p,i)=>{i.packages.lifecycle_scripts='allow'},false],
 ['reject-anonymous-push',(p,i)=>{i.access.anonymous_push=true},false],
 ['reject-release-keys',(p,i)=>{i.access.release_keys_present=true},false],
 ['reject-long-creds',(p,i)=>{i.access.credential_ttl_minutes=120},false],
 ['reject-stale-restore',(p,i)=>{i.evidence.age_days=31},false],
 ['reject-upstream-dependent-restore',(p,i)=>{i.evidence.without_upstreams=false},false],
 ['reject-same-implementation-only',(p,i)=>{i.evidence.cross_implementation=false},false],
 ['reject-late-capacity-alert',(p,i)=>{i.operations.capacity_alert_percent=90},false],
 ['reject-stale-integrity-scan',(p,i)=>{i.operations.integrity_scan_days=30},false],
 ['reject-one-delete-operator',(p,i)=>{i.operations.destructive_operators=1},false],
 ['reject-no-retention-manifest',(p,i)=>{i.operations.retention_manifest=false},false]
];
let failures=0;
for (const [name,mutate,expect] of cases) {
  const p=clone(baseP), i=clone(baseI); mutate(p,i);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'registry-test-'));
  const pp=path.join(dir,'p.json'), ip=path.join(dir,'i.json');
  fs.writeFileSync(pp,JSON.stringify(p)); fs.writeFileSync(ip,JSON.stringify(i));
  const r=spawnSync(process.execPath,[path.join(root,'verify-registry-contract.mjs'),pp,ip],{encoding:'utf8'});
  const accepted=r.status===0;
  if (accepted!==expect) { failures++; console.error(`FAIL ${name}\n${r.stdout}${r.stderr}`); }
  else console.log(`PASS ${name}`);
  fs.rmSync(dir,{recursive:true,force:true});
}
if (failures) process.exit(1);
console.log('PASS adversarial registry controls');
