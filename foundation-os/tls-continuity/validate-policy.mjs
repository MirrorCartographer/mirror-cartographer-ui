#!/usr/bin/env node
import fs from 'node:fs';

const policy = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const failures = [];
const requireRule = (condition, name) => { if (!condition) failures.push(name); };

requireRule(policy.authority?.policy_owner === 'foundation', 'policy_owner');
requireRule(policy.authority?.internal_ca === 'foundation', 'internal_ca');
requireRule(policy.authority?.public_ca_role === 'replaceable-commodity', 'public_ca_role');
requireRule(policy.pki?.offline_root === true, 'offline_root');
requireRule(policy.pki?.online_intermediate === true, 'online_intermediate');
requireRule(['2-of-3', '3-of-5'].includes(policy.pki?.root_threshold), 'root_threshold');
requireRule(policy.pki?.max_internal_leaf_hours <= 24, 'internal_leaf_lifetime');
requireRule(policy.pki?.root_backups >= 3, 'root_backups');
requireRule(policy.pki?.root_failure_domains >= 2, 'root_failure_domains');
requireRule(policy.issuance?.internal_protocol === 'ACME', 'internal_acme');
requireRule(policy.issuance?.automatic_renewal === true, 'automatic_renewal');
requireRule(policy.issuance?.wildcards_require === 'dns-01', 'wildcard_dns01');
requireRule(policy.dns?.canonical_zone_export === true, 'zone_export');
requireRule(policy.dns?.provider_count >= 2, 'dns_provider_count');
requireRule(policy.dns?.credential_scope === 'zone-limited', 'dns_scope');
requireRule(policy.dns?.credential_max_hours <= 1, 'dns_lifetime');
requireRule(policy.serving?.certificate_storage_replication >= 2, 'certificate_replication');
requireRule(policy.serving?.atomic_reload === true, 'atomic_reload');
requireRule(policy.serving?.expired_certificate_blocks_deploy === true, 'expiry_gate');
requireRule(policy.serving?.clock_monitoring === true, 'clock_monitoring');
requireRule(policy.recovery?.independent_certificate_path === true, 'independent_path');
requireRule(policy.recovery?.second_operator_restore === true, 'second_operator');
requireRule(policy.recovery?.quarterly_ca_restore_drill === true, 'ca_restore_drill');
requireRule(policy.recovery?.monthly_public_ca_failover_drill === true, 'public_ca_failover');
requireRule(policy.recovery?.dns_provider_replacement_test === true, 'dns_replacement');

if (failures.length) {
  console.error('REJECT');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('ACCEPT');
