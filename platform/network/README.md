# Sovereign Networking, Reverse Proxy, and TLS Plane

## Surviving architecture

The project owns a canonical route table, network policy, certificate inventory, and deployment evidence. Two ingress nodes in independent failure domains apply the same validated configuration through a replaceable proxy adapter.

HAProxy is the first data-plane adapter. Public certificates are obtained through ACME and retained in project custody. Private service certificates are issued from a project-owned offline root through an online intermediate and internal ACME service.

## Authority split

The reverse proxy executes routing but does not authorize production state. DNS directs clients but does not define route truth. A public CA proves public name control under Web PKI rules but does not control internal trust. Provider load balancers may front the project ingress as commodity DDoS absorption or address stability, but loss of that provider must leave a direct project-operated ingress path.

## Public PKI

Use at least two ACME CA accounts and two challenge mechanisms. DNS-01 is needed for wildcard names and for issuance when HTTP ingress is unavailable, but DNS update credentials must not be present on edge proxies. TLS-ALPN-01 provides a second mechanism at the TLS layer. Public certificates, account keys, renewal state, and last-known-good chains remain in project custody.

## Private PKI

Keep the root offline with three copies in at least two failure domains. Use separate online intermediate authority for internal service certificates. Default internal leaf lifetime is 24 hours or less. Root and intermediate rotation require overlap, dual trust bundles, and a measured removal point after old leaves expire.

## Routing safety

Unknown hosts fail closed. Forwarded headers are accepted only from explicitly trusted upstream proxies. Hop-by-hop headers are stripped. Request, header, timeout, retry, websocket, source-IP, IPv6, and MTU behavior are explicit policy.

## Configuration activation

A candidate proxy configuration is syntax-checked, semantically validated, hashed, and loaded atomically. The previous configuration and certificate set remain immediately restorable. Runtime administration sockets are local and authenticated, never internet exposed.

## Ownership boundary

### Project-owned

Route table, ingress policy, certificate inventory, private trust roots, public ACME account custody, proxy configuration compiler, TLS policy, renewal logic, failover acceptance, evidence, and recovery.

### Replaceable

HAProxy, Envoy, Caddy, Nginx, step-ca, ACME clients, DNS providers, public CAs, cloud load balancers, VMs, physical hosts, and transit providers.

### Not physically owned

DNS roots and registries, domain registration, Web PKI trust stores, public CAs, internet transit, BGP, DDoS capacity, fiber, datacenter power, hardware, and upstream routing.

## Unproven production evidence

Live dual-site ingress, config reload under traffic, full IPv4/IPv6 tests, source-IP preservation, MTU black-hole testing, public certificate renewal through two CAs, internal CA reconstruction, root/intermediate rotation, DNS outage survival, provider load-balancer removal, one-site loss, and direct rollback remain to be demonstrated.
