#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.resolve('platform/release');
const verifier = path.join(root, 'verify-release.mjs');
const policy = path.join(root, 'policy.json');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundation-release-'));
const artifact = path.join(dir, 'artifact.bin');
fs.writeFileSync(artifact, Buffer.from('foundation-release-fixture-v1\n'));
const artifactBytes = fs.readFileSync(artifact);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

const keypairs = ['operator-a','operator-b','online-automation'].map((operator, index) => {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  return {keyid:`key-${index+1}`, operator, online:index===2, publicKey, privateKey};
});
const roots = {schema:'foundation.release-roots.v1', keys:keypairs.map(k => ({keyid:k.keyid, operator:k.operator, online:k.online, algorithm:'ed25519', public_key_pem:k.publicKey.export({type:'spki',format:'pem'})}))};

function envelope(overrides = {}, signers = keypairs.slice(0,2)) {
  const signed = {
    schema:'foundation.release-manifest.v1', sequence:1, environment:'candidate',
    source_commit:'0123456789abcdef0123456789abcdef01234567',
    build_recipe_digest:`sha256:${'1'.repeat(64)}`, builder_id:'foundation-worker-01',
    reproducibility:'single-build', issued_at:'2026-07-17T00:00:00.000Z',
    expires_at:'2026-08-15T00:00:00.000Z', previous_manifest_digest:null,
    artifact:{name:'app.oci.tar', digest:`sha256:${sha(artifactBytes)}`, length:artifactBytes.length, media_type:'application/vnd.oci.image.layout.v1.tar'},
    custody:[
      {uri:'file:///vault-a/app.oci.tar',failure_domain:'site-a',digest:`sha256:${sha(artifactBytes)}`},
      {uri:'s3-compatible://vault-b/app.oci.tar',failure_domain:'site-b',digest:`sha256:${sha(artifactBytes)}`},
      {uri:'registry://cache/app@sha256',failure_domain:'site-b',digest:`sha256:${sha(artifactBytes)}`}
    ], ...overrides
  };
  const payload = Buffer.from(JSON.stringify(signed));
  return {schema:'foundation.release-envelope.v1', signed, signatures:signers.map(k => ({keyid:k.keyid, signature:crypto.sign(null,payload,k.privateKey).toString('base64')}))};
}

function run(name, makeEnvelope, shouldPass=false, mutateRoots = roots => roots) {
  const e = makeEnvelope(envelope());
  const caseRoots = mutateRoots(structuredClone(roots));
  const caseRootsPath = path.join(dir, `${name}-roots.json`);
  const manifest = path.join(dir, `${name}.json`);
  fs.writeFileSync(caseRootsPath, JSON.stringify(caseRoots, null, 2));
  fs.writeFileSync(manifest, JSON.stringify(e, null, 2));
  const result = spawnSync(process.execPath,[verifier,policy,manifest,artifact,caseRootsPath],{encoding:'utf8'});
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    console.error(result.stdout, result.stderr);
    throw new Error(`${name}: expected ${shouldPass?'accept':'reject'}, got ${passed?'accept':'reject'}`);
  }
  console.log(`PASS ${name}`);
}

run('baseline', e => e, true);
run('reject-artifact-tamper', e => {e.signed.artifact.digest=`sha256:${'0'.repeat(64)}`; return e;});
run('reject-one-signature', () => envelope({},[keypairs[0]]));
run('reject-same-operator', e => e, false, r => {r.keys[1].operator='operator-a'; return r;});
run('reject-online-only-authority', () => envelope({},[keypairs[2],keypairs[2]]));
run('reject-expired', e => {e.signed.expires_at='2026-07-16T00:00:00.000Z'; return e;});
run('reject-long-validity', e => {e.signed.expires_at='2026-12-01T00:00:00.000Z'; return e;});
run('reject-custody-single-domain', e => {e.signed.custody=e.signed.custody.map(x=>({...x,failure_domain:'site-a'})); return e;});
run('reject-too-few-copies', e => {e.signed.custody=e.signed.custody.slice(0,2); return e;});
run('reject-mutable-custody', e => {e.signed.custody[0].mutable=true; return e;});
run('reject-unpinned-source', e => {e.signed.source_commit='preview'; return e;});
run('reject-missing-builder', e => {e.signed.builder_id=''; return e;});
run('reject-reproducibility-mismatch', e => {e.signed.reproducibility='mismatch'; return e;});
console.log('PASS adversarial release controls');
