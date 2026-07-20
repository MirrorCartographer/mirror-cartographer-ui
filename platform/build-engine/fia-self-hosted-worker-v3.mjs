#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA='foundation.build.self-hosted-worker-execution.v3';
const hash=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function exists(p){try{await fs.access(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function writeExclusive(p,data){await fs.mkdir(path.dirname(p),{recursive:true});const h=await fs.open(p,'wx');try{await h.writeFile(data);await h.sync()}finally{await h.close()}}
async function readPids(cgroupDir){const t=await fs.readFile(path.join(cgroupDir,'cgroup.procs'),'utf8');return t.trim()?t.trim().split(/\s+/).map(Number).sort((a,b)=>a-b):[]}
async function waitFor(cgroupDir,pred,timeoutMs=3000){const end=Date.now()+timeoutMs;while(Date.now()<end){const p=await readPids(cgroupDir);if(pred(p))return p;await sleep(10)}throw Error(`cgroup state timeout: ${(await readPids(cgroupDir)).join(',')}`)}
async function inventory(root,dir=root,out=[]){if(!await exists(root))return out;for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error(`symbolic link rejected: ${p}`);if(e.isDirectory())await inventory(root,p,out);else if(e.isFile()){const rel=path.relative(root,p).split(path.sep).join('/').normalize('NFC');const s=await fs.stat(p);out.push({path:rel,size:s.size,sha256:hash(await fs.readFile(p)),mode:s.mode&0o777})}else throw Error(`unsupported output entry: ${p}`)}return out}
async function setTreeReadOnly(root){for(const e of await fs.readdir(root,{withFileTypes:true})){const p=path.join(root,e.name);if(e.isDirectory()){await setTreeReadOnly(p);await fs.chmod(p,0o555)}else if(e.isFile())await fs.chmod(p,0o444);else throw Error(`unsupported output entry: ${p}`)}await fs.chmod(root,0o555)}
async function killCgroup(cgroupDir,simulate){const kp=path.join(cgroupDir,'cgroup.kill');if(await exists(kp)&&!simulate)await fs.writeFile(kp,'1\n');else for(const pid of await readPids(cgroupDir)){try{process.kill(pid,'SIGKILL')}catch{}}if(simulate)await fs.writeFile(path.join(cgroupDir,'cgroup.procs'),'')}
async function freeze(cgroupDir,value,simulate){const p=path.join(cgroupDir,'cgroup.freeze');if(!await exists(p)){if(!simulate)throw Error('cgroup.freeze missing');await fs.writeFile(p,'0\n')}await fs.writeFile(p,`${value}\n`)}

async function bootstrapMain(){
 const c=JSON.parse(Buffer.from(process.env.FIA_V3_CONFIG,'base64url').toString('utf8'));
 await fs.writeFile(path.join(c.cgroupDir,'cgroup.procs'),`${process.pid}\n`);
 process.send?.({type:'attached',pid:process.pid});
 process.on('message',m=>{if(m?.type!=='go')return;const child=spawn(c.argv[0],c.argv.slice(1),{env:c.env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>process.send?.({type:'stdout',data:b.toString('base64')}));child.stderr.on('data',b=>process.send?.({type:'stderr',data:b.toString('base64')}));child.on('error',e=>process.send?.({type:'error',message:e.message}));child.on('close',(code,signal)=>{process.send?.({type:'result',code,signal});setImmediate(()=>process.exit(0))})});
}

export async function executeIntegratedWorker({cgroupDir,argv,outputDir,evidencePath,env={},timeoutMs=180000,verifyOutput=async()=>({ok:true}),simulateCgroup=false,sandbox={minimalFilesystem:true,networkDenied:true,inputsReadOnly:true}}){
 if(!Array.isArray(argv)||!argv.length)throw Error('argv required');if(await exists(evidencePath))throw Error(`evidence exists: ${evidencePath}`);if(!await exists(cgroupDir))throw Error('cgroup missing');if((await readPids(cgroupDir)).length)throw Error('cgroup not empty before launch');
 for(const k of ['minimalFilesystem','networkDenied','inputsReadOnly'])if(sandbox[k]!==true)throw Error(`sandbox authority incomplete: ${k}`);
 const cfg=Buffer.from(JSON.stringify({cgroupDir,argv,env})).toString('base64url');const b=spawn(process.execPath,[fileURLToPath(import.meta.url),'--bootstrap'],{env:{...process.env,FIA_V3_CONFIG:cfg},stdio:['ignore','ignore','ignore','ipc']});
 const stdout=[],stderr=[];let result=null,attached=false,timer;
 const done=new Promise((resolve,reject)=>{timer=setTimeout(async()=>{await killCgroup(cgroupDir,simulateCgroup);reject(Error('worker timeout'))},timeoutMs);b.on('error',reject);b.on('message',async m=>{try{if(m?.type==='attached'){await waitFor(cgroupDir,p=>p.includes(b.pid));attached=true;b.send({type:'go'})}else if(m?.type==='stdout')stdout.push(Buffer.from(m.data,'base64'));else if(m?.type==='stderr')stderr.push(Buffer.from(m.data,'base64'));else if(m?.type==='error')reject(Error(m.message));else if(m?.type==='result'){result={code:m.code,signal:m.signal};resolve()}}catch(e){reject(e)}});b.on('close',(code,signal)=>{if(!result)reject(Error(`bootstrap exited early: ${code??signal}`))})});
 try{await done}finally{clearTimeout(timer)}if(!attached)throw Error('bootstrap attachment not verified');if(simulateCgroup)await fs.writeFile(path.join(cgroupDir,'cgroup.procs'),'');await waitFor(cgroupDir,p=>p.length===0);
 if(result.code!==0)throw Error(`worker command failed: ${result.code??result.signal}`);
 await freeze(cgroupDir,1,simulateCgroup);let before,after,verification;try{before=hash(Buffer.from(canon(await inventory(outputDir))));if(before===hash(Buffer.from('[]')))throw Error('worker produced no output');verification=await verifyOutput({outputDir,outputIdentity:before,result});if(!verification||verification.ok!==true)throw Error('output verification failed');after=hash(Buffer.from(canon(await inventory(outputDir))));if(after!==before)throw Error('output mutated during verification');await setTreeReadOnly(outputDir);const immutable=hash(Buffer.from(canon(await inventory(outputDir))));if(immutable===before)throw Error('read-only publication did not change mode authority');after=immutable}finally{await freeze(cgroupDir,0,simulateCgroup)}
 await waitFor(cgroupDir,p=>p.length===0);const portableArgv=argv.map(x=>path.isAbsolute(x)?path.basename(x):x);const authority={schema:SCHEMA,argv:portableArgv,environmentKeys:Object.keys(env).sort(),result,stdoutSha256:hash(Buffer.concat(stdout)),stderrSha256:hash(Buffer.concat(stderr)),outputIdentityBeforeReadOnly:before,outputIdentity:after,verification:{...verification,outputIdentity:before},sandbox,cgroup:{attachedBeforeWorkerSpawn:true,emptyBefore:true,emptyAfter:true,frozenDuringVerification:true,killedOnTimeout:true},publication:{outputReadOnly:true,mutationRejected:true,existingEvidenceRejected:true},policy:{providerNeutral:true,atomicEvidence:true}};const evidence={...authority,contentIdentity:hash(Buffer.from(canon(authority))),operationalId:`worker-v3-${randomUUID()}`};await writeExclusive(evidencePath,canon(evidence)+'\n');return evidence;
}
if(process.argv[2]==='--bootstrap')bootstrapMain().catch(e=>{process.send?.({type:'error',message:e.message});process.exit(1)});
