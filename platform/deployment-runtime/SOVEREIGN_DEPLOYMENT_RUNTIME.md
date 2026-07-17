# Sovereign Deployment, Rollback, and Runtime Admission

## Decision

Foundation Intelligence will use a project-owned deployment admission controller around rootless Podman/Quadlet and systemd, with blue/green application slots behind a separately operated reverse proxy.

The runtime is an executor, not release authority. It may start only an OCI digest already admitted by the project release-authority plane. A hosting provider, container registry, CI system, scheduler, or reverse proxy cannot promote an artifact by itself.

## Trust decomposition

1. The build plane produces an unsigned candidate and evidence.
2. Release authority signs a digest-bound release envelope.
3. Deployment admission verifies the signature and semantic policy offline.
4. The runtime pulls the exact digest and independently compares the local image digest.
5. A candidate slot starts on a loopback-only port.
6. Health and behavioral admission execute before traffic changes.
7. The reverse proxy switches to the candidate through an atomic local pointer/config replacement.
8. The candidate remains under a stabilization watch.
9. Failure switches traffic back to the prior admitted slot.
10. The deployment journal records the decision and outcome.

Release, deployment, and public ingress are separate authorities.

## Strongest surviving initial implementation

The executable prototype is `deploy-blue-green.sh`. It requires:

- a digest-only OCI reference;
- a readable release envelope;
- an external admission command;
- an independently resolved runtime digest;
- a single deployment lock;
- rootless, non-privileged container execution;
- a read-only root filesystem;
- all capabilities dropped;
- no-new-privileges;
- loopback-only application ports;
- consecutive candidate health successes;
- an atomic active-slot pointer;
- post-switch stabilization monitoring;
- automatic traffic restoration;
- a prior admission record for rollback;
- an append-only deployment journal.

The prototype intentionally does not manage TLS, DNS, database migrations, release signing, or secrets. Those are separate control planes and must not be hidden inside a deployment script.

## Runtime choice

### Adopted for the first host class: rootless Podman plus Quadlet/systemd

Reasons:

- standard OCI images and digest references;
- no mandatory cluster datastore;
- systemd owns restart, ordering, logging, and host boot integration;
- rootless operation narrows host privilege;
- Quadlet configuration is plain text and can be generated from project policy;
- a host can be rebuilt without recovering a proprietary scheduler database;
- migration to Kubernetes, Nomad, Swarm, or another OCI executor remains possible because admission and release evidence are external.

Rootless is risk reduction, not a sandbox proof. Kernel, user-namespace, container-runtime, and host-root compromise remain trusted-computing-base risks.

### Deferred: Kubernetes

Kubernetes supplies scheduling, rollout objects, service discovery, policy integrations, and ecosystem depth. It also creates a substantial control plane: etcd recovery, API-server identity, admission webhooks, CNI, CSI, certificates, controller upgrades, and version-skew management.

It becomes justified when measured requirements exceed the single-host or small replicated-cell model: many services, many nodes, frequent rescheduling, heterogeneous teams, or automated capacity placement. Adopting it before those requirements are measured would convert sovereignty into control-plane maintenance.

### Deferred: Nomad

Nomad has a smaller surface than Kubernetes and is a credible multi-node scheduler. Its server quorum, ACL bootstrap, state snapshots, gossip encryption, service discovery, and optional Consul/Vault integrations still create recovery dependencies. It remains an exit-compatible executor, not release authority.

### Rejected as canonical authority: hosted deployment platforms

Hosted platforms may run read-only mirrors or emergency capacity. They may not hold the only deployment state, domain routing, release secret, artifact copy, or rollback procedure.

### Rejected: orchestrator-native rollback as the only rollback record

A scheduler generally remembers only recent service configuration. Loss or corruption of scheduler state can erase rollback history. Project-owned admitted release records and recovery copies are required outside the runtime.

## Adversarial review before adoption

### Deploying mutable tags

