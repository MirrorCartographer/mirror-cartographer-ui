#!/usr/bin/env node
import fs from "node:fs";

const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) {
  console.error("usage: verify-network-contract.mjs POLICY INVENTORY");
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const i = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const digest = value => /^sha256:[0-9a-f]{64}$/.test(value ?? "");

check(p.authority.project_owned_network_policy && i.authority.project_owned, "project must own network policy");
check(!p.authority.provider_load_balancer_authoritative && !i.authority.provider_load_balancer_authoritative, "provider load balancer cannot be authority");
check(!p.authority.provider_tls_state_authoritative && !i.authority.provider_tls_authoritative, "provider TLS state cannot be authority");
check(!p.authority.dns_provider_authoritative && !i.authority.dns_provider_authoritative, "DNS provider cannot be authority");
check(i.authority.adapter_replaceable && i.authority.route_table_exportable, "proxy adapter and route table must be replaceable/exportable");

check(i.ingress.nodes.length >= p.ingress.minimum_ingress_nodes, "insufficient ingress nodes");
check(new Set(i.ingress.nodes.map(n => n.domain)).size >= p.ingress.minimum_failure_domains, "insufficient ingress failure domains");
check(i.ingress.connection_draining, "connection draining required");
check(i.ingress.atomic_activation, "atomic config activation required");
check(i.ingress.last_known_good, "last-known-good config required");
check(i.ingress.config_validation, "configuration validation required");
check(!i.ingress.runtime_socket_public, "runtime socket must not be public");

check(i.routing.default_deny_unknown_hosts, "unknown hosts must be denied");
check(i.routing.allowlisted_hosts_paths, "host/path allowlist required");
check(i.routing.upstream_mtls, "upstream identity verification required");
check(i.routing.hop_by_hop_sanitized, "hop-by-hop headers must be sanitized");
check(i.routing.forwarded_headers_from_trusted_proxies_only, "forwarded header trust boundary required");
check(i.routing.request_size_limit_bytes > 0, "request size limit required");
check(i.routing.header_size_limit_bytes > 0, "header size limit required");
check(i.routing.connect_timeout_ms > 0 && i.routing.client_timeout_ms > 0 && i.routing.server_timeout_ms > 0, "timeout budget required");
check(Number.isInteger(i.routing.retry_budget) && i.routing.retry_budget >= 0 && i.routing.retry_budget <= 2, "bounded retry budget required");
check(i.routing.websocket_routes_explicit, "websocket routes must be explicit");

check(["1.2","1.3"].includes(i.tls.minimum_version), "TLS minimum must be 1.2 or newer");
check(i.tls.tls13, "TLS 1.3 must be enabled");
check(!i.tls.zero_rtt, "TLS 0-RTT must be disabled");
check(!i.tls.weak_ciphers, "weak ciphers must be disabled");
check(i.tls.atomic_reload, "certificate/key reload must be atomic");
check(i.tls.ocsp_monitored, "OCSP state must be monitored");
check(i.tls.expiry_alert_days >= p.tls.certificate_expiry_alert_days, "certificate expiry alert window insufficient");
check(i.tls.private_max_hours <= p.tls.private_certificate_max_hours, "private certificate lifetime too long");
check(i.tls.public_max_days <= p.tls.public_certificate_max_days, "public certificate lifetime too long");

check(i.pki.offline_root, "offline root required");
check(i.pki.root_copies.length >= p.pki.minimum_root_copies, "insufficient root copies");
check(new Set(i.pki.root_copies.map(r => r.domain)).size >= p.pki.minimum_root_failure_domains, "insufficient root failure domains");
check(i.pki.online_intermediate_separate, "online intermediate must be separate");
check(i.pki.public_private_separate, "public and private PKI must be separate");
check(i.pki.internal_acme, "internal ACME required");
check(i.pki.root_distribution_offline, "offline root distribution path required");
check(i.pki.intermediate_overlap, "intermediate rotation overlap required");
check(!i.pki.provider_kms_sole_path, "provider KMS cannot be sole key path");

check(i.public_certificates.acme, "ACME required for public certificates");
check(i.public_certificates.ca_accounts.length >= p.public_certificates.minimum_ca_accounts, "multiple public CA accounts required");
check(i.public_certificates.challenge_methods.length >= p.public_certificates.minimum_challenge_methods, "multiple challenge methods required");
check(!i.public_certificates.dns_api_credentials_on_ingress, "DNS API credentials forbidden on ingress");
check(i.public_certificates.certificate_cache_project_controlled, "project-controlled certificate cache required");
check(i.public_certificates.renewal_without_original_ca, "renewal must survive original CA loss");
check(!i.public_certificates.wildcard_default, "wildcard certificates must not be default");

check(i.network.default_deny_east_west, "east-west network must default deny");
check(i.network.management_plane_separate, "management plane must be separate");
check(i.network.out_of_band_access, "out-of-band access required");
check(!i.network.public_dns_required_for_internal_recovery, "internal recovery must not require public DNS");
check(!i.network.release_keys_present, "release keys forbidden on proxy hosts");
check(typeof i.network.source_ip_policy === "string" && i.network.source_ip_policy.length > 0, "source IP policy required");
check(typeof i.network.ipv6_policy === "string" && i.network.ipv6_policy.length > 0, "IPv6 policy required");
check(typeof i.network.mtu_policy === "string" && i.network.mtu_policy.length > 0, "MTU policy required");

for (const key of ["one_ingress_loss","one_site_loss","certificate_renewal_failure","dns_failure","ca_failure","config_rollback","provider_lb_loss"]) {
  check(i.resilience[key], `resilience test missing: ${key}`);
}

check(i.evidence.machine_generated, "evidence must be machine-generated");
check(i.evidence.signed, "evidence must be signed");
check(digest(i.evidence.config_digest), "configuration digest required");
check(digest(i.evidence.route_digest), "route digest required");
check(digest(i.evidence.certificate_chain_digest), "certificate-chain digest required");
check(i.evidence.tls_scan, "TLS scan evidence required");
check(i.evidence.failover_result, "failover evidence required");
check(i.evidence.external_probe_result, "external probe evidence required");
check(i.evidence.operator_signatures >= 2, "two operator signatures required");
check(i.evidence.retention_days >= p.evidence.retention_days, "evidence retention insufficient");

if (failures.length) {
  console.error(`REJECT ${failures.length} network/TLS invariant(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("ACCEPT 71 network/TLS invariants");
