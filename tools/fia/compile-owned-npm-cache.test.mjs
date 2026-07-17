import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileOwnedNpmCache } from './compile-owned-npm-cache.mjs';

const sri=b=>`sha512-${createHash('sha512').update(b).digest('base64')}`;
async function fixture(){const root=await mkdtemp(path.join(os.tmpdir(),'fia-cache-test-')),bytes=Buffer.from('owned package bytes');const lock={lockfileVersion:3,packages:{'':{},'node_modules/a':{version:'1.0.0',resolved:'https://registry.invalid/a.tgz',integrity:sri(bytes)}}};const lockfile=path.join(root,'package-lock.json');await writeFile(lockfile,JSON.stringify(lock));return{root,bytes,lock,lockfile,cacheDir:path.join(root,'cache'),manifest:path.join(root,'cache-manifest.json')};}
const fetcher=bytes=>async url=>({bytes,finalUrl:url});
test('compiles deterministic content-addressed cache manifest',async()=>{const a=await fixture(),b=await fixture();const ra=await compileOwnedNpmCache({...a,fetcher:fetcher(a.bytes)}),rb=await compileOwnedNpmCache({...b,fetcher:fetcher(b.bytes)});assert.equal(ra.manifest,rb.manifest);assert.equal(await readFile(path.join(a.cacheDir,ra.packages[0].tarball),'utf8'),'owned package bytes');});
test('deduplicates identical integrity used at multiple lockfile paths',async()=>{const f=await fixture();f.lock.packages['node_modules/b/node_modules/a']={...f.lock.packages['node_modules/a']};await writeFile(f.lockfile,JSON.stringify(f.lock));const r=await compileOwnedNpmCache({...f,fetcher:fetcher(f.bytes)});assert.equal(r.packages.length,1);assert.equal(r.packages[0].lockfilePaths.length,2);});
test('rejects bytes that do not match lockfile SRI',async()=>{const f=await fixture();await assert.rejects(()=>compileOwnedNpmCache({...f,fetcher:fetcher(Buffer.from('tampered'))}),/integrity mismatch/);assert.equal(await lstat(f.cacheDir).catch(()=>null),null);});
test('rejects missing integrity or resolved URL',async()=>{const f=await fixture();delete f.lock.packages['node_modules/a'].integrity;await writeFile(f.lockfile,JSON.stringify(f.lock));await assert.rejects(()=>compileOwnedNpmCache({...f,fetcher:fetcher(f.bytes)}),/missing integrity/);});
test('rejects conflicting URLs for the same integrity',async()=>{const f=await fixture();f.lock.packages['node_modules/b']={...f.lock.packages['node_modules/a'],resolved:'https://registry.invalid/b.tgz'};await writeFile(f.lockfile,JSON.stringify(f.lock));await assert.rejects(()=>compileOwnedNpmCache({...f,fetcher:fetcher(f.bytes)}),/conflicting resolved URLs/);});
test('refuses to overwrite retained cache or manifest',async()=>{const f=await fixture();await mkdir(f.cacheDir);await assert.rejects(()=>compileOwnedNpmCache({...f,fetcher:fetcher(f.bytes)}),/already exists/);});
