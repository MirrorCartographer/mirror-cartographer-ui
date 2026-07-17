#!/usr/bin/env node
import fs from 'node:fs';

const [policyPath='platform/observability/policy.json', collectorPath='platform/observability/otel-collector.yaml', prometheusPath='platform/observability/prometheus.yml'] = process.argv.slice(2);
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const collector = fs.readFileSync(collectorPath, 'utf8');
const prometheus = fs.readFileSync(prometheusPath, 'utf8');
const checks = [];
const check = (name, ok) => checks.push({name, ok: Boolean(ok)});

check('two metric replicas', policy.signals.metrics.minimum_replicas >= 2);
check('metric remote mirror', policy.signals.metrics.remote_mirror_required === true);
check('logs use object storage', policy.signals.logs.object_store_required === true);
check('two external probe domains', policy.signals.synthetics.minimum_external_failure_domains >= 2);
check('raw synthetic custody', policy.signals.synthetics.raw_result_custody === true);
check('local collection', policy.collection.local_agent_required === true);
check('collector memory limiter', policy.collection.memory_limiter_required && collector.includes('memory_limiter:'));
check('collector batching', policy.collection.batching_required && collector.includes('batch:'));
check('persistent telemetry queue', policy.collection.persistent_queue_required && collector.includes('file_storage'));
check('telemetry redaction', policy.collection.telemetry_redaction_required && collector.includes('attributes/redact'));
check('no direct vendor export', policy.collection.direct_vendor_export_forbidden && !collector.match(/datadog|newrelic|splunk|honeycomb|dynatrace/i));
check('collector ingestion loopback only', collector.includes('endpoint: 127.0.0.1:4317') && collector.includes('endpoint: 127.0.0.1:4318'));
check('three alertmanagers', policy.alerting.alertmanager_replicas >= 3);
check('prometheus targets all alertmanagers', policy.alerting.prometheus_sends_to_all_alertmanagers && ['alertmanager-1','alertmanager-2','alertmanager-3'].every(x => prometheus.includes(x)));
check('no alertmanager load balancer', policy.alerting.load_balancer_between_prometheus_and_alertmanager === false);
check('two notification routes', policy.alerting.minimum_notification_routes >= 2);
check('deadman alert required', policy.alerting.deadman_alert_required === true);
check('signed daily manifest', policy.custody.signed_daily_evidence_manifest === true);
check('two backup copies', policy.custody.independent_backup_copies >= 2);
check('hosted dashboard not sole copy', policy.custody.hosted_dashboard_as_sole_copy_forbidden === true);
check('hosted alerting not sole authority', policy.custody.hosted_alerting_as_sole_authority_forbidden === true);
check('public ingestion forbidden', policy.security.public_ingest_forbidden === true);
check('workload identity required', policy.security.workload_identity_required === true);
check('secret telemetry forbidden', policy.security.secret_fields_in_telemetry_forbidden === true);
check('loss counter required', policy.failure.telemetry_loss_counter_required === true);
check('disk-full alert required', policy.failure.disk_full_alert_required === true);
check('single backend loss tolerated', policy.failure.single_backend_loss_tolerated === true);
check('prometheus remote write configured', prometheus.includes('remote_write:'));

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
const failed = checks.filter(c => !c.ok);
if (failed.length) {
  console.error(`REJECT ${failed.length} observability invariants failed`);
  process.exit(1);
}
console.log(`ACCEPT ${checks.length} observability invariants`);
