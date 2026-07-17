#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here, "policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here, "inventory.json"), "utf8"));
const verifier = path.join(here, "verify-network-contract.mjs");

const mutations = [
  ["reject-provider-lb-authority", x => x.authority.provider_load_balancer_authoritative = true],
  ["reject-provider-tls-authority", x => x.authority.provider_tls_authoritative = true],
  ["reject-dns-authority", x => x.authority.dns_provider_authoritative = true],
  ["reject-fixed-proxy", x => x.authority.adapter_replaceable = false],
  ["reject-one-ingress", x => x.ingress.nodes = x.ingress.nodes.slice(0, 1)],
  ["reject-one-domain", x => x.ingress.nodes.forEach(n => n.domain = "site-a")],
  ["reject-no-drain", x => x.ingress.connection_draining = false],
  ["reject-nonatomic-config", x => x.ingress.atomic_activation = false],
  ["reject-no-last-good", x => x.ingress.last_known_good = false],
  ["reject-public-runtime-socket", x => x.ingress.runtime_socket_public = true],
  ["reject-unknown-hosts", x => x.routing.default_deny_unknown_hosts = false],
  ["reject-no-upstream-mtls", x => x.routing.upstream_mtls = false],
  ["reject-forwarded-trust", x => x.routing.forwarded_headers_from_trusted_proxies_only = false],
  ["reject-no-request-limit", x => x.routing.request_size_limit_bytes = 0],
  ["reject-no-timeout", x => x.routing.server_timeout_ms = 0],
  ["reject-unbounded-retries", x => x.routing.retry_budget = 10],
  ["reject-tls11", x => x.tls.minimum_version = "1.1"],
  ["reject-no-tls13", x => x.tls.tls13 = false],
  ["reject-zero-rtt", x => x.tls.zero_rtt = true],
  ["reject-weak-ciphers", x => x.tls.weak_ciphers = true],
  ["reject-nonatomic-cert", x => x.tls.atomic_reload = false],
  ["reject-long-private-cert", x => x.tls.private_max_hours = 168],
  ["reject-online-root", x => x.pki.offline_root = false],
  ["reject-two-root-copies", x => x.pki.root_copies = x.pki.root_copies.slice(0, 2)],
  ["reject-one-root-domain", x => x.pki.root_copies.forEach(r => r.domain = "vault-a")],
  ["reject-shared-public-private-pki", x => x.pki.public_private_separate = false],
  ["reject-no-internal-acme", x => x.pki.internal_acme = false],
  ["reject-kms-sole-path", x => x.pki.provider_kms_sole_path = true],
  ["reject-one-ca-account", x => x.public_certificates.ca_accounts = ["ca-a"]],
  ["reject-one-challenge", x => x.public_certificates.challenge_methods = ["dns-01"]],
  ["reject-dns-creds-on-edge", x => x.public_certificates.dns_api_credentials_on_ingress = true],
  ["reject-original-ca-required", x => x.public_certificates.renewal_without_original_ca = false],
  ["reject-wildcard-default", x => x.public_certificates.wildcard_default = true],
  ["reject-open-east-west", x => x.network.default_deny_east_west = false],
  ["reject-shared-management", x => x.network.management_plane_separate = false],
  ["reject-no-oob", x => x.network.out_of_band_access = false],
  ["reject-dns-required", x => x.network.public_dns_required_for_internal_recovery = true],
  ["reject-release-keys", x => x.network.release_keys_present = true],
  ["reject-no-ipv6-policy", x => x.network.ipv6_policy = ""],
  ["reject-no-mtu-policy", x => x.network.mtu_policy = ""],
  ["reject-no-site-loss-test", x => x.resilience.one_site_loss = false],
  ["reject-no-renewal-failure-test", x => x.resilience.certificate_renewal_failure = false],
  ["reject-no-ca-failure-test", x => x.resilience.ca_failure = false],
  ["reject-no-provider-lb-loss-test", x => x.resilience.provider_lb_loss = false],
  ["reject-unsigned-evidence", x => x.evidence.signed = false],
  ["reject-no-tls-scan", x => x.evidence.tls_scan = false],
  ["reject-one-operator", x => x.evidence.operator_signatures = 1]
];

function run(inv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "network-contract-"));
  const file = path.join(dir, "inventory.json");
  fs.writeFileSync(file, JSON.stringify(inv, null, 2));
  const result = spawnSync(process.execPath, [verifier, policy, file], {encoding: "utf8"});
  fs.rmSync(dir, {recursive: true, force: true});
  return result;
}

let result = run(base);
if (result.status !== 0) {
  console.error(result.stdout, result.stderr);
  process.exit(1);
}
console.log("PASS baseline");

for (const [name, mutate] of mutations) {
  const inv = structuredClone(base);
  mutate(inv);
  result = run(inv);
  if (result.status === 0) {
    console.error(`FAIL ${name}: verifier accepted degraded inventory`);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
console.log("PASS adversarial network/TLS controls");
