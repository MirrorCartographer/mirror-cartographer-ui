#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { executeIntegratedWorker } from './fia-self-hosted-worker-v3.mjs';
import { publishWorkerOutputToCas } from './fia-worker-cas-publication.mjs';

const SCHEMA='foundation.build.self-hosted-worker-execution.v4';
const hash=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
async function exists(p){try{await fs.access(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function writeExclusive(p,data){await fs.mkdir(path.dirname(p),{recursive:true});const h=await fs.open(p,'wx');try{await h.writeFile(data);await h.sync()}finally{await h.close()}}
async function fsyncDir(p){const h=await fs.open(p,'r');try{await h.sync()}finally{await h.close()}}
async function inventory(root,dir=root,out=[]){for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error(`symbolic link rejected: ${p}`);if(e.isDirectory())await inventory(root,p,out);else if(e.isFile()){const rel=path.relative(root,p).split(path.sep).join('/').normalize('NFC');const s=await fs.stat(p);out.push({path:rel,size:s.size,sha256:hash(await fs.readFile(p)),mode:s.mode&0o777})}else throw Error(`unsupported entry: ${p}`)}return out}

export async function executeWorkerV4({cgroupDir,argv,outputDir,casRoot,evidencePath,workerEvidencePath,casEvidencePath,sourceExecutionIdentity,env={},timeoutMs=180000,verifyOutput=async()=>({ok:true}),simulateCgroup=false,sandbox={minimalFilesystem:true,networkDenied:true,inputsReadOnly:true},fault}={}){
 if(!cgroupDir||!Array.isArray(argv)||!argv.length||!outputDir||!casRoot||!evidencePath||!workerEvidencePath||!casEvidencePath||!sourceExecutionIdentity)throw Error('missing required worker v4 input');
 for(const p of [evidencePath,workerEvidencePath,casEvidencePath])if(await exists(p))throw Error(`evidence exists: ${p}`);
 const worker=await executeIntegratedWorker({cgroupDir,argv,outputDir,evidencePath:workerEvidencePath,env,timeoutMs,verifyOutput,simulateCgroup,sandbox});
 if(fault==='after-worker')throw Error('injected failure after worker verification');
 const sealedIdentity=hash(Buffer.from(canon(await inventory(outputDir))));
 if(sealedIdentity!==worker.outputIdentity)throw Error('worker output identity drift before CAS publication');
 const cas=await publishWorkerOutputToCas({outputDir,casRoot,evidencePath:casEvidencePath,sourceExecutionIdentity,verifySource:async({sourceOutputIdentity})=>({ok:sourceOutputIdentity===worker.outputIdentity,workerContentIdentity:worker.contentIdentity}),fault:fault==='after-cas-objects'?'after-object-publish':undefined});
 if(fault==='after-cas')throw Error('injected failure after CAS commit');
 const after=hash(Buffer.from(canon(await inventory(outputDir))));
 if(after!==worker.outputIdentity)throw Error('worker output drift after CAS publication');
 const manifestPath=path.join(casRoot,cas.manifestPath);if(!await exists(manifestPath))throw Error('CAS manifest missing after publication');
 const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));if(manifest.sourceOutputIdentity!==worker.outputIdentity)throw Error('CAS manifest does not bind worker output');
 const authority={schema:SCHEMA,sourceExecutionIdentity,workerContentIdentity:worker.contentIdentity,workerOutputIdentity:worker.outputIdentity,casContentIdentity:cas.contentIdentity,casManifestIdentity:cas.manifestIdentity,casManifestPath:cas.manifestPath,verification:{workerEvidenceRetained:true,casEvidenceRetained:true,manifestCommitted:true,stagingMatchesCas:true,noWritableAliasObserved:true},policy:{workerSuccessRequiresCasManifest:true,manifestIsCommitBoundary:true,providerNeutral:true,reversible:true}};
 const evidence={...authority,contentIdentity:hash(Buffer.from(canon(authority))),operationalId:`worker-v4-${randomUUID()}`};
 await writeExclusive(evidencePath,canon(evidence)+'\n');await fsyncDir(path.dirname(evidencePath));return evidence;
}
