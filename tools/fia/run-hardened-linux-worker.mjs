#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, lstat, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PLAN_SCHEMA = 'fia.hardened-linux-worker-plan.v1';
const RUN_SCHEMA = 'fia.hardened-linux-worker-run.v1';
const LOG_LIMIT = 4 * 1024 * 1024;
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const stable=v=>JSON.stringify(canonical(v));
const sha256=b=>createHash('sha256').update(b).digest('hex');
function fail(m){throw new Error(m);}
async function ensureAbsent(p){try{await stat(p);fail(`destination already exists: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
async function inventory(root){
  const out=[];
  async function walk(dir,rel=''){
    for(const name of (await readdir(dir)).sort()){
      const abs=path.join(dir,name), rp=rel?`${rel}/${name}`:name, s=await lstat(abs);
      if(s.isSymbolicLink()) fail(`symlink is not allowed: ${rp}`);
      if(s.isDirectory()){out.push({path:rp,type:'directory',mode:s.mode&0o777});await walk(abs,rp);}
      else if(s.isFile()){const b=await readFile(abs);out.push({path:rp,type:'file',mode:s.mode&0o777,size:b.length,sha256:sha256(b)});}
      else fail(`unsupported filesystem entry: ${rp}`);
    }
  }
  await walk(root); return out;
}
function resolveBinary(name){const r=spawnSync('sh',['-c','command -v "$1"','fia-lookup',name],{encoding:'utf8'});if(r.status!==0)fail(`required executable is unavailable: ${name}`);return r.stdout.trim();}
async function verifyExecutable(name, expected){const p=resolveBinary(name);const b=await readFile(p);if(sha256(b)!==expected.sha256||b.length!==expected.bytes)fail(`executable identity mismatch: ${name}`);return p;}
function parseArgs(argv){const o={};for(let i=2;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]===undefined)fail('arguments must be --name value pairs');o[argv[i].slice(2)]=argv[i+1];}for(const k of ['plan','workspace','output'])if(!o[k])fail(`missing --${k}`);return o;}
function boundedCollector(limit=LOG_LIMIT){let chunks=[],bytes=0,truncated=false;return{push(chunk){if(bytes>=limit){truncated=true;return;}const remain=limit-bytes;const slice=chunk.length>remain?chunk.subarray(0,remain):chunk;chunks.push(slice);bytes+=slice.length;if(slice.length<chunk.length)truncated=true;},finish(){const body=Buffer.concat(chunks);return{bytes:body.length,sha256:sha256(body),truncated,text:body.toString('utf8')}}};}

export async function runHardenedLinuxWorker(options,hooks={}){
  const planPath=path.resolve(options.plan), workspace=path.resolve(options.workspace), output=path.resolve(options.output);
  await ensureAbsent(output);
  const planBytes=await readFile(planPath); const plan=JSON.parse(planBytes);
  if(plan.schema!==PLAN_SCHEMA)fail('invalid hardened worker plan schema');
  const claimed=plan.identity; const copy={...plan}; delete copy.identity;
  if(sha256(Buffer.from(stable(copy)))!==claimed)fail('hardened worker plan identity mismatch');
  if(!Array.isArray(plan.launcher)||plan.launcher.length<3)fail('invalid hardened worker launcher');
  if(plan.policy?.filesystemRoot!=='not-chrooted'||plan.policy?.cgroupV2!=='not-configured')fail('unsupported worker plan policy');
  const ws=await stat(workspace).catch(()=>null); if(!ws?.isDirectory())fail('workspace must be an existing directory');
  const before=await inventory(workspace);
  const verify=hooks.verifyExecutable??verifyExecutable;
  await verify('unshare',plan.executables.unshare); await verify('prlimit',plan.executables.prlimit); await verify(plan.command.executable,plan.executables.command);
  const env={PATH:process.env.PATH??'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC',HOME:path.join(workspace,'.fia-home'),TMPDIR:path.join(workspace,'.fia-tmp'),TMP:path.join(workspace,'.fia-tmp'),TEMP:path.join(workspace,'.fia-tmp')};
  await mkdir(env.HOME,{recursive:true}); await mkdir(env.TMPDIR,{recursive:true});
  const stdout=boundedCollector(),stderr=boundedCollector();
  const execute=hooks.execute??((launcher,ctx)=>new Promise(resolve=>{
    const child=spawn(launcher[0],launcher.slice(1),{cwd:workspace,env,detached:true,stdio:['ignore','pipe','pipe']});
    let timedOut=false; child.stdout.on('data',c=>stdout.push(c)); child.stderr.on('data',c=>stderr.push(c));
    const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGKILL');}catch{}},plan.limits.timeoutMs);
    child.on('error',error=>{clearTimeout(timer);resolve({exitCode:null,signal:null,timedOut,error:error.code??error.message});});
    child.on('close',(code,signal)=>{clearTimeout(timer);resolve({exitCode:code,signal,timedOut,error:null});});
  }));
  const result=await execute(plan.launcher,{workspace,env,stdout,stderr,timeoutMs:plan.limits.timeoutMs});
  const after=await inventory(workspace); const outLog=stdout.finish(),errLog=stderr.finish();
  const status=result.timedOut?'timed-out':result.exitCode===0&&!result.signal&&!result.error?'succeeded':'failed';
  const record={schema:RUN_SCHEMA,plan:{identity:claimed,fileSha256:sha256(planBytes)},policy:{logs:'bounded',logLimitBytes:LOG_LIMIT,environment:'fixed-minimal',processTermination:'process-group-on-timeout'},status,result,workspace:{beforeIdentity:sha256(Buffer.from(stable(before))),afterIdentity:sha256(Buffer.from(stable(after))),after},stdout:outLog,stderr:errLog};
  record.identity=sha256(Buffer.from(stable(record)));
  await mkdir(path.dirname(output),{recursive:true}); await writeFile(output,`${JSON.stringify(record,null,2)}\n`,{flag:'wx'});
  if(status!=='succeeded')fail(`hardened worker ${status}`); return record;
}
if(import.meta.url===`file://${process.argv[1]}`)runHardenedLinuxWorker(parseArgs(process.argv)).then(r=>process.stdout.write(`${r.identity}\n`)).catch(e=>{console.error(e.message);process.exitCode=1;});
