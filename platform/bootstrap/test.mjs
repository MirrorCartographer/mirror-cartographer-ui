import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const originalPolicy = JSON.parse(fs.readFileSync(path.join(dir, 'policy.json'), 'utf8'));
const originalInventory = JSON.parse(fs.readFileSync(path.join(dir, 'inventory.json'), 'utf8'));
const cases = [
  ['provider-authority', p => p.authority.provider_userdata_authoritative = true], ['nonexportable-state', p => p.authority.exportable = false],
  ['one-operator-change', p => p.authority.two_operator_production_changes = false], ['provider-machine-id', p => p.machine_identity.provider_instance_id_authoritative = true],
  ['tpm-sole-recovery', p => p.machine_identity.tpm_optional_not_sole_recovery = false], ['repeat-bootstrap', p => p.bootstrap.first_boot_only = false],
  ['network-required', p => p.bootstrap.network_optional = false], ['dns-required', p => p.bootstrap.public_dns_required = true],
  ['metadata-required', p => p.bootstrap.metadata_service_required = true], ['unsigned-config', p => p.bootstrap.signed_configuration = false],
  ['embedded-secret', p => p.bootstrap.secrets_embedded = true], ['floating-os', p => p.operating_system.image_digest_pinned = false],
  ['unmirrored-os', p => p.operating_system.image_mirrored = false], ['no-verified-boot', p => p.operating_system.verified_boot_required = false],
  ['mutable-root', p => p.operating_system.immutable_or_transactional_root = false], ['no-ab-rollback', p => p.operating_system.ab_updates = false],
  ['late-patching', p => p.operating_system.security_update_sla_days = 31], ['imperative-config', p => p.configuration.declarative = false],
  ['no-drift-detection', p => p.configuration.drift_detection = false], ['boot-package-install', p => p.configuration.package_install_during_boot = true],
  ['remote-script', p => p.configuration.arbitrary_remote_scripts = true], ['password-ssh', p => p.access.ssh_password_auth = true],
  ['no-oob', p => p.access.out_of_band_path = false], ['one-reimage-operator', p => p.access.two_operator_destructive_reimage = false],
  ['stale-rebuild', p => p.recovery.clean_host_rebuild_days = 90], ['same-hardware-only', p => p.recovery.different_hardware_verified = false],
  ['provider-only-rebuild', p => p.recovery.provider_independent_path = false], ['no-offline-image', p => p.recovery.offline_image_copy = false],
  ['one-key-copy', p => p.recovery.bootstrap_key_copies = 1], ['missing-boot-evidence', p => p.evidence.boot_measurements = false]
];
function run(policy, inventory = originalInventory) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-test-'));
  fs.copyFileSync(path.join(dir, 'verify-bootstrap-contract.mjs'), path.join(tmp, 'verify-bootstrap-contract.mjs'));
  fs.writeFileSync(path.join(tmp, 'policy.json'), JSON.stringify(policy, null, 2));
  fs.writeFileSync(path.join(tmp, 'inventory.json'), JSON.stringify(inventory, null, 2));
  return spawnSync(process.execPath, [path.join(tmp, 'verify-bootstrap-contract.mjs')], { encoding: 'utf8' });
}
let result = run(originalPolicy);
if (result.status !== 0) throw new Error(result.stderr || result.stdout);
console.log('PASS baseline');
for (const [name, mutate] of cases) {
  const candidate = structuredClone(originalPolicy); mutate(candidate); result = run(candidate);
  if (result.status === 0) throw new Error(`FALSE ACCEPT ${name}`);
  console.log(`PASS reject-${name}`);
}
console.log('PASS adversarial bootstrap controls');
