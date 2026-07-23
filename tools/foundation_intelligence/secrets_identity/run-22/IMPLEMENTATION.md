# FIA Owned Secrets and Machine Identity — Run 22

Foundation separates machine identity from secret authorization.

- SPIRE 1.15.2 attests nodes and workloads and issues short-lived SPIFFE SVIDs.
- OpenBao 2.5.4 maps SPIFFE identity to least-privilege policies and short-lived secret leases.
- Foundation retains the trust domain, registration graph, policy graph, Shamir unseal quorum, audit custody, Raft snapshots, revocation authority, and recovery acceptance.
- Cloud instance identity and cloud KMS auto-unseal remain forbidden as canonical dependencies.
- Workload API access remains local through a Unix socket.
- Machine passwords and permanent deployment credentials remain forbidden.
- Tokens and secret leases expire within one hour; the admitted baseline uses 15 minutes.
- Certificate-bound tokens replace bearer-only machine authority.
- Two audit devices write to Foundation-controlled sinks.
- Recovery drills remove the primary operator, one OpenBao node, one SPIRE server, all online hosts, and provider identity services.

Executable gate and synthetic tests are retained in the private run artifact `fia-owned-secrets-identity-run-22.zip`.
