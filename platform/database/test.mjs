import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const policy = JSON.parse(fs.readFileSync(path.join(root, 'policy.json')));
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'inventory.json')));
const verifier = path.join(root, 'verify-database-contract.mjs');
const clone = x => JSON.parse(JSON.stringify(x));
const cases = [
 ['reject-provider-authority', x => x.authority.provider_authoritative = true],
 ['reject-provider-election', x => x.authority.primary_election = 'managed-service'],
 ['reject-two-nodes', x => x.nodes.pop()],
 ['reject-one-domain', x => x.nodes.forEach(n => n.failure_domain = 'site-a')],
 ['reject-ephemeral-node', x => x.nodes[0].persistent = false],
 ['reject-no-sync-standby', x => x.replication.synchronous_standbys = 0],
 ['reject-no-fencing', x => x.replication.fencing = ''],
 ['reject-multi-writer', x => x.replication.single_writer = false],
 ['reject-rpo-breach', x => x.replication.measured_rpo_seconds = 31],
 ['reject-failover-breach', x => x.replication.measured_failover_seconds = 121],
 ['reject-no-checksums', x => {x.replication.data_checksums=false; x.replication.full_page_writes=false;}],
 ['reject-no-wal-archive', x => x.replication.wal_archive = false],
 ['reject-unbounded-slot', x => x.replication.replication_slots_bounded = false],
 ['reject-low-disk-headroom', x => x.replication.disk_headroom_percent = 10],
 ['reject-mutable-migrations', x => x.migrations.immutable_ids = false],
 ['reject-no-expand-contract', x => x.migrations.expand_contract = false],
 ['reject-one-schema-operator', x => x.migrations.destructive_change_operators = 1],
 ['reject-no-compat-tests', x => x.migrations.compatibility_tests = false],
 ['reject-no-upgrade-check', x => x.upgrades.pg_upgrade_check = false],
 ['reject-link-first-upgrade', x => x.upgrades.mode = 'link'],
 ['reject-no-logical-exit', x => x.upgrades.logical_replication_exit = false],
 ['reject-no-sequence-reconcile', x => x.upgrades.sequence_reconciliation = false],
 ['reject-no-rewind', x => x.recovery.pg_rewind = false],
 ['reject-stale-restore', x => x.recovery.clean_host_restore_age_days = 31],
 ['reject-dns-only-admin', x => x.recovery.dns_independent_admin = false],
 ['reject-app-superuser', x => x.security.application_superuser = true],
 ['reject-unsigned-evidence', x => x.evidence.signed = false],
 ['reject-no-lsn-evidence', x => x.evidence.timeline_and_lsn = false]
];
function run(inv) {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'db-contract-'));
 const pp = path.join(d, 'p.json'); const ip = path.join(d, 'i.json');
 fs.writeFileSync(pp, JSON.stringify(policy)); fs.writeFileSync(ip, JSON.stringify(inv));
 return spawnSync(process.execPath, [verifier, pp, ip], {encoding:'utf8'});
}
let r = run(baseline); if (r.status !== 0) throw new Error(`baseline failed: ${r.stderr}${r.stdout}`); console.log('PASS baseline');
for (const [name, mutate] of cases) { const x=clone(baseline); mutate(x); r=run(x); if (r.status===0) throw new Error(`${name} falsely accepted`); console.log(`PASS ${name}`); }
console.log('PASS adversarial database controls');
