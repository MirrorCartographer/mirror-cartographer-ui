import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishRelease } from './publish-release.mjs';

const A=`sha256:${'a'.repeat(64)}`;
const B=`sha256:${'b'.repeat(64)}`;
function fakeRuntime(reportedArtifact){return async()=>({address:{address:'127.0.0.1',port:41234},close:async()=>{},artifact:reportedArtifact});}
function verifier({artifact}){return Promise.resolve({verification:`sha256:${artifact.slice(7)}`});}

test('verified publication emits deterministic evidence and does not roll back',async()=>{
 const root=mkdtempSync(join(tmpdir(),'fia-publish-'));let rolledBack=false;
 const result=await publishRelease({artifact:A,root,deployFn:async()=>({artifact:A,previousArtifact:null,deployment:A}),rollbackFn:async()=>{rolledBack=true;},runtimeFactory:fakeRuntime(A),verifier});
 assert.equal(result.state,'verified-and-promoted');assert.equal(rolledBack,false);
 assert.equal(readdirSync(join(root,'publication-history')).length,1);
});

test('post-promotion identity mismatch restores previous artifact',async()=>{
 const root=mkdtempSync(join(tmpdir(),'fia-publish-'));let rollbackTarget=null;let closed=false;
 await assert.rejects(()=>publishRelease({artifact:B,root,deployFn:async()=>({artifact:B,previousArtifact:A,deployment:B}),rollbackFn:async({artifact})=>{rollbackTarget=artifact;return{artifact,state:'rolled-back'};},runtimeFactory:async()=>({address:{address:'127.0.0.1',port:41234},close:async()=>{closed=true;}}),verifier:async()=>{throw new Error(`served artifact mismatch: expected ${B}, received ${A}`);}}),/served artifact mismatch/);
 assert.equal(rollbackTarget,A);assert.equal(closed,true);
 const file=join(root,'publication-history',readdirSync(join(root,'publication-history'))[0]);
 const record=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(record.state,'rolled-back');assert.equal(record.rollbackArtifact,A);
});

test('rollback failure is surfaced and retained as failed evidence',async()=>{
 const root=mkdtempSync(join(tmpdir(),'fia-publish-'));
 await assert.rejects(()=>publishRelease({artifact:B,root,deployFn:async()=>({artifact:B,previousArtifact:A}),rollbackFn:async()=>{throw new Error('rollback unavailable');},runtimeFactory:fakeRuntime(A),verifier:async()=>{throw new Error('identity mismatch');}}),/rollback failed: rollback unavailable/);
 const record=JSON.parse(readFileSync(join(root,'publication-history',readdirSync(join(root,'publication-history'))[0]),'utf8'));
 assert.equal(record.state,'failed');assert.equal(record.previousArtifact,A);
});
