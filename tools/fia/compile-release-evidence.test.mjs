import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileReleaseEvidence } from './compile-release-evidence.mjs';
const h = s => `sha256:${createHash('sha256').update(s).digest('hex')}`;
async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-evidence-'));
  const artifact = h('artifact'), bundle = h('bundle');
  const files = {
    lockfile: { lockfileVersion: 3, packages: {'': {name:'app',version:'1.0.0'}, 'node_modules/a': {name:'a',version:'1.0.0',integrity:'sha512-AAAA'}} },
    build: { schema:'fia.clean-environment-build-attestation.v1', attestation:h('build'), outputInventory:artifact },
    staticValidation: { schema:'fia.static-artifact-validation.v1', validation:h('validation'), artifact },
    runtimeVerification: { schema:'fia.owned-runtime-verification.v1', verification:h('runtime'), artifact, bundle },
    bundleManifest: { schema:'fia.portable-runtime-bundle.v1', bundle, artifacts:{current:{},rollback:{}} }
  };
  const paths = {};
  for (const [name,value] of Object.entries(files)) { paths[name] = path.join(dir, `${name}.json`); await fs.writeFile(paths[name], JSON.stringify(value)); }
  return { dir, paths, artifact, bundle, opts:{...paths, sourceCommit:'a'.repeat(40), sbom:path.join(dir,'sbom.json'), provenance:path.join(dir,'provenance.json')} };
}
test('equivalent inputs produce stable SBOM and provenance identities', async()=>{const a=await fixture(), b=await fixture();const ra=await compileReleaseEvidence(a.opts), rb=await compileReleaseEvidence(b.opts);assert.equal(ra.sbom.sbom,rb.sbom.sbom);assert.equal(ra.provenance.provenance,rb.provenance.provenance);assert.equal(ra.sbom.components.length,1)});
test('static validation substitution is rejected', async()=>{const f=await fixture();const v=JSON.parse(await fs.readFile(f.paths.staticValidation));v.artifact=h('other');await fs.writeFile(f.paths.staticValidation,JSON.stringify(v));await assert.rejects(()=>compileReleaseEvidence(f.opts),/another artifact/)});
test('runtime artifact substitution is rejected', async()=>{const f=await fixture();const v=JSON.parse(await fs.readFile(f.paths.runtimeVerification));v.artifact=h('other');await fs.writeFile(f.paths.runtimeVerification,JSON.stringify(v));await assert.rejects(()=>compileReleaseEvidence(f.opts),/another artifact/)});
test('runtime bundle substitution is rejected', async()=>{const f=await fixture();const v=JSON.parse(await fs.readFile(f.paths.runtimeVerification));v.bundle=h('other');await fs.writeFile(f.paths.runtimeVerification,JSON.stringify(v));await assert.rejects(()=>compileReleaseEvidence(f.opts),/another bundle/)});
test('dependency without integrity is rejected', async()=>{const f=await fixture();const v=JSON.parse(await fs.readFile(f.paths.lockfile));delete v.packages['node_modules/a'].integrity;await fs.writeFile(f.paths.lockfile,JSON.stringify(v));await assert.rejects(()=>compileReleaseEvidence(f.opts),/missing integrity/)});
test('existing evidence is not overwritten', async()=>{const f=await fixture();await fs.writeFile(f.opts.sbom,'keep');await assert.rejects(()=>compileReleaseEvidence(f.opts),/already exists/);assert.equal(await fs.readFile(f.opts.sbom,'utf8'),'keep')});
