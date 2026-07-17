import fs from 'node:fs';

const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) {
  console.error('usage: node verify-queue-contract.mjs <policy.json> <inventory.json>');
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const i = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const checks = [];
const requireCheck = (name, ok) => checks.push({name, ok: Boolean(ok)});
const domains = new Set((i.nodes || []).map(n => n.failure_domain));
const backupDomains = new Set((i.backups || []).map(b => b.failure_domain));

requireCheck('project owns canonical topology', p.authority.canonical_topology_owned_by_project && !i.provider_authoritative);
requireCheck('broker is replaceable', p.authority.broker_is_replaceable_mechanism);
requireCheck('at-least-once floor', p.delivery.minimum_semantics === 'at-least-once');
requireCheck('publisher confirmations', p.delivery.publisher_confirmation_required && i.publisher_confirms);
requireCheck('manual acknowledgements', p.delivery.manual_consumer_ack_required && i.manual_consumer_ack);
requireCheck('ack occurs after committed side effects', p.delivery.ack_after_side_effect_commit && i.ack_after_commit);
requireCheck('transactional outbox', p.delivery.transactional_outbox_required && i.transactional_outbox);
requireCheck('distributed 2PC not required', !p.delivery.distributed_2pc_required && !i.distributed_2pc);
requireCheck('idempotent consumer store', p.delivery.idempotency_required && typeof i.idempotency_store === 'string' && i.idempotency_store.length > 0);
requireCheck('three durable replicas', i.nodes?.length >= p.durability.minimum_replicas && i.replication_factor >= p.durability.minimum_replicas && i.nodes.every(n => n.persistent));
requireCheck('three failure domains', domains.size >= p.durability.minimum_failure_domains);
requireCheck('quorum commit', p.durability.quorum_commit_required && i.quorum_commit);
requireCheck('durable flush', p.durability.fsync_or_equivalent_required && i.fsync_or_equivalent);
requireCheck('bounded queue', p.flow_control.bounded_queue_bytes && i.queue_limits.bounded_bytes);
requireCheck('reject new on saturation', p.flow_control.discard_policy === 'reject-new' && i.queue_limits.discard_policy === 'reject-new');
requireCheck('producer backpressure', p.flow_control.producer_backpressure_required && i.queue_limits.producer_backpressure);
requireCheck('bounded prefetch', p.flow_control.consumer_prefetch_bounded && i.queue_limits.prefetch_bounded);
requireCheck('capacity alerts', p.flow_control.capacity_alerting_required && i.queue_limits.capacity_alerting);
requireCheck('bounded retry with jitter', i.retry.max_attempts <= p.failure_handling.maximum_delivery_attempts && i.retry.max_attempts > 0 && i.retry.jitter);
requireCheck('dead-letter custody', p.failure_handling.dead_letter_required && i.dead_letter.enabled && i.dead_letter.transfer_semantics === 'at-least-once');
requireCheck('poison retention', i.dead_letter.retention_days >= p.failure_handling.poison_message_retention_days);
requireCheck('audited replay', p.failure_handling.operator_replay_audited && i.dead_letter.audited_replay);
requireCheck('portable exports', p.custody.stream_export_required && p.custody.configuration_export_required && i.exports.stream && i.exports.configuration && i.exports.format === 'broker-neutral-envelope-v1');
requireCheck('offline recovery copy', p.custody.offline_recovery_copy_required && i.exports.offline_copy);
requireCheck('three backups across two domains', i.backups?.length >= p.custody.minimum_backup_copies && backupDomains.size >= p.custody.minimum_backup_failure_domains);
requireCheck('fresh signed clean-host restore', i.restore_evidence.signed && i.restore_evidence.clean_host && i.restore_evidence.replay_verified && i.restore_evidence.age_days <= p.custody.restore_drill_max_age_days);
requireCheck('transport and workload identity', p.security.tls_required && i.security.tls && p.security.workload_identity_required && i.security.workload_identity);
requireCheck('default deny tenant isolation', i.security.default_deny && i.security.tenant_isolation);
requireCheck('no secrets in payloads', p.security.payload_secrets_forbidden && !i.security.payload_secrets);
requireCheck('auditing', p.security.audit_log_required && i.security.audit_log);
requireCheck('versioned compatible schemas', i.schema.versioned && i.schema.backward_compatible_window);
requireCheck('lag redelivery and age metrics', i.metrics.lag && i.metrics.redelivery && i.metrics.oldest_message_age);
requireCheck('two-operator destructive replay', i.destructive_replay.minimum_operators >= 2);

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
if (failed.length) {
  console.error(`REJECT ${failed.length}/${checks.length} queue invariants failed`);
  process.exit(1);
}
console.log(`ACCEPT ${checks.length} queue invariants`);
