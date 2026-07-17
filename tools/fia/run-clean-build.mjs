#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, readdir, lstat, copyFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const SCHEMA='fia.clean-build-attestation.v1';
const sha256=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v}
const canonical=v=>JSON.stringify(sort(v));
function fail(m){throw new Error(m)}
function validRel(p){return typeof p==='string'&&p.length>0&&!path.isAbsolute(p)&&!p.split(/[\\/]+/).some(x=>x===''||x==='.'||x==='..')}
async function walk(root,rel=''){
 const dir=path.join(root,rel),names=(await readdir(dir)).sort(),out=[];
 for(const name of names){const child=path.join(rel,name),st=await lstat(path.join(root,child));if(st.isSymbolicLink())fail(`symbolic link rejected: ${child}`);if(st.isDirectory())out.push(...await walk(root,child));else if(st.isFile()){const b=await readFile(path.join(root,child));out.push({path:child.split(path.sep).join('/'),bytes:b.length,sha256:sha256(b)});}else fail(`unsupported filesystem entry: ${child}`)}
 return out;
}
async function copyDeclared(source,dest,inputs){
 for(const rel of inputs){if(!validRel(rel))fail(`invalid declared input: ${rel}`);const src=path.join(source,rel),st=await lstat(src).catch(()=>null);if(!st)fail(`missing declared input: ${rel}`);if(st.isSymbolicLink())fail(`symbolic link rejected: ${rel}`);if(st.isDirectory()){for(const f of await walk(source,rel)){const from=path.join(source,f.path),to=path.join(dest,f.path);await mkdir(path.dirname(to),{recursive:true});await copyFile(from,to);}}else if(st.isFile()){const to=path.join(dest,rel);await mkdir(path.dirname(to),{recursive:true});await copyFile(src,to);}else fail(`unsupported declared input: ${rel}`)}
}
function run(command,cwd,env,timeoutMs){return new Promise((resolve,reject)=>{const child=spawn(command,{cwd,env,shell:true,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let stdout='',stderr='',done=false;const timer=setTimeout(()=>{if(done)return;try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL')}catch{}},timeoutMs);child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('close',(code,signal)=>{done=true;clearTimeout(timer);if(code!==0)reject(new Error(`clean build command failed (${code??signal}): ${stderr.trim()}`));else resolve({stdout,stderr})})})}
export async function runCleanBuild({source='.',inputs,command,outputDir,attempts=2,attestation,timeoutMs=300000,env={}}){
 if(!Array.isArray(inputs)||inputs.length===0)fail('declared inputs required');if(new Set(inputs).size!==inputs.length)fail('duplicate declared input');if(typeof command!=='string'||!command.trim())fail('build command required');if(!validRel(outputDir))fail('invalid output directory');if(!Number.isInteger(attempts)||attempts<2||attempts>8)fail('attempts must be between 2 and 8');if(!attestation)fail('attestation output required');
 const sourceRoot=path.resolve(source),sourceInventory=[];for(const rel of [...inputs].sort()){const st=await lstat(path.join(sourceRoot,rel)).catch(()=>null);if(!st)fail(`missing declared input: ${rel}`);if(st.isSymbolicLink())fail(`symbolic link rejected: ${rel}`);if(st.isDirectory())sourceInventory.push(...await walk(sourceRoot,rel));else if(st.isFile()){const b=await readFile(path.join(sourceRoot,rel));sourceInventory.push({path:rel.split(path.sep).join('/'),bytes:b.length,sha256:sha256(b)}); } else fail(`unsupported declared input: ${rel}`)}
 sourceInventory.sort((a,b)=>a.path.localeCompare(b.path));const inventories=[],logs=[],roots=[];
 try{for(let i=0;i<attempts;i++){const root=await mkdtemp(path.join(os.tmpdir(),'fia-clean-build-'));roots.push(root);await copyDeclared(sourceRoot,root,inputs);const cleanEnv={PATH:process.env.PATH??'',HOME:path.join(root,'.home'),TMPDIR:path.join(root,'.tmp'),LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC',SOURCE_DATE_EPOCH:'0',...env};await mkdir(cleanEnv.HOME,{recursive:true});await mkdir(cleanEnv.TMPDIR,{recursive:true});const result=await run(command,root,cleanEnv,timeoutMs);const out=path.join(root,outputDir),inventory=await walk(out).catch(e=>fail(`missing or unreadable output directory: ${outputDir}: ${e.message}`));inventories.push(inventory);logs.push({attempt:i+1,stdout:sha256(Buffer.from(result.stdout)),stderr:sha256(Buffer.from(result.stderr))});if(i>0&&canonical(inventory)!==canonical(inventories[0]))fail(`clean build mismatch at attempt ${i+1}`)}
 const core={schema:SCHEMA,command:sha256(Buffer.from(command)),inputs:sourceInventory,outputDir,attempts,inventory:inventories[0],logs,status:'reproducible'};const record={...core,attestation:sha256(Buffer.from(canonical(core)))};await mkdir(path.dirname(path.resolve(attestation)),{recursive:true});await writeFile(attestation,canonical(record)+'\n',{flag:'wx',mode:0o600});return record;
 }finally{await Promise.all(roots.map(r=>rm(r,{recursive:true,force:true})))}
}
function args(argv){const o={inputs:[]};for(let i=0;i<argv.length;i++){const t=argv[i];if(!t.startsWith('--'))fail(`unexpected argument: ${t}`);const k=t.slice(2),v=argv[++i];if(k==='input')o.inputs.push(v);else o[k]=v}return{source:o.source??'.',inputs:o.inputs,command:o.command,outputDir:o.output,attempts:o.attempts?Number(o.attempts):2,attestation:o.attestation,timeoutMs:o.timeout?Number(o.timeout):300000}}
if(import.meta.url===`file://${process.argv[1]}`)runCleanBuild(args(process.argv.slice(2))).then(v=>console.log(canonical(v))).catch(e=>{console.error(e.message);process.exitCode=1});
