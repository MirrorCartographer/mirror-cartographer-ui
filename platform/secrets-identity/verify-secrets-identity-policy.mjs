#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2] || path.join(import.meta.dirname, 'policy.json');
const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
const failures = [];
const pass = (name, ok, detail='') => {
  if (ok) console.log(`PASS ${name}`);
  else { failures.push(name); console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`); }
};

pass('schema is recognized', policy.schema === 'foundation.secrets-identity.policy.v1');
pass('root uses threshold recovery', Number.isInteger(policy.root_recovery?.threshold) && policy.root_recovery.threshold >= 2);
pass('root has more shares than threshold', policy.root_recovery?.shares > policy.root_recovery?.threshold);
pass('root key is not continuously online', policy.root_recovery?.online_root_key === false);
pass('recovery crosses failure domains', policy.root_recovery?.independent_failure_domains >= 2);
pass('SPIFFE/SPIRE is workload identity authority', policy.workload_identity?.provider === 'spiffe-spire');
pass('Workload API is host-local', policy.workload_identity?.workload_api_transport === 'unix');
pass('workload credentials are short lived', policy.workload_identity?.max_svid_ttl_seconds <= 3600);
pass('static workload tokens are forbidden', policy.workload_identity?.static_tokens_allowed === false);
pass('workload identity requires selector binding', policy.workload_identity?.selector_binding_required === true);
pass('OpenBao is secret broker', policy.secret_broker?.provider === 'openbao');
pass('secret storage is project-operated Raft', policy.secret_broker?.storage === 'integrated-raft');
pass('secret broker has quorum-capable HA', policy.secret_broker?.high_availability_nodes >= 3 && policy.secret_broker.high_availability_nodes % 2 === 1);
pass('two independent audit devices required', policy.secret_broker?.audit_devices_minimum >= 2);
pass('default secret lease is short lived', policy.secret_broker?.default_lease_ttl_seconds <= 900);
pass('maximum secret lease is bounded', policy.secret_broker?.maximum_lease_ttl_seconds <= 3600);
pass('KV v2 is required', policy.secret_broker?.kv_version === 2);
pass('KV check-and-set is required', policy.secret_broker?.kv_cas_required === true);
pass('bootstrap uses single-use wrapping', policy.secret_broker?.response_wrapping_required_for_bootstrap === true);
pass('plaintext secret files are forbidden', policy.deployment?.plaintext_secret_files_allowed === false);
pass('environment injection is forbidden', policy.deployment?.environment_secret_injection_allowed === false);
pass('release workers cannot read production secrets', policy.deployment?.release_worker_may_read_production_secrets === false);
pass('artifacts cannot contain secret material', policy.deployment?.secret_material_in_artifacts_allowed === false);
pass('break-glass access is bounded', policy.deployment?.break_glass_ttl_seconds <= 900);
pass('multiple offline root copies exist', policy.recovery?.offline_root_bundle_copies >= 3);
pass('clean-host recovery is mandatory', policy.recovery?.requires_clean_host_restore === true);
pass('restore is exercised at least quarterly', policy.recovery?.restore_test_interval_days <= 90);
pass('revocation is exercised monthly', policy.recovery?.revocation_test_interval_days <= 30);

if (failures.length) {
  console.error(`REJECT ${failures.length} invariant(s) failed`);
  process.exit(1);
}
console.log('ACCEPT secrets and identity policy');
