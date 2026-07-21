import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { executeWorkerV4 } from './fia-self-hosted-worker-v4.mjs';

async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-worker-v4-'));
 const cgroupDir=path.join(root,'cgroup'),outputDir=path.join(root,'output'),casRoot=path.join(root,'cas');
 await fs.mkdir(cgroupDir);await fs.writeFile(path.join(cgroupDir,'cgroup.procs'),'');await fs.writeFile(path.join(cgroupDir,'cgroup.freeze'),'0\n');
 const script=path.join(root,'build.mjs');
 await fs.writeFile(script,"import{promises as fs}from'node:fs';import path from'node:path';await fs.mkdir(process.env.FIA_OUTPUT,{recursive:true});await fs.writeFile(path.join(process.env.FIA_OUTPUT,'index.html'),'<!doctype html><html lang=\"en\"><title>Owned</title><meta name=\"viewport\" content=\"width=device-width\"><body>owned</body></html>')");
 return {root,cgroupDir,outputDir,casRoot,script,workerEvidencePath:path.join(root,'worker.json'),casEvidencePath:path.join(root,'cas.json'),evidencePath:path.join(root,'v4.json')};
}
async function run(f,extra={}){return executeWorkerV4({cgroupDir:f.cgroupDir,argv:[process.execPath,f.script],outputDir:f.outputDir,casRoot:f.casRoot,evidencePath:f.evidencePath,workerEvidencePath:f.workerEvidencePath,casEvidencePath:f.casEvidencePath,sourceExecutionIdentity:'sha256:source',env:{FIA_OUTPUT:f.outputDir},simulateCgroup:true,...extra})}

test('success requires a committed CAS manifest',async()=>{const f=await fixture(),e=await run(f);assert.equal(e.verification.manifestCommitted,true);assert.ok((await fs.stat(path.join(f.casRoot,e.casManifestPath))).isFile());});
test('equivalent authority produces identical content identity',async()=>{const a=await fixture(),b=await fixture();assert.equal((await run(a)).contentIdentity,(await run(b)).contentIdentity);});
test('failure after worker verification emits no v4 success evidence',async()=>{const f=await fixture();await assert.rejects(run(f,{fault:'after-worker'}));await assert.rejects(fs.access(f.evidencePath));});
test('failure after object publication leaves no manifest or v4 evidence',async()=>{const f=await fixture();await assert.rejects(run(f,{fault:'after-cas-objects'}));await assert.rejects(fs.access(f.evidencePath));await assert.rejects(fs.access(path.join(f.casRoot,'manifests','sha256_source.json')));});
test('existing evidence prevents execution',async()=>{const f=await fixture();await fs.writeFile(f.evidencePath,'sentinel');await assert.rejects(run(f));assert.equal(await fs.readFile(f.evidencePath,'utf8'),'sentinel');});
