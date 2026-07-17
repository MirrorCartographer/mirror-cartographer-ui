import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const basePolicy = JSON.parse(fs.readFileSync(path.join(here, 'policy.json')));
const baseInventory = JSON.parse(fs.readFileSync(path.join(here, 'inventory.json')));
const verifier = fs.readFileSync(path.join(here, 'verify-scaling-contract.mjs'), 'utf8');

function clone(value) { return structuredClone(value); }
function runCase(name, mutate, shouldPass = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaling-contract-'));
  const policy = clone(basePolicy);
  const inventory = clone(baseInventory);
  mutate?.(policy, inventory);
  fs.writeFileSync(path.join(dir, 'policy.json'), JSON.stringify(policy));
  fs.writeFileSync(path.join(dir, 'inventory.json'), JSON.stringify(inventory));
  fs.writeFileSync(path.join(dir, 'verify-scaling-contract.mjs'), verifier);
  const result = spawnSync(process.execPath, ['verify-scaling-contract.mjs'], { cwd: dir, encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  const passed = result.status === 0;
  if (passed !== shouldPass) throw new Error(`${name}: expected ${shouldPass ? 'accept' : 'reject'}; stdout=${result.stdout}; stderr=${result.stderr}`);
  console.log(`PASS ${name}`);
}

runCase('baseline', null, true);
runCase('reject-provider-authority', p => { p.authority.provider_autoscaling_authoritative = true; });
runCase('reject-nonexportable-state', p => { p.authority.desired_state_exportable = false; });
runCase('reject-one-operator', p => { p.authority.destructive_scale_actions_require_operators = 1; });
runCase('reject-one-replica', p => { p.workload.minimum_ready_replicas = 1; });
runCase('reject-unbounded-max', (p, i) => { i.workloads[0].max_replicas = null; });
runCase('reject-one-domain', (p, i) => { i.workloads[0].failure_domains = ['site-a']; });
runCase('reject-no-readiness', p => { p.workload.readiness_gates_required = false; });
runCase('reject-no-drain', p => { p.workload.graceful_drain_required = false; });
runCase('reject-one-signal', (p, i) => { i.workloads[0].signals = ['cpu_saturation']; });
runCase('reject-no-saturation', (p, i) => { i.workloads[0].signals = ['inflight_requests', 'p95_latency']; });
runCase('reject-no-backlog-age', (p, i) => { i.workloads[1].signals = ['consumer_saturation', 'cpu']; });
runCase('reject-stale-metrics', p => { p.signals.metrics_freshness_limit_seconds = 300; });
runCase('reject-missing-metric-scaledown', p => { p.signals.missing_metrics_fail_closed_for_scale_down = false; });
runCase('reject-provider-only-metric', p => { p.signals.provider_metric_sole_signal = true; });
runCase('reject-slow-scaleup', p => { p.control_loop.scale_up_max_delay_seconds = 120; });
runCase('reject-fast-scaledown', p => { p.control_loop.scale_down_stabilization_seconds = 30; });
runCase('reject-scale-to-zero-critical', p => { p.control_loop.scale_to_zero_for_critical_services = true; });
runCase('reject-no-headroom', p => { p.capacity.headroom_percent = 10; });
runCase('reject-no-load-shedding', p => { p.capacity.load_shedding_required = false; });
runCase('reject-unbounded-queues', p => { p.capacity.bounded_queues_required = false; });
runCase('reject-late-capacity-alert', p => { p.capacity.capacity_exhaustion_alert_percent = 95; });
runCase('reject-no-downstream-budget', (p, i) => { i.workloads[0].downstream_budgets = {}; });
runCase('reject-no-failure-test', (p, i) => { i.evidence.failure_domain_loss = false; });
runCase('reject-unsigned-evidence', (p, i) => { i.evidence.signed = false; });
runCase('reject-provider-dependent-scale', (p, i) => { i.evidence.provider_outage_scale_path = false; });
runCase('reject-dns-dependent-manual-scale', (p, i) => { i.evidence.dns_independent_manual_scale = false; });
console.log('PASS adversarial scaling controls');
