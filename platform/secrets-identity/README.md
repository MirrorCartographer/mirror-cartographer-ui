# Sovereign Secrets and Workload Identity Plane

## Surviving architecture

The project owns identity namespaces, registration policy, authorization mappings, secret classes, rotation order, root custody, and recovery acceptance.

SPIRE issues short-lived workload identities. OpenBao brokers dynamic credentials and encrypted static exceptions. Neither product is canonical authority.

```text
offline threshold identity root
        ↓
separate production/build/recovery trust domains
        ↓
SPIRE servers and node agents
        ↓
node + workload attestation
        ↓
short-lived X.509-SVID
        ↓
OpenBao workload authentication
        ↓
policy-bound dynamic credential lease
        ↓
consumer
        ↓
renew, revoke, rotate, audit
```

## Root boundary

Keep root keys offline or threshold-controlled. Five shares with a threshold of three span at least three custody domains. Cloud KMS may assist online unsealing but cannot be the sole recovery path.

The online SPIFFE issuer and OpenBao seal keys are subordinate operational keys. Compromise must be recoverable by rotating subordinate keys without replacing the project identity namespace.

## Workload identity

Use SPIFFE IDs as canonical workload names. Divide production, build, and recovery into separate trust domains. Prefer X.509-SVIDs and mTLS; JWT-SVIDs are limited to narrow audiences and short TTLs.

Node attestation must use TPM DevID, pre-provisioned X.509 proof, or another independently verifiable mechanism. Single-use join tokens are bootstrap exceptions, not the production default. Workload identity requires multiple selectors such as systemd unit, Unix identity, and immutable image digest.

## Secret broker

OpenBao is the first credential-broker adapter. Dynamic database, PKI, cloud, and messaging credentials are preferred. Static KV values require an owner, justification, expiry, rotation procedure, and recovery classification.

Every dynamic credential has a lease. Consumers renew within bounds or obtain replacement credentials. Revocation is tested at both broker and target system.

Response wrapping is used for bootstrap delivery. Wrapped values are single-use and short-lived.

## Audit

Enable two independent audit devices. Audit records are externalized into project evidence custody. Loss of all audit paths may make OpenBao unavailable; that failure mode is intentional and must be tested and monitored.

## Authorization

Identity proves a principal; project policy decides access. Authorization defaults deny, separates humans from workloads and environments, and grants time-bounded elevation. Privileged production policy changes and break-glass actions require two operators.

## Rotation

Rotation order is:

1. Add new trust material.
2. Rotate issuer or credential source.
3. Rotate broker configuration.
4. Confirm consumers accept the new credential.
5. Revoke the old credential.

Mass rotation is rate limited and reversible. Old credentials remain valid only through a bounded compatibility window.

## Recovery order

1. Recover offline identity roots.
2. Restore workload identity and trust bundles.
3. Restore OpenBao from a verified Raft snapshot.
4. Re-issue dynamic credentials.
5. Restore static exceptions from encrypted offline export.
6. Revoke all credentials whose custody became uncertain.
7. Admit consumers only after identity and access tests pass.

Root recovery must not require OpenBao, SPIRE, public DNS, GitHub, or the original cloud provider.

## Ownership boundary

### Project-owned

Identity schema, SPIFFE ID namespace, trust-domain boundaries, registration entries, authorization policy, secret classes, root custody, rotation, revocation, audit requirements, recovery export, and acceptance evidence.

### Replaceable

SPIRE, OpenBao, HashiCorp Vault, step-ca, cloud IAM, HSM/KMS products, databases, notification systems, VMs, and physical hosts.

### Not physically owned

HSM fabrication, TPM manufacturing, CPU and firmware supply chains, cloud control planes, public networks, DNS roots, domain registration, internet transit, and public certificate authorities.
