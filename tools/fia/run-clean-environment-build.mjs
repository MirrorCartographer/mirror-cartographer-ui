#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, lstat, chmod, rm, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { materializeOwnedDependencies } from './materialize-owned-dependencies.mjs';

const INPUT_SCHEMA='fia.build-input-manifest.v1';
const INSTALL_SCHEMA='fia.owned-npm-dependency-installation.v1';
const SCHEMA='fia.clean-environment-build-attestation.v1';
const sha256=value=>`sha256:${createHash('sha256').update(value).digest('hex')}`;
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
const canonical=value=>JSON.stringify(sort(value));
function fail(message){throw new Error(message);}
function validRel(value){return typeof value==='string'&&value.length>0&&!path.isAbsolute(value)&&!value.split(/[\\/]+/).some(p=>p===''||p==='.'||p==='..');}
const posix=value=>value.split(path.sep).join('/');

async function inventory(root,rel='',label='entry'){
 const absolute=path.join(root,rel),names=(await readdir(absolute)).sort(),out=[];
 for(const name of names){const child=path.join(rel,name),target=path.join(root,child),st=await lstat(target);if(st.isSymbolicLink())fail(`${label} symbolic link rejected: ${posix(child)}`);if(st.isDirectory())out.push(...await inventory(root,child,label));else if(st.isFile()){const bytes=await readFile(target);out.push({path:posix(child),bytes:bytes.length,sha256:sha256(bytes),mode:st.mode&0o777});}else fail(`unsupported ${label}: ${posix(child)}`);}
 return out;
}
async function verifyManifest(sourceRoot,manifestPath){
 const raw=await readFile(manifestPath),manifest=JSON.parse(raw);if(manifest.schema!==INPUT_SCHEMA||!Array.isArray(manifest.files)||manifest.files.length===0)fail('unsupported build input manifest');
 const core={...manifest};delete core.manifest;if(!/^sha256:[0-9a-f]{64}$/.test(manifest.manifest??'')||sha256(Buffer.from(canonical(core)))!==manifest.manifest)fail('build input manifest identity mismatch');
 const paths=manifest.files.map(f=>f.path);if(new Set(paths).size!==paths.length||canonical(paths)!==canonical([...paths].sort()))fail('build input manifest paths must be unique and canonical');
 const files=[];for(const entry of manifest.files){if(!validRel(entry.path)||!Number.isInteger(entry.bytes)||!/^sha256:[0-9a-f]{64}$/.test(entry.sha256??'')||!Number.isInteger(entry.mode))fail(`invalid input entry: ${entry.path}`);const target=path.join(sourceRoot,entry.path),st=await lstat(target).catch(()=>null);if(!st||st.isSymbolicLink()||!st.isFile())fail(`invalid source input: ${entry.path}`);const bytes=await readFile(target);if(bytes.length!==entry.bytes||sha256(bytes)!==entry.sha256||(st.mode&0o777)!==entry.mode)fail(`source input changed: ${entry.path}`);files.push({entry,bytes});}
 return {manifest,manifestFile:sha256(raw),files};
}
async function materialize(root,files){for(const {entry,bytes} of files){const target=path.join(root,entry.path);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx',mode:entry.mode});await chmod(target,entry.mode);}}
function verifyInstallation(record,{lockfile,cacheManifest}){const core={...record};delete core.attestation;if(record?.schema!==INSTALL_SCHEMA||!/^sha256:[0-9a-f]{64}$/.test(record.attestation??'')||sha256(Buffer.from(canonical(core)))!==record.attestation)fail('dependency installation attestation identity mismatch');if(record.status!=='installed-offline'||record.lockfile!==lockfile||record.cacheManifest!==cacheManifest)fail('dependency installation evidence mismatch');return record;}
function run(command,cwd,env,timeoutMs){return new Promise((resolve,reject)=>{const child=spawn(command,{cwd,env,shell:true,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let stdout='',stderr='',done=false,timedOut=false;const timer=setTimeout(()=>{if(done)return;timedOut=true;try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL');}catch{}},timeoutMs);child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);child.on('error',reject);child.on('close',(code,signal)=>{done=true;clearTimeout(timer);if(timedOut)reject(new Error('clean environment build timed out'));else if(code!==0)reject(new Error(`clean environment build failed (${code??signal}): ${stderr.trim()}`));else resolve({stdout,stderr});});});}

export async function runCleanEnvironmentBuild({source='.',manifest,lockfile='package-lock.json',cacheManifest,cacheDir,command,outputDir,attempts=2,attestation,timeoutMs=300000,npmCommand='npm',installer=materializeOwnedDependencies,beforeBuild}){
 if(!manifest||!cacheManifest||!cacheDir||!attestation)fail('manifest, cacheManifest, cacheDir, and attestation are required');if(!validRel(lockfile)||!validRel(outputDir)||typeof command!=='string'||!command.trim())fail('invalid lockfile, output, or command');if(!Number.isInteger(attempts)||attempts<2||attempts>8)fail('attempts must be between 2 and 8');
 const sourceRoot=path.resolve(source),manifestPath=path.resolve(manifest),initial=await verifyManifest(sourceRoot,manifestPath),cacheRaw=await readFile(path.resolve(cacheManifest)),cache=JSON.parse(cacheRaw),lockRaw=await readFile(path.join(sourceRoot,lockfile));
 const cacheCore={...cache};delete cacheCore.manifest;if(cache.schema!=='fia.owned-npm-cache-manifest.v1'||sha256(Buffer.from(canonical(cacheCore)))!==cache.manifest)fail('owned npm cache manifest identity mismatch');const lockIdentity=sha256(lockRaw);if(cache.lockfile!==lockIdentity)fail('owned npm cache lockfile identity mismatch');
 const results=[],roots=[];try{for(let index=0;index<attempts;index++){
  const current=await verifyManifest(sourceRoot,manifestPath);if(current.manifest.manifest!==initial.manifest.manifest||current.manifestFile!==initial.manifestFile)fail(`input manifest changed before attempt ${index+1}`);
  const root=await mkdtemp(path.join(os.tmpdir(),'fia-clean-environment-'));roots.push(root);await materialize(root,current.files);
  const installPath=path.join(root,'dependency-installation.json'),installed=verifyInstallation(await installer({workspace:root,lockfile,cacheManifest:path.resolve(cacheManifest),cacheDir:path.resolve(cacheDir),attestation:installPath,timeoutMs,npmCommand}),{lockfile:lockIdentity,cacheManifest:cache.manifest});
  const dependencyBefore=await inventory(path.join(root,'node_modules'),'','dependency');if(canonical(dependencyBefore)!==canonical(installed.inventory))fail(`dependency installation inventory mismatch at attempt ${index+1}`);
  if(beforeBuild)await beforeBuild({attempt:index+1,workspace:root});
  const env={PATH:process.env.PATH??'',HOME:path.join(root,'.home'),TMPDIR:path.join(root,'.tmp'),LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC',SOURCE_DATE_EPOCH:'0'};await mkdir(env.HOME,{recursive:true});await mkdir(env.TMPDIR,{recursive:true});const log=await run(command,root,env,timeoutMs);
  const dependencyAfter=await inventory(path.join(root,'node_modules'),'','dependency');if(canonical(dependencyAfter)!==canonical(dependencyBefore))fail(`build mutated dependency tree at attempt ${index+1}`);
  const output=await inventory(path.join(root,outputDir),'','output').catch(e=>fail(`missing or unreadable output directory: ${outputDir}: ${e.message}`));
  results.push({attempt:index+1,installation:installed.attestation,dependencyInventory:sha256(Buffer.from(canonical(dependencyBefore))),outputInventory:sha256(Buffer.from(canonical(output))),stdout:sha256(Buffer.from(log.stdout)),stderr:sha256(Buffer.from(log.stderr)),dependencies:dependencyBefore,output});
 }
 const first=results[0];for(const result of results.slice(1)){if(canonical(result.dependencies)!==canonical(first.dependencies))fail(`dependency mismatch at attempt ${result.attempt}`);if(canonical(result.output)!==canonical(first.output))fail(`application output mismatch at attempt ${result.attempt}`);}
 const attemptsShape=results.map(({attempt,installation,dependencyInventory,outputInventory,stdout,stderr})=>({attempt,installation,dependencyInventory,outputInventory,stdout,stderr}));const core={schema:SCHEMA,inputManifest:initial.manifest.manifest,inputManifestFile:initial.manifestFile,lockfile:lockIdentity,cacheManifest:cache.manifest,cacheManifestFile:sha256(cacheRaw),command:sha256(Buffer.from(command)),outputDir,attempts,attemptEvidence:attemptsShape,dependencyInventory:first.dependencies,dependencyInventoryIdentity:first.dependencyInventory,outputInventory:first.output,outputInventoryIdentity:first.outputInventory,status:'reproducible-clean-environment'};const record={...core,attestation:sha256(Buffer.from(canonical(core)))};await mkdir(path.dirname(path.resolve(attestation)),{recursive:true});await writeFile(path.resolve(attestation),canonical(record)+'\n',{flag:'wx',mode:0o600});return record;
 }finally{await Promise.all(roots.map(root=>rm(root,{recursive:true,force:true})));}
}
function args(argv){const out={};for(let i=0;i<argv.length;i++){const t=argv[i];if(!t.startsWith('--'))fail(`unexpected argument: ${t}`);out[t.slice(2)]=argv[++i];}return{source:out.source??'.',manifest:out.manifest,lockfile:out.lockfile??'package-lock.json',cacheManifest:out.cacheManifest,cacheDir:out.cacheDir,command:out.command,outputDir:out.output,attempts:out.attempts?Number(out.attempts):2,attestation:out.attestation,timeoutMs:out.timeout?Number(out.timeout):300000,npmCommand:out.npm??'npm'};}
if(import.meta.url===`file://${process.argv[1]}`)runCleanEnvironmentBuild(args(process.argv.slice(2))).then(r=>console.log(canonical(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
