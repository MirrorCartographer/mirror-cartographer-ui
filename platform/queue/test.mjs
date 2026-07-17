import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const policy = JSON.parse(fs.readFileSync(path.join(root, 'policy.json'), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'inventory.json'), 'utf8'));
const verifier = path.join(root, 'verify-queue-contract.mjs');

const cases = [
  ['baseline', () => {}, true],
  ['reject-hosted-authority', x => { x.inventory.provider_authoritative = true; }],
  ['reject-no-confirms', x => { x.inventory.publisher_confirms = false; }],
  ['reject-auto-ack', x => { x.inventory.manual_consumer_ack = false; }],
  ['reject-ack-before-commit', x => { x.inventory.ack_after_commit = false; }],
  ['reject-no-outbox', x => { x.inventory.transactional_outbox = false; }],
  ['reject-no-idempotency', x => { x.inventory.idempotency_store = ''; }],
  ['reject-two-replicas', x => { x.inventory.nodes.pop(); x.inventory.replication_factor = 2; }],
  ['reject-one-domain', x => { x.inventory.nodes.forEach(n => n.failure_domain = 'site-a'); }],
  ['reject-no-quorum', x => { x.inventory.quorum_commit = false; }],
  ['reject-no-fsync', x => { x.inventory.fsync_or_equivalent = false; }],
  ['reject-unbounded-queue', x => { x.inventory.queue_limits.bounded_bytes = false; }],
  ['reject-discard-old', x => { x.inventory.queue_limits.discard_policy = 'discard-old'; }],
  ['reject-no-backpressure', x => { x.inventory.queue_limits.producer_backpressure = false; }],
  ['reject-unbounded-prefetch', x => { x.inventory.queue_limits.prefetch_bounded = false; }],
  ['reject-infinite-retry', x => { x.inventory.retry.max_attempts = 999999; }],
  ['reject-no-jitter', x => { x.inventory.retry.jitter = false; }],
  ['reject-no-dead-letter', x => { x.inventory.dead_letter.enabled = false; }],
  ['reject-lossy-dead-letter', x => { x.inventory.dead_letter.transfer_semantics = 'at-most-once'; }],
  ['reject-short-poison-retention', x => { x.inventory.dead_letter.retention_days = 1; }],
  ['reject-no-portable-export', x => { x.inventory.exports.stream = false; }],
  ['reject-no-offline-copy', x => { x.inventory.exports.offline_copy = false; }],
  ['reject-one-backup-domain', x => { x.inventory.backups.forEach(b => b.failure_domain = 'site-a'); }],
  ['reject-stale-restore', x => { x.inventory.restore_evidence.age_days = 31; }],
  ['reject-unsigned-restore', x => { x.inventory.restore_evidence.signed = false; }],
  ['reject-payload-secrets', x => { x.inventory.security.payload_secrets = true; }],
  ['reject-no-schema-window', x => { x.inventory.schema.backward_compatible_window = false; }],
  ['reject-no-lag-metric', x => { x.inventory.metrics.lag = false; }],
  ['reject-one-replay-operator', x => { x.inventory.destructive_replay.minimum_operators = 1; }]
];

for (const [name, mutate, shouldPass = false] of cases) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-contract-'));
  const state = {policy: structuredClone(policy), inventory: structuredClone(inventory)};
  mutate(state);
  const pp = path.join(dir, 'policy.json');
  const ip = path.join(dir, 'inventory.json');
  fs.writeFileSync(pp, JSON.stringify(state.policy, null, 2));
  fs.writeFileSync(ip, JSON.stringify(state.inventory, null, 2));
  const result = spawnSync(process.execPath, [verifier, pp, ip], {encoding:'utf8'});
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    console.error(`FAIL ${name}\n${result.stdout}${result.stderr}`);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
console.log('PASS adversarial queue controls');
