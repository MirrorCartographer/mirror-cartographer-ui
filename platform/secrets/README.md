# Sovereign Secrets and Workload Identity Plane

## Surviving architecture

The project owns the workload identity namespace, trust-domain roots, identity-to-policy mappings, secret inventory, lease policy, recovery quorum, and audit evidence.

SPIFFE defines portable workload identities. SPIRE is the initial implementation. Each host exposes a local Workload API socket; workloads receive short-lived X.509 SVIDs without possessing a permanent bootstrap secret. Production and staging use separate trust domains and separate root keys.

A project-controlled secret broker issues dynamic, leased credentials after authenticating the workload identity. Static secrets are exceptions, versioned, separately inventoried, and delivered over an authenticated local channel. Secret values are forbidden in source, images, CI logs, and exported environment files.

## Trust flow

1. A host proves node identity to the SPIRE Server.
2. The local SPIRE Agent evaluates kernel/runtime selectors for the calling workload.
3. The Workload API streams a short-lived SVID and current trust bundle over a host-local Unix socket.
4. The secret broker validates the SVID against the correct trust-domain bundle.
5. Source-controlled policy maps the SPIFFE ID to a narrow dynamic credential or secret lease.
6. The workload renews or replaces the lease; termination or policy revocation removes access.

## Recovery boundary

Three SPIRE servers and three secret servers run across three independent domains. Their data uses quorum storage. Trust roots, recovery shares, encrypted snapshots, policy source, and canonical inventories have project-controlled offline copies.

Cloud KMS auto-unseal is not the sole recovery mechanism. The first implementation uses a five-share, three-share threshold recovery ceremony. Provider KMS or HSM systems may later accelerate unseal but remain replaceable.

## False sovereignty rejected

- A self-hosted Vault with a cloud-KMS-only seal is still operationally dependent on that cloud account.
- Long-lived AppRole SecretIDs merely relocate static bootstrap credentials.
- Kubernetes ServiceAccount tokens are not a universal identity authority.
- Environment variables are not safe canonical secret delivery because they leak through process, crash, debug, and orchestration surfaces.
- Replicated secret storage is not an independent backup.
- A valid SVID authenticates identity; it does not authorize every secret.

## Production evidence still required

- Live SPIRE node and workload attestation.
- Local Workload API isolation and cross-host denial.
- X.509 SVID rotation during active connections.
- Bundle and root rotation with overlap.
- Three-node secret storage quorum behavior.
- Dynamic database credential issue, expiry, and revocation.
- Compromised workload revocation within five minutes.
- Secret-value leak scanning across images, logs, and process environments.
- Loss of one recovery share and one server site.
- Isolated restore without original provider, public DNS, or cloud KMS.
- Cross-implementation secret inventory export and reconstruction.
