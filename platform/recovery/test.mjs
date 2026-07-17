#!/usr/bin/env node
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
const root=path.resolve('platform/recovery');
const base={policy:JSON.parse(fs.readFileSync(path.join(root,'policy.json'))),inventory:JSON.parse(fs.readFileSync(path.join(root,'inventory.json'))),evidence:JSON.parse(fs.readFileSync(path.join(root,'restore-evidence.json')))};
const verifier=path.join(root,'verify-recovery-contract.mjs');
function run(name,mutate,pass=false){const x=structuredClone(base);mutate(x);const d=fs.mkdtempSync(path.join(os.tmpdir(),'foundation-recovery-'));for(const k of ['policy','inventory','evidence'])fs.writeFileSync(path.join(d,`${k}.json`),JSON.stringify(x[k],null,2));const r=spawnSync(process.execPath,[verifier,path.join(d,'policy.json'),path.join(d,'inventory.json'),path.join(d,'evidence.json')],{encoding:'utf8'});if((r.status===0)!==pass){console.error(r.stdout,r.stderr);throw new Error(`${name}: expected ${pass?'accept':'reject'}`)}console.log(`PASS ${name}`)}
run('baseline',()=>{},true);
run('reject-two-copies',x=>x.inventory.copies.pop());
run('reject-one-domain',x=>x.inventory.copies.forEach(c=>c.failure_domain='site-a'));
run('reject-no-offline',x=>x.inventory.copies.forEach(c=>c.offline=false));
run('reject-no-immutable',x=>x.inventory.copies.forEach(c=>c.immutable=false));
run('reject-key-in-repository',x=>x.inventory.keys.stored_outside_repositories=false);
run('reject-one-key-copy',x=>x.inventory.keys.recovery_key_copies=1);
run('reject-no-wal',x=>x.inventory.postgres.wal_archive=false);
run('reject-no-manifest',x=>x.inventory.postgres.backup_manifest='crc32c');
run('reject-stale-drill',x=>x.evidence.completed_at='2025-01-01T00:00:00Z');
run('reject-rpo-breach',x=>x.evidence.measured_rpo_minutes=16);
run('reject-rto-breach',x=>x.evidence.measured_rto_minutes=121);
run('reject-single-operator',x=>x.evidence.operators=['operator-a']);
run('reject-dns-dependency',x=>x.inventory.dns_independent_access=false);
run('reject-unsigned-evidence',x=>x.evidence.signed=false);
console.log('PASS adversarial recovery controls');
