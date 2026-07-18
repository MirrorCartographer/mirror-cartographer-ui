import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileReleaseEvidenceGraph } from './compile-release-evidence-graph.mjs';

const sha = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const stableBytes = (v) => Buffer.from(`${JSON.stringify(stable(v), null, 2)}\n`);
async function fixture(root, mutate = (x) => x) {
  const core = { schema:'fia.portable-runtime-bundle.v1', policy:{providerNeutral:true,runtime:'node-http-v1'}, launcher:{path:'run.mjs',sha256:sha(Buffer.from('run'))}, objects:{algorithm:'sha256',count:2}, artifacts:{current:{identity:sha(Buffer.from('c')),files:[{path:'index.html',mode:420,size:1,sha256:sha(Buffer.from('c')),object:'objects/sha256/c'}],routes:[{route:'/',file:'index.html',sha256:sha(Buffer.from('c'))}]},rollback:{identity:sha(Buffer.from('r')),files:[{path:'index.html',mode:420,size:1,sha256:sha(Buffer.from('r')),object:'objects/sha256/r'}],routes:[{route:'/',file:'index.html',sha256:sha(Buffer.from('r'))}]}} };
  const bundle = mutate({ ...core, identity: sha(stableBytes(core)) });
  const pkg = { name:'mirror', version:'1.0.0', dependencies:{react:'^18.3.1'}, devDependencies:{vite:'^4.0.0'} };
  await fs.writeFile(path.join(root,'bundle.json'), stableBytes(bundle));
  await fs.writeFile(path.join(root,'package.json'), JSON.stringify(pkg,null,2));
  return { bundle:path.join(root,'bundle.json'), pkg:path.join(root,'package.json') };
}
async function run(root, inputs) { return compileReleaseEvidenceGraph({bundleManifest:inputs.bundle,packageJson:inputs.pkg,sourceCommit:'a'.repeat(40),sbom:path.join(root,'sbom.json'),provenance:path.join(root,'provenance.json'),boundBundle:path.join(root,'bound.json'),graph:path.join(root,'graph.json')}); }

test('compiles coherent deterministic evidence graph', async()=>{ const a=await fs.mkdtemp(path.join(os.tmpdir(),'fia-a-')); const b=await fs.mkdtemp(path.join(os.tmpdir(),'fia-b-')); const ra=await run(a,await fixture(a)); const rb=await run(b,await fixture(b)); assert.equal(ra.graph.identity,rb.graph.identity); assert.equal(ra.bundle.sbomIdentity,ra.sbom.identity); assert.equal(ra.bundle.provenanceIdentity,ra.provenance.identity); assert.equal(ra.provenance.bundleIdentity,ra.bundle.bundleAnchorIdentity); });
test('records unlocked dependency authority without false reproducibility', async()=>{ const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-u-')); const r=await run(root,await fixture(root)); assert.equal(r.sbom.dependencyAuthority.locked,false); assert.equal(r.provenance.dependencyReproducibility,'not-proven-without-lockfile'); assert.equal(r.graph.dependencyReproducibility,false); });
test('rejects producer bundle tampering', async()=>{ const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-t-')); const i=await fixture(root,b=>({...b,objects:{...b.objects,count:99}})); await assert.rejects(run(root,i),/producer bundle identity mismatch/); });
test('rejects incomplete source commits before writing', async()=>{ const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-c-')); const i=await fixture(root); await assert.rejects(compileReleaseEvidenceGraph({bundleManifest:i.bundle,packageJson:i.pkg,sourceCommit:'abc',sbom:path.join(root,'s'),provenance:path.join(root,'p'),boundBundle:path.join(root,'b')}),/full lowercase/); });
test('rejects existing output and preserves it', async()=>{ const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-e-')); const i=await fixture(root); const s=path.join(root,'sbom.json'); await fs.writeFile(s,'keep'); await assert.rejects(compileReleaseEvidenceGraph({bundleManifest:i.bundle,packageJson:i.pkg,sourceCommit:'a'.repeat(40),sbom:s,provenance:path.join(root,'p'),boundBundle:path.join(root,'b')}),/output exists/); assert.equal(await fs.readFile(s,'utf8'),'keep'); });
test('rejects output aliasing', async()=>{ const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-o-')); const i=await fixture(root); const same=path.join(root,'same'); await assert.rejects(compileReleaseEvidenceGraph({bundleManifest:i.bundle,packageJson:i.pkg,sourceCommit:'a'.repeat(40),sbom:same,provenance:same,boundBundle:path.join(root,'b')}),/distinct/); });
