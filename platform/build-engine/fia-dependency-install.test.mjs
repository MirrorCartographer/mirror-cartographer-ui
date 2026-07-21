import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { installDependencies } from './fia-dependency-install.mjs';

const sha256 = data => `sha256:${createHash('sha256').update(data).digest('hex')}`;
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value);
function octal(value, width) { return `${value.toString(8).padStart(width-1,'0')}\0`; }
function header(name, size, type='0', mode=0o644, link='') {
  const b=Buffer.alloc(512,0); b.write(name,0,100,'utf8'); b.write(octal(mode,8),100,8,'ascii'); b.write(octal(0,8),108,8,'ascii'); b.write(octal(0,8),116,8,'ascii'); b.write(octal(size,12),124,12,'ascii'); b.write(octal(0,12),136,12,'ascii'); b.fill(32,148,156); b[156]=type.charCodeAt(0); if(link)b.write(link,157,100,'utf8'); b.write('ustar\0',257,6,'ascii'); b.write('00',263,2,'ascii'); let sum=0; for(const x of b) sum+=x; b.write(`${sum.toString(8).padStart(6,'0')}\0 `,148,8,'ascii'); return b;
}
function tar(entries) { const chunks=[]; for(const e of entries){const bytes=Buffer.from(e.bytes??'');chunks.push(header(`package/${e.path}`,bytes.length,e.type??'0',e.mode??0o644,e.link??''),bytes,Buffer.alloc((512-(bytes.length%512))%512));} chunks.push(Buffer.alloc(1024)); return gzipSync(Buffer.concat(chunks)); }
async function fixture(entries, {name='demo',version='1.0.0'}={}) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-install-')); const lockfile=path.join(root,'package-lock.json'); const materialized=path.join(root,'materialized'); await fs.mkdir(path.join(materialized,'objects','sha512'),{recursive:true});
  const lock={lockfileVersion:3,packages:{'':{},'node_modules/demo':{name,version}}}; const lockBytes=Buffer.from(JSON.stringify(lock)); await fs.writeFile(lockfile,lockBytes);
  const bytes=tar(entries); const objectPath='objects/sha512/demo.tgz'; await fs.writeFile(path.join(materialized,objectPath),bytes);
  const authority={schema:'foundation.build.dependency-materialization.v1',lockfileSha256:sha256(lockBytes),nodeVersion:'v22',npmVersion:'10',packages:[{lockPath:'node_modules/demo',name,version,resolved:'https://registry.npmjs.org/demo/-/demo-1.0.0.tgz',integrity:'sha512-fixture',sha256:sha256(bytes),size:bytes.length,objectPath,dev:false,optional:false}],policy:{}};
  const clean={schema:authority.schema,lockfileSha256:authority.lockfileSha256,nodeVersion:authority.nodeVersion,npmVersion:authority.npmVersion,packages:authority.packages,policy:authority.policy}; authority.identity=sha256(Buffer.from(canonical(clean)));
  await fs.writeFile(path.join(materialized,'materialization.json'),`${canonical(authority)}\n`);
  return {root,lockfile,materialized,output:path.join(root,'installed')};
}
const baseEntries=(pkg={name:'demo',version:'1.0.0'})=>[{path:'package.json',bytes:JSON.stringify(pkg)},{path:'index.js',bytes:'export default 1;'}];

test('reconstructs deterministic node_modules tree and SBOM', async()=>{const a=await fixture(baseEntries()),b=await fixture(baseEntries());const x=await installDependencies({lockfile:a.lockfile,materialized:a.materialized,output:a.output});const y=await installDependencies({lockfile:b.lockfile,materialized:b.materialized,output:b.output});assert.equal(x.identity,y.identity);assert.equal(await fs.readFile(path.join(a.output,'node_modules/demo/index.js'),'utf8'),'export default 1;');assert.equal(JSON.parse(await fs.readFile(path.join(a.output,'sbom.json'),'utf8')).components[0].name,'demo');});
test('rejects traversal and link entries', async()=>{for(const entries of [[{path:'../escape',bytes:'x'}],[...baseEntries(),{path:'link',type:'2',link:'index.js'}]]){const f=await fixture(entries);await assert.rejects(installDependencies({lockfile:f.lockfile,materialized:f.materialized,output:f.output}));await assert.rejects(fs.access(f.output));}});
test('rejects case-fold collisions and bad tar checksums', async()=>{const f=await fixture([...baseEntries(),{path:'A.js',bytes:'a'},{path:'a.js',bytes:'b'}]);await assert.rejects(installDependencies({lockfile:f.lockfile,materialized:f.materialized,output:f.output}),/case-fold/);const g=await fixture(baseEntries());const obj=path.join(g.materialized,'objects/sha512/demo.tgz');const bytes=await fs.readFile(obj);bytes[20]^=1;await fs.writeFile(obj,bytes);const m=JSON.parse(await fs.readFile(path.join(g.materialized,'materialization.json'),'utf8'));m.packages[0].sha256=sha256(bytes);m.packages[0].size=bytes.length;await fs.writeFile(path.join(g.materialized,'materialization.json'),`${canonical(m)}\n`);await assert.rejects(installDependencies({lockfile:g.lockfile,materialized:g.materialized,output:g.output}));});
test('rejects package metadata substitution', async()=>{const f=await fixture(baseEntries({name:'other',version:'9.0.0'}));await assert.rejects(installDependencies({lockfile:f.lockfile,materialized:f.materialized,output:f.output}),/metadata disagrees/);});
test('rejects undeclared executables but admits declared bin', async()=>{const bad=await fixture([...baseEntries(),{path:'tool',bytes:'#!/bin/sh',mode:0o755}]);await assert.rejects(installDependencies({lockfile:bad.lockfile,materialized:bad.materialized,output:bad.output}),/undeclared executable/);const good=await fixture([{path:'package.json',bytes:JSON.stringify({name:'demo',version:'1.0.0',bin:'tool'})},{path:'tool',bytes:'#!/bin/sh',mode:0o755}]);await installDependencies({lockfile:good.lockfile,materialized:good.materialized,output:good.output});assert.equal((await fs.stat(path.join(good.output,'node_modules/demo/tool'))).mode&0o777,0o755);});
test('rejects poisoned materialized objects and immutable existing output', async()=>{const f=await fixture(baseEntries());await fs.appendFile(path.join(f.materialized,'objects/sha512/demo.tgz'),'x');await assert.rejects(installDependencies({lockfile:f.lockfile,materialized:f.materialized,output:f.output}),/identity mismatch/);const g=await fixture(baseEntries());await fs.mkdir(g.output);await fs.writeFile(path.join(g.output,'sentinel'),'keep');await assert.rejects(installDependencies({lockfile:g.lockfile,materialized:g.materialized,output:g.output}),/output exists/);assert.equal(await fs.readFile(path.join(g.output,'sentinel'),'utf8'),'keep');});
