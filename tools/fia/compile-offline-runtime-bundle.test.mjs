import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compile } from './compile-offline-runtime-bundle.mjs';
const sha = v => createHash('sha256').update(v).digest('hex');
const sort = v => Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canon = v => JSON.stringify(sort(v));
function manifest(overrides={}) {
  const base={schema:'fia.runtime-route-manifest.v1',config:{identity:'c'},routes:[{route:'/',document:{path:'index.html',mode:420,size:5,sha256:sha('index')},assets:[{path:'assets/app.js',mode:420,size:3,sha256:sha('app')}]}],offlineFallback:{path:'offline.html',mode:420,size:7,sha256:sha('offline')},policy:{}};
  const value={...base,...overrides}; value.identity=sha(canon(value)); return value;
}
test('equivalent manifests produce identical bundles',()=>{const a=compile(canon(manifest()));const b=compile(canon(manifest()));assert.equal(a.identity,b.identity);assert.equal(a.serviceWorker.sha256,b.serviceWorker.sha256);});
test('stale manifest identity is rejected',()=>{const m=manifest();m.routes[0].route='/changed';assert.throws(()=>compile(canon(m)),/identity mismatch/);});
test('offline fallback is required',()=>{const m=manifest({offlineFallback:null});delete m.identity;m.identity=sha(canon(m));assert.throws(()=>compile(canon(m)),/offlineFallback is required/);});
test('cache aliases with conflicting artifacts are rejected',()=>{const m=manifest();m.routes.push({route:'/two',document:{path:'index.html',mode:420,size:99,sha256:sha('other')},assets:[]});delete m.identity;m.identity=sha(canon(m));assert.throws(()=>compile(canon(m)),/cache key collision/);});
test('service worker constrains fallback to navigation and same origin',()=>{const b=compile(canon(manifest()));assert.match(b.serviceWorker.source,/request\.mode==='navigate'/);assert.match(b.serviceWorker.source,/url\.origin!==self\.location\.origin/);assert.equal(b.policy.exactAssetFallback,false);});
test('existing output is not overwritten',async()=>{const dir=await mkdtemp(join(tmpdir(),'fia-offline-'));const mp=join(dir,'m.json'),op=join(dir,'o.json');await writeFile(mp,canon(manifest()));await writeFile(op,'retained');const r=spawnSync(process.execPath,['./compile-offline-runtime-bundle.mjs','--manifest',mp,'--output',op],{cwd:new URL('.',import.meta.url).pathname,encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(await readFile(op,'utf8'),'retained');});
test('service worker deletes stale release caches and verifies install digests',()=>{const b=compile(canon(manifest()));assert.match(b.serviceWorker.source,/caches\.keys\(\)/);assert.match(b.serviceWorker.source,/crypto\.subtle\.digest\('SHA-256'/);assert.match(b.cache.name,/^fia-[a-f0-9]{64}$/);});
