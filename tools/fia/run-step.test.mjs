import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runStep } from './run-step.mjs';

const temp = () => mkdtemp(path.join(os.tmpdir(), 'fia-step-'));

test('successful step retains stdout, stderr, hashes, and stable identity', async () => {
  const dir = await temp();
  const a = await runStep({name:'compile',command:"node -e \"console.log('ok');console.error('note')\"",cwd:dir,output:path.join(dir,'a.json'),env:{...process.env,CI:'1',TZ:'UTC'}});
  const b = await runStep({name:'compile',command:"node -e \"console.log('ok');console.error('note')\"",cwd:dir,output:path.join(dir,'b.json'),env:{...process.env,CI:'1',TZ:'UTC'}});
  assert.equal(a.log,b.log);
  assert.equal(a.stdout.text,'ok\n');
  assert.equal(a.stderr.text,'note\n');
  assert.equal(a.environment.CI,'1');
});

test('nonzero exit writes evidence then fails', async () => {
  const dir = await temp(); const output=path.join(dir,'failed.json');
  await assert.rejects(runStep({name:'test',command:"node -e \"console.error('bad');process.exit(7)\"",cwd:dir,output}),/step failed \(7\)/);
  const doc=JSON.parse(await readFile(output,'utf8'));
  assert.equal(doc.exit.code,7); assert.equal(doc.stderr.text,'bad\n');
});

test('timeout kills step and records timeout evidence', async () => {
  const dir = await temp(); const output=path.join(dir,'timeout.json');
  await assert.rejects(runStep({name:'hang',command:"node -e \"setTimeout(()=>{},10000)\"",cwd:dir,output,timeoutMs:50}),/timed out/);
  const doc=JSON.parse(await readFile(output,'utf8')); assert.equal(doc.exit.timedOut,true);
});

test('output flooding is bounded and rejected', async () => {
  const dir = await temp(); const output=path.join(dir,'overflow.json');
  await assert.rejects(runStep({name:'flood',command:"node -e \"process.stdout.write('x'.repeat(50000))\"",cwd:dir,output,maxBytes:1024}),/output exceeded/);
  const doc=JSON.parse(await readFile(output,'utf8')); assert.ok(doc.exit.overflow);
});

test('retained evidence cannot be overwritten', async () => {
  const dir = await temp(); const output=path.join(dir,'immutable.json');
  await runStep({name:'one',command:"node -e \"\"",cwd:dir,output});
  await assert.rejects(runStep({name:'one',command:"node -e \"\"",cwd:dir,output}),/EEXIST/);
});

test('environment record excludes secrets and unrelated variables', async () => {
  const dir=await temp();
  const doc=await runStep({name:'env',command:"node -e \"\"",cwd:dir,output:path.join(dir,'env.json'),env:{...process.env,CI:'1',TOKEN:'secret',HOME:'/private'}});
  assert.deepEqual(doc.environment,{CI:'1'});
});
