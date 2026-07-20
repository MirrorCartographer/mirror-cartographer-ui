import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeAccountedWorker,readCgroupSnapshot,classifyResourceOutcome } from './fia-worker-resource-accounting.mjs';

async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-acct-'));
 const cg=path.join(root,'cg');await fs.mkdir(cg);
 const write=(f,v)=>fs.writeFile(path.join(cg,f),String(v)+'\n');
 await Promise.all([
  write('cpu.stat','usage_usec 10\nuser_usec 7\nsystem_usec 3'),
  write('memory.current','0'),write('memory.peak','0'),
  write('memory.events','low 0\nhigh 0\nmax 0\noom 0\noom_kill 0\noom_group_kill 0'),
  write('pids.current','0'),write('pids.events','max 0'),write('io.stat',''),
  write('cgroup.events','populated 0\nfrozen 0'),write('cgroup.procs',''),write('cgroup.freeze','0')
 ]);
 return {root,cg,out:path.join(root,'out'),ev:path.join(root,'evidence.json')};
}

test('snapshot parsing is deterministic',async()=>{
 const f=await fixture();const s=await readCgroupSnapshot(f.cg);
 assert.equal(s.cpu.usage_usec,10);assert.equal(s.memory.events.oom_kill,0);assert.deepEqual(s.processes,[]);
 await fs.rm(f.root,{recursive:true,force:true});
});

test('resource classifications distinguish oom, pids, timeout and command failure',()=>{
 const base={memory:{events:{oom_kill:0,oom_group_kill:0}},pids:{events:{max:0}}};
 assert.equal(classifyResourceOutcome({result:{code:1},before:base,after:{memory:{events:{oom_kill:1}},pids:{events:{max:0}}}}).classification,'memory-limit');
 assert.equal(classifyResourceOutcome({result:{code:1},before:base,after:{memory:{events:{oom_kill:0}},pids:{events:{max:1}}}}).classification,'process-limit');
 assert.equal(classifyResourceOutcome({result:{code:null,timedOut:true},before:base,after:base}).classification,'wall-time-limit');
 assert.equal(classifyResourceOutcome({result:{code:2},before:base,after:base}).classification,'command-failure');
});

test('successful accounting freezes verification and emits evidence',async()=>{
 const f=await fixture();await fs.mkdir(f.out);
 const e=await executeAccountedWorker({cgroupDir:f.cg,command:[process.execPath,'-e','process.exit(0)'],outputDir:f.out,evidencePath:f.ev,verifyOutput:async()=>({ok:true,artifactIdentity:'sha256:x'}),simulateCgroup:true});
 assert.equal(e.outcome.classification,'success');assert.equal(JSON.parse(await fs.readFile(f.ev)).schema,'foundation.build.worker-resource-accounting.v1');
 await fs.rm(f.root,{recursive:true,force:true});
});

test('existing evidence fails before execution',async()=>{
 const f=await fixture();await fs.writeFile(f.ev,'keep');
 await assert.rejects(()=>executeAccountedWorker({cgroupDir:f.cg,command:[process.execPath,'-e','process.exit(0)'],outputDir:f.out,evidencePath:f.ev,verifyOutput:async()=>({ok:true})}),/evidence exists/);
 assert.equal(await fs.readFile(f.ev,'utf8'),'keep');await fs.rm(f.root,{recursive:true,force:true});
});

test('verification failure emits no success evidence',async()=>{
 const f=await fixture();await fs.mkdir(f.out);
 await assert.rejects(()=>executeAccountedWorker({cgroupDir:f.cg,command:[process.execPath,'-e','process.exit(0)'],outputDir:f.out,evidencePath:f.ev,verifyOutput:async()=>({ok:false}),simulateCgroup:true}),/verification failed/);
 assert.equal(await fs.stat(f.ev).then(()=>true,()=>false),false);await fs.rm(f.root,{recursive:true,force:true});
});

test('output mutation during verification is rejected',async()=>{
 const f=await fixture();await fs.mkdir(f.out);await fs.writeFile(path.join(f.out,'artifact'),'before');
 await assert.rejects(()=>executeAccountedWorker({cgroupDir:f.cg,command:[process.execPath,'-e','process.exit(0)'],outputDir:f.out,evidencePath:f.ev,simulateCgroup:true,verifyOutput:async()=>{await fs.writeFile(path.join(f.out,'artifact'),'after');return {ok:true}}}),/mutated during verification/);
 assert.equal(await fs.stat(f.ev).then(()=>true,()=>false),false);await fs.rm(f.root,{recursive:true,force:true});
});
