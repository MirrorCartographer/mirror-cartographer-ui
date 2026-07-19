#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { constants as C } from 'node:fs';
import { access, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const INDEX_SCHEMA='foundation.artifact.registry.index.v1';
const REQUEST_SCHEMA='foundation.artifact.registry.gc.request.v1';
const JOURNAL_SCHEMA='foundation.artifact.registry.gc-journal.v2';
const OUTPUT_SCHEMA='foundation.artifact.registry.gc.v2';
const POLICY=Object.freeze({version:2,digest:'sha256',journalFsync:true,progress:'intent-before-move+completion-after-move',atomicIndex:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canonical=v=>`${JSON.stringify(sort(v))}\n`;
const fail=m=>{throw new Error(m)};
async function exists(p){try{await access(p,C.F_OK);return true}catch{return false}}
function exact(o,keys,label){if(!o||typeof o!=='object'||Array.isArray(o))fail(`${label} must be object`);if(JSON.stringify(Object.keys(o).sort())!==JSON.stringify([...keys].sort()))fail(`${label} fields mismatch`)}
function digest(v,l='digest'){if(typeof v!=='string'||!/^sha256:[0-9a-f]{64}$/.test(v))fail(`invalid ${l}`);return v.slice(7)}
async function fsync(p){const h=await open(p,'r');try{await h.sync()}finally{await h.close()}}
async function exclusive(p,b){await mkdir(dirname(p),{recursive:true});const h=await open(p,'wx',0o600);try{await h.writeFile(b);await h.sync()}finally{await h.close()}await fsync(dirname(p))}
async function atomic(p,b){await mkdir(dirname(p),{recursive:true});const t=`${p}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`;const h=await open(t,'wx',0o600);try{await h.writeFile(b);await h.sync()}finally{await h.close()}await rename(t,p);await fsync(dirname(p))}
async function json(p,l){let b;try{b=await readFile(p)}catch{fail(`${l} missing`)}let v;try{v=JSON.parse(b)}catch{fail(`${l} invalid JSON`)}return{b,v}}
function validateIndex(i){exact(i,['schema','generation','releases','objects'],'index');if(i.schema!==INDEX_SCHEMA)fail('unsupported index');if(!Number.isInteger(i.generation)||i.generation<0)fail('invalid generation');if(!i.releases||Array.isArray(i.releases)||typeof i.releases!=='object')fail('invalid releases');if(!i.objects||Array.isArray(i.objects)||typeof i.objects!=='object')fail('invalid objects')}
function validateRequest(r){exact(r,['schema','retainReleaseIdentities','rollbackEdges'],'request');if(r.schema!==REQUEST_SCHEMA)fail('unsupported request');if(!Array.isArray(r.retainReleaseIdentities)||new Set(r.retainReleaseIdentities).size!==r.retainReleaseIdentities.length)fail('invalid retain releases');for(const x of r.retainReleaseIdentities)digest(x,'release identity');if(!Array.isArray(r.rollbackEdges))fail('invalid rollback edges');for(const e of r.rollbackEdges){exact(e,['from','to'],'rollback edge');digest(e.from);digest(e.to)}}
async function verifyBlob(registry,d,meta){const p=join(registry,'blobs','sha256',digest(d));const s=await lstat(p).catch(()=>null);if(!s||!s.isFile()||s.isSymbolicLink())fail(`invalid blob ${d}`);const b=await readFile(p);if(sha(b)!==digest(d))fail(`blob digest mismatch ${d}`);if(meta?.size!==b.length)fail(`blob size mismatch ${d}`)}
async function verifyIndex(registry,index){validateIndex(index);for(const [d,m] of Object.entries(index.objects)){digest(d);await verifyBlob(registry,d,m)}for(const [r,rec] of Object.entries(index.releases)){digest(r,'release identity');if(!rec||!Array.isArray(rec.objects))fail(`invalid release ${r}`);for(const d of rec.objects){digest(d);if(!index.objects[d])fail(`missing object ${d}`)}}}
function derive(index,request){const retained=new Set(request.retainReleaseIdentities);for(const r of retained)if(!index.releases[r])fail(`unknown retained release ${r}`);for(const e of request.rollbackEdges){if(!retained.has(e.from))fail(`rollback source not retained ${e.from}`);if(!retained.has(e.to))fail(`rollback target not retained ${e.to}`)}const live=new Set;for(const r of retained)for(const d of index.releases[r].objects)live.add(d);const candidates=Object.keys(index.objects).filter(d=>!live.has(d)).sort();const releases=Object.fromEntries([...retained].sort().map(r=>[r,index.releases[r]]));const objects=Object.fromEntries([...live].sort().map(d=>[d,index.objects[d]]));return{candidates,target:{schema:INDEX_SCHEMA,generation:index.generation+1,releases,objects},retained:[...live].sort()}}
async function writeJournal(path,j){await atomic(path,Buffer.from(canonical(j)))}
function args(argv){const o={};for(let i=2;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]==null)fail('invalid arguments');o[argv[i].slice(2)]=argv[i+1]}return o}
export async function collect({registry,request,output,failAt}){
 registry=resolve(registry);request=resolve(request);output=resolve(output);if(await exists(output))fail('output already exists');
 const lock=join(registry,'locks','maintenance.lock');await exclusive(lock,Buffer.from(canonical({pid:process.pid}))).catch(()=>fail('maintenance lock held'));
 const tx=`gc-${randomBytes(8).toString('hex')}`;const txdir=join(registry,'transactions',tx);const qdir=join(registry,'quarantine',tx);const journalPath=join(txdir,'journal.json');
 let published=false;
 try{
  const req=await json(request,'request');validateRequest(req.v);const src=await json(join(registry,'index.json'),'index');validateIndex(src.v);await verifyIndex(registry,src.v);
  const {candidates,target,retained}=derive(src.v,req.v);const targetBytes=Buffer.from(canonical(target));await mkdir(txdir,{recursive:true});await mkdir(qdir,{recursive:true});
  await exclusive(join(txdir,'source-index.json'),src.b);await exclusive(join(txdir,'target-index.json'),targetBytes);
  let journal={schema:JOURNAL_SCHEMA,transactionId:tx,phase:'prepared',sourceIndexSha256:`sha256:${sha(src.b)}`,targetIndexSha256:`sha256:${sha(targetBytes)}`,candidateDigests:candidates,moveIntents:[],movedDigests:[],createdAt:'1970-01-01T00:00:00.000Z'};
  await exclusive(journalPath,Buffer.from(canonical(journal)));if(failAt==='after-prepared')fail('injected failure');
  journal={...journal,phase:'quarantining'};await writeJournal(journalPath,journal);
  for(const d of candidates){
   journal={...journal,moveIntents:[...journal.moveIntents,d]};await writeJournal(journalPath,journal);if(failAt===`after-intent:${d}`)fail('injected failure');
   await rename(join(registry,'blobs','sha256',digest(d)),join(qdir,digest(d)));await fsync(join(registry,'blobs','sha256'));await fsync(qdir);if(failAt===`after-move:${d}`)fail('injected failure');
   journal={...journal,movedDigests:[...journal.movedDigests,d]};await writeJournal(journalPath,journal);
  }
  await atomic(join(registry,'index.json'),targetBytes);published=true;if(failAt==='after-index')fail('injected failure');
  journal={...journal,phase:'index-published'};await writeJournal(journalPath,journal);await verifyIndex(registry,target);
  journal={...journal,phase:'finalizing'};await writeJournal(journalPath,journal);await rm(qdir,{recursive:true,force:true});await fsync(dirname(qdir));
  const core={schema:OUTPUT_SCHEMA,transactionId:tx,sourceIndexSha256:journal.sourceIndexSha256,targetIndexSha256:journal.targetIndexSha256,retainedDigests:retained,deletedDigests:candidates,journalPolicy:POLICY};const evidence={...core,identity:`sha256:${sha(Buffer.from(canonical(core)))}`};await exclusive(output,Buffer.from(canonical(evidence)));await rm(txdir,{recursive:true,force:true});return evidence;
 }catch(e){e.transactionId=tx;e.indexPublished=published;throw e}finally{await rm(lock,{force:true})}
}
if(import.meta.url===`file://${process.argv[1]}`)collect(args(process.argv)).then(e=>process.stdout.write(canonical(e))).catch(e=>{console.error(e.message);process.exitCode=1});
