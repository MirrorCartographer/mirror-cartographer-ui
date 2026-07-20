#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants as C } from 'node:fs';
import { access, copyFile, lstat, mkdir, open, readdir, readlink, realpath, rename, rm, symlink } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SCHEMA='foundation.artifact.registry.sovereign-release-promotion.v1';
const JOURNAL='foundation.artifact.registry.sovereign-release-promotion-journal.v1';
const fail=m=>{throw new Error(m)};
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const canonical=v=>Buffer.from(`${JSON.stringify(sort(v))}\n`);
const digest=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
async function exists(p){try{await access(p,C.F_OK);return true}catch{return false}}
async function fsync(p){const h=await open(p,'r');try{await h.sync()}finally{await h.close()}}
async function hashFile(p){const h=createHash('sha256');const f=await open(p,'r');let size=0;try{const b=Buffer.alloc(65536);for(;;){const {bytesRead}=await f.read(b,0,b.length,null);if(!bytesRead)break;h.update(b.subarray(0,bytesRead));size+=bytesRead}}finally{await f.close()}return{size,sha256:`sha256:${h.digest('hex')}`}}
function safeId(v,name){if(typeof v!=='string'||!/^[a-zA-Z0-9._-]{1,160}$/.test(v))fail(`invalid ${name}`);return v}
async function inventory(root){const out=[];async function walk(dir){for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,e.name),rel=relative(root,p).split(sep).join('/');if(e.isSymbolicLink())fail(`symbolic link rejected: ${rel}`);if(e.isDirectory())await walk(p);else if(e.isFile()){const h=await hashFile(p);out.push({path:rel,size:h.size,sha256:h.sha256})}else fail(`unsupported entry: ${rel}`)}}await walk(root);return out}
async function copyTree(src,dst){await mkdir(dst,{recursive:true});for(const e of await readdir(src,{withFileTypes:true})){const a=join(src,e.name),b=join(dst,e.name);if(e.isSymbolicLink())fail(`symbolic link rejected: ${a}`);if(e.isDirectory())await copyTree(a,b);else if(e.isFile()){await copyFile(a,b,C.COPYFILE_EXCL);await fsync(b)}else fail(`unsupported entry: ${a}`)}await fsync(dst)}
async function pointerTarget(pointer){if(!await exists(pointer))return null;const st=await lstat(pointer);if(!st.isSymbolicLink())fail('active pointer must be a symbolic link');return await readlink(pointer)}
async function writeExclusive(path,obj){const h=await open(path,'wx',0o600);try{await h.writeFile(canonical(obj));await h.sync()}finally{await h.close()}await fsync(dirname(path))}
async function swapPointer(pointer,target){const temp=`${pointer}.next-${process.pid}`;await symlink(target,temp);await rename(temp,pointer);await fsync(dirname(pointer))}

