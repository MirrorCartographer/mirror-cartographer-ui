#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const base = path.dirname(new URL(import.meta.url).pathname);
const policyPath = process.argv[2] || path.join(base, 'policy.json');
const caddyPath = process.argv[3] || path.join(base, 'Caddyfile');
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const caddy = fs.readFileSync(caddyPath, 'utf8');

const checks = [
  ['only 80/443 public', JSON.stringify(policy.public_ingress.only_public_ports) === '[80,443]'],
  ['applications loopback-only', policy.public_ingress.application_bind === '127.0.0.1' && /reverse_proxy 127\.0\.0\.1:/.test(caddy)],
  ['proxy admin loopback-only', /admin 127\.0\.0\.1:2019/.test(caddy)],
  ['config validation required', policy.public_ingress.config_validation_required === true],
  ['atomic reload required', policy.public_ingress.atomic_reload_required === true],
  ['post-reload ingress probe required', policy.public_ingress.post_reload_ingress_probe_required === true],
  ['two ingress cells required', policy.public_ingress.minimum_ingress_cells >= 2],
  ['on-demand TLS prohibited', policy.tls.on_demand_tls === false && !/on_demand/.test(caddy)],
  ['certificate lifetime alert window', policy.tls.renewal_failure_alert_hours >= 336],
  ['two issuers required', policy.tls.minimum_issuers >= 2],
  ['CA not sole recovery path', policy.tls.public_ca_is_sole_recovery_path === false],
  ['independent key backup required', policy.tls.independent_private_key_backup === true],
  ['two DNS authorities required', policy.dns.minimum_authoritative_providers >= 2],
  ['project zone manifest authoritative', policy.dns.zone_source_of_truth === 'project-owned-zone-manifest'],
  ['registrar not zone authority', policy.dns.registrar_is_zone_authority === false],
  ['DNS export required', policy.dns.provider_export_required === true],
  ['DNS probes required', policy.dns.authoritative_and_recursive_probes_required === true],
  ['old proxy config preserved', policy.failure_containment.proxy_reload_failure_preserves_old_config === true],
  ['existing cert survives renewal failure', policy.failure_containment.certificate_renewal_failure_preserves_existing_cert === true],
  ['single ingress loss tolerated', policy.failure_containment.single_ingress_host_loss_tolerated === true],
  ['single DNS provider loss tolerated', policy.failure_containment.single_dns_provider_loss_tolerated === true],
  ['active health checks configured', /health_uri \/health\/ready/.test(caddy) && /health_fails 3/.test(caddy)],
  ['security headers configured', /Strict-Transport-Security/.test(caddy) && /X-Content-Type-Options/.test(caddy)],
  ['signed evidence required', policy.evidence.signed_zone_manifest === true && policy.evidence.proxy_config_digest === true && policy.evidence.certificate_inventory_digest === true]
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`REJECT ${failed} ingress invariant(s) failed`);
  process.exit(1);
}
console.log(`ACCEPT ${checks.length} ingress invariants`);
