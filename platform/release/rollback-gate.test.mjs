import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto'; import {spawnSync} from 'node:child_process';
const script=path.resolve('platform/release/rollback-gate.mjs');
const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const can=v=>Array.isArray(v)?`[${v.map(can).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${can(v[k])}`).join(',')}}`:JSON.stringify(v);
const dig=v=>sha(Buffer.from(can(v)));
function fixture(mut){ const r=fs.mkdtempSync(path.join(os.tmpdir(),'rb-')); fs.mkdirSync(path.join(r,'site')); fs.writeFileSync(path.join(r,'site','index.html'),'ok'); const st=fs.statSync(path.join(r,'site','index.html')); const m={schema:'fia.rollback-bundle.v1',provider:null,release_authority:'foundation-intelligence',autoplay:false,previous_release_digest:'sha256:'+'1'.repeat(64),target_release_digest:'sha256:'+'2'.repeat(64),artifacts:[{path:'site/index.html',size:2,mode:st.mode&0o777,sha256:sha(Buffer.from('ok'))}],health_gate:{required:true,timeout_seconds:30},rollback_steps:['stop new runtime','activate previous runtime'],export:{format:'tar',provider_neutral:true}}; if(mut) mut(m,r); m.bundle_digest=dig(m); fs.writeFileSync(path.join(r,'rollback-manifest.json'),JSON.stringify(m)); return r; }
const run=r=>spawnSync(process.execPath,[script,r],{encoding:'utf8'});
test('valid bundle accepted',()=>assert.equal(run(fixture()).status,0));
test('provider binding rejected',()=>assert.notEqual(run(fixture(m=>m.provider='vercel')).status,0));
test('tampered artifact rejected',()=>{const r=fixture();fs.writeFileSync(path.join(r,'site/index.html'),'bad');assert.notEqual(run(r).status,0)});
test('manifest tampering rejected',()=>{const r=fixture();const p=path.join(r,'rollback-manifest.json');const m=JSON.parse(fs.readFileSync(p));m.autoplay=true;fs.writeFileSync(p,JSON.stringify(m));assert.notEqual(run(r).status,0)});
test('symlink rejected',()=>{const r=fixture((m,r)=>{fs.unlinkSync(path.join(r,'site/index.html'));fs.symlinkSync('/etc/hosts',path.join(r,'site/index.html'))});assert.notEqual(run(r).status,0)});
test('same release rejected',()=>assert.notEqual(run(fixture(m=>m.target_release_digest=m.previous_release_digest)).status,0));
test('missing health gate rejected',()=>assert.notEqual(run(fixture(m=>delete m.health_gate)).status,0));
