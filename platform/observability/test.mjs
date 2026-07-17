#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve('platform/observability');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'policy.json'), 'utf8'));
const collector = path.join(root, 'otel-collector.yaml');
const prometheus = path.join(root, 'prometheus.yml');
const verifier = path.join(root, 'verify-observability-contract.mjs');

function run(name, mutate, shouldPass=false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundation-observability-'));
  const p = structuredClone(baseline);
  mutate(p);
  const policy = path.join(dir, 'policy.json');
  fs.writeFileSync(policy, JSON.stringify(p, null, 2));
  const result = spawnSync(process.execPath, [verifier, policy, collector, prometheus], {encoding:'utf8'});
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    console.error(result.stdout, result.stderr);
    throw new Error(`${name}: expected ${shouldPass ? 'accept' : 'reject'}, got ${passed ? 'accept' : 'reject'}`);
  }
  console.log(`PASS ${name}`);
}

run('baseline', () => {}, true);
run('reject-one-prometheus', p => p.signals.metrics.minimum_replicas = 1);
run('reject-no-raw-synthetic-custody', p => p.signals.synthetics.raw_result_custody = false);
run('reject-direct-vendor-export', p => p.collection.direct_vendor_export_forbidden = false);
run('reject-one-alertmanager', p => p.alerting.alertmanager_replicas = 1);
run('reject-load-balanced-alertmanager', p => p.alerting.load_balancer_between_prometheus_and_alertmanager = true);
run('reject-hosted-alert-authority', p => p.custody.hosted_alerting_as_sole_authority_forbidden = false);
run('reject-public-ingest', p => p.security.public_ingest_forbidden = false);
run('reject-no-loss-counter', p => p.failure.telemetry_loss_counter_required = false);
console.log('PASS adversarial observability controls');
