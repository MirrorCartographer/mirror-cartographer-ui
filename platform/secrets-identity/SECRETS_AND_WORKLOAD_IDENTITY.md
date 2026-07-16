# Sovereign Secrets Custody and Workload Identity

Status: implementation-ready control-plane contract with executable negative controls.

## Decision

Use two deliberately separate authorities:

1. **SPIFFE/SPIRE** issues short-lived workload identity documents through a host-local Unix Workload API.
2. **OpenBao** authenticates those identities and issues narrowly scoped, leased secrets or dynamic credentials.

The offline recovery root, OpenBao unseal/recovery material, SPIRE trust-domain root, audit evidence, and recovery procedures remain under project custody. A release worker may build and attest software but may not read production secrets or authorize runtime identity.

## Strongest surviving architecture

```text
Offline threshold recovery authority (2-of-3, separated custodians/media)
        |
        +--> SPIRE trust-domain authority
        |       +--> per-node agent
        |               +--> host-local Workload API
        |                       +--> short-lived X.509/JWT SVID
        |
        +--> OpenBao recovery/unseal authority
                +--> 3-node integrated-Raft cluster
                +--> two independent audit devices
                +--> workload authentication
                +--> dynamic database/queue/object-store credentials
                +--> versioned KV only where dynamic issuance is impossible
```

No application image, deployment manifest, environment file, CI variable, source repository, or package registry is permitted to contain production secret material.

## Why identity and secrets are different

A workload identity answers **which running process is this?** A secret broker answers **what may that identity obtain, for how long, and with what revocation semantics?** Combining both into static tokens creates a credential that is simultaneously identity, authority, and recovery dependency. This design refuses that collapse.

SPIRE maps attested node and process selectors to SPIFFE IDs and serves SVIDs through a local Workload API. OpenBao policies map those identities to leased capabilities. Loss of one workload credential expires naturally; it does not require rotating a shared fleet-wide password.

## Workload identity contract

Trust domain: `foundation.internal`.

Example identities:

```text
spiffe://foundation.internal/prod/reader/api
spiffe://foundation.internal/prod/compiler/worker
spiffe://foundation.internal/prod/release/admission
spiffe://foundation.internal/prod/runtime/web
spiffe://foundation.internal/prod/runtime/database-migrator
```

Requirements:

- Workload API is exposed only through a host-local Unix socket.
- Every registration entry binds a SPIFFE ID to explicit node and workload selectors.
- X.509/JWT SVID lifetime is at most one hour; production target is 15 minutes.
- Agents have no authority to create registration entries.
- Build workers, release admission, migration jobs, and runtime services receive distinct identities.
- Production and non-production are separate trust domains or separately rooted intermediate authorities.
- Federation is explicit, bounded, and removable; no public identity provider is required for internal operation.

## Secret broker contract

OpenBao is operated as a three-node integrated-Raft cluster. Quorum loss stops writes rather than silently selecting an inconsistent authority.

Required controls:

- TLS on client and cluster interfaces.
- At least two audit devices with independent destinations; failure policy is tested.
- Default lease TTL no greater than 15 minutes; maximum no greater than one hour.
- Dynamic database, queue, and object-store credentials where supported.
- KV v2 only for irreducibly static values, with check-and-set required and destructive operations separately authorized.
- Single-use response wrapping for bootstrap delivery.
- Root token is not retained for routine operation.
- Recovery/unseal material is threshold-split across at least two independent failure domains.
- Raft snapshots are encrypted, signed, copied off-cluster, and destructively restored on a clean host.

## Secret delivery rules

Preferred order:

1. Workload obtains a short-lived identity from the local Workload API.
2. It authenticates to OpenBao using that identity.
3. OpenBao returns a leased dynamic credential.
4. The workload consumes the credential from memory or a restricted in-memory file descriptor.
5. Lease expiry or explicit revocation removes authority.

Forbidden steady-state paths:

- production secrets in environment variables;
- plaintext `.env` files;
- secrets baked into OCI layers;
- long-lived CI secrets;
- deployment-controller credentials shared by workloads;
- one static database password used by the entire fleet;
- cloud identity as the sole bootstrap root.

