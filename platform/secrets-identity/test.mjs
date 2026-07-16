#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const verifier = path.join(here, 'verify-secrets-identity-policy.mjs');
const original = JSON.parse(fs.readFileSync(path.join(here, 'policy.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'foundation-secret-policy-'));

function run(policy, expected, label) {
  const p = path.join(tmp, `${label}.json`);
  fs.writeFileSync(p, JSON.stringify(policy, null, 2));
  const r = spawnSync(process.execPath, [verifier, p], { encoding: 'utf8' });
  if ((r.status === 0) !== expected) {
    console.error(r.stdout, r.stderr);
    throw new Error(`${label}: expected ${expected ? 'accept' : 'reject'}, got ${r.status}`);
  }
  console.log(`PASS ${label}`);
}

run(original, true, 'baseline');
const staticToken = structuredClone(original);
staticToken.workload_identity.static_tokens_allowed = true;
run(staticToken, false, 'reject-static-token');
const onlineRoot = structuredClone(original);
onlineRoot.root_recovery.online_root_key = true;
run(onlineRoot, false, 'reject-online-root');
const releaseReadsSecrets = structuredClone(original);
releaseReadsSecrets.deployment.release_worker_may_read_production_secrets = true;
run(releaseReadsSecrets, false, 'reject-release-worker-secret-access');
const singleAudit = structuredClone(original);
singleAudit.secret_broker.audit_devices_minimum = 1;
run(singleAudit, false, 'reject-single-audit-device');
const longLease = structuredClone(original);
longLease.secret_broker.maximum_lease_ttl_seconds = 86400;
run(longLease, false, 'reject-long-lived-secret');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('PASS adversarial secrets and identity controls');
