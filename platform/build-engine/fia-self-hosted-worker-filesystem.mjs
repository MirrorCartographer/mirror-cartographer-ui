#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCHEMA='foundation.build.self-hosted-worker-filesystem.v1';
const hash=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
async function exists(p){try{await fs.access(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function writeExclusive(p,data){await fs.mkdir(path.dirname(p),{recursive:true});const h=await fs.open(p,'wx');try{await h.writeFile(data);await h.sync()}finally{await h.close()}}
async function fileHash(p){return hash(await fs.readFile(p))}
function safeAbs(p,name){const x=path.resolve(p);if(!path.isAbsolute(x)||x==='/'||x.includes('\0'))throw Error(`unsafe ${name}: ${p}`);return x}
async function walk(root,dir=root,out=[]){for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error(`symbolic link rejected: ${p}`);if(e.isDirectory())await walk(root,p,out);else if(e.isFile()){const rel=path.relative(root,p).split(path.sep).join('/').normalize('NFC');if(!rel||rel.split('/').some(x=>!x||x==='.'||x==='..'))throw Error(`unsafe path: ${rel}`);const s=await fs.stat(p);out.push({path:rel,size:s.size,sha256:await fileHash(p),mode:s.mode&0o777})}else throw Error(`unsupported entry: ${p}`)}return out}
export function discoverRuntimeAuthorities(nodeBinary){nodeBinary=safeAbs(nodeBinary,'node binary');const r=spawnSync('/usr/bin/ldd',[nodeBinary],{encoding:'utf8'});if(r.status!==0)throw Error(`runtime dependency discovery failed: ${(r.stderr||'').trim()}`);const libs=[];for(const line of (r.stdout||'').split('\n')){const m=line.match(/(?:=>\s*)?(\/[^\s(]+)/);if(m)libs.push(m[1])}const out=[{source:nodeBinary,target:'/runtime/node'}];for(const lib of [...new Set(libs)].sort())out.push({source:lib,target:lib});return out}
function validateGuestPath(p){if(typeof p!=='string'||!p.startsWith('/')||p==='/'||p.includes('\\')||p.includes('\0')||p.split('/').some((x,i)=>i>0&&(!x||x==='.'||x==='..')))throw Error(`unsafe guest path: ${p}`);return path.posix.normalize(p)}
export function buildMountPlan({source,packageCache,outputStage,tempDir,runtimePaths=[]}){
 const mounts=[
  {source:safeAbs(source,'source'),target:'/workspace',mode:'ro',kind:'bind'},
  {source:safeAbs(packageCache,'package cache'),target:'/package-cache',mode:'ro',kind:'bind'},
  {source:safeAbs(outputStage,'output stage'),target:'/output',mode:'rw',kind:'bind'},
  {source:safeAbs(tempDir,'temp dir'),target:'/tmp',mode:'rw',kind:'bind'}
 ];
 for(const [i,item] of runtimePaths.entries()){const p=typeof item==='string'?{source:item,target:`/runtime/${i}`} : item;if(!p||typeof p!=='object')throw Error(`invalid runtime authority ${i}`);mounts.push({source:safeAbs(p.source,`runtime path ${i}`),target:validateGuestPath(p.target),mode:'ro',kind:'bind'})}
 const seen=new Set();for(const m of mounts){validateGuestPath(m.target);const key=m.target.toLocaleLowerCase('en-US');if(seen.has(key))throw Error(`duplicate mount target: ${m.target}`);seen.add(key)}
 return mounts;
}
export function buildCgroupPolicy(limits={}){
 const p={memoryMax:String(limits.memoryBytes??1073741824),memorySwapMax:String(limits.memorySwapBytes??0),pidsMax:String(limits.processes??512),cpuMax:`${limits.cpuQuotaMicros??100000} ${limits.cpuPeriodMicros??100000}`};
 for(const [k,v] of Object.entries(p))if(!/^(max|\d+( \d+)?)$/.test(v))throw Error(`invalid cgroup value ${k}: ${v}`);return p;
}
export async function createCgroup({root,name,policy,simulate=false}){
 root=safeAbs(root,'cgroup root');if(!/^[A-Za-z0-9._-]+$/.test(name))throw Error(`unsafe cgroup name: ${name}`);const dir=path.join(root,name);if(await exists(dir))throw Error(`cgroup exists: ${dir}`);await fs.mkdir(dir,{recursive:false});const files={
  'memory.max':policy.memoryMax,'memory.swap.max':policy.memorySwapMax,'pids.max':policy.pidsMax,'cpu.max':policy.cpuMax
 };
 try{for(const [f,v] of Object.entries(files)){const target=path.join(dir,f);if(simulate&&!await exists(target))await fs.writeFile(target,'');await fs.writeFile(target,`${v}\n`)}return {dir,files}}catch(e){await fs.rm(dir,{recursive:true,force:true});throw e}
}
function probeProduction({cgroupRoot}){
 if(process.platform!=='linux')return {ok:false,reason:'linux required'};
 for(const p of ['/usr/bin/unshare','/usr/bin/mount','/usr/sbin/chroot','/usr/bin/ldd'])if(spawnSync('/usr/bin/test',['-x',p]).status!==0)return {ok:false,reason:`missing executable ${p}`};
 const ns=spawnSync('/usr/bin/unshare',['--user','--map-root-user','--mount','--pid','--fork','true'],{encoding:'utf8'});if(ns.status!==0)return {ok:false,reason:(ns.stderr||'namespace probe failed').trim()};
 return {ok:true,cgroupV2:!!cgroupRoot};
}
function shellQuote(x){return `'${String(x).replaceAll("'","'\\''")}'`}
function sandboxScript({root,mounts,nodeGuest,command}){
 const lines=['set -eu',`mount -t tmpfs -o mode=0755,nosuid,nodev tmpfs ${shellQuote(root)}`];
 for(const d of ['/workspace','/package-cache','/output','/tmp','/proc','/dev','/runtime'])lines.push(`mkdir -p ${shellQuote(path.join(root,d))}`);
 for(const m of mounts){const dst=path.join(root,m.target);lines.push(`if [ -d ${shellQuote(m.source)} ]; then mkdir -p ${shellQuote(dst)}; else mkdir -p ${shellQuote(path.dirname(dst))}; : > ${shellQuote(dst)}; fi`,`mount --bind ${shellQuote(m.source)} ${shellQuote(dst)}`);if(m.mode==='ro')lines.push(`mount -o remount,bind,ro,nosuid,nodev ${shellQuote(dst)}`);else lines.push(`mount -o remount,bind,rw,nosuid,nodev ${shellQuote(dst)}`)}
 lines.push(`mount -t proc -o nosuid,nodev,noexec proc ${shellQuote(path.join(root,'proc'))}`);
 lines.push(`exec chroot ${shellQuote(root)} ${shellQuote(nodeGuest)} ${command.slice(1).map(shellQuote).join(' ')}`);
 return lines.join('\n');
}
function portableCommand(command,{source,nodeBinary}){return command.map((x,i)=>{const a=path.resolve(x);if(i===0&&a===nodeBinary)return path.basename(nodeBinary);if(a===source||a.startsWith(source+path.sep))return '/workspace/'+path.relative(source,a).split(path.sep).join('/');return x})}
async function run(argv,{env,timeoutMs,onSpawn}){return await new Promise((resolve,reject)=>{const child=spawn(argv[0],argv.slice(1),{env,stdio:['ignore','pipe','pipe'],detached:true});onSpawn?.(child);const out=[],err=[];let timedOut=false;const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGKILL')}catch{}},timeoutMs);child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));child.on('error',reject);child.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,timedOut,stdout:Buffer.concat(out),stderr:Buffer.concat(err)})})})}
export async function executeFilesystemWorker({source,packageCache,output,command,nodeBinary=process.execPath,nodeBinarySha256,runtimePaths=[],cgroupRoot='/sys/fs/cgroup',limits={},timeoutMs=180000,backend='linux-minimal',testOnly=false}){
 source=safeAbs(source,'source');packageCache=safeAbs(packageCache,'package cache');output=safeAbs(output,'output');nodeBinary=safeAbs(nodeBinary,'node binary');if(await exists(output))throw Error(`output exists: ${output}`);if(!Array.isArray(command)||!command.length)throw Error('command required');if(!await exists(source)||!await exists(packageCache))throw Error('source or package cache missing');const actualNode=await fileHash(nodeBinary);if(nodeBinarySha256&&nodeBinarySha256!==actualNode)throw Error(`node binary digest mismatch: ${actualNode}`);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-rootfs-'));const stage=`${output}.stage-${process.pid}-${randomUUID()}`;const temp=await fs.mkdtemp(path.join(os.tmpdir(),'fia-worker-tmp-'));let cgroup=null;
 try{await fs.mkdir(stage,{recursive:true});const runtimeAuthorities=[...discoverRuntimeAuthorities(nodeBinary),...runtimePaths];const mounts=buildMountPlan({source,packageCache,outputStage:stage,tempDir:temp,runtimePaths:runtimeAuthorities});const policy=buildCgroupPolicy(limits);let isolation;
  if(backend==='linux-minimal'){const probe=probeProduction({cgroupRoot});if(!probe.ok)throw Error(`minimal worker isolation unavailable: ${probe.reason}`);if(!await exists(path.join(cgroupRoot,'cgroup.controllers')))throw Error('cgroup v2 unavailable');cgroup=await createCgroup({root:cgroupRoot,name:`fia-${process.pid}-${randomUUID()}`,policy});isolation={backend,privateMountNamespace:true,privatePidNamespace:true,networkNamespace:true,minimalTmpfsRoot:true,readOnlyInputs:true,cgroupV2:true};
  }else if(backend==='test-process'){if(!testOnly)throw Error('test-process backend requires testOnly=true');const fakeRoot=path.join(root,'cgroup');await fs.mkdir(fakeRoot);cgroup=await createCgroup({root:fakeRoot,name:'worker',policy,simulate:true});isolation={backend,privateMountNamespace:false,privatePidNamespace:false,networkNamespace:false,minimalTmpfsRoot:false,readOnlyInputs:false,cgroupV2:'simulated'};}else throw Error(`unsupported backend: ${backend}`);
  const beforeSource=hash(Buffer.from(canon(await walk(source))));const beforeCache=hash(Buffer.from(canon(await walk(packageCache))));let argv;
  if(backend==='linux-minimal'){const script=sandboxScript({root,mounts,nodeGuest:'/runtime/node',command});argv=['/usr/bin/unshare','--user','--map-root-user','--net','--mount','--pid','--fork','/bin/sh','-c',script]}else argv=command;
  const env={PATH:path.dirname(nodeBinary),HOME:temp,CI:'1',TZ:'UTC',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',NODE_ENV:'production',SOURCE_DATE_EPOCH:'0',FIA_SOURCE_ROOT:source,FIA_PACKAGE_CACHE:packageCache,FIA_OUTPUT:stage};
  const result=await run(argv,{env,timeoutMs,onSpawn:child=>{if(cgroup)fs.writeFile(path.join(cgroup.dir,'cgroup.procs'),`${child.pid}\n`).catch(()=>{})}});
  const afterSource=hash(Buffer.from(canon(await walk(source))));const afterCache=hash(Buffer.from(canon(await walk(packageCache))));if(beforeSource!==afterSource)throw Error('source snapshot mutated');if(beforeCache!==afterCache)throw Error('package cache mutated');if(result.timedOut)throw Error('worker timeout');if(result.code!==0)throw Error(`worker failed with ${result.code}: ${result.stderr.toString('utf8').trim()}`);const artifacts=await walk(stage);if(!artifacts.length)throw Error('worker reported success without artifacts');
  const authority={schema:SCHEMA,command:portableCommand(command,{source,nodeBinary}),nodeBinary:{name:path.basename(nodeBinary),sha256:actualNode},mountPlan:mounts.map(m=>({target:m.target,mode:m.mode,kind:m.kind,sourceIdentity:m.target.startsWith('/runtime/')?path.basename(m.source):m.target.slice(1)})),cgroupPolicy:policy,isolation,sourceIdentity:beforeSource,packageCacheIdentity:beforeCache,stdoutSha256:hash(result.stdout),stderrSha256:hash(result.stderr),exitCode:result.code,signal:result.signal,artifactInventory:artifacts,policy:{hostRootHidden:backend==='linux-minimal',inputsReadOnly:backend==='linux-minimal',networkDenied:backend==='linux-minimal',cgroupEnforced:backend==='linux-minimal',existingOutputRejected:true,atomicPublication:true,descendantsBoundToCgroup:true}};const evidence={...authority,identity:hash(Buffer.from(canon(authority)))};await writeExclusive(path.join(stage,'worker-filesystem.json'),canon(evidence)+'\n');await writeExclusive(path.join(stage,'stdout.log'),result.stdout);await writeExclusive(path.join(stage,'stderr.log'),result.stderr);await fs.rename(stage,output);return evidence;
 }finally{if(cgroup)await fs.rm(cgroup.dir,{recursive:true,force:true}).catch(()=>{});await fs.rm(root,{recursive:true,force:true});await fs.rm(temp,{recursive:true,force:true});await fs.rm(stage,{recursive:true,force:true})}
}