Environment variables are prohibited because they are commonly inherited by child processes, exposed through debugging and crash tooling, and retained in process metadata. A temporary memory-backed file may be used only where a library cannot consume a descriptor or socket directly, and must have mode `0400`, bounded lifetime, and explicit deletion.

## Root and recovery ceremonies

The project retains two separate offline roots:

- **identity root:** authorizes SPIRE intermediate signing authorities and trust bundles;
- **recovery root:** authorizes OpenBao recovery/unseal operations and recovery manifests.

Each uses a minimum 2-of-3 threshold with shares stored by separate custodians or in separate physical/admin domains. No root private key remains continuously mounted on an online server.

Quarterly recovery drill:

1. Provision clean hosts from pinned bootstrap artifacts.
2. Restore OpenBao Raft state from an independent copy.
3. Reconstruct recovery authority with threshold shares.
4. Restore SPIRE datastore and signing hierarchy, or issue a new intermediate from the offline root.
5. Re-register one fixture workload from declarative policy.
6. Obtain an SVID through the local Workload API.
7. Authenticate to OpenBao and obtain a short-lived fixture database credential.
8. Revoke the workload entry and lease.
9. Prove subsequent authentication and credential use fail.
10. Record RTO, manual steps, key custody participants, and all exceptions.

## Adversarial review before adoption

### Static secrets encrypted in Git

Rejected as the primary model. SOPS/age can be a useful bootstrap and disaster-recovery transport, but decrypted values still become long-lived application secrets and Git history remains a durable distribution channel. Encryption-at-rest does not provide workload attestation, lease expiry, or automatic revocation.

### Cloud KMS or cloud workload identity as root authority

Rejected as sole authority. They may wrap secondary keys or provide a replaceable node-attestation input. Account suspension, region failure, IAM policy mutation, API incompatibility, billing failure, or provider withdrawal cannot be allowed to eliminate the only recovery path.

### Kubernetes Secrets

Rejected as canonical custody. They are an orchestration projection and inherit cluster, datastore, RBAC, backup, and control-plane failure modes. They may contain short-lived projected credentials, never the sole long-lived source.

### OpenBao alone as workload identity

Rejected. A token copied from one host to another is possession evidence, not process attestation. SPIFFE separates runtime identity from secret issuance.

### SPIRE alone as secret store

Rejected. SVIDs establish identity and secure channels; they do not provide versioned static-secret custody, database credential leasing, response wrapping, or secret-specific audit policy.

### One-node secret server

Rejected. It is simpler but turns hardware failure, patching, and operator error into a complete control-plane outage. Three nodes are the minimum quorum-capable production topology; they must still be backed up because replication is not backup.

## Adversarial review after artifact production

The executable verifier rejects:

- an online root key;
- threshold recovery below two participants;
- a single failure-domain recovery design;
- non-local Workload API transport;
- long-lived workload credentials;
- static workload tokens;
- absent selector binding;
- a non-quorum OpenBao topology;
- fewer than two audit devices;
- long secret leases;
- KV without check-and-set;
- plaintext or environment-based secret delivery;
- release-worker access to production secrets;
- secret material in release artifacts;
- infrequent restore or revocation drills.

The included adversarial test mutates five high-impact controls and proves fail-closed rejection.

## Verification status

Executed locally with Node.js:

```text
PASS baseline
PASS reject-static-token
PASS reject-online-root
PASS reject-release-worker-secret-access
PASS reject-single-audit-device
PASS reject-long-lived-secret
PASS adversarial secrets and identity controls
```

This proves policy enforcement, not live SPIRE/OpenBao interoperability. No production key, recovery share, SVID, OpenBao token, lease, or secret is committed to the repository.

## Build-versus-buy result

### Adopted: SPIRE + OpenBao

