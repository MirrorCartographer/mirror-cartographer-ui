# Sovereign DNS and Domain-Continuity Plane

The project owns the canonical zone source, compiler, signing policy, delegation inventory, and served-state evidence. Registrars, registries, DNS operators, and public resolvers remain unavoidable external participants, but none defines zone truth.

## Surviving topology

source-controlled zone
→ lint and serial admission
→ offline-KSK / online-ZSK signing
→ signed immutable generation
→ hidden primary
→ authenticated transfer or provider adapters
→ four authoritative servers
→ two DNS operators
→ at least three failure domains
→ multi-vantage DNSSEC validation

The domain registration itself cannot be physically or institutionally internalized: the registry and registrar control the parent delegation. Sovereignty therefore means controlling registrant identity, transfer authority, locks, renewal, DS intent, portable zone data, multiple operators, and a tested exit path.

## Initial implementation

Use Knot DNS or NSD/BIND as the hidden primary and signer, with two distinct secondary-DNS operators. Compile standard zone files plus a canonical JSON RRset manifest. Keep provider adapters narrow and replaceable.

Use registrar lock and registry lock where supported. Keep transfer credentials and registrar recovery material offline under two-person authority. Maintain a second accredited registrar account as an exercised transfer destination, not merely a theoretical option.

## DNSSEC

Keep the KSK offline or equivalently threshold-protected, with three copies in two domains. Use a separate online ZSK. Rollover by prepublication and verify the parent DS from multiple validating resolvers before removing old keys. CDS/CDNSKEY automation is accepted only when continuity checks prove the proposed parent DS cannot break the existing secure delegation.

## Dynamic update

RFC 2136 updates are permitted only for narrow machine-owned subtrees such as `_acme-challenge`. General zone changes flow through the project compiler. Update credentials cannot transfer the domain or change parent delegation.

## Ownership boundary

### Project-owned
Zone source, RRset manifest, signing keys, key policy, serial policy, provider adapters, registrar runbook, transfer quorum, DNSSEC rollover, evidence, and restoration.

### Replaceable
Knot, NSD, BIND, PowerDNS, DNS providers, registrars, ACME DNS controllers, VMs, physical servers, and monitoring vantage points.

### Not physically owned
TLD registries, the DNS root, ICANN policy, registrar accreditation, recursive resolvers, global anycast networks, BGP, transit, public trust stores, and domain-name allocation.
