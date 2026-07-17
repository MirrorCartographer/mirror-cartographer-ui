#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const dir = path.dirname(new URL(import.meta.url).pathname);
const policy = JSON.parse(fs.readFileSync(path.join(dir, 'policy.json'), 'utf8'));
const script = fs.readFileSync(path.join(dir, 'deploy-blue-green.sh'), 'utf8');

const checks = [
  ['digest-only images required', policy.runtime.digest_only_images === true && policy.runtime.mutable_tags_allowed === false && /@sha256:\[0-9a-f\]\{64\}/.test(script)],
  ['rootless runtime required', policy.runtime.rootless_required === true],
  ['privileged execution forbidden', policy.runtime.privileged_containers_allowed === false && !/--privileged/.test(script)],
  ['read-only root filesystem', policy.runtime.read_only_root_filesystem_required === true && /--read-only/.test(script)],
  ['all capabilities dropped', policy.runtime.capabilities_drop_all_required === true && /--cap-drop=all/.test(script)],
  ['no-new-privileges enforced', policy.runtime.no_new_privileges_required === true && /no-new-privileges/.test(script)],
  ['application binds loopback only', policy.network.application_ports_loopback_only === true && /127\.0\.0\.1:\$\{PORT\}:8080/.test(script)],
  ['external admission command mandatory', policy.admission.release_envelope_required === true && /FOUNDATION_ADMISSION_CMD/.test(script)],
  ['runtime digest reverified', policy.admission.runtime_digest_match_required === true && /image inspect/.test(script) && /runtime digest mismatch/.test(script)],
  ['concurrent deployments locked out', policy.deployment.concurrent_deployments_allowed === false && /flock -n/.test(script)],
  ['candidate health precedes traffic switch', policy.deployment.candidate_must_be_healthy_before_switch === true && script.indexOf('candidate failed health admission') < script.indexOf('mv -Tf "$TMP_LINK" "$ROOT/active"')],
  ['active slot switch is atomic', policy.deployment.active_slot_pointer === 'atomic-symlink' && /mv -Tf/.test(script)],
  ['stabilization rollback exists', policy.deployment.automatic_rollback_on_stabilization_failure === true && /traffic restored to previous slot/.test(script)],
  ['rollback requires prior admission', policy.rollback.digest_must_have_prior_admission_record === true && /rollback target has no prior admission record/.test(script)],
  ['deployment journal required', policy.evidence.append_only_deployment_journal_required === true && />> "\$ROOT\/journal\/deployments\.tsv"/.test(script)],
  ['release worker cannot switch traffic', policy.admission.release_worker_may_switch_traffic === false],
  ['destructive same-release migrations forbidden', policy.rollback.destructive_schema_change_in_same_release_allowed === false]
];

let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures++;
}
if (failures) {
  console.error(`REJECT ${failures} deployment contract violation(s)`);
  process.exit(1);
}
console.log(`ACCEPT ${checks.length} deployment contract invariants`);