Rejected. A tag can move between admission and pull, or between hosts. Every runtime reference must contain `@sha256:` and the pulled image must be inspected before start.

### In-place replacement

Rejected. Stopping the only healthy instance before candidate admission creates unnecessary outage and makes rollback dependent on a second pull or rebuild.

### Health means process is running

Rejected. Process liveness is weaker than readiness and behavioral correctness. The initial prototype checks HTTP readiness; production admission must add release-specific invariants such as dependency reachability, schema compatibility, build identity, and critical Reader behavior.

### Deployment worker can sign or release

Rejected. A host able to switch traffic must not possess the root release key. It verifies authorization; it does not create it.

### Rollback bypasses current policy

Rejected. Rollback is another deployment of a previously admitted digest. It must satisfy signature, custody, secrets, and compatibility policy.

### Database migration inside application startup

Rejected for destructive changes. A new application may switch traffic only after an expand/contract migration demonstrates backward compatibility with both old and new application versions. Destructive contraction is a separately authorized later release after rollback windows close.

## Adversarial review after artifact production

The policy verifier and mutation harness challenge:

- mutable tags;
- public application binds;
- missing runtime digest comparison;
- release workers granted traffic-switch authority;
- rollback without prior admission;
- destructive schema changes in the same release;
- missing stabilization rollback;
- privileged runtime configuration;
- absent deployment serialization.

The implementation still has unresolved weaknesses:

1. Shell command environment variables are flexible but require a tightly controlled systemd unit and sanitized environment.
2. The journal is append-only by convention, not cryptographically chained or stored on append-only media.
3. HTTP health alone cannot detect semantic corruption.
4. A compromised runtime host can alter proxy state, fake local health, or replace deployment evidence.
5. `slirp4netns` availability and behavior depend on Podman version and host configuration.
6. The script directly uses Podman for the prototype; production should generate and install Quadlet units, then let systemd own process lifecycle.
7. Proxy reload success is not followed by an external-path probe in the prototype.
8. Old slot retention and garbage collection are policy fields but not fully implemented.
9. A single-host blue/green design survives bad releases, not host or site loss.

These weaknesses narrow the current claim to local deployment admission and reversible slot switching.

## Reverse proxy boundary

The reverse proxy is the only public application ingress. Application slots bind loopback only.

The proxy configuration must be generated from the active-slot pointer and validated before reload. A reload must preserve the existing configuration on parse or activation failure. The deployment verifier must then probe both:

- the candidate directly on loopback before switching; and
- the public or internal ingress route after switching.

Caddy is the leading initial option because it supports active health checks and atomic configuration reload behavior, but the project-owned upstream file and switching protocol must remain independent of Caddy. HAProxy and nginx are viable replacements.

TLS and DNS remain separate capabilities. A successful local switch does not prove certificate validity, DNS propagation, external routing, or internet reachability.

## Multi-host scaling model

The first scaling step is replicated cells, not a single large scheduler:

- each cell has an independently rebuildable runtime host;
- each cell admits the same signed digest;
- a project-owned load-balancing layer adds a cell only after remote behavioral checks;
- deployment proceeds one cell at a time;
- failure removes the candidate cell and leaves earlier cells serving;
- stateful services remain outside application containers.

This limits blast radius and preserves an exit path to a scheduler later. It costs more capacity during rollout and requires explicit cross-cell consistency tests.

## Rollback and database compatibility

Every production release must declare:

- previous compatible application digest(s);
- minimum and maximum compatible schema version;
- whether rollback is code-only or requires data repair;
- migration phase: expand, backfill, verify, contract;
- rollback deadline;
- irreversible operations;
- required feature-flag state.

The deployment controller must reject a release when the live schema falls outside its declared compatibility range.

A rollback target must have:

- a valid release envelope;
- a prior successful admission record;
- an available canonical OCI artifact;
- currently valid secret and identity policy;
- schema compatibility evidence;
- a successful recent behavioral test or an explicit emergency authorization.

## Evidence and recovery

