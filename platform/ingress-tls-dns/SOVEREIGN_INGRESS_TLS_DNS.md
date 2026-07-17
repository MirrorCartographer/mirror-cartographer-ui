# Sovereign Ingress, TLS, and DNS

## Decision

Foundation Intelligence will operate a project-owned ingress control plane using Caddy as the initial reverse proxy, a signed project-owned zone manifest as DNS source of truth, at least two authoritative DNS failure domains, and recoverable certificate/key custody independent of any single CA, DNS provider, registrar, or ingress host.

Caddy is an executor. Public CAs issue trust assertions. DNS providers publish records. Registrars maintain delegation. None is release authority, canonical configuration authority, or sole recovery path.

## Strongest surviving implementation

1. Applications bind only to loopback or a private service network.
2. Two independently rebuildable ingress cells expose ports 80/443.
3. A signed zone manifest generates provider-specific records.
4. Caddy configuration is generated from admitted active-slot state.
5. Candidate configuration is validated before reload.
6. Reload failure preserves the prior live configuration.
7. Direct backend probes precede switching; external ingress probes follow it.
8. Caddy stores live certificates on persistent encrypted storage, but a separate signed certificate inventory and encrypted key backup are held outside the ingress host.
9. At least two ACME issuers are configured or operationally available.
10. Existing unexpired certificates continue serving during CA or renewal outage.
11. DNS changes are verified against authoritative servers and independent recursive resolvers before traffic cutover.
12. Recovery can reconstruct DNS records, proxy configuration, and certificates without the failed provider account.

## Why Caddy initially

Caddy provides automatic HTTPS, certificate renewal, HTTP-to-HTTPS redirects, active upstream health checks, and reloadable configuration with a comparatively small control-plane surface. Its certificate storage must be writable and persistent for normal automation. That storage is operational state, not the only canonical recovery representation.

On-demand TLS is prohibited for the known Foundation Intelligence host set. It defers issuance to client handshakes and requires an authorization service to prevent abuse. Static admitted domains do not justify that added runtime issuance path.

## TLS custody model

Public Web PKI cannot be physically owned by the project: browser trust stores, root programs, certificate authorities, revocation infrastructure, and client clocks remain external. The project can own:

- ACME account configuration;
- selected issuers and failover order;
- private keys and encrypted independent backups;
- certificate inventory, SANs, issuer, serial, validity, and fingerprints;
- renewal policy and alert thresholds;
- internal emergency CA for controlled clients;
- clean-host restoration procedure.

A public CA outage must not interrupt service while a valid certificate remains. Renewal failure becomes urgent well before expiration. The initial policy alerts at fourteen days remaining and requires at least seven days of remaining validity for ordinary deployments.

Private-key reuse is not required. New keys reduce the impact of historic compromise, but every active key required for restoration must be independently backed up or reproducibly reissued before expiration.

An internal CA is useful for operator, service-to-service, and emergency controlled-client paths. It cannot replace public browser trust for the public website.

## DNS authority model

The canonical DNS object is a signed, provider-neutral zone manifest stored with project evidence. Provider dashboards are projections.

The minimum production design uses two authoritative DNS failure domains capable of serving the same admitted zone. The registrar holds delegation and registry-lock controls but is not the zone source of truth.

Required evidence for every change:

- prior and proposed zone manifest digests;
- SOA serial or equivalent revision;
- authoritative answers from every provider;
- answers from multiple independent recursive resolvers;
- DNSSEC validation status where enabled;
- TTL observation before and after cutover;
- rollback manifest and deadline.

Low TTL does not eliminate stale DNS. Recursive resolvers, client caches, negative caching, browser connection reuse, and ISP behavior can extend effective convergence. A cutover is not accepted merely because one resolver returns the new address.

DNSSEC protects authenticity of DNS answers, not availability. Incorrect DS records, expired signatures, key rollover errors, or broken delegation can make a correctly hosted zone unreachable. DNSSEC changes require separate validation and rollback evidence.

## Adversarial review before adoption

### One fully managed edge provider

Rejected as sole ingress, DNS, certificate, and DDoS authority. It creates one account, billing, policy, API, and operational failure domain. It may be a commodity edge mirror, not the only path.

### Registrar DNS as canonical state

Rejected. Registrar compromise or lockout would then remove both delegation control and the only zone representation.

### One ACME CA

Rejected as the only renewal route. Existing certificates remain useful during outage, but long outages or account-policy failures become expiration events.

### Wildcard certificate by default

Rejected. Wildcards increase key blast radius and require DNS-01 credentials. Use only where operationally justified, with narrowly scoped DNS credentials and separate key custody.

### On-demand TLS

Rejected for known project domains. It exposes issuance to handshake-time load and authorization-service failure.

### Health check only from the proxy host

Rejected. It cannot detect public DNS, routing, certificate-chain, SNI, firewall, or external-path failure.

### DNS failover as instant recovery

Rejected. TTLs and caching make DNS a slow steering plane, not an atomic traffic switch.

## Adversarial review after artifact production

The policy and tests reject:

- public application binding;
- public Caddy administration;
- on-demand TLS;
- a single certificate issuer;
- a single authoritative DNS provider;
- registrar-owned canonical zone state;
- missing independent key backup;
- absent post-reload external verification;
- missing active backend health containment.

