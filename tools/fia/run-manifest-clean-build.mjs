#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, lstat, chmod, rm, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const MANIFEST_SCHEMA = 'fia.build-input-manifest.v1';
const SCHEMA = 'fia.manifest-clean-build-attestation.v1';
const sha256 = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
const canonical = value => JSON.stringify(sort(value));
function fail(message){throw new Error(message);}
function validRel(value){return typeof value==='string'&&value.length>0&&!path.isAbsolute(value)&&!value.split(/[\\/]+/).some(part=>part===''||part==='.'||part==='..');}
function posix(value){return value.split(path.sep).join('/');}

async function verifyFile(sourceRoot, entry){
  if(!entry||!validRel(entry.path))fail(`invalid manifest file path: ${entry?.path}`);
  if(!Number.isInteger(entry.bytes)||entry.bytes<0)fail(`invalid manifest byte count: ${entry.path}`);
  if(!/^sha256:[0-9a-f]{64}$/.test(entry.sha256))fail(`invalid manifest digest: ${entry.path}`);
  if(!Number.isInteger(entry.mode)||entry.mode<0||entry.mode>0o777)fail(`invalid manifest mode: ${entry.path}`);
  const absolute=path.join(sourceRoot,entry.path),st=await lstat(absolute).catch(()=>null);
  if(!st)fail(`manifest input missing: ${entry.path}`);
  if(st.isSymbolicLink())fail(`manifest input became symbolic link: ${entry.path}`);
  if(!st.isFile())fail(`manifest input is not a file: ${entry.path}`);
  const bytes=await readFile(absolute),mode=st.mode&0o777,digest=sha256(bytes);
  if(bytes.length!==entry.bytes)fail(`manifest byte mismatch: ${entry.path}`);
  if(digest!==entry.sha256)fail(`manifest digest mismatch: ${entry.path}`);
  if(mode!==entry.mode)fail(`manifest mode mismatch: ${entry.path}`);
  return bytes;
}

async function verifyManifest(sourceRoot, manifestPath){
  const raw=await readFile(manifestPath),manifest=JSON.parse(raw);
  if(manifest.schema!==MANIFEST_SCHEMA)fail(`unsupported input manifest schema: ${manifest.schema}`);
  if(!Array.isArray(manifest.files)||manifest.files.length===0)fail('input manifest requires files');
  if(!/^sha256:[0-9a-f]{64}$/.test(manifest.manifest??''))fail('invalid input manifest identity');
  const core={...manifest};delete core.manifest;
  if(sha256(Buffer.from(canonical(core)))!==manifest.manifest)fail('input manifest identity mismatch');
  const paths=manifest.files.map(file=>file.path);
  if(new Set(paths).size!==paths.length)fail('duplicate file path in input manifest');
  if(canonical(paths)!==canonical([...paths].sort()))fail('input manifest files are not canonically ordered');
  const files=[];
  for(const entry of manifest.files)files.push({entry,bytes:await verifyFile(sourceRoot,entry)});
  return {manifest,manifestFile:sha256(raw),files};
}

async function materialize(root, files){
  for(const {entry,bytes} of files){
    const target=path.join(root,entry.path);
    await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,bytes,{flag:'wx',mode:entry.mode});
    await chmod(target,entry.mode);
  }
}

