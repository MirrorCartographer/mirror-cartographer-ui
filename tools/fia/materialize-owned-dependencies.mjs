#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, lstat, rm, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const SCHEMA='fia.owned-npm-dependency-installation.v1';
const CACHE_SCHEMA='fia.owned-npm-cache-manifest.v1';
const sha256=value=>`sha256:${createHash('sha256').update(value).digest('hex')}`;
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
const canonical=value=>JSON.stringify(sort(value));
function fail(message){throw new Error(message);}
function validRel(value){return typeof value==='string'&&value.length>0&&!path.isAbsolute(value)&&!value.split(/[\\/]+/).some(part=>part===''||part==='.'||part==='..');}
function sriDigest(integrity,bytes){for(const token of String(integrity??'').trim().split(/\s+/).filter(Boolean)){const match=/^(sha256|sha384|sha512)-([A-Za-z0-9+/=]+)$/.exec(token);if(!match)continue;if(createHash(match[1]).update(bytes).digest('base64')===match[2])return token;}return null;}
async function run(command,args,{cwd,env,timeoutMs=300000}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let stdout='',stderr='',done=false,timedOut=false;const timer=setTimeout(()=>{if(done)return;timedOut=true;try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL');}catch{}},timeoutMs);child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);child.on('error',reject);child.on('close',(code,signal)=>{done=true;clearTimeout(timer);if(timedOut)reject(new Error(`${command} timed out`));else if(code!==0)reject(new Error(`${command} failed (${code??signal}): ${stderr.trim()}`));else resolve({stdout,stderr});});});}
async function inventory(root,rel=''){const names=(await readdir(path.join(root,rel))).sort(),out=[];for(const name of names){const child=path.join(rel,name),absolute=path.join(root,child),st=await lstat(absolute);if(st.isSymbolicLink())fail(`installed dependency symbolic link rejected: ${child}`);if(st.isDirectory())out.push(...await inventory(root,child));else if(st.isFile()){const bytes=await readFile(absolute);out.push({path:child.split(path.sep).join('/'),bytes:bytes.length,sha256:sha256(bytes),mode:st.mode&0o777});}else fail(`unsupported installed dependency entry: ${child}`);}return out;}
function lockPackages(lock){if(!lock||![2,3].includes(lock.lockfileVersion)||!lock.packages||typeof lock.packages!=='object')fail('package-lock.json must use lockfileVersion 2 or 3 with packages');return Object.entries(lock.packages).filter(([p,v])=>p&&v&&typeof v==='object');}
export async function materializeOwnedDependencies({workspace='.',lockfile='package-lock.json',cacheManifest,cacheDir,attestation,timeoutMs=300000,npmCommand='npm'}){
 if(!cacheManifest||!cacheDir||!attestation)fail('cacheManifest, cacheDir, and attestation are required');
 const root=path.resolve(workspace),lockPath=path.resolve(root,lockfile),manifestPath=path.resolve(cacheManifest),ownedRoot=path.resolve(cacheDir);
 const lockRaw=await readFile(lockPath),lock=JSON.parse(lockRaw),manifestRaw=await readFile(manifestPath),manifest=JSON.parse(manifestRaw);
 if(manifest.schema!==CACHE_SCHEMA||!Array.isArray(manifest.packages))fail('unsupported owned npm cache manifest');
 const manifestCore={...manifest};delete manifestCore.manifest;if(!/^sha256:[0-9a-f]{64}$/.test(manifest.manifest??'')||sha256(Buffer.from(canonical(manifestCore)))!==manifest.manifest)fail('owned npm cache manifest identity mismatch');
 const byIntegrity=new Map();for(const entry of manifest.packages){if(!entry||!validRel(entry.tarball)||!/^sha256:[0-9a-f]{64}$/.test(entry.sha256??'')||typeof entry.integrity!=='string')fail('invalid owned npm cache entry');if(byIntegrity.has(entry.integrity))fail(`duplicate owned cache integrity: ${entry.integrity}`);const absolute=path.join(ownedRoot,entry.tarball),st=await lstat(absolute).catch(()=>null);if(!st||st.isSymbolicLink()||!st.isFile())fail(`owned cache tarball invalid: ${entry.tarball}`);const bytes=await readFile(absolute);if(sha256(bytes)!==entry.sha256)fail(`owned cache sha256 mismatch: ${entry.tarball}`);if(!sriDigest(entry.integrity,bytes))fail(`owned cache integrity mismatch: ${entry.tarball}`);byIntegrity.set(entry.integrity,{entry,absolute});}
 const required=[];for(const [pkgPath,pkg] of lockPackages(lock)){if(typeof pkg.integrity!=='string')fail(`lockfile dependency missing integrity: ${pkgPath}`);const hit=byIntegrity.get(pkg.integrity);if(!hit)fail(`owned cache missing dependency: ${pkgPath}`);required.push({path:pkgPath,integrity:pkg.integrity,tarball:hit.entry.tarball,sha256:hit.entry.sha256});}
 required.sort((a,b)=>a.path.localeCompare(b.path));if(byIntegrity.size!==new Set(required.map(r=>r.integrity)).size)fail('owned cache manifest contains unreferenced tarballs');
 const npmCache=await mkdtemp(path.join(os.tmpdir(),'fia-owned-npm-cache-'));
 try{
  const env={PATH:process.env.PATH??'',HOME:path.join(npmCache,'home'),TMPDIR:path.join(npmCache,'tmp'),LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC',npm_config_registry:'http://127.0.0.1:9',npm_config_audit:'false',npm_config_fund:'false',npm_config_update_notifier:'false',npm_config_ignore_scripts:'true'};await mkdir(env.HOME,{recursive:true});await mkdir(env.TMPDIR,{recursive:true});
  for(const item of required){const hit=byIntegrity.get(item.integrity);await run(npmCommand,['cache','add',hit.absolute,'--cache',npmCache,'--ignore-scripts'],{cwd:root,env,timeoutMs});}
  const result=await run(npmCommand,['ci','--offline','--ignore-scripts','--audit=false','--fund=false','--cache',npmCache],{cwd:root,env,timeoutMs});
  const files=await inventory(path.join(root,'node_modules')).catch(e=>fail(`node_modules inventory failed: ${e.message}`));
  const core={schema:SCHEMA,lockfile:sha256(lockRaw),cacheManifest:manifest.manifest,cacheManifestFile:sha256(manifestRaw),packages:required,npmCommand,installArguments:['ci','--offline','--ignore-scripts','--audit=false','--fund=false'],stdout:sha256(Buffer.from(result.stdout)),stderr:sha256(Buffer.from(result.stderr)),inventory:files,status:'installed-offline'};
  const record={...core,attestation:sha256(Buffer.from(canonical(core)))};await mkdir(path.dirname(path.resolve(attestation)),{recursive:true});await writeFile(attestation,canonical(record)+'\n',{flag:'wx',mode:0o600});return record;
 }finally{await rm(npmCache,{recursive:true,force:true});}
}
function args(argv){const out={};for(let i=0;i<argv.length;i++){const t=argv[i];if(!t.startsWith('--'))fail(`unexpected argument: ${t}`);out[t.slice(2)]=argv[++i];}return{workspace:out.workspace??'.',lockfile:out.lockfile??'package-lock.json',cacheManifest:out.cacheManifest,cacheDir:out.cacheDir,attestation:out.attestation,timeoutMs:out.timeout?Number(out.timeout):300000,npmCommand:out.npm??'npm'};}
if(import.meta.url===`file://${process.argv[1]}`)materializeOwnedDependencies(args(process.argv.slice(2))).then(r=>console.log(canonical(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