Remaining weaknesses:

1. The Caddyfile is a template and has not been validated by a pinned Caddy binary.
2. Dual-authoritative DNS can produce divergent answers unless generation and reconciliation are automatic.
3. Encrypted key backup still depends on recovery-key custody.
4. A compromised ingress host can serve a fraudulent configuration while its local probes pass.
5. Public external probes depend on networks outside project control.
6. DDoS resistance is constrained by purchased bandwidth and upstream filtering.
7. Certificate revocation behavior varies across clients.
8. Registrar takeover remains catastrophic for public delegation even when zone data is preserved.
9. DNSSEC adds authenticity but also rollover and delegation failure modes.
10. Two ingress cells require independent power/network failure domains to survive site loss.

## Build-versus-buy comparison

### Adopted: Caddy plus project policy

Caddy has the smallest operational surface among the leading candidates for automatic public HTTPS and active reverse-proxy health checks. Configuration, active upstream state, certificate inventory, and recovery evidence remain outside Caddy-specific storage.

### HAProxy

Strong for explicit load-balancing behavior, runtime APIs, and high-throughput ingress. Certificate automation requires separate tooling. It remains the leading replacement when traffic policy complexity outweighs integrated HTTPS automation.

### nginx

Mature and broadly understood. Safe reloads are well established, but certificate automation and richer active health behavior require additional components or commercial features. It remains a viable replacement executor.

### Managed CDN/edge

Useful for DDoS absorption, caching, global proximity, and emergency capacity. Rejected as canonical authority. Origin access, DNS manifests, certificates where exportable, and direct-origin recovery must remain project controlled.

### Self-hosted authoritative DNS

Provides maximal software control but creates anycast, abuse handling, global reachability, DNSSEC, monitoring, and 24/7 operational burdens. Initial production should use multiple commodity authoritative providers generated from the project manifest, while retaining a tested self-hosted hidden-primary or emergency path.

## Ownership boundary achieved

The project owns:

- provider-neutral zone state;
- proxy configuration generation;
- active upstream selection;
- TLS policy and issuer selection;
- private-key custody and recovery copies;
- certificate inventory;
- ingress health and cutover evidence;
- provider adapters and reconciliation;
- rollback manifests;
- clean-host reconstruction procedure.

The project does not physically own merely by operating this plane:

- domain registry or registrar institutions;
- DNS root and TLD servers;
- browser root programs and public CAs;
- BGP routing and internet transit;
- ISP recursive resolvers and client caches;
- datacenter power, hardware, or upstream DDoS capacity.

The defensible claim is that none of those external systems holds the only configuration, private key, authoritative record, certificate issuance route, ingress implementation, or recovery procedure.

## Cost and operational implications

The initial credible footprint requires:

- two ingress cells in separate host failure domains;
- two authoritative DNS failure domains;
- persistent encrypted certificate storage;
- independent encrypted key and certificate-inventory backups;
- external probes from multiple networks;
- registrar lock and recovery controls;
- DNSSEC monitoring if enabled;
- reserved emergency origin capacity;
- recurring certificate-renewal, DNS, proxy reload, and ingress-loss drills.

Software licensing can remain zero. Costs arise from redundant compute, DNS service, bandwidth, DDoS protection, external monitoring, secure key storage, patching, and operator discipline.

## Verification status

Implemented:

- machine-readable policy;
- hardened Caddy template;
- 24-invariant verifier;
- adversarial mutation harness;
- implementation-ready ownership and recovery specification.

Not yet proven:

- Caddy configuration validation and reload;
- ACME issuance or renewal;
- multi-issuer failover;
- dual-provider DNS reconciliation;
- DNSSEC rollover;
- external-path cutover;
- ingress-host loss;
- certificate restoration on a clean host;
- measured outage, propagation, or renewal latency.

## Next falsifiable build step

1. Pin and mirror one Caddy binary and its source/build provenance.
2. Provision two clean ingress VMs in independent host/network domains.
3. Generate configuration from a signed active-slot and zone manifest.
4. Validate with `caddy validate` before activation.
5. Issue a public test certificate through issuer A.
6. Export and sign certificate inventory; escrow encrypted key material independently.
7. Serve one admitted fixture digest through both ingress cells.
8. Probe direct backend, each ingress IP with explicit SNI, authoritative DNS, recursive DNS, and the public hostname.
9. Submit an invalid proxy configuration and prove the old configuration continues serving.
10. Block issuer A and prove issuer B can issue or renew a separate test hostname.
11. Block all CA access and prove the existing certificate remains served while alerts escalate.
12. Corrupt primary certificate storage, restore on a clean ingress host, and prove the original fingerprint and key match.
13. Change the zone through both provider adapters and detect intentional divergence before cutover.
14. Remove one authoritative provider and prove resolution continues.
15. Kill one ingress cell and prove external service continues without DNS change.
16. Perform a DNS steering change, measure resolver convergence, and roll back using the signed prior manifest.
17. Break a DNSSEC test delegation and require validation alarms before production adoption.
18. Lock out the primary registrar account and execute the documented recovery path.
19. Record issuance time, renewal margin, reload interruption, DNS convergence, failover outage, bandwidth ceiling, and manual actions.