function run(command,cwd,env,timeoutMs){return new Promise((resolve,reject)=>{const child=spawn(command,{cwd,env,shell:true,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let stdout='',stderr='',done=false,timedOut=false;const timer=setTimeout(()=>{if(done)return;timedOut=true;try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL');}catch{}},timeoutMs);child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',(code,signal)=>{done=true;clearTimeout(timer);if(timedOut)reject(new Error('manifest clean build timed out'));else if(code!==0)reject(new Error(`manifest clean build command failed (${code??signal}): ${stderr.trim()}`));else resolve({stdout,stderr});});});}

async function inventory(root,rel=''){
  const absolute=path.join(root,rel),names=(await readdir(absolute)).sort(),out=[];
  for(const name of names){const child=path.join(rel,name),st=await lstat(path.join(root,child));if(st.isSymbolicLink())fail(`output symbolic link rejected: ${posix(child)}`);if(st.isDirectory())out.push(...await inventory(root,child));else if(st.isFile()){const bytes=await readFile(path.join(root,child));out.push({path:posix(child),bytes:bytes.length,sha256:sha256(bytes),mode:st.mode&0o777});}else fail(`unsupported output entry: ${posix(child)}`);}
  return out;
}

export async function runManifestCleanBuild({source='.',manifest,command,outputDir,attempts=2,attestation,timeoutMs=300000,env={},beforeAttempt}){
  if(!manifest)fail('input manifest required');if(typeof command!=='string'||!command.trim())fail('build command required');if(!validRel(outputDir))fail('invalid output directory');if(!Number.isInteger(attempts)||attempts<2||attempts>8)fail('attempts must be between 2 and 8');if(!attestation)fail('attestation output required');
  const sourceRoot=path.resolve(source),manifestPath=path.resolve(manifest),initial=await verifyManifest(sourceRoot,manifestPath),inventories=[],logs=[],roots=[];
  try{
    for(let index=0;index<attempts;index++){
      if(beforeAttempt)await beforeAttempt(index+1);
      const current=await verifyManifest(sourceRoot,manifestPath);
      if(current.manifest.manifest!==initial.manifest.manifest||current.manifestFile!==initial.manifestFile)fail(`input manifest changed before attempt ${index+1}`);
      const root=await mkdtemp(path.join(os.tmpdir(),'fia-manifest-clean-build-'));roots.push(root);await materialize(root,current.files);
      const cleanEnv={PATH:process.env.PATH??'',HOME:path.join(root,'.home'),TMPDIR:path.join(root,'.tmp'),LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC',SOURCE_DATE_EPOCH:'0',...env};await mkdir(cleanEnv.HOME,{recursive:true});await mkdir(cleanEnv.TMPDIR,{recursive:true});
      const result=await run(command,root,cleanEnv,timeoutMs),output=path.join(root,outputDir),files=await inventory(output).catch(error=>fail(`missing or unreadable output directory: ${outputDir}: ${error.message}`));
      inventories.push(files);logs.push({attempt:index+1,stdout:sha256(Buffer.from(result.stdout)),stderr:sha256(Buffer.from(result.stderr))});
      if(index>0&&canonical(files)!==canonical(inventories[0]))fail(`manifest clean build mismatch at attempt ${index+1}`);
    }
    const core={schema:SCHEMA,inputManifest:initial.manifest.manifest,inputManifestFile:initial.manifestFile,command:sha256(Buffer.from(command)),outputDir,attempts,inventory:inventories[0],logs,status:'reproducible'};
    const record={...core,attestation:sha256(Buffer.from(canonical(core)))};await mkdir(path.dirname(path.resolve(attestation)),{recursive:true});await writeFile(attestation,canonical(record)+'\n',{flag:'wx',mode:0o600});return record;
  }finally{await Promise.all(roots.map(root=>rm(root,{recursive:true,force:true})));}
}

function args(argv){const out={};for(let i=0;i<argv.length;i++){const token=argv[i];if(!token.startsWith('--'))fail(`unexpected argument: ${token}`);out[token.slice(2)]=argv[++i];}return{source:out.source??'.',manifest:out.manifest,command:out.command,outputDir:out.output,attempts:out.attempts?Number(out.attempts):2,attestation:out.attestation,timeoutMs:out.timeout?Number(out.timeout):300000};}
if(import.meta.url===`file://${process.argv[1]}`)runManifestCleanBuild(args(process.argv.slice(2))).then(record=>console.log(canonical(record))).catch(error=>{console.error(error.message);process.exitCode=1;});
