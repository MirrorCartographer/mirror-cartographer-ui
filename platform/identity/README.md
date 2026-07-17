# Foundation workload identity and secrets authority

This directory defines the admission contract for project-owned workload identity and secret issuance.

## Authority split

- **SPIFFE/SPIRE-compatible identity plane:** issues short-lived workload identities from project-controlled trust roots.
- **Replaceable secret broker:** maps verified workload identity to narrowly scoped, leased credentials.
- **SOPS + age-compatible configuration custody:** keeps encrypted configuration in source control while recovery keys remain outside repositories and outside the broker.
- **Project policy and verifier:** determine whether an implementation is admissible. No provider IAM system, CI platform, secret-manager account, or registry is authoritative.

## Production topology

Use separate trust domains for production and staging. Keep the Workload API local to each node. Attest workloads using kernel-visible process metadata plus an admitted deployment digest. Prefer X.509-SVIDs for mutual authentication; permit JWT-SVIDs only where an intermediary makes X.509 impractical and require a strict audience.

The secret broker must issue short-lived database, queue, registry, and deployment credentials. Static credentials are migration exceptions with explicit expiry. Revocation and audit evidence must remain available after an individual workload or node disappears.

Encrypted configuration uses at least two independent recipient groups with a threshold of two. One recovery path must be offline and must not require the running secret broker, public DNS, or a cloud-provider identity service.

## Break-glass recovery

1. Start a clean host from mirrored, digest-pinned dependencies.
2. Reach it through a documented IP or local-console path without public DNS.
3. Recover two offline root or recipient shares under two-person control.
4. Restore the identity datastore and trust bundle, or rotate to a new project root using the recorded ceremony.
5. Restore encrypted configuration and broker state from independent custody.
6. Re-attest one workload and issue a short-lived SVID.
7. Issue one leased database credential and verify automatic expiry and explicit revocation.
8. Record machine-generated evidence and operator signatures.

## Verification

```sh
node platform/identity/verify-identity-contract.mjs
node platform/identity/test.mjs
```

The checked-in inventory is a design fixture. Production evidence must be derived from live certificate inspection, broker lease records, policy exports, audit logs, root-key custody records, and destructive recovery drills.