Deployment records must eventually be hash-chained and signed. Minimum record fields:

- release envelope digest;
- OCI digest;
- source commit;
- previous digest;
- target cell and slot;
- runtime image digest observed after pull;
- admission-policy version;
- health and behavioral test results;
- proxy configuration digest;
- operator/workload identity;
- timestamps from a monitored clock source;
- rollback outcome;
- database schema version;
- secrets-policy version.

The deployment state is recoverable when a clean host can consume project-owned records, pull or restore the admitted OCI digest, recreate Quadlet units, reconstruct proxy state, and resume service without the original hosting account.

## Ownership boundary

The project owns:

- release-to-runtime admission policy;
- digest selection;
- deployment and rollback records;
- slot-switching protocol;
- health and behavioral acceptance criteria;
- runtime configuration generation;
- reverse-proxy upstream state;
- migration compatibility policy;
- recovery procedure;
- executor replacement contract.

The project does not automatically own:

- physical servers, CPUs, firmware, disks, switches, or power;
- host kernel and container-runtime upstream maintenance;
- domain registration or registry policy;
- DNS root and TLD operation;
- public certificate authorities;
- ISP routing, DDoS capacity, or internet transit;
- rented datacenter access.

Those may remain commodity dependencies. None may be the sole artifact source, release authority, deployment record, traffic-switch procedure, or recovery path.

## Operational and cost implications

Blue/green deployment requires spare capacity for two versions during rollout. A replicated-cell rollout can require more than double steady-state application capacity while preserving rollback and site-level safety.

Project ownership adds:

- Podman/systemd patching;
- host image maintenance;
- reverse-proxy maintenance;
- behavioral probe development;
- deployment-journal custody;
- migration compatibility testing;
- capacity reservation;
- rollback drills;
- clean-host recovery drills;
- multi-person operational training.

A small deployment plane is cheaper in software and more expensive in disciplined operation. The burden must be measured rather than hidden.

## Verification status

The policy, verifier, mutation harness, and deployment prototype are committed. The static/adversarial harness was not executed in the originating environment because that host could not resolve GitHub to clone the updated branch. No Podman daemon, rootless user runtime, reverse proxy, or signed release fixture was available there.

Therefore the truthful status is:

- implementation-ready policy: yes;
- executable local prototype: yes;
- committed negative-control tests: yes;
- local syntax and policy test result in this run: not obtained;
- live digest pull: not tested;
- signed admission: not tested;
- traffic switch: not tested;
- automatic rollback: not tested;
- clean-host recovery: not tested.

## Next falsifiable build step

1. Provision a clean Linux VM with pinned Podman, systemd, and Caddy packages from project custody.
2. Create two fixture OCI images by digest: one healthy and one that fails after startup.
3. Sign release envelopes for both using the project test authority.
4. Install a rootless runtime account with no release-signing credentials.
5. Generate Quadlet units with read-only root filesystems, dropped capabilities, loopback ports, and workload identity sockets.
6. Deploy the healthy digest to the inactive slot.
7. Prove direct readiness and behavioral invariants.
8. Atomically switch Caddy and prove ingress behavior.
9. Deploy the delayed-failure digest.
10. Require automatic restoration to the healthy slot during stabilization.
11. Attempt deployment by mutable tag and require rejection before pull.
12. Substitute a different image under the same repository name and require digest mismatch rejection.
13. Attempt rollback to an unsigned or never-admitted digest and require rejection.
14. Kill the deployment process at every transition point and prove traffic remains on a valid slot.
15. Reboot the host and prove systemd reconstructs the active admitted slot.
16. Destroy the host, restore on a clean VM from independent records and artifact custody, and prove the same digest serves.
17. Measure outage, rollback time, deployment time, spare capacity, operator actions, and failure recovery.

The subsequent capability should be reverse proxy, TLS, DNS, and external-path failure containment, including certificate renewal failure, stale DNS, proxy reload rejection, and loss of one ingress host.
