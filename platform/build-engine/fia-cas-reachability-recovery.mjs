#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PLAN='foundation.build.cas-reachability-plan.v1';
const JOURNAL='foundation.build.cas-reachability-journal.v1';
const LOCK='foundation.build.cas-reachability-lock.v1';
const EVIDENCE='foundation.build.cas-reachability-recovery.v1';
const hash=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
async function exists(p){try{await fs.access(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function syncDir(p){const h=await fs.open(p,'r');try{await h.sync()}finally{await h.close()}}
async function writeExclusive(p,v){await fs.mkdir(path.dirname(p),{recursive:true});const h=await fs.open(p,'wx',0o600);try{await h.writeFile(canon(v)+'\n');await h.sync()}finally{await h.close()}await syncDir(path.dirname(p))}
function safeDigest(x){if(!/^sha256:[0-9a-f]{64}$/.test(x))throw Error(`invalid digest: ${x}`);return x}
function objectName(x){return safeDigest(x).slice(7)}
async function verifyObject(p,digest,size){const s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink())throw Error(`invalid CAS object: ${p}`);if(s.nlink!==1)throw Error(`hard-linked CAS object rejected: ${p}`);if(size!=null&&s.size!==size)throw Error(`CAS size mismatch: ${p}`);if(hash(await fs.readFile(p))!==digest)throw Error(`CAS digest mismatch: ${p}`);return s}
function manifestAuthority(m){return {schema:m.schema,sourceExecutionIdentity:m.sourceExecutionIdentity,sourceOutputIdentity:m.sourceOutputIdentity,files:m.files,objects:m.objects,policy:m.policy}}
async function snapshotManifests(dir){if(!await exists(dir))return {identity:hash(Buffer.from('[]')),records:[]};const records=[];for(const n of (await fs.readdir(dir)).filter(x=>x.endsWith('.json')).sort()){const p=path.join(dir,n),raw=await fs.readFile(p),m=JSON.parse(raw);if(m.schema!=='foundation.build.worker-cas-manifest.v1')throw Error(`unsupported manifest: ${n}`);if(m.identity!==hash(Buffer.from(canon(manifestAuthority(m)))))throw Error(`manifest identity mismatch: ${n}`);records.push({name:n,identity:m.identity,sha256:hash(raw),manifest:m})}return {identity:hash(Buffer.from(canon(records.map(({name,identity,sha256})=>({name,identity,sha256}))))),records}}
async function snapshotClaims(dir){if(!dir||!await exists(dir))return {identity:hash(Buffer.from('[]')),records:[]};const records=[];for(const n of (await fs.readdir(dir)).filter(x=>x.endsWith('.json')).sort()){const p=path.join(dir,n),raw=await fs.readFile(p),j=JSON.parse(raw),claims=[...(j.claimedObjectDigests||[])].map(safeDigest).sort();records.push({name:n,sha256:hash(raw),claims})}return {identity:hash(Buffer.from(canon(records))),records}}
function planAuthority(p){return {schema:p.schema,manifests:p.manifests,reachableDigests:p.reachableDigests,claimedDigests:p.claimedDigests,orphanObjects:p.orphanObjects,policy:p.policy}}
async function acquireLock(lockPath){const authority={schema:LOCK,operation:'cas-reachability-recovery',policy:{exclusive:true,staleLocksFailClosed:true,providerNeutral:true}};const lock={...authority,contentIdentity:hash(Buffer.from(canon(authority))),operationalId:`cas-reachability-lock-${randomUUID()}`,pid:process.pid};await writeExclusive(lockPath,lock);return lock}
async function loadTransaction(qRoot){const planPath=path.join(qRoot,'plan.json'),journalPath=path.join(qRoot,'journal.json');if(!await exists(planPath)||!await exists(journalPath))throw Error(`incomplete quarantine transaction: ${path.basename(qRoot)}`);const plan=JSON.parse(await fs.readFile(planPath,'utf8')),journal=JSON.parse(await fs.readFile(journalPath,'utf8'));if(plan.schema!==PLAN||journal.schema!==JOURNAL)throw Error(`unsupported quarantine transaction: ${path.basename(qRoot)}`);if(plan.identity!==hash(Buffer.from(canon(planAuthority(plan)))))throw Error(`plan identity mismatch: ${path.basename(qRoot)}`);if(journal.planIdentity!==plan.identity)throw Error(`journal plan mismatch: ${path.basename(qRoot)}`);if(!['moving','committed'].includes(journal.phase))throw Error(`invalid journal phase: ${journal.phase}`);const moved=[...(journal.moved||[])].map(safeDigest);if(new Set(moved).size!==moved.length)throw Error('duplicate moved digest');const orphanMap=new Map(plan.orphanObjects.map(o=>[safeDigest(o.digest),o]));for(const d of moved)if(!orphanMap.has(d))throw Error(`journal moved undeclared digest: ${d}`);return {plan,journal,planPath,journalPath,orphanMap}}
async function verifyManifestClosure(snapshot,objectDir){for(const {manifest:m} of snapshot.records)for(const o of m.objects)await verifyObject(path.join(objectDir,objectName(o.digest)),o.digest,o.size)}
export async function recoverCasReachability({casRoot,journalDir,evidencePath,lockPath=path.join(casRoot||'', '.reachability.lock'),fault}={}){
 if(!casRoot||!evidencePath)throw Error('casRoot and evidencePath required');if(await exists(evidencePath))throw Error('evidence exists');
 const manifestDir=path.join(casRoot,'manifests'),objectDir=path.join(casRoot,'objects','sha256'),quarantineDir=path.join(casRoot,'quarantine');
 let lock;try{lock=await acquireLock(lockPath)}catch(e){if(e.code==='EEXIST')throw Error('CAS reachability lock exists');throw e}
 try{
  const manifestBefore=await snapshotManifests(manifestDir),claimsBefore=await snapshotClaims(journalDir);await verifyManifestClosure(manifestBefore,objectDir);
  const txNames=await exists(quarantineDir)?(await fs.readdir(quarantineDir,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort():[];
  const actions=[];
  for(const name of txNames){const qRoot=path.join(quarantineDir,name),{plan,journal,orphanMap}=await loadTransaction(qRoot),qObjects=path.join(qRoot,'objects');
   if(journal.phase==='moving'){
    for(const d of [...journal.moved].reverse()){const meta=orphanMap.get(d),src=path.join(qObjects,objectName(d)),dst=path.join(objectDir,objectName(d));if(!await exists(src))throw Error(`missing quarantined object: ${d}`);await verifyObject(src,d,meta.size);if(await exists(dst))throw Error(`duplicate active and quarantined object: ${d}`);await fs.rename(src,dst);await syncDir(objectDir);await syncDir(qObjects)}
    await fs.rm(qRoot,{recursive:true,force:true});actions.push({quarantineId:name,planIdentity:plan.identity,action:'rolled-back-pre-commit',objectCount:journal.moved.length});
   }else{
    for(const o of plan.orphanObjects)await verifyObject(path.join(qObjects,objectName(o.digest)),o.digest,o.size);
    actions.push({quarantineId:name,planIdentity:plan.identity,action:'verified-committed',objectCount:plan.orphanObjects.length});
   }
   if(fault==='after-first-transaction'&&actions.length===1)throw Error('injected failure');
  }
  const manifestAfter=await snapshotManifests(manifestDir),claimsAfter=await snapshotClaims(journalDir);
  if(manifestBefore.identity!==manifestAfter.identity)throw Error('manifest set drift during recovery');if(claimsBefore.identity!==claimsAfter.identity)throw Error('journal claim set drift during recovery');
  await verifyManifestClosure(manifestAfter,objectDir);
  const authority={schema:EVIDENCE,manifestSetIdentity:manifestAfter.identity,claimSetIdentity:claimsAfter.identity,actions,verification:{globalLockHeld:true,manifestSetStable:true,claimSetStable:true,committedManifestClosureVerified:true,preCommitMovesRestored:true},policy:{manifestIsCommitBoundary:true,staleLocksFailClosed:true,committedTransactionsRetained:true,providerNeutral:true}};
  const evidence={...authority,contentIdentity:hash(Buffer.from(canon(authority))),operationalId:`cas-reachability-recovery-${randomUUID()}`};await writeExclusive(evidencePath,evidence);return evidence;
 }finally{if(lock&&await exists(lockPath)){await fs.rm(lockPath,{force:true});await syncDir(path.dirname(lockPath))}}
}
if(import.meta.url===`file://${process.argv[1]}`){const a=Object.fromEntries(process.argv.slice(2).reduce((r,x,i,v)=>x.startsWith('--')?(r.push([x.slice(2),v[i+1]]),r):r,[]));recoverCasReachability({casRoot:a.cas,journalDir:a.journals,evidencePath:a.evidence,lockPath:a.lock}).then(x=>console.log(x.contentIdentity)).catch(e=>{console.error(e.message);process.exit(1)})}
