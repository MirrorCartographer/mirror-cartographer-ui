#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA='foundation.build.self-hosted-worker-execution.v2';
const hash=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function exists(p){try{await fs.access(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function writeExclusive(p,data){await fs.mkdir(path.dirname(p),{recursive:true});const h=await fs.open(p,'wx');try{await h.writeFile(data);await h.sync()}finally{await h.close()}}
async function readPids(cgroupDir){const t=await fs.readFile(path.join(cgroupDir,'cgroup.procs'),'utf8');return t.trim()?t.trim().split(/\s+/).map(Number).sort((a,b)=>a-b):[]}
async function waitForPid(cgroupDir,pid,timeoutMs=2000){const end=Date.now()+timeoutMs;while(Date.now()<end){if((await readPids(cgroupDir)).includes(pid))return;await sleep(10)}throw Error(`bootstrap pid ${pid} not attached to cgroup`)}
async function waitEmpty(cgroupDir,timeoutMs=3000){const end=Date.now()+timeoutMs;while(Date.now()<end){if((await readPids(cgroupDir)).length===0)return;await sleep(20)}throw Error(`cgroup remains populated: ${(await readPids(cgroupDir)).join(',')}`)}
async function inventory(root,dir=root,out=[]){if(!await exists(root))return out;for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error(`symbolic link rejected: ${p}`);if(e.isDirectory())await inventory(root,p,out);else if(e.isFile()){const rel=path.relative(root,p).split(path.sep).join('/').normalize('NFC');const st=await fs.stat(p);out.push({path:rel,size:st.size,sha256:hash(await fs.readFile(p)),mode:st.mode&0o777})}else throw Error(`unsupported output entry: ${p}`)}return out}
async function killCgroup(cgroupDir,simulate=false){const killPath=path.join(cgroupDir,'cgroup.kill');if(await exists(killPath)&&!simulate)await fs.writeFile(killPath,'1\n');else for(const pid of await readPids(cgroupDir)){try{process.kill(pid,'SIGKILL')}catch{}}if(simulate)await fs.writeFile(path.join(cgroupDir,'cgroup.procs'),'')}

async function bootstrapMain(){
 const config=JSON.parse(Buffer.from(process.env.FIA_BOOTSTRAP_CONFIG,'base64url').toString('utf8'));
 const {cgroupDir,command,env,simulateCgroup}=config;
 await fs.writeFile(path.join(cgroupDir,'cgroup.procs'),`${process.pid}\n`);
 process.send?.({type:'attached',pid:process.pid});
 process.on('message',msg=>{
  if(msg?.type!=='go')return;
  const child=spawn(command[0],command.slice(1),{env,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>process.send?.({type:'stdout',data:b.toString('base64')}));
  child.stderr.on('data',b=>process.send?.({type:'stderr',data:b.toString('base64')}));
  child.on('error',e=>process.send?.({type:'spawn-error',message:e.message}));
  child.on('close',(code,signal)=>{process.send?.({type:'result',code,signal});setImmediate(()=>process.exit(0))});
 });
}

export async function executeAttachedWorker({cgroupDir,command,outputDir,evidencePath,env={},timeoutMs=180000,verifyOutput=async()=>({ok:true}),simulateCgroup=false}){
 if(!Array.isArray(command)||!command.length)throw Error('command required');
 if(await exists(evidencePath))throw Error(`evidence exists: ${evidencePath}`);
 if(!await exists(cgroupDir))throw Error('cgroup missing');
 if((await readPids(cgroupDir)).length)throw Error('cgroup not empty before launch');
 const bootstrapConfig=Buffer.from(JSON.stringify({cgroupDir,command,env,simulateCgroup})).toString('base64url');
 const bootstrap=spawn(process.execPath,[fileURLToPath(import.meta.url),'--bootstrap'],{env:{...process.env,FIA_BOOTSTRAP_CONFIG:bootstrapConfig},stdio:['ignore','ignore','ignore','ipc']});
 const stdout=[],stderr=[];let workerResult=null;let attached=false;let timer;
 const resultPromise=new Promise((resolve,reject)=>{
  timer=setTimeout(async()=>{await killCgroup(cgroupDir,simulateCgroup);reject(Error('worker timeout'))},timeoutMs);
  bootstrap.on('error',reject);
  bootstrap.on('message',async msg=>{
   try{
    if(msg?.type==='attached'){
      await waitForPid(cgroupDir,bootstrap.pid);attached=true;bootstrap.send({type:'go'});
    } else if(msg?.type==='stdout')stdout.push(Buffer.from(msg.data,'base64'));
    else if(msg?.type==='stderr')stderr.push(Buffer.from(msg.data,'base64'));
    else if(msg?.type==='spawn-error')reject(Error(msg.message));
    else if(msg?.type==='result'){workerResult={code:msg.code,signal:msg.signal};resolve()}
   }catch(e){reject(e)}
  });
  bootstrap.on('close',(code,signal)=>{if(!workerResult)reject(Error(`bootstrap exited before worker result: ${code??signal}`))});
 });
 try{await resultPromise}finally{clearTimeout(timer)}
 if(!attached)throw Error('worker bootstrap never attached');
 if(simulateCgroup)await fs.writeFile(path.join(cgroupDir,'cgroup.procs'),'');
 await waitEmpty(cgroupDir);
 const outputBefore=hash(Buffer.from(canon(await inventory(outputDir))));
 const verification=await verifyOutput({outputDir,outputIdentity:outputBefore,result:workerResult});
 if(!verification||verification.ok!==true)throw Error('output verification failed');
 const outputAfter=hash(Buffer.from(canon(await inventory(outputDir))));
 if(outputAfter!==outputBefore)throw Error('output mutated during verification');
 if(workerResult.code!==0)throw Error(`worker command failed: ${workerResult.code??workerResult.signal}`);
 const authority={schema:SCHEMA,command,bootstrapAttachedBeforeWorkerSpawn:true,cgroupEmptyBeforeLaunch:true,cgroupEmptyAfterExecution:true,workerResult,stdoutSha256:hash(Buffer.concat(stdout)),stderrSha256:hash(Buffer.concat(stderr)),outputIdentity:outputBefore,verification:{...verification,outputIdentity:outputBefore},policy:{gatedSpawn:true,cgroupMembershipVerifiedBeforeWorkerSpawn:true,cgroupKillOnTimeout:true,descendantAbsenceRequired:true,outputMutationRejected:true,existingEvidenceRejected:true}};
 const evidence={...authority,contentIdentity:hash(Buffer.from(canon(authority))),operationalId:`worker-v2-${randomUUID()}`};
 await writeExclusive(evidencePath,canon(evidence)+'\n');return evidence;
}

if(process.argv[2]==='--bootstrap')bootstrapMain().catch(e=>{process.send?.({type:'spawn-error',message:e.message});process.exit(1)});
