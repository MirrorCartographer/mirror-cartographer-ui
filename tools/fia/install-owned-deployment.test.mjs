import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile, readlink, symlink, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const tool=new URL('./install-owned-deployment.mjs',import.meta.url).pathname;
const h=b=>createHash('sha256').update(b).digest('hex');
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canon=v=>JSON.stringify(sort(v));
const id=o=>{const c={...o};delete c.identity;return h(Buffer.from(canon(c)))};

async function fixture(){const root=await mkdtemp(path.join(os.tmpdir(),'fia-install-'));const restore=path.join(root,'restore');await mkdir(path.join(restore,'runtime'),{recursive:true});const body=Buffer.from('<html lang="en"><meta name="viewport" content="width=device-width"></html>');await writeFile(path.join(restore,'runtime/index.html'),body,{mode:0o644});const ev={schema:'fia.owned-deployment-restore.v1',releaseIdentity:'a'.repeat(64),entries:[{path:'runtime/index.html',mode:0o644,size:body.length,sha256:h(body)}]};ev.identity=id(ev);const ep=path.join(root,'restore.json');await writeFile(ep,canon(ev));return{root,restore,ep,ev};}
function run(f,extra=[]){const out=path.join(f.root,`out-${Math.random()}.json`),state=path.join(f.root,'state');const r=spawnSync(process.execPath,[tool,'--restoreEvidence',f.ep,'--restoreDir',f.restore,'--stateDir',state,'--releaseName','preview','--output',out,...extra],{encoding:'utf8'});return{...r,out,state};}

test('installs immutable release and switches active pointer',async()=>{const f=await fixture(),r=run(f);assert.equal(r.status,0,r.stderr);assert.equal(await readlink(path.join(r.state,'active')),'releases/preview-aaaaaaaaaaaaaaaa');const e=JSON.parse(await readFile(r.out));assert.equal(e.identity,id(e));});
test('equivalent installs produce identical evidence identities',async()=>{const a=await fixture(),b=await fixture(),ra=run(a),rb=run(b);assert.equal(ra.status,0);assert.equal(rb.status,0);assert.equal(JSON.parse(await readFile(ra.out)).identity,JSON.parse(await readFile(rb.out)).identity);});
test('rejects changed restored bytes',async()=>{const f=await fixture();await writeFile(path.join(f.restore,'runtime/index.html'),'tampered');const r=run(f);assert.notEqual(r.status,0);assert.match(r.stderr,/restored tree mismatch/);});
test('rejects symlinked restored entries',async()=>{const f=await fixture();await writeFile(path.join(f.root,'outside'),'x');await unlink(path.join(f.restore,'runtime/index.html'));await symlink(path.join(f.root,'outside'),path.join(f.restore,'runtime/index.html'));const r=run(f);assert.notEqual(r.status,0);assert.match(r.stderr,/unsupported restored entry/);});
test('post-switch failure restores previous active target',async()=>{const f=await fixture();const state=path.join(f.root,'state');await mkdir(path.join(state,'releases','old'),{recursive:true});await symlink('releases/old',path.join(state,'active'));const out=path.join(f.root,'out.json');const r=spawnSync(process.execPath,[tool,'--restoreEvidence',f.ep,'--restoreDir',f.restore,'--stateDir',state,'--releaseName','preview','--output',out,'--injectFailure','post-switch'],{encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(await readlink(path.join(state,'active')),'releases/old');});
test('refuses immutable release overwrite',async()=>{const f=await fixture(),r1=run(f);assert.equal(r1.status,0);const out=path.join(f.root,'second.json');const r2=spawnSync(process.execPath,[tool,'--restoreEvidence',f.ep,'--restoreDir',f.restore,'--stateDir',r1.state,'--releaseName','preview','--output',out],{encoding:'utf8'});assert.notEqual(r2.status,0);assert.match(r2.stderr,/immutable release already exists/);});
test('refuses retained evidence overwrite before mutation',async()=>{const f=await fixture();const out=path.join(f.root,'out.json');await writeFile(out,'retain');const state=path.join(f.root,'state');const r=spawnSync(process.execPath,[tool,'--restoreEvidence',f.ep,'--restoreDir',f.restore,'--stateDir',state,'--releaseName','preview','--output',out],{encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(await readFile(out,'utf8'),'retain');});
