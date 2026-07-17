import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(fs.readFileSync(path.join(here, 'policy.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(here, 'inventory.json'), 'utf8'));
const verifier = path.join(here, 'verify-observability-contract.mjs');
const clone = value => JSON.parse(JSON.stringify(value));
const cases = [
 ['hosted-authority', p => p.authority.provider_observability_authoritative = true, null],
 ['one-gateway', null, i => i.collectors = i.collectors.filter(c => c.id !== 'gateway-b')],
 ['one-gateway-domain', null, i => i.collectors.filter(c => c.role === 'gateway').forEach(c => c.failure_domain = 'site-a')],
 ['memory-only-buffer', null, i => i.collectors[0].disk_buffer = false],
 ['short-buffer', null, i => i.collectors[0].buffer_minutes = 5],
 ['hidden-drops', null, i => i.observed.telemetry_drop_visible = false],
 ['vendor-sdk', p => p.collection.direct_vendor_sdk_forbidden = false, null],
 ['one-scraper', null, i => i.scrapers.pop()],
 ['no-metric-wal', null, i => i.scrapers[0].wal = false],
 ['one-metric-copy', null, i => i.metric_copies.pop()],
 ['no-cardinality-budget', null, i => i.observed.cardinality_budget_enforced = false],
 ['no-missing-data-alert', null, i => i.observed.missing_data_alerts = false],
 ['high-cardinality-labels', p => p.logs.high_cardinality_labels_forbidden = false, null],
 ['two-log-copies', null, i => i.log_copies.pop()],
 ['no-immutable-log-copy', null, i => i.log_copies.forEach(c => c.immutable = false)],
 ['no-wal-corruption-alert', null, i => i.observed.wal_corruption_alert = false],
 ['no-wal-full-alert', null, i => i.observed.wal_disk_full_alert = false],
 ['tail-sampling-no-affinity', p => p.traces.tail_sampling_requires_trace_affinity = false, null],
 ['one-evaluator', null, i => i.evaluators.pop()],
 ['two-alertmanagers', null, i => i.alertmanagers.pop()],
 ['loadbalanced-alertmanager', p => p.alerting.load_balancer_between_evaluator_and_alertmanager = true, null],
 ['one-notification-path', null, i => i.notification_paths.pop()],
 ['deadman-missing', null, i => i.observed.external_deadman_received = false],
 ['same-meta-monitor', null, i => i.observed.meta_monitor_separate = false],
 ['provider-outage-blind', null, i => i.observed.provider_outage_visible = false],
 ['dns-dependent-admin', null, i => i.observed.boot_without_public_dns = false],
 ['stale-restore', null, i => i.observed.restore_age_days = 90],
 ['same-implementation-only', null, i => i.observed.cross_implementation_restore = false],
 ['release-key-present', p => p.security.release_keys_forbidden = false, null],
 ['unsigned-evidence', null, i => i.observed.signed = false]
];
const run = (p, i) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-contract-'));
  const pp = path.join(dir, 'policy.json'); const ip = path.join(dir, 'inventory.json');
  fs.writeFileSync(pp, JSON.stringify(p)); fs.writeFileSync(ip, JSON.stringify(i));
  return spawnSync(process.execPath, [verifier, pp, ip], {encoding:'utf8'});
};
const base = run(policy, baseline);
if (base.status !== 0) { console.error(base.stderr); process.exit(1); }
console.log('PASS baseline');
for (const [name, mutatePolicy, mutateInventory] of cases) {
  const p = clone(policy); const i = clone(baseline);
  mutatePolicy?.(p); mutateInventory?.(i);
  const result = run(p, i);
  if (result.status === 0) { console.error(`FAIL accepted ${name}`); process.exit(1); }
  console.log(`PASS reject-${name}`);
}
console.log('PASS adversarial observability controls');