- Open specifications and source code.
- Runs on bare metal, VMs, containers, or commodity hosting.
- Workload identity is not tied to one cloud IAM system.
- Secret policy and storage remain project-operated.
- Both components can be rebuilt from source and mirrored as signed OCI artifacts.
- Exit paths exist: another SPIFFE implementation can replace SPIRE; another secret broker can replace OpenBao behind the project-owned identity and lease contract.

### Retained as secondary tools

- **SOPS + age:** offline bootstrap packets, encrypted declarative configuration, and emergency recovery exports.
- **Hardware security module or PKCS#11 device:** protection for online intermediate keys after measured operational testing.
- **systemd credentials:** local delivery mechanism for bootstrap material on Linux hosts.

None may become the only canonical authority or sole recovery path.

### Deferred

- Full HSM-backed auto-unseal: deferred until two-vendor recovery and hardware-loss drills succeed.
- Multi-region SPIRE federation: deferred until one trust domain survives root rotation and clean-host restoration.
- Secret zero: not claimed. Bootstrap always begins from some physical or institutional root; the goal is explicit custody, threshold control, and replaceability.

## Ownership boundary achieved

The project owns the design and enforcement for:

- trust-domain namespace;
- workload registration policy;
- selector-to-identity mapping;
- secret access policy;
- credential TTL and revocation;
- OpenBao storage and audit configuration;
- root and recovery ceremonies;
- backup and restore acceptance;
- separation of build, release, and runtime authority;
- migration and replacement contracts.

The project does not physically own merely by operating this software:

- CPU, firmware, disks, HSM manufacturing, or datacenter facilities;
- electricity;
- domain registration and DNS roots;
- public certificate authorities;
- internet transit;
- upstream SPIRE, OpenBao, Linux, or cryptographic-library maintenance.

The defensible claim is that none is the sole intelligence, canonical secret authority, release authority, or recovery path.

## Remaining risks

- Kernel or root compromise can impersonate local workloads and read process memory.
- SPIRE server or intermediate-key compromise can mint identities until revocation/rotation completes.
- OpenBao compromise can issue or expose secrets within reachable policy scope.
- Audit logs can leak sensitive metadata and require separate integrity and retention controls.
- Raft quorum and restore operations create real operational burden.
- Threshold shares can be lost, colluded, coerced, or mishandled.
- Clock failure can invalidate short-lived identity and lease behavior.
- Applications may copy dynamic credentials into logs, caches, crash dumps, or telemetry.
- A single operator remains a procedural dependency until ceremonies and runbooks are exercised by multiple people.
- HSM adoption can create a new proprietary recovery dependency if raw or standards-based export is impossible.

## Cost and operational implications

Minimum production footprint:

- three OpenBao nodes;
- one or more SPIRE servers, preferably three when identity availability becomes critical;
- one SPIRE agent per runtime node;
- independent audit storage;
- encrypted off-cluster snapshots;
- clean recovery capacity;
- monitoring for lease failures, audit-device failure, Raft health, certificate expiry, clock drift, and attestation rejection.

Software license cost is zero. The real cost is 24/7 patching, key ceremonies, quorum operations, audit retention, recovery drills, application integration, and multi-person procedural competence.

## Next falsifiable build step

Create a network-isolated integration harness:

```text
start a three-node OpenBao Raft cluster
→ enable two independent audit devices
→ initialize threshold recovery and remove root token
→ start SPIRE server and agent with a project trust domain
→ register one fixture workload by Unix selectors
→ obtain a short-lived X.509-SVID from the local Workload API
→ authenticate that SVID to OpenBao
→ issue a 60-second dynamic PostgreSQL credential
→ use it successfully once
→ revoke the SPIFFE registration entry and OpenBao lease
→ prove identity renewal fails
→ prove database authentication fails after revocation/expiry
→ kill one OpenBao node and preserve service
→ kill quorum and require writes to stop
→ restore OpenBao and SPIRE state on clean hosts from independent copies
→ repeat issuance without external identity, cloud KMS, or internet access
→ rotate the SPIRE intermediate and OpenBao auth trust
→ prove old credentials fail and new credentials succeed
→ record RTO, credential lifetime, revocation latency, manual steps, and all hidden external dependencies
```
