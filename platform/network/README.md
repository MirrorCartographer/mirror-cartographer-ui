# Sovereign network, reverse-proxy, DNS, and TLS authority

This contract defines what the project must control before public ingress is considered sovereign enough for the Foundation Intelligence replacement platform.

## Strongest surviving design

Public traffic terminates only on two project-configured reverse proxies in independent failure domains. Backends bind only to loopback or private addresses. Proxy configuration is digest-recorded, health-gated, and atomically reloadable. DNS zone source is project-controlled and exportable as a standard master file, with a secondary authoritative copy and documented registrar, registry-lock, DNSSEC, DS-removal, and provider migration procedures.

Browser reachability still depends on public DNS, Web PKI, registrars, CAs, and internet transit. Those are unavoidable external systems, but none is accepted as the project's routing intelligence, canonical configuration store, sole certificate path, or sole recovery path.

TLS certificates are automatically renewed through ACME using two replaceable issuers. ACME account keys are separate from certificate keys, backed up, and recoverable. Certificate storage is persistent, encrypted, and copied outside one ingress host. CAA restricts issuance. Unrestricted on-demand TLS is forbidden because an attacker could induce issuance load or consume CA limits.

An unexpired cached certificate must survive CA outage and proxy restart. Rollback and operator access must not require public DNS. A separate project-controlled internal PKI supports private service identity and disaster operations but is not presented as a substitute for browser-trusted public certificates.

## Why Caddy first

Caddy is the initial reverse proxy because it provides automatic HTTPS, persistent certificate storage, atomic configuration reloads, health-aware reverse proxying, and standard ACME integration. It remains replaceable by HAProxy, NGINX, Envoy, or another proxy because the project owns the routing policy, upstream inventory, certificate custody requirements, DNS zone, probes, and admission verifier.

## Rejected alternatives

- A CDN or hosted load balancer as canonical ingress authority.
- One public proxy host, even with blue/green application slots.
- Application processes exposed directly to the internet.
- DNS records stored only in one provider's proprietary control plane.
- One ACME CA and one online account key.
- Ephemeral proxy storage that requires reissuance after restart.
- Public DNS as the only route for rollback or emergency administration.
- Wildcard or on-demand issuance without explicit authorization controls.
- DNS failover as an instant rollback mechanism; resolver caching makes it nondeterministic.

## Evidence still required

The JSON inventory is a design fixture, not production proof. Production admission must derive evidence from parsed proxy configuration, socket inspection, active upstream probes, DNS zone exports and digests, DNSSEC validation, certificate-chain inspection, private-key permissions, storage-copy challenges, CA-outage restart tests, authoritative DNS failover, registrar recovery, and signed operator evidence.

## Destructive verification sequence

1. Provision two ingress nodes in independently failing sites.
2. Load the same digest-pinned proxy configuration on both.
3. Confirm only ports 80/443 are public and every backend is private.
4. Issue through ACME issuer A, persist and replicate certificate state.
5. Disable issuer A and restart both proxies without network access to any CA.
6. Verify the cached certificate and HTTPS service remain valid.
7. Renew through issuer B.
8. Remove the primary authoritative DNS service and verify the secondary answers correctly.
9. Export the zone, import it into a different authoritative implementation, and compare records and DNSSEC behavior.
10. Simulate registrar account loss and execute the documented registry/registrar recovery path.
11. Corrupt one certificate store and restore from the other copy.
12. Remove public DNS resolution and prove deployment rollback and operator access still work through the out-of-band route.
13. Sign machine-generated evidence with two operators.

## Ownership boundary

The project owns policy, proxy configuration, route state, zone source, TLS custody rules, ACME account recovery, probes, evidence, and migration procedures. Commodity software and hosting remain replaceable. The project does not physically own public DNS roots, TLD registries, registrar systems, public CAs, browser trust stores, BGP, internet transit, datacenter power, or hardware fabrication.
