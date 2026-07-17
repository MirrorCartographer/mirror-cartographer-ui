#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve('platform/observability');
const baselinePolicy = JSON.parse(fs.readFileSync(path.join(root, 'policy.json'), 'utf8'));
const baselineCollector = fs.readFileSync(path.join(root, 'otel-collector.yaml'), 'utf8');
const baselinePrometheus = fs.readFileSync(path.join(root, 'prometheus.yml'), 'utf8');
const verifier = path.join(root, 'verify-observability-contract.mjs');

function run(name, mutate, shouldPass = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundation-observability-'));
  const fixture = {
    policy: structuredClone(baselinePolicy),
    collector: baselineCollector,
    prometheus: baselinePrometheus
  };
  mutate(fixture);

  const policyPath = path.join(dir, 'policy.json');
  const collectorPath = path.join(dir, 'otel-collector.yaml');
  const prometheusPath = path.join(dir, 'prometheus.yml');
  fs.writeFileSync(policyPath, JSON.stringify(fixture.policy, null, 2));
  fs.writeFileSync(collectorPath, fixture.collector);
  fs.writeFileSync(prometheusPath, fixture.prometheus);

  const result = spawnSync(
    process.execPath,
    [verifier, policyPath, collectorPath, prometheusPath],
    {encoding: 'utf8'}
  );
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    console.error(result.stdout, result.stderr);
    throw new Error(`${name}: expected ${shouldPass ? 'accept' : 'reject'}, got ${passed ? 'accept' : 'reject'}`);
  }
  console.log(`PASS ${name}`);
}

run('baseline', () => {}, true);
run('reject-one-prometheus', f => f.policy.signals.metrics.minimum_replicas = 1);
run('reject-no-raw-synthetic-custody', f => f.policy.signals.synthetics.raw_result_custody = false);
run('reject-direct-vendor-export-policy', f => f.policy.collection.direct_vendor_export_forbidden = false);
run('reject-one-alertmanager', f => f.policy.alerting.alertmanager_replicas = 1);
run('reject-load-balanced-alertmanager', f => f.policy.alerting.load_balancer_between_prometheus_and_alertmanager = true);
run('reject-hosted-alert-authority', f => f.policy.custody.hosted_alerting_as_sole_authority_forbidden = false);
run('reject-public-ingest-policy', f => f.policy.security.public_ingest_forbidden = false);
run('reject-no-loss-counter', f => f.policy.failure.telemetry_loss_counter_required = false);

run('reject-public-collector-grpc', f => {
  f.collector = f.collector.replace('endpoint: 127.0.0.1:4317', 'endpoint: 0.0.0.0:4317');
});
run('reject-public-collector-http', f => {
  f.collector = f.collector.replace('endpoint: 127.0.0.1:4318', 'endpoint: 0.0.0.0:4318');
});
run('reject-missing-memory-limiter', f => {
  f.collector = f.collector.replace('memory_limiter:', 'memory_guard:');
});
run('reject-missing-redaction', f => {
  f.collector = f.collector.replaceAll('attributes/redact', 'attributes/pass');
});
run('reject-vendor-exporter', f => {
  f.collector += '\n# forbidden exporter\n# datadog/exporter\n';
});
run('reject-missing-persistent-queue', f => {
  f.collector = f.collector.replaceAll('file_storage', 'memory_storage');
});
run('reject-missing-alertmanager-member', f => {
  f.prometheus = f.prometheus.replace('            - alertmanager-3.internal:9093\n', '');
});
run('reject-missing-remote-write', f => {
  f.prometheus = f.prometheus.replace('remote_write:', 'external_mirror:');
});

console.log('PASS adversarial observability controls');
