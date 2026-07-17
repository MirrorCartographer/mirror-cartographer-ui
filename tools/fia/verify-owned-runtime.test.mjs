import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const cli=new URL('./verify-owned-runtime.mjs',import.meta.url).pathname;
async function fixture(root,label='A') {
  await mkdir(join(root,'about'),{recursive:true}); await mkdir(join(root,'assets'),{recursive:true});
  await writeFile(join(root,'index.html'),`<!doctype html><html lang="en"><head><title>${label}</title><link rel="stylesheet" href="/assets/app.12345678.css"></head><body><main><h1>${label}</h1></main></body></html>`);
  await writeFile(join(root,'about','index.html'),`<!doctype html><html lang="en"><head><title>About</title></head><body><main><h1>About</h1></main></body></html>`);
  await writeFile(join(root,'assets','app.12345678.css'),'body{min-height:100vh}'.repeat(20));
}
function run(args) { return new Promise(resolve=>{const p=spawn(process.execPath,[cli,...args]);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',code=>resolve({code,out,err}));}); }

test('verifies real HTTP routes, MIME, cache, compression, HEAD and ETag',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fia-runtime-'));const artifact=join(dir,'dist');await fixture(artifact);const output=join(dir,'evidence.json');
  const r=await run(['--artifact',artifact,'--output',output]);assert.equal(r.code,0,r.err);
  const e=JSON.parse(await readFile(output));assert.equal(e.status,'accepted');assert.equal(e.primary.routes.length,2);assert.ok(e.primary.probes.every(p=>p.etag&&p.cacheControl));
  assert.equal(e.primary.probes.find(p=>p.route.includes('.css')).contentEncoding,'gzip');
});

test('verification identity is stable for equivalent artifacts',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fia-runtime-'));const a=join(dir,'a'),b=join(dir,'b');await fixture(a);await fixture(b);
  await run(['--artifact',a,'--output',join(dir,'a.json')]);await run(['--artifact',b,'--output',join(dir,'b.json')]);
  const ea=JSON.parse(await readFile(join(dir,'a.json'))),eb=JSON.parse(await readFile(join(dir,'b.json')));assert.equal(ea.verification,eb.verification);
});

test('boots and verifies an independent rollback artifact',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fia-runtime-'));const a=join(dir,'a'),b=join(dir,'b');await fixture(a,'current');await fixture(b,'rollback');
  const r=await run(['--artifact',a,'--rollbackArtifact',b,'--output',join(dir,'e.json')]);assert.equal(r.code,0,r.err);
  const e=JSON.parse(await readFile(join(dir,'e.json')));assert.ok(e.rollback);assert.notEqual(e.primary.artifact,e.rollback.artifact);
});

test('history fallback policy is explicit and testable',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fia-runtime-'));const a=join(dir,'a');await fixture(a);
  const r=await run(['--artifact',a,'--historyFallback','--output',join(dir,'e.json')]);assert.equal(r.code,0,r.err);
  const e=JSON.parse(await readFile(join(dir,'e.json')));assert.equal(e.policy.historyFallback,true);
});

test('symlink contamination is rejected',async()=>{
  const { symlink }=await import('node:fs/promises');const dir=await mkdtemp(join(tmpdir(),'fia-runtime-'));const a=join(dir,'a');await fixture(a);await symlink(join(a,'index.html'),join(a,'alias.html'));
  const r=await run(['--artifact',a,'--output',join(dir,'e.json')]);assert.notEqual(r.code,0);assert.match(r.err,/symlink rejected/);
});

test('retained evidence cannot be overwritten',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fia-runtime-'));const a=join(dir,'a');await fixture(a);const output=join(dir,'e.json');assert.equal((await run(['--artifact',a,'--output',output])).code,0);
  const r=await run(['--artifact',a,'--output',output]);assert.notEqual(r.code,0);assert.match(r.err,/EEXIST/);
});
