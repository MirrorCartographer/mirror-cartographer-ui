# Sovereign Networking, Reverse Proxy, and TLS Ingress Plane

## Surviving architecture

The project owns the route catalog, backend identity mapping, TLS policy, certificate inventory, public-CA account custody, internal trust roots, rendered proxy configuration, and failover acceptance.

```text
source-controlled route catalog
              ↓
deterministic route compiler
              ↓
HAProxy config + certificate map
              ↓
two ingress nodes / two failure domains
              ↓
backend mTLS to SPIFFE workload identity
```

Envoy is the required secondary proxy adapter for clean-host and cross-implementation recovery.

## Public TLS

Public browser trust remains externally governed. The project cannot mint a generally trusted public certificate without a public CA trusted by client platforms.

Use at least two ACME CA accounts backed by different CA implementations. Keep ACME account keys and leaf private keys in project custody. DNS-01 is limited to wildcard names and credentials scoped to `_acme-challenge`; HTTP-01 is retained as an independent fallback for ordinary hostnames.

CAA expresses which public CAs are permitted but does not replace account, DNS, or key security.

## Internal TLS

The project owns an offline internal root. `step-ca` operates only an online intermediate or registration authority. Internal leaves are short lived and issued through ACME or SPIFFE-compatible identity.

Trust-bundle rotation overlaps old and new trust anchors before old material is removed.

## HAProxy state

HAProxy runtime certificate changes are transactional but memory state is not automatically persistent. Every runtime update must also be written to project-custodied disk state and reconciled before the change is accepted.

Configuration is rendered from the canonical route catalog, validated, staged on both edges, reloaded gracefully, and checked externally before old state is retired.

## Routing controls

Unknown hosts fail closed. There is no catch-all public backend. Client-supplied forwarding headers are removed and replaced at the trusted edge. PROXY protocol is accepted only from known upstream peers.

Retries are restricted to safe methods or requests carrying an application-approved idempotency key.

## Health and failover

Use active transport checks, passive production-error observation, and semantic application checks. A process that accepts TCP is not necessarily safe to receive production traffic.

Two edges use independent public paths. The project retains a direct-origin emergency route and offline route/certificate inventories. Internal diagnosis and recovery do not require public DNS.

## Ownership boundary

### Project-owned

Route catalog, configuration compiler, certificate inventory, private-key custody, ACME accounts, internal roots, trust bundles, proxy policy, failover rules, and evidence.

### Replaceable

HAProxy, Envoy, Caddy, step-ca, public ACME CAs, DNS providers, transit providers, cloud load balancers, VMs, and physical hosts.

### Not physically owned

DNS root and TLD registries, public browser trust stores, CA ecosystem governance, BGP, global internet transit, upstream DDoS capacity, undersea cables, hardware fabrication, facilities, and power.
