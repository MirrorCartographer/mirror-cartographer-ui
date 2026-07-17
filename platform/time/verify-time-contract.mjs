import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(fs.readFileSync(process.argv[2] || path.join(here, 'policy.json'), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(process.argv[3] || path.join(here, 'inventory.json'), 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const uniq = values => new Set(values).size;

check(policy.authority.canonical_policy === 'project-repository', 'time policy must be project authoritative');
check(policy.authority.provider_time_authoritative === false, 'provider time must not be authoritative');
check(policy.authority.exportable === true, 'time desired state must be exportable');
check(policy.authority.two_operator_policy_changes === true, 'production time policy changes require two operators');

const sources = inventory.sources || [];
check(sources.length >= policy.sources.minimum_total, 'insufficient total time sources');
check(uniq(sources.map(s => s.operator)) >= policy.sources.minimum_independent_operators, 'insufficient independent source operators');
check(uniq(sources.filter(s => s.path !== 'local').map(s => s.path)) >= policy.sources.minimum_network_paths, 'insufficient independent network paths');
check(sources.filter(s => s.authenticated === 'nts').length >= policy.sources.nts_sources, 'insufficient NTS-authenticated sources');
check(sources.filter(s => s.authenticated === 'none').length <= policy.sources.unauthenticated_sources_max, 'too many unauthenticated sources');
check(sources.some(s => s.kind === 'holdover') === policy.sources.local_holdover_source, 'local holdover source required');
check(policy.sources.public_pool_sole_source === false, 'public pool cannot be sole time source');

const servers = inventory.internal_servers || [];
check(servers.length >= policy.servers.minimum_internal_servers, 'insufficient internal time servers');
check(uniq(servers.map(s => s.failure_domain)) >= policy.servers.failure_domains, 'insufficient time-server failure domains');
check(policy.servers.orphan_mode === true, 'internal orphan/holdover election mode required');
check(policy.servers.clients_use_internal_servers === true, 'clients must use project internal time servers');
check(policy.servers.clients_contact_public_ntp === false, 'ordinary clients must not contact public NTP directly');

check(policy.discipline.runtime_backward_step === false, 'runtime backward stepping forbidden');
check(policy.discipline.quarantine_on_excess_offset === true, 'excess offset must quarantine host');
check(policy.discipline.quarantine_on_no_majority === true, 'lack of source majority must quarantine host');
check(inventory.observed.normal_offset_ms <= policy.discipline.maximum_normal_offset_ms, 'observed offset exceeds policy');
check(inventory.observed.root_distance_ms <= policy.discipline.maximum_root_distance_ms, 'root distance exceeds policy');
check(inventory.observed.frequency_error_ppm <= policy.discipline.maximum_frequency_error_ppm, 'frequency error exceeds policy');
check(inventory.observed.holdover_test_hours >= policy.discipline.holdover_max_hours, 'holdover objective not demonstrated');
check(inventory.observed.majority_available === true, 'source majority unavailable');

check(policy.application.durations_use_monotonic_clock === true, 'durations must use monotonic clocks');
check(policy.application.wall_clock_used_for_expiry_only_with_uncertainty === true, 'expiry checks must account for uncertainty');
check(policy.application.signed_evidence_records_time_uncertainty === true, 'signed evidence must record time uncertainty');
check(policy.application.database_ordering_not_derived_from_wall_clock === true, 'database ordering must not derive from wall clock');
check(policy.application.lease_safety_accounts_for_clock_error === true, 'leases must include clock-error budget');

check(policy.security.nts_required === true, 'NTS required');
check(Number(policy.security.nts_tls_minimum) >= 1.3, 'NTS requires TLS 1.3 or newer');
check(policy.security.time_service_no_release_keys === true, 'time service must not hold release keys');
check(policy.security.default_deny_network === true, 'time-service networking must be default deny');
check(policy.security.time_change_audited === true, 'time changes must be audited');
check(policy.security.manual_step_two_operators === true, 'manual time steps require two operators');

check(policy.continuity.boot_without_public_dns === true && inventory.observed.boot_without_public_dns === true, 'boot must work without public DNS');
check(policy.continuity.boot_without_internet === true && inventory.observed.boot_without_internet === true, 'boot must work without internet');
check(policy.continuity.cached_trust_material === true, 'NTS trust material must be cached');
check(policy.continuity.rtc_seed === true, 'RTC seed required');
check(policy.continuity.offline_time_recovery_procedure === true, 'offline time recovery procedure required');
check(inventory.observed.restore_age_days <= policy.continuity.clean_host_restore_days, 'time-plane restore evidence is stale');

for (const [key, value] of Object.entries(policy.evidence)) {
  if (key === 'operator_signatures') continue;
  check(value === true, `evidence requirement ${key} must be enabled`);
}
check(inventory.observed.signed === true, 'time evidence must be signed');
check(inventory.observed.operator_signatures >= policy.evidence.operator_signatures, 'insufficient evidence signatures');

if (failures.length) {
  console.error(`REJECT ${failures.length} time invariants`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('ACCEPT 44 time invariants');
