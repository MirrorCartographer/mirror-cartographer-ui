import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeAttachedWorker } from './fia-self-hosted-worker-v2.mjs';

async function fixture(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-v2-'));const cg=path.join(root,'cg'),out=path.join(root,'out'),ev=path.join(root,'evidence.json');await fs.mkdir(cg);await fs.mkdir(out);await fs.writeFile(path.join(cg,'cgroup.procs'),'');await fs.writeFile(path.join(cg,'cgroup.kill'),'0\n');return {root,cg,out,ev}}

test('gated worker attaches bootstrap before command and emits evidence',async()=>{const f=await fixture();const script=`const fs=require('fs');fs.writeFileSync(${JSON.stringify(path.join(f.out,'artifact'))},'ok')`;const e=await executeAttachedWorker({cgroupDir:f.cg,command:[process.execPath,'-e',script],outputDir:f.out,evidencePath:f.ev,simulateCgroup:true,verifyOutput:async()=>({ok:true})});assert.equal(e.bootstrapAttachedBeforeWorkerSpawn,true);assert.equal(e.workerResult.code,0);assert.equal(await fs.readFile(path.join(f.out,'artifact'),'utf8'),'ok');await fs.rm(f.root,{recursive:true,force:true})});

test('equivalent runs produce same content identity',async()=>{const run=async()=>{const f=await fixture();const e=await executeAttachedWorker({cgroupDir:f.cg,command:[process.execPath,'-e','process.exit(0)'],outputDir:f.out,evidencePath:f.ev,simulateCgroup:true});await fs.rm(f.root,{recursive:true,force:true});return e};const a=await run(),b=await run();assert.equal(a.contentIdentity,b.contentIdentity);assert.notEqual(a.operationalId,b.operationalId)});

test('nonempty cgroup is rejected before bootstrap',async()=>{const f=await fixture();await fs.writeFile(path.join(f.cg,'cgroup.procs'),'999\n');await assert.rejects(()=>executeAttachedWorker({cgroupDir:f.cg,command:[process.execPath,'-e',''],outputDir:f.out,evidencePath:f.ev,simulateCgroup:true}),/not empty/);assert.equal(await fs.stat(f.ev).then(()=>true,()=>false),false);await fs.rm(f.root,{recursive:true,force:true})});

test('command failure emits no evidence',async()=>{const f=await fixture();await assert.rejects(()=>executeAttachedWorker({cgroupDir:f.cg,command:[process.execPath,'-e','process.exit(7)'],outputDir:f.out,evidencePath:f.ev,simulateCgroup:true}),/worker command failed/);assert.equal(await fs.stat(f.ev).then(()=>true,()=>false),false);await fs.rm(f.root,{recursive:true,force:true})});

test('output mutation during verification is rejected',async()=>{const f=await fixture();await fs.writeFile(path.join(f.out,'a'),'before');await assert.rejects(()=>executeAttachedWorker({cgroupDir:f.cg,command:[process.execPath,'-e',''],outputDir:f.out,evidencePath:f.ev,simulateCgroup:true,verifyOutput:async()=>{await fs.writeFile(path.join(f.out,'a'),'after');return {ok:true}}}),/mutated/);assert.equal(await fs.stat(f.ev).then(()=>true,()=>false),false);await fs.rm(f.root,{recursive:true,force:true})});

test('existing evidence is immutable',async()=>{const f=await fixture();await fs.writeFile(f.ev,'keep');await assert.rejects(()=>executeAttachedWorker({cgroupDir:f.cg,command:[process.execPath,'-e',''],outputDir:f.out,evidencePath:f.ev,simulateCgroup:true}),/evidence exists/);assert.equal(await fs.readFile(f.ev,'utf8'),'keep');await fs.rm(f.root,{recursive:true,force:true})});
