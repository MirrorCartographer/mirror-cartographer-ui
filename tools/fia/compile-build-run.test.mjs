import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileBuildRun } from './compile-build-run.mjs';

const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function sort(value){ if(Array.isArray(value)) return value.map(sort); if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])])); return value; }
const canonical = value => JSON.stringify(sort(value));
async function fixture(){
  const dir=await mkdtemp(path.join(os.tmpdir(),'fia-build-run-'));
  const names=['lockfile','compile','verify'];
  const plan={schema:'fia.build-plan.v1',steps:names.map(name=>({name,required:true}))};
  const planPath=path.join(dir,'plan.json'); await writeFile(planPath,canonical(plan));
  const logs=[];
  for(const name of names){
    const stdout=Buffer.from(`${name} ok\n`), stderr=Buffer.alloc(0), command=`run ${name}`;
    const core={schema:'fia.build-step-log.v1',step:name,command,commandSha256:sha256(Buffer.from(command)),cwd:'/owned/build',environment:{CI:'1',TZ:'UTC'},started:'2026-01-01T00:00:00.000Z',finished:'2026-01-01T00:00:01.000Z',exit:{code:0,signal:null,timedOut:false,overflow:null},stdout:{bytes:stdout.length,sha256:sha256(stdout),text:stdout.toString()},stderr:{bytes:0,sha256:sha256(stderr),text:''}};
    const identityCore={...core,started:null,finished:null};
    const log={...core,log:sha256(Buffer.from(canonical(identityCore)))};
    const file=path.join(dir,`${name}.json`); await writeFile(file,canonical(log)+'\n'); logs.push(file);
  }
  return {dir,planPath,logs};
}

test('compiles ordered successful logs into stable run identity', async()=>{
  const a=await fixture(); const b=await fixture();
  const ra=await compileBuildRun({plan:a.planPath,logs:a.logs,output:path.join(a.dir,'run.json'),sourceCommit:'a'.repeat(40)});
  const rb=await compileBuildRun({plan:b.planPath,logs:b.logs,output:path.join(b.dir,'run.json'),sourceCommit:'a'.repeat(40)});
  assert.equal(ra.run,rb.run); assert.equal(ra.steps.length,3); assert.equal(ra.status,'succeeded');
});

test('rejects skipped or additional logs', async()=>{
  const f=await fixture();
  await assert.rejects(()=>compileBuildRun({plan:f.planPath,logs:f.logs.slice(0,2),output:path.join(f.dir,'run.json')}),/count mismatch/);
  await assert.rejects(()=>compileBuildRun({plan:f.planPath,logs:[...f.logs,f.logs[0]],output:path.join(f.dir,'run2.json')}),/count mismatch/);
});

test('rejects reordered logs', async()=>{
  const f=await fixture(); const logs=[f.logs[1],f.logs[0],f.logs[2]];
  await assert.rejects(()=>compileBuildRun({plan:f.planPath,logs,output:path.join(f.dir,'run.json')}),/order mismatch/);
});

test('rejects false-success exit state', async()=>{
  const f=await fixture(); const value=JSON.parse(await readFile(f.logs[1],'utf8')); value.exit.code=1; await writeFile(f.logs[1],canonical(value));
  await assert.rejects(()=>compileBuildRun({plan:f.planPath,logs:f.logs,output:path.join(f.dir,'run.json')}),/unsuccessful/);
});

test('rejects tampered stream and log identities', async()=>{
  const f=await fixture(); const value=JSON.parse(await readFile(f.logs[0],'utf8')); value.stdout.text='tampered'; await writeFile(f.logs[0],canonical(value));
  await assert.rejects(()=>compileBuildRun({plan:f.planPath,logs:f.logs,output:path.join(f.dir,'run.json')}),/stdout evidence mismatch/);
  const g=await fixture(); const second=JSON.parse(await readFile(g.logs[0],'utf8')); second.log='sha256:'+ '0'.repeat(64); await writeFile(g.logs[0],canonical(second));
  await assert.rejects(()=>compileBuildRun({plan:g.planPath,logs:g.logs,output:path.join(g.dir,'run.json')}),/log identity mismatch/);
});

test('rejects duplicate plan steps and immutable output overwrite', async()=>{
  const f=await fixture(); const bad={schema:'fia.build-plan.v1',steps:[{name:'compile'},{name:'compile'}]}; await writeFile(f.planPath,canonical(bad));
  await assert.rejects(()=>compileBuildRun({plan:f.planPath,logs:f.logs.slice(0,2),output:path.join(f.dir,'run.json')}),/duplicate plan step/);
  const g=await fixture(); const output=path.join(g.dir,'run.json'); await compileBuildRun({plan:g.planPath,logs:g.logs,output});
  await assert.rejects(()=>compileBuildRun({plan:g.planPath,logs:g.logs,output}),/EEXIST/);
});
