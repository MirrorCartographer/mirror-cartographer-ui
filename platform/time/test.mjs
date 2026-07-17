import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const basePolicy = JSON.parse(fs.readFileSync(path.join(here, 'policy.json')));
const baseInventory = JSON.parse(fs.readFileSync(path.join(here, 'inventory.json')));
const clone = value => JSON.parse(JSON.stringify(value));

const cases = [
  ['baseline', () => {}, true],
  ['reject-provider-authority', p => { p.authority.provider_time_authoritative = true; }],
  ['reject-one-operator', p => { p.authority.two_operator_policy_changes = false; }],
  ['reject-two-sources', (_p, i) => { i.sources = i.sources.slice(0, 2); }],
  ['reject-one-source-operator', (_p, i) => { i.sources.forEach(s => { s.operator = 'one'; }); }],
  ['reject-one-network-path', (_p, i) => { i.sources.filter(s => s.path !== 'local').forEach(s => { s.path = 'isp-a'; }); }],
  ['reject-no-nts', (_p, i) => { i.sources.forEach(s => { if (s.kind === 'network') s.authenticated = 'none'; }); }],
  ['reject-no-holdover', (_p, i) => { i.sources = i.sources.filter(s => s.kind !== 'holdover'); }],
  ['reject-two-internal-servers', (_p, i) => { i.internal_servers.pop(); }],
  ['reject-one-server-domain', (_p, i) => { i.internal_servers.forEach(s => { s.failure_domain = 'site-a'; }); }],
  ['reject-public-client-ntp', p => { p.servers.clients_contact_public_ntp = true; }],
  ['reject-backward-step', p => { p.discipline.runtime_backward_step = true; }],
  ['reject-large-offset', (_p, i) => { i.observed.normal_offset_ms = 500; }],
  ['reject-large-root-distance', (_p, i) => { i.observed.root_distance_ms = 2000; }],
  ['reject-no-majority', (_p, i) => { i.observed.majority_available = false; }],
  ['reject-short-holdover', (_p, i) => { i.observed.holdover_test_hours = 2; }],
  ['reject-wall-clock-durations', p => { p.application.durations_use_monotonic_clock = false; }],
  ['reject-clock-derived-ordering', p => { p.application.database_ordering_not_derived_from_wall_clock = false; }],
  ['reject-no-uncertainty', p => { p.application.signed_evidence_records_time_uncertainty = false; }],
  ['reject-old-tls', p => { p.security.nts_tls_minimum = '1.2'; }],
  ['reject-release-key-on-time-host', p => { p.security.time_service_no_release_keys = false; }],
  ['reject-one-person-step', p => { p.security.manual_step_two_operators = false; }],
  ['reject-internet-required', p => { p.continuity.boot_without_internet = false; }],
  ['reject-dns-required', (_p, i) => { i.observed.boot_without_public_dns = false; }],
  ['reject-stale-restore', (_p, i) => { i.observed.restore_age_days = 31; }],
  ['reject-unsigned-evidence', (_p, i) => { i.observed.signed = false; }]
];

for (const [name, mutate, shouldPass = false] of cases) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'time-contract-'));
  const policy = clone(basePolicy);
  const inventory = clone(baseInventory);
  mutate(policy, inventory);
  const policyPath = path.join(dir, 'policy.json');
  const inventoryPath = path.join(dir, 'inventory.json');
  fs.writeFileSync(policyPath, JSON.stringify(policy));
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory));
  const result = spawnSync(process.execPath, [path.join(here, 'verify-time-contract.mjs'), policyPath, inventoryPath], { encoding: 'utf8' });
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    console.error(`FAIL ${name}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
console.log('PASS adversarial time controls');
