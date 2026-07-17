#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const verifier = fs.readFileSync(path.join(here, 'verify-deployment-contract.mjs'), 'utf8');
const policy = JSON.parse(fs.readFileSync(path.join(here, 'policy.json'), 'utf8'));
const deploy = fs.readFileSync(path.join(here, 'deploy-blue-green.sh'), 'utf8');

function runCase(name, mutate, shouldPass) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'foundation-deploy-test-'));
  fs.writeFileSync(path.join(root, 'verify-deployment-contract.mjs'), verifier);
  const changed = structuredClone(policy);
  let changedScript = deploy;
  const result = mutate(changed, changedScript);
  if (typeof result === 'string') changedScript = result;
  fs.writeFileSync(path.join(root, 'policy.json'), JSON.stringify(changed, null, 2));
  fs.writeFileSync(path.join(root, 'deploy-blue-green.sh'), changedScript);
  const proc = spawnSync(process.execPath, [path.join(root, 'verify-deployment-contract.mjs')], { encoding: 'utf8' });
  assert.equal(proc.status === 0, shouldPass, `${name}\nstdout:\n${proc.stdout}\nstderr:\n${proc.stderr}`);
  console.log(`PASS ${name}`);
  fs.rmSync(root, { recursive: true, force: true });
}

runCase('baseline', () => {}, true);
runCase('reject-mutable-tags', p => { p.runtime.mutable_tags_allowed = true; }, false);
runCase('reject-release-worker-traffic-authority', p => { p.admission.release_worker_may_switch_traffic = true; }, false);
runCase('reject-rollback-without-admission', p => { p.rollback.digest_must_have_prior_admission_record = false; }, false);
runCase('reject-destructive-same-release-migration', p => { p.rollback.destructive_schema_change_in_same_release_allowed = true; }, false);
runCase('reject-public-application-bind', (p, s) => s.replace('127.0.0.1:${PORT}:8080', '0.0.0.0:${PORT}:8080'), false);
runCase('reject-missing-runtime-digest-check', (p, s) => s.replace('image inspect', 'image metadata'), false);
runCase('reject-missing-stabilization-rollback', (p, s) => s.replace('traffic restored to previous slot', 'candidate stopped'), false);
console.log('PASS adversarial deployment contract controls');
