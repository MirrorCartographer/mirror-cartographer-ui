#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.release-graph.v1';
const ID = /^sha256:[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function sort(value){
  if(Array.isArray(value)) return value.map(sort);
  if(value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  return value;
}
const canonical = value => JSON.stringify(sort(value));
function fail(message){ throw new Error(message); }
function requireId(value, label){ if(!ID.test(value || '')) fail(`invalid ${label}`); return value; }
function requireSchema(doc, schema, label){ if(doc?.schema !== schema) fail(`${label} schema mismatch`); }
async function load(file, label){
  let bytes; try { bytes = await readFile(file); } catch { fail(`unable to read ${label}`); }
  let doc; try { doc = JSON.parse(bytes); } catch { fail(`invalid JSON in ${label}`); }
  return { file, bytes, doc, sha256: `sha256:${sha256(bytes)}` };
}
function artifactFromManifest(doc){ return doc.artifact || doc.aggregate || doc.identity; }
function sbomIdentity(doc){ return doc.sbom || doc.identity || doc.serialNumber?.replace(/^urn:uuid:/,'sha256:'); }
function provenanceSubject(doc){
  return doc.provenance?.artifact || doc.statement?.artifact || doc.subject?.artifact || doc.artifact;
}
function provenanceCommit(doc){
  return doc.provenance?.source?.commit || doc.statement?.source?.commit || doc.source?.commit || doc.commit;
}
function provenanceRefs(doc){
  const p = doc.provenance || doc.statement || doc;
  return {
    manifest: p.evidence?.manifest || p.manifest,
    sbom: p.evidence?.sbom || p.sbom,
    reproducibility: p.evidence?.reproducibility || p.reproducibility,
    lockfile: p.evidence?.lockfile || p.lockfile,
    policy: p.evidence?.policy || p.policy
  };
}
function assertEqual(actual, expected, label){ if(actual !== expected) fail(`${label} mismatch`); }

export async function compileReleaseGraph({artifact, commit, manifest, sbom, provenance, bundle, rehearsal, reproducibility, lockfilePolicy, output}){
  requireId(artifact, 'artifact identity');
  if(!COMMIT.test(commit || '')) fail('invalid source commit');
  const nodes = {};
  const inputs = {
    manifest: await load(manifest, 'manifest'),
    sbom: await load(sbom, 'SBOM'),
    provenance: await load(provenance, 'provenance'),
    bundle: await load(bundle, 'bundle descriptor'),
    rehearsal: await load(rehearsal, 'import rehearsal'),
    reproducibility: await load(reproducibility, 'reproducibility attestation'),
    lockfilePolicy: await load(lockfilePolicy, 'lockfile policy')
  };
  requireSchema(inputs.rehearsal.doc, 'fia.release-import-rehearsal.v1', 'import rehearsal');
  requireSchema(inputs.reproducibility.doc, 'fia.reproducibility-attestation.v1', 'reproducibility attestation');
  assertEqual(artifactFromManifest(inputs.manifest.doc), artifact, 'manifest artifact');
  assertEqual(provenanceSubject(inputs.provenance.doc), artifact, 'provenance artifact');
  assertEqual(inputs.bundle.doc.artifact, artifact, 'bundle artifact');
  assertEqual(inputs.rehearsal.doc.artifact, artifact, 'rehearsal artifact');
  assertEqual(inputs.reproducibility.doc.artifact, artifact, 'reproducibility artifact');
  assertEqual(provenanceCommit(inputs.provenance.doc), commit, 'provenance commit');
  assertEqual(inputs.rehearsal.doc.bundle, inputs.bundle.doc.bundle, 'rehearsal bundle');

  const manifestIdentity = requireId(inputs.manifest.doc.manifest || inputs.manifest.doc.identity || inputs.manifest.sha256, 'manifest identity');
  const sbomId = requireId(sbomIdentity(inputs.sbom.doc) || inputs.sbom.sha256, 'SBOM identity');
  const reproId = requireId(inputs.reproducibility.doc.reproducibility || inputs.reproducibility.doc.identity || inputs.reproducibility.sha256, 'reproducibility identity');
  const bundleId = requireId(inputs.bundle.doc.bundle, 'bundle identity');
  const rehearsalId = requireId(inputs.rehearsal.doc.rehearsal, 'rehearsal identity');
  const policyId = requireId(inputs.lockfilePolicy.doc.policy || inputs.lockfilePolicy.doc.policySha256 || inputs.lockfilePolicy.doc.identity || inputs.lockfilePolicy.sha256, 'policy identity');
  const refs = provenanceRefs(inputs.provenance.doc);
  if(refs.manifest) assertEqual(refs.manifest, manifestIdentity, 'provenance manifest reference');
  if(refs.sbom) assertEqual(refs.sbom, sbomId, 'provenance SBOM reference');
  if(refs.reproducibility) assertEqual(refs.reproducibility, reproId, 'provenance reproducibility reference');
  if(refs.policy) assertEqual(refs.policy, policyId, 'provenance policy reference');

  for(const [name,input] of Object.entries(inputs)) nodes[name] = {sha256: input.sha256, schema: input.doc.schema || null};
  const core = {
    schema: SCHEMA,
    artifact,
    source: {commit},
    identities: {manifest: manifestIdentity, sbom: sbomId, reproducibility: reproId, policy: policyId, bundle: bundleId, rehearsal: rehearsalId},
    nodes,
    edges: [
      {from:'source',to:'artifact',type:'builds'},
      {from:'manifest',to:'artifact',type:'describes'},
      {from:'sbom',to:'artifact',type:'enumerates-dependencies-for'},
      {from:'reproducibility',to:'artifact',type:'reproduces'},
      {from:'provenance',to:'artifact',type:'attests'},
      {from:'bundle',to:'artifact',type:'contains'},
      {from:'rehearsal',to:'bundle',type:'reconstructs'}
    ]
  };
  const release = `sha256:${sha256(Buffer.from(canonical(core)))}`;
  const result = {...core, release};
  if(output){ await mkdir(path.dirname(output), {recursive:true}); await writeFile(output, canonical(result)+'\n', {flag:'wx', mode:0o600}); }
  return result;
}
function args(argv){ const out={}; for(let i=0;i<argv.length;i++){ const token=argv[i]; if(!token.startsWith('--')) fail(`unexpected argument: ${token}`); out[token.slice(2)] = argv[++i]; } return out; }
if(import.meta.url === `file://${process.argv[1]}`) compileReleaseGraph(args(process.argv.slice(2))).then(value=>console.log(canonical(value))).catch(error=>{console.error(error.message);process.exitCode=1;});
