#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const INDEX_SCHEMA='foundation.artifact.registry.index.v1';
const REQUEST_SCHEMA='foundation.artifact.registry.gc.request.v1';
const EVIDENCE_SCHEMA='foundation.artifact.registry.gc.v1';
const DIGEST_RE=/^sha256:([0-9a-f]{64})$/;
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const sha256=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
function exact(o,keys,label){if(!o||typeof o!=='object'||Array.isArray(o))throw new Error(`${label} must be object`);for(const k of Object.keys(o))if(!keys.includes(k))throw new Error(`${label} unknown field ${k}`)}
function args(a){const o={};for(let i=0;i<a.length;i+=2){if(!a[i]?.startsWith('--')||a[i+1]==null)throw new Error('usage: --registry DIR --request FILE --output FILE');o[a[i].slice(2)]=a[i+1]}for(const k of ['registry','request','output'])if(!o[k])throw new Error(`missing --${k}`);return o}
function writeExclusive(file,bytes,mode=0o600){fs.mkdirSync(path.dirname(file),{recursive:true});const fd=fs.openSync(file,'wx',mode);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function atomicReplace(file,bytes){const tmp=`${file}.tmp-${process.pid}`;const fd=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(tmp,file);const dfd=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dfd)}finally{fs.closeSync(dfd)}}
function blobPath(root,d){const m=DIGEST_RE.exec(d);if(!m)throw new Error(`invalid digest ${d}`);return path.join(root,'blobs','sha256',m[1])}
function readIndex(file){const bytes=fs.readFileSync(file);const x=JSON.parse(bytes);exact(x,['schema','generation','releases','blobs'],'index');if(x.schema!==INDEX_SCHEMA||!Number.isInteger(x.generation)||x.generation<0)throw new Error('invalid index');if(!x.releases||Array.isArray(x.releases)||!x.blobs||Array.isArray(x.blobs))throw new Error('invalid index maps');return {x,bytes}}
function validateRelease(index,id){if(!DIGEST_RE.test(id))throw new Error(`invalid release identity ${id}`);const r=index.releases[id];if(!r)throw new Error(`retained release not found ${id}`);exact(r,['releaseIdentity','catalogDigest','catalogSha256','roots','objectDigests'],'release');if(r.releaseIdentity!==id||!DIGEST_RE.test(r.catalogDigest)||!DIGEST_RE.test(r.catalogSha256))throw new Error(`invalid release record ${id}`);if(!Array.isArray(r.roots)||!Array.isArray(r.objectDigests)||new Set(r.objectDigests).size!==r.objectDigests.length)throw new Error(`invalid release closure ${id}`);for(const d of r.roots)if(!r.objectDigests.includes(d))throw new Error(`root outside release closure ${d}`);for(const d of r.objectDigests){if(!DIGEST_RE.test(d)||!index.blobs[d])throw new Error(`missing indexed blob ${d}`)}return r}
function verifyBlob(root,d,meta){exact(meta,['size','mediaType'],'blob metadata');if(!Number.isInteger(meta.size)||meta.size<0||typeof meta.mediaType!=='string'||!meta.mediaType)throw new Error(`invalid blob metadata ${d}`);const p=blobPath(root,d);const st=fs.lstatSync(p);if(!st.isFile()||st.isSymbolicLink())throw new Error(`invalid blob file ${d}`);if(st.size!==meta.size)throw new Error(`blob size mismatch ${d}`);if(sha256(fs.readFileSync(p))!==d)throw new Error(`blob digest mismatch ${d}`)}
function loadRequest(file){const bytes=fs.readFileSync(file);const r=JSON.parse(bytes);exact(r,['schema','retainReleaseIdentities','rollbackEdges'],'request');if(r.schema!==REQUEST_SCHEMA||!Array.isArray(r.retainReleaseIdentities)||!Array.isArray(r.rollbackEdges)||new Set(r.retainReleaseIdentities).size!==r.retainReleaseIdentities.length||r.retainReleaseIdentities.length===0)throw new Error('invalid gc request');for(const e of r.rollbackEdges){exact(e,['from','to'],'rollback edge');if(!DIGEST_RE.test(e.from)||!DIGEST_RE.test(e.to)||e.from===e.to)throw new Error('invalid rollback edge')}return {r,bytes}}
function main(){const a=args(process.argv.slice(2));for(const p of [a.output])if(fs.existsSync(p))throw new Error(`output already exists: ${p}`);const registry=path.resolve(a.registry),indexFile=path.join(registry,'index.json'),lockDir=path.join(registry,'locks'),lock=path.join(lockDir,'maintenance.lock');fs.mkdirSync(lockDir,{recursive:true});let lfd;try{lfd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(lfd,JSON.stringify({pid:process.pid,operation:'gc'})+'\n');fs.fsyncSync(lfd)}catch(e){if(e.code==='EEXIST')throw new Error('registry maintenance lock is already held');throw e}
 let quarantine=null,indexPublished=false,before;
 try{
  before=readIndex(indexFile);const {r:req,bytes:reqBytes}=loadRequest(path.resolve(a.request));
  for(const [d,m] of Object.entries(before.x.blobs)){if(!DIGEST_RE.test(d))throw new Error(`invalid indexed digest ${d}`);verifyBlob(registry,d,m)}
  const retain=new Set(req.retainReleaseIdentities);for(const id of retain)validateRelease(before.x,id);
  for(const e of req.rollbackEdges){validateRelease(before.x,e.from);validateRelease(before.x,e.to);if(retain.has(e.from)&&!retain.has(e.to))throw new Error(`rollback target not retained ${e.to}`)}
  const live=new Set();for(const id of retain)for(const d of before.x.releases[id].objectDigests)live.add(d);
  const candidates=Object.keys(before.x.blobs).filter(d=>!live.has(d)).sort();
  quarantine=path.join(registry,'quarantine',`gc-${process.pid}`);fs.mkdirSync(path.join(quarantine,'sha256'),{recursive:true});
  for(const d of candidates)fs.renameSync(blobPath(registry,d),path.join(quarantine,'sha256',d.slice(7)));
  if(process.env.FIA_TEST_FAIL_AFTER_QUARANTINE==='1')throw new Error('injected failure after quarantine');
  for(const id of retain)for(const d of before.x.releases[id].objectDigests)verifyBlob(registry,d,before.x.blobs[d]);
  const releases=Object.fromEntries([...retain].sort().map(id=>[id,before.x.releases[id]]));
  const blobs=Object.fromEntries([...live].sort().map(d=>[d,before.x.blobs[d]]));
  const next={schema:INDEX_SCHEMA,generation:before.x.generation+1,releases,blobs};const nextBytes=Buffer.from(canonical(next)+'\n');atomicReplace(indexFile,nextBytes);indexPublished=true;
  if(process.env.FIA_TEST_FAIL_AFTER_INDEX==='1')throw new Error('injected failure after index publication');
  const check=readIndex(indexFile);if(sha256(check.bytes)!==sha256(nextBytes))throw new Error('post-gc index mismatch');for(const id of retain)for(const d of check.x.releases[id].objectDigests)verifyBlob(registry,d,check.x.blobs[d]);
  fs.rmSync(quarantine,{recursive:true,force:true});quarantine=null;
  const core={schema:EVIDENCE_SCHEMA,requestSha256:sha256(reqBytes),sourceIndexSha256:sha256(before.bytes),resultIndexSha256:sha256(nextBytes),sourceGeneration:before.x.generation,resultGeneration:next.generation,retainedReleaseIdentities:[...retain].sort(),rollbackEdges:req.rollbackEdges.slice().sort((x,y)=>canonical(x).localeCompare(canonical(y))),retainedObjectDigests:[...live].sort(),deletedObjectDigests:candidates,checks:{allSourceBlobsVerified:true,rollbackTargetsRetained:true,quarantineUsed:true,retainedReleasesExportable:true,indexPublishedAtomically:true,deletedOnlyUnreachable:true},policy:{digestAlgorithm:'sha256',exclusiveMaintenanceLock:true,quarantineBeforeDelete:true,indexRollbackOnFailure:true}};const evidence={...core,identity:sha256(Buffer.from(canonical(core)))};writeExclusive(path.resolve(a.output),Buffer.from(canonical(evidence)+'\n'));console.log(evidence.identity);
 }catch(e){if(indexPublished&&before)atomicReplace(indexFile,before.bytes);if(quarantine&&fs.existsSync(quarantine)){for(const name of fs.readdirSync(path.join(quarantine,'sha256'))){const src=path.join(quarantine,'sha256',name),dst=path.join(registry,'blobs','sha256',name);if(!fs.existsSync(dst))fs.renameSync(src,dst)}fs.rmSync(quarantine,{recursive:true,force:true})}throw e}finally{if(lfd!==undefined)fs.closeSync(lfd);fs.rmSync(lock,{force:true})}}
try{main()}catch(e){console.error(e.message);process.exitCode=1}
