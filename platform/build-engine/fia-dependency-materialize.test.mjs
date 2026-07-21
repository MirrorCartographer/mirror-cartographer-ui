import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { materializeDependencies } from './fia-dependency-materialize.mjs';

function integrity(bytes) {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}
async function fixture({ resolved='https://registry.npmjs.org/example/-/example-1.2.3.tgz', installScript=false, includeCache=true }={}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-deps-'));
  const cache = path.join(root, 'cache'); await fs.mkdir(cache);
  const bytes = Buffer.from('owned package bytes');
  const lock = {
    name:'fixture', version:'1.0.0', lockfileVersion:3, packages:{
      '':{name:'fixture',version:'1.0.0'},
      'node_modules/example':{name:'example',version:'1.2.3',resolved,integrity:integrity(bytes),hasInstallScript:installScript}
    }
  };
  const lockfile = path.join(root, 'package-lock.json');
  await fs.writeFile(lockfile, JSON.stringify(lock));
  if (includeCache) await fs.writeFile(path.join(cache, 'example-1.2.3.tgz'), bytes);
  return {root,cache,lockfile,output:path.join(root,'materialized'),bytes,lock};
}
test('verified offline package is materialized deterministically', async()=>{
  const a=await fixture(), b=await fixture();
  const ea=await materializeDependencies({lockfile:a.lockfile,sourceCache:a.cache,output:a.output,nodeVersion:'v22.0.0',npmVersion:'10.0.0'});
  const eb=await materializeDependencies({lockfile:b.lockfile,sourceCache:b.cache,output:b.output,nodeVersion:'v22.0.0',npmVersion:'10.0.0'});
  assert.equal(ea.identity,eb.identity);
  assert.equal(ea.packages.length,1);
  assert.equal(await fs.readFile(path.join(a.output,ea.packages[0].objectPath),'utf8'),'owned package bytes');
});
test('cache poisoning fails closed without output', async()=>{
  const f=await fixture();
  await fs.writeFile(path.join(f.cache,'example-1.2.3.tgz'),'changed bytes');
  await assert.rejects(materializeDependencies({lockfile:f.lockfile,sourceCache:f.cache,output:f.output,nodeVersion:'v22',npmVersion:'10'}),/integrity mismatch/);
  await assert.rejects(fs.access(f.output));
});
test('unauthorized sources and lifecycle scripts are rejected', async()=>{
  for (const options of [{resolved:'http://registry.npmjs.org/example/-/example-1.2.3.tgz'},{resolved:'https://evil.example/example.tgz'},{resolved:'git+https://github.com/x/y.git'},{installScript:true}]) {
    const f=await fixture(options);
    await assert.rejects(materializeDependencies({lockfile:f.lockfile,sourceCache:f.cache,output:f.output,nodeVersion:'v22',npmVersion:'10'}));
  }
});
test('offline cache miss is terminal and never falls back to network', async()=>{
  const f=await fixture({includeCache:false});
  await assert.rejects(materializeDependencies({lockfile:f.lockfile,sourceCache:f.cache,output:f.output,nodeVersion:'v22',npmVersion:'10'}),/offline cache miss/);
});
test('missing integrity and non-v3 lockfiles are rejected', async()=>{
  const f=await fixture();
  f.lock.packages['node_modules/example'].integrity=undefined;
  await fs.writeFile(f.lockfile,JSON.stringify(f.lock));
  await assert.rejects(materializeDependencies({lockfile:f.lockfile,sourceCache:f.cache,output:f.output,nodeVersion:'v22',npmVersion:'10'}),/integrity/);
  const g=await fixture(); g.lock.lockfileVersion=2; await fs.writeFile(g.lockfile,JSON.stringify(g.lock));
  await assert.rejects(materializeDependencies({lockfile:g.lockfile,sourceCache:g.cache,output:g.output,nodeVersion:'v22',npmVersion:'10'}),/lockfileVersion 3/);
});
test('existing output remains immutable', async()=>{
  const f=await fixture(); await fs.mkdir(f.output); await fs.writeFile(path.join(f.output,'sentinel'),'keep');
  await assert.rejects(materializeDependencies({lockfile:f.lockfile,sourceCache:f.cache,output:f.output,nodeVersion:'v22',npmVersion:'10'}),/output exists/);
  assert.equal(await fs.readFile(path.join(f.output,'sentinel'),'utf8'),'keep');
});
