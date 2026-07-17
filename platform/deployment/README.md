# Sovereign deployment and runtime contract

This directory defines project-owned deployment admission over replaceable Linux hosts. The fixture is design evidence, not proof of a live deployment.

## Authority model

A deployment is admissible only when an already admitted release digest is present in local custody, started by a rootless and resource-bounded runtime, exposed only through the reverse proxy, health-gated on two failure domains, and reversible without registry or public-DNS access.

The initial mechanism is rootless Podman managed by systemd Quadlet. Podman and systemd are replaceable mechanisms; `policy.json`, release admission, promotion quorum, deployment evidence, and rollback authority belong to the project.

## Required production sequence

1. Verify the signed release envelope and artifact digest.
2. Copy the current and previous OCI artifacts into host-local custody.
3. Generate blue and green Quadlet units from admitted configuration.
4. Start the inactive slot with a read-only root filesystem, no new privileges, all capabilities dropped, and CPU/memory limits.
5. Run process, HTTP, dependency, and semantic health tests.
6. Obtain two distinct promotion approvals.
7. Atomically switch reverse-proxy routing while keeping zero unavailable replicas.
8. Observe error, latency, saturation, and semantic probes.
9. Automatically route back to the cached prior digest on failure.
10. Sign and retain deployment evidence; continuously detect configuration drift.

## Explicit non-claims

This contract does not prove that Podman, systemd, the kernel, firmware, hosts, switches, ISP transit, DNS registries, or certificate authorities are physically owned. It establishes project control over deployment decisions and recovery paths while treating infrastructure as replaceable capacity.

## Current limitations

The inventory is declarative. Production evidence must be generated from live image inspection, systemd unit properties, cgroup limits, socket listeners, health results, reverse-proxy state, operator signatures, and an observed rollback during registry and DNS failure.

Run:

```sh
node platform/deployment/verify-deployment-contract.mjs
node platform/deployment/test.mjs
```
