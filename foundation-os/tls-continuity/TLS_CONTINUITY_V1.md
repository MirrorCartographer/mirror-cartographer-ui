# Foundation TLS and Certificate Continuity v1

## Authority chain

Foundation controls internal trust roots, issuance policy, certificate inventory, renewal gates, DNS zone exports, recovery evidence, and acceptance. Public certificate authorities, DNS hosts, reverse proxies, registrars, and transit providers remain replaceable commodities.

## Strongest surviving implementation

Operate an offline 2-of-3 root and one online issuing intermediate for private infrastructure. Run `step-ca` as the first internal ACME implementation. Issue private leaf certificates for no more than 24 hours. Keep the root offline. Back up root material three times across two failure domains. Require two operators for root use and restore.

Use ACME for public certificates. Prefer DNS-01 for wildcard issuance and when HTTP reachability cannot remain stable. Limit DNS automation authority to one zone and one hour. Keep a complete canonical zone export outside both DNS providers. Maintain two provider-compatible update paths. Declare CAA records, but never treat CAA as issuance authority.

Terminate TLS through a replaceable reverse proxy. Store certificates on replicated local state. Reload certificates atomically. Reject deployment when the active certificate is expired, mismatched, untrusted, or inside the configured renewal failure window.

## Build versus buy

Adopt `step-ca` for internal ACME and X.509 issuance. Retain Foundation policy outside its database and configuration format. Reject building a custom CA, ACME server, X.509 library, or TLS stack.

Use public ACME certificate authorities for browser-trusted certificates because Foundation cannot unilaterally place its root in browser and operating-system trust stores. Maintain two compatible issuers and exercise failover monthly.

Use Caddy, HAProxy, Envoy, or another proxy as a replaceable serving implementation. Never allow automatic-HTTPS convenience logic to become the canonical certificate inventory or sole renewal path.

## Adversarial review

- Root theft: require threshold custody, offline storage, separate media, and documented revocation and reissuance.
- Online intermediate theft: cap leaf lifetime, revoke the intermediate, rebuild from the offline root, and reissue all leaves.
- DNS API compromise: scope authority to one zone, expire it within one hour, monitor TXT changes, and preserve a second provider path.
- DNS provider outage: restore the canonical zone export to the replacement provider and complete DNS-01 issuance there.
- Public CA outage or rate limit: fail over to the second ACME issuer without changing application identity or release authority.
- Clock failure: monitor clock offset and block issuance, renewal acceptance, and deployment when drift exceeds policy.
- Renewal succeeds but reload fails: verify the served certificate from outside the proxy before accepting renewal.
- Registrar compromise: maintain transfer locks, recovery contacts, and a registrar exit path. Do not label domain ownership sovereign.
- Browser trust policy changes: preserve an alternate issuer.
- Single operator loss: require a second operator to restore the CA and public issuance path from blank infrastructure.

## Verification gates

1. Validate the machine-readable policy.
2. Issue an internal certificate through ACME.
3. Confirm automatic renewal before one-third of lifetime remains.
4. Replace the online intermediate and verify old leaves expire.
5. Fail public issuance from issuer A and complete it through issuer B.
6. Delete DNS provider A and restore the zone plus DNS-01 automation through provider B.
7. Corrupt certificate storage and restore from the independent copy.
8. Verify the externally served certificate after every reload.
9. Rebuild the CA from blank infrastructure with a second operator.
10. Record issuance latency, renewal margin, DNS propagation, reload time, failover time, and manual actions.

## Ownership boundary

Foundation owns the internal software trust root, issuance policy, certificate lifecycle, inventory, renewal gates, DNS configuration source, and recovery process. Foundation does not own public browser trust stores, registrar databases, TLD registries, root DNS, internet transit, physical cables, cryptographic algorithms, CPU fabrication, firmware, or upstream CA and proxy implementations.

## Rejected alternatives

- One public CA as the only issuance path.
- Provider-managed TLS as the canonical certificate store.
- Long-lived wildcard certificates.
- Permanent broad DNS automation authority.
- Online root CA.
- Reverse-proxy state as the only certificate inventory.
- Manual renewal.
- CAA records as a substitute for local issuance policy.
- Owning hardware as a claim of owning domain registration or internet transit.

## Cost and operations

Operate CA patching, root ceremonies, intermediate rotation, DNS automation rotation, external probing, certificate inventory, renewal monitoring, provider failover, zone export verification, second-operator drills, and incident response. Short lifetimes increase issuance volume and expose ACME or DNS bottlenecks earlier. Public trust remains an unavoidable external dependency.

## Next falsifiable build

Initialize an offline root and online `step-ca` intermediate, enable ACME, issue one 24-hour internal certificate, renew it automatically, rotate the intermediate, fail public issuance from one ACME CA, restore DNS to a second provider, issue through the alternate CA, verify the externally served chain, erase the CA host, and require a second operator to reconstruct both internal and public issuance paths.
