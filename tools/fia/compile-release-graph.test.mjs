import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileReleaseGraph } from './compile-release-graph.mjs';

const H = c => `sha256:${c.repeat(64)}`;
const commit = 'a'.repeat(40);
async function fixture(mutator=()=>{}){
  const root=await mkdtemp(path.join(os.tmpdir(),'fia-release-graph-'));
  const docs={
    manifest:{schema:'fia.artifact-manifest.v1',artifact:H('1'),manifest:H('2')},
    sbom:{schema:'fia.sbom.v1',sbom:H('3')},
    provenance:{schema:'fia.provenance-signature.v1',provenance:{artifact:H('1'),source:{commit},evidence:{manifest:H('2'),sbom:H('3'),reproducibility:H('4'),policy:H('5')}}},
    bundle:{schema:'fia.release-bundle.v1',artifact:H('1'),bundle:H('6')},
    rehearsal:{schema:'fia.release-import-rehearsal.v1',artifact:H('1'),bundle:H('6'),rehearsal:H('7')},
    reproducibility:{schema:'fia.reproducibility-attestation.v1',artifact:H('1'),reproducibility:H('4')},
    lockfilePolicy:{schema:'fia.lockfile-policy.v1',policy:H('5')}
  };
  mutator(docs);
  const files={};
  for(const [name,doc] of Object.entries(docs)){files[name]=path.join(root,`${name}.json`);await writeFile(files[name],JSON.stringify(doc));}
  return {root,files,docs};
}
const run = f => compileReleaseGraph({artifact:H('1'),commit,...f});

test('compiles a stable release graph and retains it immutably', async()=>{
  const {root,files}=await fixture(); const output=path.join(root,'release.json');
  const a=await run({...files,output}); const b=await run(files);
  assert.equal(a.release,b.release); assert.equal(JSON.parse(await readFile(output)).release,a.release);
  await assert.rejects(()=>run({...files,output}),/EEXIST/);
});
test('rejects cross-artifact manifest substitution', async()=>{
  const {files}=await fixture(d=>{d.manifest.artifact=H('9')});
  await assert.rejects(()=>run(files),/manifest artifact mismatch/);
});
test('rejects bundle and rehearsal identity divergence', async()=>{
  const {files}=await fixture(d=>{d.rehearsal.bundle=H('8')});
  await assert.rejects(()=>run(files),/rehearsal bundle mismatch/);
});
test('rejects provenance evidence substitution', async()=>{
  const {files}=await fixture(d=>{d.provenance.provenance.evidence.sbom=H('8')});
  await assert.rejects(()=>run(files),/provenance SBOM reference mismatch/);
});
test('rejects source commit mismatch', async()=>{
  const {files}=await fixture(d=>{d.provenance.provenance.source.commit='b'.repeat(40)});
  await assert.rejects(()=>run(files),/provenance commit mismatch/);
});
test('rejects malformed identities before graph emission', async()=>{
  const {files}=await fixture();
  await assert.rejects(()=>compileReleaseGraph({artifact:'latest',commit,...files}),/invalid artifact identity/);
});
