import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, chmod, rm, lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runManifestCleanBuild } from './run-manifest-clean-build.mjs';

const sha256=value=>`sha256:${createHash('sha256').update(value).digest('hex')}`;
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
const canonical=value=>JSON.stringify(sort(value));
async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'fia-manifest-executor-test-'));await mkdir(path.join(root,'src'),{recursive:true});await mkdir(path.join(root,'tools'),{recursive:true});
 await writeFile(path.join(root,'src','value.txt'),'stable\n');
 await writeFile(path.join(root,'secret.txt'),'must-not-copy\n');
 await writeFile(path.join(root,'tools','build.mjs'),"import {readFile,mkdir,writeFile} from 'node:fs/promises';const value=await readFile('src/value.txt','utf8');let secret='absent';try{await readFile('secret.txt');secret='present'}catch{}await mkdir('dist');await writeFile('dist/result.txt',value+secret+'\\n');\n",{mode:0o755});
 const files=[];for(const rel of ['src/value.txt','tools/build.mjs']){const absolute=path.join(root,rel),bytes=await readFile(absolute),st=await lstat(absolute);files.push({path:rel,bytes:bytes.length,sha256:sha256(bytes),mode:st.mode&0o777});}
 files.sort((a,b)=>a.path.localeCompare(b.path));const core={schema:'fia.build-input-manifest.v1',plan:sha256(Buffer.from('plan')),inputs:['src/value.txt','tools/build.mjs'],excludes:[],excluded:[],command:sha256(Buffer.from('node tools/build.mjs')),executables:['tools/build.mjs'],files,status:'compiled'};const manifest={...core,manifest:sha256(Buffer.from(canonical(core)))};await writeFile(path.join(root,'manifest.json'),canonical(manifest)+'\n');return root;
}
async function run(root,extra={}){return runManifestCleanBuild({source:root,manifest:path.join(root,'manifest.json'),command:'node tools/build.mjs',outputDir:'dist',attempts:2,attestation:path.join(root,'attestation.json'),...extra});}

test('copies only verified manifest files and produces stable attestation',async()=>{const root=await fixture();try{const record=await run(root);assert.equal(record.status,'reproducible');assert.equal(record.inventory[0].sha256,sha256(Buffer.from('stable\nabsent\n')));assert.match(await readFile(path.join(root,'attestation.json'),'utf8'),/fia.manifest-clean-build-attestation.v1/);}finally{await rm(root,{recursive:true,force:true});}});
test('rejects source mutation before first workspace',async()=>{const root=await fixture();try{await assert.rejects(run(root,{beforeAttempt:async attempt=>{if(attempt===1)await writeFile(path.join(root,'src','value.txt'),'changed\n');}}),/manifest (byte|digest) mismatch/);}finally{await rm(root,{recursive:true,force:true});}});
test('rejects mutation between independent attempts',async()=>{const root=await fixture();try{await assert.rejects(run(root,{beforeAttempt:async attempt=>{if(attempt===2)await writeFile(path.join(root,'src','value.txt'),'changed\n');}}),/manifest (byte|digest) mismatch/);}finally{await rm(root,{recursive:true,force:true});}});
test('rejects mode substitution',async()=>{const root=await fixture();try{await chmod(path.join(root,'tools','build.mjs'),0o644);await assert.rejects(run(root),/manifest mode mismatch/);}finally{await rm(root,{recursive:true,force:true});}});
test('rejects forged manifest identity',async()=>{const root=await fixture();try{const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));manifest.files[0].bytes+=1;await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest));await assert.rejects(run(root),/input manifest identity mismatch/);}finally{await rm(root,{recursive:true,force:true});}});
test('retained attestation cannot be overwritten',async()=>{const root=await fixture();try{await run(root);await assert.rejects(run(root),/EEXIST/);}finally{await rm(root,{recursive:true,force:true});}});
