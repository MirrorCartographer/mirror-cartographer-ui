#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { importBundle, verifyBundle } from './bundle-release.mjs';

const SCHEMA='fia.release-import-rehearsal.v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>JSON.stringify(sort(v));
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
function fail(m){throw new Error(m)}
async function inventory(root){
  const out=[];
  async function walk(dir,rel=''){
    for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const r=rel?`${rel}/${e.name}`:e.name; const p=path.join(dir,e.name);
      if(e.isDirectory()) await walk(p,r); else if(e.isFile()){const b=await readFile(p);out.push({path:r,size:b.length,sha256:sha256(b)});} else fail(`unsupported imported entry: ${r}`);
    }
  }
  await walk(root); return out;
}
async function verifyStore(store,artifact){
  const digest=artifact.slice(7); const descriptorPath=path.join(store,'releases',`${digest}.json`); const bytes=await readFile(descriptorPath); const descriptor=JSON.parse(bytes);
  if(descriptor.artifact!==artifact) fail('imported descriptor artifact mismatch');
  const seen=new Set();
  for(const f of descriptor.files||[]){
    if(seen.has(f.path)) fail(`duplicate descriptor path: ${f.path}`); seen.add(f.path);
    if(!/^sha256:[0-9a-f]{64}$/.test(f.blob||'')) fail(`invalid imported blob identity: ${f.path}`);
    const bd=f.blob.slice(7); const blob=await readFile(path.join(store,'blobs','sha256',bd.slice(0,2),bd));
    if(blob.length!==f.size||sha256(blob)!==bd) fail(`imported blob mismatch: ${f.path}`);
  }
  return {descriptorSha256:sha256(bytes),files:(descriptor.files||[]).length};
}
export async function rehearseReleaseImport({input,attempts=2,attestation,importer=importBundle}){
  attempts=Number(attempts); if(!Number.isInteger(attempts)||attempts<2||attempts>8) fail('attempts must be an integer from 2 to 8');
  const bundle=await verifyBundle({input}); const root=await mkdtemp(path.join(os.tmpdir(),'fia-import-rehearsal-')); const runs=[];
  try{
    for(let i=0;i<attempts;i++){
      const store=path.join(root,`store-${i}`), evidence=path.join(root,`evidence-${i}`); await mkdir(store,{recursive:true});
      const imported=await importer({input,store,evidenceDir:evidence}); const storeProof=await verifyStore(store,bundle.artifact);
      const storeInventory=await inventory(store), evidenceInventory=await inventory(evidence);
      runs.push({attempt:i+1,artifact:imported.artifact,bundle:imported.bundle,storeProof,storeInventory,evidenceInventory});
    }
    const baseline=canonical({...runs[0],attempt:0});
    for(const run of runs.slice(1)) if(canonical({...run,attempt:0})!==baseline) fail(`import rehearsal mismatch at attempt ${run.attempt}`);
    const core={schema:SCHEMA,artifact:bundle.artifact,bundle:bundle.bundle,attempts,storeProof:runs[0].storeProof,storeInventory:runs[0].storeInventory,evidenceInventory:runs[0].evidenceInventory};
    const rehearsal=`sha256:${sha256(Buffer.from(canonical(core)))}`; const result={...core,rehearsal};
    if(attestation){await mkdir(path.dirname(attestation),{recursive:true});await writeFile(attestation,canonical(result)+'\n',{flag:'wx',mode:0o600});}
    return result;
  } finally { await rm(root,{recursive:true,force:true}); }
}
function args(argv){const o={};for(let i=0;i<argv.length;i++){const x=argv[i];if(x.startsWith('--'))o[x.slice(2)]=argv[++i];else fail(`unexpected argument: ${x}`);}return o;}
if(import.meta.url===`file://${process.argv[1]}`){rehearseReleaseImport(args(process.argv.slice(2))).then(r=>console.log(canonical(r))).catch(e=>{console.error(e.message);process.exitCode=1;});}
