import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promote } from './promote-owned-listener.mjs';

const digest = c => c.repeat(64);
const endpoint = (id, port, hash='a') => ({ releaseIdentity:`release-${id}`, healthIdentity:`health-${id}`, listenerId:`listener-${id}`, contentSha256:digest(hash), host:'127.0.0.1', port });
const probe = e => ({ releaseIdentity:e.releaseIdentity, healthIdentity:e.healthIdentity, listenerId:e.listenerId, contentSha256:e.contentSha256 });
async function fixture(previous=null, candidate=endpoint('new',9001)) {
  const dir = await mkdtemp(path.join(os.tmpdir(),'fia-listener-'));
  const requestPath=path.join(dir,'request.json'), statePath=path.join(dir,'active.json'), outputPath=path.join(dir,'evidence.json');
  if(previous) await writeFile(statePath, JSON.stringify(previous));
  await writeFile(requestPath, JSON.stringify({schema:'fia.owned-listener-promotion-request.v1',previous,candidate,privateProbe:probe(candidate),publicProbe:probe(candidate)}));
  return {dir,requestPath,statePath,outputPath,previous,candidate};
}

test('promotes candidate and emits deterministic evidence', async()=>{
  const a=await fixture(); const b=await fixture();
  const ea=await promote(a); const eb=await promote(b);
  assert.equal(ea.identity,eb.identity);
  assert.deepEqual(JSON.parse(await readFile(a.statePath,'utf8')),a.candidate);
});
test('rejects private probe mismatch', async()=>{
  const f=await fixture(); const r=JSON.parse(await readFile(f.requestPath)); r.privateProbe.contentSha256=digest('b'); await writeFile(f.requestPath,JSON.stringify(r));
  await assert.rejects(()=>promote(f),/private probe content mismatch/);
});
test('rejects public listener mismatch', async()=>{
  const f=await fixture(); const r=JSON.parse(await readFile(f.requestPath)); r.publicProbe.listenerId='old-listener'; await writeFile(f.requestPath,JSON.stringify(r));
  await assert.rejects(()=>promote(f),/public probe listener mismatch/);
});
test('rejects stale active state', async()=>{
  const prev=endpoint('old',8000,'b'); const f=await fixture(prev); await writeFile(f.statePath,JSON.stringify({...prev,port:7999}));
  await assert.rejects(()=>promote(f),/active state mismatch at port/);
});
test('restores previous state after post-switch failure', async()=>{
  const prev=endpoint('old',8000,'b'); const f=await fixture(prev);
  await assert.rejects(()=>promote({...f,injectFailure:'after-switch'}),/injected failure/);
  assert.deepEqual(JSON.parse(await readFile(f.statePath,'utf8')),prev);
});
test('refuses evidence overwrite', async()=>{
  const f=await fixture(); await writeFile(f.outputPath,'retained');
  await assert.rejects(()=>promote(f),/refusing to overwrite/);
  assert.equal(await readFile(f.outputPath,'utf8'),'retained');
});