export async function promoteSovereignRelease({runtimeRoot,candidateRegistry,candidateCapsule,rollbackCapsule,releaseId,rollbackReleaseId,expectedActiveTarget=null,output,probe=null,failpoint=null}){
  releaseId=safeId(releaseId,'releaseId');rollbackReleaseId=safeId(rollbackReleaseId,'rollbackReleaseId');
  runtimeRoot=resolve(runtimeRoot);candidateRegistry=resolve(candidateRegistry);candidateCapsule=resolve(candidateCapsule);rollbackCapsule=resolve(rollbackCapsule);output=resolve(output);
  const releases=join(runtimeRoot,'releases'),capsules=join(runtimeRoot,'capsules'),pointer=join(runtimeRoot,'active'),journalPath=join(runtimeRoot,'promotion-journal.json');
  const releaseDir=join(releases,releaseId),candidateCapsuleDst=join(capsules,`${releaseId}.fia`),rollbackCapsuleDst=join(capsules,`${rollbackReleaseId}.fia`);
  for(const p of [output,journalPath,releaseDir,candidateCapsuleDst])if(await exists(p))fail(`${p} already exists`);
  if(!await exists(candidateRegistry)||!await exists(candidateCapsule)||!await exists(rollbackCapsule))fail('candidate or rollback authority missing');
  await mkdir(releases,{recursive:true});await mkdir(capsules,{recursive:true});
  const activeBefore=await pointerTarget(pointer);if(expectedActiveTarget!==null&&activeBefore!==expectedActiveTarget)fail('active pointer drift');
  const registryInventory=await inventory(candidateRegistry),registryIdentity=digest(canonical(registryInventory));
  const candidateHash=await hashFile(candidateCapsule),rollbackHash=await hashFile(rollbackCapsule);
  const journalCore={schema:JOURNAL,phase:'prepared',releaseId,rollbackReleaseId,activeBefore,registryIdentity,candidateCapsuleSha256:candidateHash.sha256,rollbackCapsuleSha256:rollbackHash.sha256};
  await writeExclusive(journalPath,{...journalCore,identity:digest(canonical(journalCore))});
  let pointerSwitched=false;
  try{
    const stage=`${releaseDir}.staging-${process.pid}`;await copyTree(candidateRegistry,stage);const stagedInventory=await inventory(stage);if(digest(canonical(stagedInventory))!==registryIdentity)fail('candidate registry changed during install');await rename(stage,releaseDir);await fsync(releases);
    await copyFile(candidateCapsule,candidateCapsuleDst,C.COPYFILE_EXCL);await fsync(candidateCapsuleDst);
    if(!await exists(rollbackCapsuleDst)){await copyFile(rollbackCapsule,rollbackCapsuleDst,C.COPYFILE_EXCL);await fsync(rollbackCapsuleDst)}else{const installedRollback=await hashFile(rollbackCapsuleDst);if(installedRollback.sha256!==rollbackHash.sha256)fail('installed rollback capsule mismatch')}
    if((await hashFile(candidateCapsuleDst)).sha256!==candidateHash.sha256)fail('candidate capsule install mismatch');
    if((await hashFile(rollbackCapsuleDst)).sha256!==rollbackHash.sha256)fail('rollback capsule install mismatch');
    if(failpoint==='before-switch')fail('injected failure before pointer switch');
    const activeImmediatelyBefore=await pointerTarget(pointer);if(activeImmediatelyBefore!==activeBefore)fail('active pointer changed during promotion');
    await swapPointer(pointer,join('releases',releaseId));pointerSwitched=true;
    if(failpoint==='after-switch')fail('injected failure after pointer switch');
    const resolved=await realpath(pointer);if(resolved!==await realpath(releaseDir))fail('active pointer resolves to wrong release');
    const activeInventory=await inventory(resolved);if(digest(canonical(activeInventory))!==registryIdentity)fail('active registry identity mismatch');
    const probeResult=probe?await probe({activePath:resolved,releaseId}):{ok:true};if(!probeResult||probeResult.ok!==true)fail('runtime probe failed');
    if((await hashFile(rollbackCapsuleDst)).sha256!==rollbackHash.sha256)fail('rollback route verification failed');
    const evidenceCore={schema:SCHEMA,releaseId,rollbackReleaseId,activeBefore,activeAfter:join('releases',releaseId),registryIdentity,candidateCapsuleSha256:candidateHash.sha256,rollbackCapsuleSha256:rollbackHash.sha256,verification:{immutableInstall:true,activePointer:true,runtimeProbe:true,rollbackCapsule:true,providerNeutral:true}};
    const evidence={...evidenceCore,identity:digest(canonical(evidenceCore))};await writeExclusive(output,evidence);await rm(journalPath,{force:true});await fsync(runtimeRoot);return evidence;
  }catch(e){
    if(pointerSwitched){if(activeBefore===null){await rm(pointer,{force:true})}else await swapPointer(pointer,activeBefore)}
    await rm(releaseDir,{recursive:true,force:true});await rm(candidateCapsuleDst,{force:true});await rm(journalPath,{force:true});await fsync(runtimeRoot);throw e;
  }
}
function args(a){const o={};for(let i=2;i<a.length;i+=2)o[a[i].slice(2)]=a[i+1];for(const k of ['runtimeRoot','candidateRegistry','candidateCapsule','rollbackCapsule','releaseId','rollbackReleaseId','output'])if(!o[k])fail(`missing --${k}`);return o}
if(import.meta.url===`file://${process.argv[1]}`)promoteSovereignRelease(args(process.argv)).then(e=>console.log(e.identity),e=>{console.error(e.message);process.exitCode=1});
