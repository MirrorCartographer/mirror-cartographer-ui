#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { constants as C } from 'node:fs';
import { access, lstat, open, readFile, readdir, readlink, realpath, rename, rm, symlink } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

const JOURNAL='foundation.artifact.registry.sovereign-release-promotion-journal.v1';
const SCHEMA='foundation.artifact.registry.sovereign-release-promotion-recovery.v1';
const fail=m=>{throw new Error(m)};
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canonical=v=>Buffer.from(`${JSON.stringify(sort(v))}\n`);
const digest=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
async function exists(p){try{await access(p,C.F_OK);return true}catch{return false}}
async function fsync(p){const h=await open(p,'r');try{await h.sync()}finally{await h.close()}}
async function hashFile(p){const h=createHash('sha256');const f=await open(p,'r');let size=0;try{const b=Buffer.alloc(65536);for(;;){const {bytesRead}=await f.read(b,0,b.length,null);if(!bytesRead)break;h.update(b.subarray(0,bytesRead));size+=bytesRead}}finally{await f.close()}return{size,sha256:`sha256:${h.digest('hex')}`}}
async function inventory(root){const out=[];async function walk(dir){for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,e.name),rel=relative(root,p).split(sep).join('/');if(e.isSymbolicLink())fail(`symbolic link rejected: ${rel}`);if(e.isDirectory())await walk(p);else if(e.isFile()){const h=await hashFile(p);out.push({path:rel,size:h.size,sha256:h.sha256})}else fail(`unsupported entry: ${rel}`)}}await walk(root);return out}
async function pointerTarget(p){if(!await exists(p))return null;const s=await lstat(p);if(!s.isSymbolicLink())fail('active pointer must be a symbolic link');return await readlink(p)}
async function swapPointer(pointer,target){const temp=`${pointer}.recovery-${process.pid}`;await symlink(target,temp);await rename(temp,pointer);await fsync(dirname(pointer))}
async function writeExclusive(path,obj){const h=await open(path,'wx',0o600);try{await h.writeFile(canonical(obj));await h.sync()}finally{await h.close()}await fsync(dirname(path))}
function validateJournal(j){const keys=['activeBefore','candidateCapsuleSha256','identity','phase','registryIdentity','releaseId','rollbackCapsuleSha256','rollbackReleaseId','schema'];if(!j||typeof j!=='object'||Array.isArray(j)||Object.keys(j).sort().join('|')!==keys.sort().join('|'))fail('invalid promotion journal fields');if(j.schema!==JOURNAL||j.phase!=='prepared')fail('unsupported promotion journal');const core={schema:j.schema,phase:j.phase,releaseId:j.releaseId,rollbackReleaseId:j.rollbackReleaseId,activeBefore:j.activeBefore,registryIdentity:j.registryIdentity,candidateCapsuleSha256:j.candidateCapsuleSha256,rollbackCapsuleSha256:j.rollbackCapsuleSha256};if(digest(canonical(core))!==j.identity)fail('promotion journal identity mismatch');return j}

export async function recoverSovereignReleasePromotion({runtimeRoot,output,probe=null,failpoint=null}){
 runtimeRoot=resolve(runtimeRoot);output=resolve(output);const pointer=join(runtimeRoot,'active'),journalPath=join(runtimeRoot,'promotion-journal.json');
 if(await exists(output))fail('recovery evidence already exists');if(!await exists(journalPath))fail('promotion journal missing');
 const journalBytes=await readFile(journalPath),j=validateJournal(JSON.parse(journalBytes));
 const candidateTarget=join('releases',j.releaseId),releaseDir=join(runtimeRoot,candidateTarget),candidateCapsule=join(runtimeRoot,'capsules',`${j.releaseId}.fia`),rollbackCapsule=join(runtimeRoot,'capsules',`${j.rollbackReleaseId}.fia`);
 const active=await pointerTarget(pointer);if(active!==j.activeBefore&&active!==candidateTarget)fail('active pointer is neither previous nor candidate authority');
 const releaseExists=await exists(releaseDir),candidateCapsuleExists=await exists(candidateCapsule),rollbackCapsuleExists=await exists(rollbackCapsule);
 if(!rollbackCapsuleExists)fail('rollback capsule missing');if((await hashFile(rollbackCapsule)).sha256!==j.rollbackCapsuleSha256)fail('rollback capsule mismatch');
 let action;
 if(active===j.activeBefore){
   if(releaseExists){const id=digest(canonical(await inventory(releaseDir)));if(id!==j.registryIdentity)fail('partial or substituted candidate release');}
   if(candidateCapsuleExists&&(await hashFile(candidateCapsule)).sha256!==j.candidateCapsuleSha256)fail('candidate capsule mismatch');
   if(failpoint==='before-cleanup')fail('injected failure before cleanup');
   await rm(releaseDir,{recursive:true,force:true});await rm(candidateCapsule,{force:true});action='rolled-back-pre-switch';
 }else{
   if(!releaseExists||!candidateCapsuleExists)fail('candidate authority incomplete after pointer switch');
   if(digest(canonical(await inventory(releaseDir)))!==j.registryIdentity)fail('candidate registry identity mismatch');
   if((await hashFile(candidateCapsule)).sha256!==j.candidateCapsuleSha256)fail('candidate capsule mismatch');
   if(await realpath(pointer)!==await realpath(releaseDir))fail('active pointer resolution mismatch');
   const r=probe?await probe({activePath:releaseDir,releaseId:j.releaseId}):{ok:true};if(!r||r.ok!==true)fail('runtime probe failed');
   action='finalized-post-switch';
 }
 const contentCore={schema:SCHEMA,journalSha256:digest(journalBytes),releaseId:j.releaseId,rollbackReleaseId:j.rollbackReleaseId,activeBefore:j.activeBefore,activeAfter:await pointerTarget(pointer),action,registryIdentity:j.registryIdentity,candidateCapsuleSha256:j.candidateCapsuleSha256,rollbackCapsuleSha256:j.rollbackCapsuleSha256,verification:{journal:true,pointer:true,candidate:action==='finalized-post-switch',rollbackCapsule:true,runtimeProbe:action==='finalized-post-switch',providerNeutral:true}};
 const contentIdentity=digest(canonical(contentCore)),operationalId=`promotion-recovery-${randomUUID()}`,evidence={...contentCore,contentIdentity,operationalId,identity:digest(canonical({contentIdentity,operationalId}))};
 await writeExclusive(output,evidence);await rm(journalPath);await fsync(runtimeRoot);return evidence;
}
function args(a){const o={};for(let i=2;i<a.length;i+=2)o[a[i].slice(2)]=a[i+1];for(const k of ['runtimeRoot','output'])if(!o[k])fail(`missing --${k}`);return o}
if(import.meta.url===`file://${process.argv[1]}`)recoverSovereignReleasePromotion(args(process.argv)).then(e=>console.log(e.identity),e=>{console.error(e.message);process.exitCode=1});
