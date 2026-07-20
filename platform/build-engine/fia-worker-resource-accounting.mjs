#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SCHEMA='foundation.build.worker-resource-accounting.v1';
const hash=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
async function exists(p){try{await fs.access(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function readText(p,required=true){try{return (await fs.readFile(p,'utf8')).trim()}catch(e){if(!required&&e.code==='ENOENT')return null;throw e}}
async function writeExclusive(p,data){await fs.mkdir(path.dirname(p),{recursive:true});const h=await fs.open(p,'wx');try{await h.writeFile(data);await h.sync()}finally{await h.close()}}
function parseKv(text){const out={};for(const line of String(text||'').split('\n')){if(!line.trim())continue;const [k,...rest]=line.trim().split(/\s+/);const v=rest.join(' ');out[k]=/^\d+$/.test(v)?Number(v):v}return out}
function parseIo(text){return String(text||'').split('\n').filter(Boolean).map(line=>{const [device,...pairs]=line.trim().split(/\s+/);return {device,values:Object.fromEntries(pairs.map(p=>{const [k,v]=p.split('=');return [k,Number(v)]}))}}).sort((a,b)=>a.device.localeCompare(b.device))}
export async function readCgroupSnapshot(dir){
 const files={cpuStat:'cpu.stat',memoryCurrent:'memory.current',memoryPeak:'memory.peak',memoryEvents:'memory.events',pidsCurrent:'pids.current',pidsEvents:'pids.events',ioStat:'io.stat',cgroupEvents:'cgroup.events',cgroupProcs:'cgroup.procs'};
 const raw={};for(const [k,f] of Object.entries(files))raw[k]=await readText(path.join(dir,f),['memoryPeak','ioStat','pidsEvents'].includes(k)?false:true);
 return {cpu:parseKv(raw.cpuStat),memory:{current:Number(raw.memoryCurrent),peak:raw.memoryPeak===null?null:Number(raw.memoryPeak),events:parseKv(raw.memoryEvents)},pids:{current:Number(raw.pidsCurrent),events:parseKv(raw.pidsEvents||'')},io:parseIo(raw.ioStat||''),cgroup:parseKv(raw.cgroupEvents),processes:String(raw.cgroupProcs||'').split(/\s+/).filter(Boolean).map(Number).sort((a,b)=>a-b)};
}
export function classifyResourceOutcome({result,before,after}){
 const delta=(obj,key)=>(after?.[obj]?.events?.[key]??0)-(before?.[obj]?.events?.[key]??0);
 const oom=delta('memory','oom_kill')>0||delta('memory','oom_group_kill')>0;
 const pidsLimited=delta('pids','max')>0;
 const timedOut=!!result.timedOut;
 const classification=oom?'memory-limit':pidsLimited?'process-limit':timedOut?'wall-time-limit':result.signal?'signal':result.code===0?'success':'command-failure';
 return {classification,oomKilled:oom,pidsLimited,timedOut,exitCode:result.code,signal:result.signal};
}
async function setFreeze(dir,value,simulate=false){const p=path.join(dir,'cgroup.freeze');if(await exists(p))await fs.writeFile(p,`${value}\n`);if(simulate){const e=path.join(dir,'cgroup.events');const current=parseKv(await readText(e));await fs.writeFile(e,`populated ${current.populated??0}\nfrozen ${value}\n`)}}
async function waitFrozen(dir,expected,timeoutMs=2000){const start=Date.now();while(Date.now()-start<timeoutMs){const e=parseKv(await readText(path.join(dir,'cgroup.events')));if(Number(e.frozen||0)===expected)return;await new Promise(r=>setTimeout(r,20))}throw Error(`cgroup freeze state did not become ${expected}`)}
async function waitEmpty(dir,timeoutMs=2000){const start=Date.now();while(Date.now()-start<timeoutMs){const s=await readCgroupSnapshot(dir);if(s.processes.length===0&&s.pids.current===0)return s;await new Promise(r=>setTimeout(r,20))}const s=await readCgroupSnapshot(dir);throw Error(`worker descendants remain: ${s.processes.join(',')||s.pids.current}`)}
async function run(argv,{env,timeoutMs,onSpawn}){return await new Promise((resolve,reject)=>{const child=spawn(argv[0],argv.slice(1),{env,stdio:['ignore','pipe','pipe'],detached:true});onSpawn?.(child);const out=[],err=[];let timedOut=false;const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGKILL')}catch{}},timeoutMs);child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));child.on('error',reject);child.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,timedOut,stdout:Buffer.concat(out),stderr:Buffer.concat(err)})})})}
export async function executeAccountedWorker({cgroupDir,command,outputDir,evidencePath,env={},timeoutMs=180000,verifyOutput,simulateCgroup=false}){
 if(!Array.isArray(command)||!command.length)throw Error('command required');if(await exists(evidencePath))throw Error(`evidence exists: ${evidencePath}`);if(!await exists(cgroupDir))throw Error('cgroup missing');
 const before=await readCgroupSnapshot(cgroupDir);let childPid=null;const result=await run(command,{env,timeoutMs,onSpawn:child=>{childPid=child.pid;fs.writeFile(path.join(cgroupDir,'cgroup.procs'),`${child.pid}\n`).catch(()=>{})}});
 if(simulateCgroup){await fs.writeFile(path.join(cgroupDir,'cgroup.procs'),'');await fs.writeFile(path.join(cgroupDir,'pids.current'),'0\n');await fs.writeFile(path.join(cgroupDir,'cgroup.events'),'populated 0\nfrozen 0\n')}
 const afterCommand=await readCgroupSnapshot(cgroupDir);const outcome=classifyResourceOutcome({result,before,after:afterCommand});
 if(afterCommand.processes.length){for(const pid of afterCommand.processes){try{process.kill(pid,'SIGKILL')}catch{}}}
 await waitEmpty(cgroupDir);
 await setFreeze(cgroupDir,1,simulateCgroup);if(await exists(path.join(cgroupDir,'cgroup.freeze')))await waitFrozen(cgroupDir,1);
 let verification;try{verification=await verifyOutput({outputDir,result,outcome});if(!verification||verification.ok!==true)throw Error('output verification failed')}finally{await setFreeze(cgroupDir,0,simulateCgroup);if(await exists(path.join(cgroupDir,'cgroup.freeze')))await waitFrozen(cgroupDir,0)}
 const final=await readCgroupSnapshot(cgroupDir);if(final.processes.length||final.pids.current!==0)throw Error('cgroup not empty after verification');
 const authority={schema:SCHEMA,command,resourceBefore:before,resourceAfterCommand:afterCommand,resourceFinal:final,outcome,childPidRecorded:childPid!==null,stdoutSha256:hash(result.stdout),stderrSha256:hash(result.stderr),verification,policy:{freezeBeforeVerification:true,descendantAbsenceRequired:true,oomClassified:true,pidsLimitClassified:true,timeoutClassified:true,existingEvidenceRejected:true}};
 const evidence={...authority,identity:hash(Buffer.from(canon(authority))),operationalId:`worker-accounting-${randomUUID()}`};await writeExclusive(evidencePath,canon(evidence)+'\n');return evidence;
}
