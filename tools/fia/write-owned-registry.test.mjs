import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const tool = new URL('./write-owned-registry.mjs', import.meta.url).pathname;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function identity(v){const c=structuredClone(v);delete c.identity;return sha(Buffer.from(canonical(c)))}
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-reg-'));
 const bytes={runtime:Buffer.from('runtime-v1'),sbom:Buffer.from('sbom-v1'),prov:Buffer.from('prov-v1'),sig:Buffer.from('sig-v1'),rollback:Buffer.from('rollback-v1')};
 const objects=[];
 for(const [role,b] of Object.entries(bytes)){const p=`${role}.bin`;await fs.writeFile(path.join(root,p),b);objects.push({role,path:p,size:b.length,digest:`sha256:${sha(b)}`,mediaType:'application/octet-stream'});}
 const all=objects.map(o=>o.digest); const runtime=objects.find(o=>o.role==='runtime').digest;
 const r={schema:'fia.registered-owned-build.v1',release:{name:'preview'},objects,catalog:{objectDigests:all},export:{objectDigests:all},rollback:{objectDigests:[runtime,objects.find(o=>o.role==='rollback').digest]}};r.identity=identity(r);
 await fs.writeFile(path.join(root,'registered.json'),JSON.stringify(r));
 return {root,r,objects};
}
function run(root, extra=[]){return spawnSync(process.execPath,[tool,'--registered',path.join(root,'registered.json'),'--registryDir',path.join(root,'registry'),'--output',path.join(root,'evidence.json'),...extra],{encoding:'utf8'});}

test('writes content-addressed objects and verifies clean restore',async()=>{const {root,r,objects}=await fixture();const x=run(root);assert.equal(x.status,0,x.stderr);const e=JSON.parse(await fs.readFile(path.join(root,'evidence.json'),'utf8'));assert.equal(e.export.cleanRestoreVerified,true);assert.equal(e.objects.length,objects.length);assert.equal(e.registeredBuild.identity,r.identity);for(const o of objects){const d=o.digest.slice(7);assert.equal(await fs.readFile(path.join(root,'registry','objects','sha256',d.slice(0,2),d),'utf8'),await fs.readFile(path.join(root,o.path),'utf8'));}});

test('equivalent independent registries produce identical evidence identities',async()=>{const a=await fixture(),b=await fixture();assert.equal(run(a.root).status,0);assert.equal(run(b.root).status,0);const ea=JSON.parse(await fs.readFile(path.join(a.root,'evidence.json'))),eb=JSON.parse(await fs.readFile(path.join(b.root,'evidence.json')));assert.equal(ea.identity,eb.identity);assert.equal(ea.catalog.digest,eb.catalog.digest);});

test('rejects source object substitution',async()=>{const {root}=await fixture();await fs.writeFile(path.join(root,'runtime.bin'),'changed');const x=run(root);assert.notEqual(x.status,0);assert.match(x.stderr,/size mismatch|digest mismatch/);});

test('rejects incomplete export closure',async()=>{const {root,r}=await fixture();r.export.objectDigests.pop();r.identity=identity(r);await fs.writeFile(path.join(root,'registered.json'),JSON.stringify(r));const x=run(root);assert.notEqual(x.status,0);assert.match(x.stderr,/export manifest is not complete/);});

test('rejects rollback without runtime',async()=>{const {root,r}=await fixture();r.rollback.objectDigests=r.rollback.objectDigests.filter(d=>d!==r.objects.find(o=>o.role==='runtime').digest);r.identity=identity(r);await fs.writeFile(path.join(root,'registered.json'),JSON.stringify(r));const x=run(root);assert.notEqual(x.status,0);assert.match(x.stderr,/rollback manifest must retain/);});

test('rejects conflicting bytes already stored under digest path',async()=>{const {root,objects}=await fixture();const o=objects[0],d=o.digest.slice(7),p=path.join(root,'registry','objects','sha256',d.slice(0,2),d);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,'conflict');const x=run(root);assert.notEqual(x.status,0);assert.match(x.stderr,/conflicting existing registry object/);});

test('refuses to overwrite retained evidence',async()=>{const {root}=await fixture();await fs.writeFile(path.join(root,'evidence.json'),'keep');const x=run(root);assert.notEqual(x.status,0);assert.equal(await fs.readFile(path.join(root,'evidence.json'),'utf8'),'keep');});
