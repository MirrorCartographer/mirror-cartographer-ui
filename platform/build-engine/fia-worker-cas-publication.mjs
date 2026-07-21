#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MANIFEST_SCHEMA='foundation.build.worker-cas-manifest.v1';
const EVIDENCE_SCHEMA='foundation.build.worker-cas-publication.v1';
const hash=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
async function exists(p){try{await fs.access(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function writeExclusive(p,data){await fs.mkdir(path.dirname(p),{recursive:true});const h=await fs.open(p,'wx');try{await h.writeFile(data);await h.sync()}finally{await h.close()}}
async function fsyncDir(p){const h=await fs.open(p,'r');try{await h.sync()}finally{await h.close()}}
function safeRel(rel){if(!rel||rel.startsWith('/')||rel.includes('\\')||rel.includes('\0'))throw Error(`unsafe path: ${rel}`);const parts=rel.split('/');if(parts.some(x=>!x||x==='.'||x==='..'))throw Error(`unsafe path: ${rel}`);const n=parts.join('/').normalize('NFC');if(n!==rel)throw Error(`noncanonical path: ${rel}`);return n}
async function inventory(root,dir=root,out=[]){for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error(`symbolic link rejected: ${p}`);if(e.isDirectory())await inventory(root,p,out);else if(e.isFile()){const rel=safeRel(path.relative(root,p).split(path.sep).join('/'));const st=await fs.stat(p);const bytes=await fs.readFile(p);out.push({path:rel,size:st.size,sha256:hash(bytes),mode:st.mode&0o777,bytes});}else throw Error(`unsupported entry: ${p}`)}return out}
function publicInventory(entries){return entries.map(({bytes,...x})=>x)}
async function copyExclusive(src,dst){await fs.mkdir(path.dirname(dst),{recursive:true});const r=await fs.open(src,'r');const w=await fs.open(dst,'wx',0o444);try{const b=Buffer.alloc(64*1024);for(;;){const {bytesRead}=await r.read(b,0,b.length,null);if(!bytesRead)break;await w.write(b.subarray(0,bytesRead));}await w.sync();}finally{await r.close();await w.close()}}
async function verifyObject(p,digest,size){const st=await fs.lstat(p);if(!st.isFile()||st.isSymbolicLink())throw Error(`invalid CAS object: ${p}`);if(st.size!==size)throw Error(`CAS size mismatch: ${p}`);const got=hash(await fs.readFile(p));if(got!==digest)throw Error(`CAS digest mismatch: ${p}`)}
function objectName(digest){return digest.slice('sha256:'.length)}

export async function publishWorkerOutputToCas({outputDir,casRoot,evidencePath,sourceExecutionIdentity,verifySource=async()=>({ok:true}),fault}={}){
 if(!outputDir||!casRoot||!evidencePath||!sourceExecutionIdentity)throw Error('outputDir, casRoot, evidencePath, sourceExecutionIdentity required');
 if(await exists(evidencePath))throw Error(`evidence exists: ${evidencePath}`);
 if(!await exists(outputDir))throw Error('worker output missing');
 const manifestPath=path.join(casRoot,'manifests',`${sourceExecutionIdentity.replace(/[^A-Za-z0-9._-]/g,'_')}.json`);
 if(await exists(manifestPath))throw Error(`manifest exists: ${manifestPath}`);
 const beforeEntries=await inventory(outputDir);if(!beforeEntries.length)throw Error('worker output empty');
 const before=publicInventory(beforeEntries);const sourceOutputIdentity=hash(Buffer.from(canon(before)));
 const verification=await verifySource({outputDir,sourceOutputIdentity,entries:before});if(!verification||verification.ok!==true)throw Error('source verification failed');
 const afterVerify=publicInventory(await inventory(outputDir));if(hash(Buffer.from(canon(afterVerify)))!==sourceOutputIdentity)throw Error('source mutated during verification');
 const tx=`cas-publish-${randomUUID()}`;const stage=path.join(casRoot,'.staging',tx);const stagedObjects=path.join(stage,'objects','sha256');await fs.mkdir(stagedObjects,{recursive:true});
 try{
  const objects=[];
  for(const entry of beforeEntries){const name=objectName(entry.sha256);const final=path.join(casRoot,'objects','sha256',name);const staged=path.join(stagedObjects,name);if(await exists(final)){await verifyObject(final,entry.sha256,entry.size);}else if(!await exists(staged)){await copyExclusive(path.join(outputDir,...entry.path.split('/')),staged);await verifyObject(staged,entry.sha256,entry.size);}objects.push({digest:entry.sha256,size:entry.size});}
  if(fault==='after-objects')throw Error('injected failure after objects');
  const uniqueObjects=[...new Map(objects.map(x=>[x.digest,x])).values()].sort((a,b)=>a.digest.localeCompare(b.digest));
  const manifestAuthority={schema:MANIFEST_SCHEMA,sourceExecutionIdentity,sourceOutputIdentity,files:before.map(x=>({path:x.path,size:x.size,sha256:x.sha256,mode:x.mode})),objects:uniqueObjects,policy:{contentAddressed:true,sha256Verified:true,sourceMutationRejected:true,atomicManifestPublication:true,providerNeutral:true}};
  const manifest={...manifestAuthority,identity:hash(Buffer.from(canon(manifestAuthority)))};const stagedManifest=path.join(stage,'manifest.json');await writeExclusive(stagedManifest,canon(manifest)+'\n');
  const finalObjects=path.join(casRoot,'objects','sha256');await fs.mkdir(finalObjects,{recursive:true});
  for(const obj of uniqueObjects){const name=objectName(obj.digest),src=path.join(stagedObjects,name),dst=path.join(finalObjects,name);if(await exists(src)){if(await exists(dst))await verifyObject(dst,obj.digest,obj.size);else await fs.rename(src,dst);await verifyObject(dst,obj.digest,obj.size);}}
  await fsyncDir(finalObjects);if(fault==='after-object-publish')throw Error('injected failure after object publish');
  const current=publicInventory(await inventory(outputDir));if(hash(Buffer.from(canon(current)))!==sourceOutputIdentity)throw Error('source mutated before manifest publication');
  await fs.mkdir(path.dirname(manifestPath),{recursive:true});await fs.rename(stagedManifest,manifestPath);await fsyncDir(path.dirname(manifestPath));
  const evidenceAuthority={schema:EVIDENCE_SCHEMA,sourceExecutionIdentity,sourceOutputIdentity,manifestIdentity:manifest.identity,manifestPath:path.relative(casRoot,manifestPath).split(path.sep).join('/'),objectDigests:uniqueObjects.map(x=>x.digest),verification:{...verification,sourceOutputIdentity},policy:{manifestIsCommitBoundary:true,orphanObjectsSafe:true,existingEvidenceRejected:true,providerNeutral:true}};
  const evidence={...evidenceAuthority,contentIdentity:hash(Buffer.from(canon(evidenceAuthority))),operationalId:`cas-publish-${randomUUID()}`};await writeExclusive(evidencePath,canon(evidence)+'\n');return evidence;
 }finally{await fs.rm(stage,{recursive:true,force:true});}
}

if(import.meta.url===`file://${process.argv[1]}`){const a=Object.fromEntries(process.argv.slice(2).reduce((r,x,i,v)=>x.startsWith('--')?(r.push([x.slice(2),v[i+1]]),r):r,[]));publishWorkerOutputToCas({outputDir:a.output,casRoot:a.cas,evidencePath:a.evidence,sourceExecutionIdentity:a.sourceExecutionIdentity}).then(x=>process.stdout.write(`${x.contentIdentity}\n`)).catch(e=>{console.error(e.message);process.exit(1)});}
