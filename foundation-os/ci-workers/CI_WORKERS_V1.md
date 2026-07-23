# Foundation CI Workers v1

Status: prototype policy accepted by local hostile tests.

## Decision

Run every untrusted build in a single-use worker. Keep scheduling, job admission, artifact acceptance, and evidence policy inside Foundation. Keep production release authority outside CI.

## Authority chain

1. Foundation scheduler accepts a job only after source intake and policy checks succeed.
2. Scheduler creates a short-lived runner registration valid for one job and no more than ten minutes.
3. Orchestrator starts a fresh worker from an immutable image digest.
4. Worker runs rootless with an isolated user namespace, no privileged mode, no host namespaces, no container-engine socket, no host-root mount, and no persistent workspace.
5. Network policy denies all egress, then permits only Foundation source mirrors, dependency mirrors, artifact ingestion, and trusted time service.
6. Job-scoped credentials expire within ten minutes and disappear when the job exits.
7. Worker emits source, image, command, output, and test-result digests.
8. Foundation artifact custody verifies and stores accepted evidence.
9. Orchestrator destroys the worker, workspace, registration, and job credentials after the result is accepted or rejected.
10. CI never signs a production release.

## Strongest surviving implementation

Use Forgejo Actions as the replaceable workflow dispatcher and Forgejo Runner ephemeral registration as the first scheduler implementation. Wrap each job in a fresh rootless Podman container created with user namespace `nomap` or a uniquely allocated `auto` namespace. Run workers on dedicated Linux hosts or virtual machines that contain no canonical state. Rebuild every host from declared configuration.

Treat Forgejo, Podman, Linux, and the worker hardware as implementations, not authorities. Preserve a Foundation-owned job schema, worker policy, evidence schema, registration broker, artifact acceptance gate, and recovery runbook so another dispatcher or container runtime can replace them.

## Build-versus-buy comparison

### Build the full scheduler and runner

Reject for v1. This path creates a large parser, queue, executor, log transport, cancellation, retry, and security-maintenance burden before the isolation model has passed destructive tests.

### Adopt GitHub-hosted runners

Reject as canonical execution. GitHub controls scheduler availability, worker images, job dispatch, logs, quota, and account policy. Keep GitHub Actions as a migration source and non-authoritative replica only.

### Adopt persistent self-hosted runners

Reject. A job can alter later jobs, preserve credentials, poison caches, and turn one repository compromise into durable worker compromise.

### Adopt Kubernetes jobs

Defer. Kubernetes provides scheduling and disposable pods but adds an API server, etcd, CNI, admission controllers, upgrades, certificates, and cluster recovery. Introduce it only after measured concurrency exceeds the simpler host pool.

### Adopt Forgejo Actions with single-use workers

Accept for the first laboratory. Forgejo separates the server from attached runners and current Forgejo releases support one-job ephemeral registrations. The Foundation policy remains portable because workflows, admission rules, evidence, and artifacts stay outside the runner implementation.

## Adversarial review before adoption

- Scheduler compromise can dispatch malicious jobs. Separate scheduler identity from artifact-acceptance identity and reject evidence that lacks the admitted job digest.
- Worker escape can reach the host. Run rootless, allocate subordinate IDs, deny host sockets and namespaces, patch the kernel, and place high-risk jobs in disposable virtual machines.
- Dependency download can exfiltrate data or change between builds. Deny public egress and use pinned Foundation mirrors.
- Persistent caches can become canonical state or cross-job infection paths. Make caches content-addressed, read-only on intake, disposable on suspicion, and excluded from release evidence.
- Logs can leak credentials. Redact at ingestion, reject unbounded logs, and use short-lived job-scoped files rather than inherited environment variables where practical.
- A single operator can lose the runner fleet. Store no canonical state on runners and require a second operator to rebuild one worker from policy and image digest.

## Prototype and verification

`worker-policy.json` encodes the enforceable v1 boundary. A local verifier and hostile fixture suite exercised seven cases:

- accept the valid policy
- reject a reusable runner
- reject a mounted container-engine socket
- reject default-allow networking
- reject a long-lived job credential
- reject release authority inside CI
- reject a persistent workspace

Result: seven tests passed and the valid policy returned `ACCEPT`.

Publication of the verifier source was blocked by the repository connector during this run. Keep the accepted policy and this implementation specification as the committed artifact; repeat the test inside repository CI when the connector permits the verifier file.

## Verification adversarial review

The policy proves declared intent, not kernel isolation. It does not prove Podman containment, Forgejo registration deletion, network enforcement, credential deletion, or host recovery. The next laboratory executes those claims on a disposable host and treats any surviving process, file, registration, network route, or credential as failure.

## Ownership boundary achieved

Foundation owns:

- worker admission policy
- workflow authority
- registration issuance rules
- execution-image digests
- isolation requirements
- evidence requirements
- artifact acceptance
- recovery procedure

Foundation does not yet own:

- CPU fabrication
- motherboard firmware
- electrical power
- physical premises unless purchased
- upstream Linux and Podman code
- internet transit
- Forgejo implementation maintenance

Dedicated owned hardware increases physical custody but does not eliminate firmware, power, transit, or upstream software dependencies.

## Operational and cost implications

A two-host starting pool carries hardware purchase, replacement disks, UPS capacity, patching, monitoring, spare-parts, and operator time. Rootless containers reduce privilege but do not equal virtual-machine isolation. High-risk public pull requests consume a disposable VM boundary and increase boot time and memory use. Kubernetes remains a cost cliff until concurrency justifies its control-plane burden.

## Exit paths

- Export repositories and workflows from Forgejo.
- Replace Forgejo Runner with a Foundation broker that consumes the same job schema.
- Replace Podman with another OCI runtime while preserving worker-image digests and policy tests.
- Move workers between owned servers, rented bare metal, and commodity virtual machines without moving canonical artifacts or release keys.
- Rebuild every runner from the policy, scheduler configuration, and immutable worker image.

## Next falsifiable build step

Provision one disposable Linux host, register one ephemeral Forgejo runner, execute one synthetic hostile job, and verify all of the following after completion:

1. Forgejo deletes the registration.
2. No runner process remains.
3. No workspace file remains.
4. No job credential remains usable.
5. No host or engine socket was visible inside the worker.
6. Public internet access fails.
7. Foundation mirrors remain reachable.
8. Output and test digests reach artifact custody.
9. A second operator rebuilds the worker from a blank host.
10. Replaying the old registration fails.
