# Sovereign Hosting Runtime and Scaling Substrate

## Surviving architecture

The project owns a canonical node inventory, immutable host-image digest, workload specification, placement constraints, resource-isolation policy, maintenance state machine, scaling bounds, and runtime evidence.

Nomad with Podman is the first scheduler/runtime adapter. systemd with Podman is the mandatory secondary adapter. Kubernetes may be added later. Scheduler state, provider instance state, and autoscaler recommendations are observations and actuations—not canonical runtime truth.

## Runtime path

signed deployment decision
→ admitted immutable host image
→ drift-free node inventory
→ digest-pinned workload specification
→ scheduler adapter
→ rootless workload
→ cgroup v2 CPU/memory/PID/I/O controls
→ seccomp and capability allowlist
→ workload identity
→ health and pressure evidence
→ signed observed runtime state

## Isolation boundary

cgroup v2 limits resource consumption but does not constitute a separate kernel. Containers share the host kernel. High-risk build or plugin workloads require a microVM or dedicated host boundary.

Every ordinary workload gets explicit CPU, memory, PID, and where needed I/O limits. Rootless execution, read-only root filesystems, seccomp, and capability allowlists are defaults. Host PID, host networking, privileged mode, host mounts, and runtime sockets require explicit exceptions; privileged exceptions require two operators.

Pressure Stall Information, cgroup OOM events, disk pressure, and network pressure are operational admission signals. A process can remain alive while the host is effectively saturated.

## Placement and capacity

Critical replicas use anti-affinity across independent failure domains. Resource requests and limits are mandatory. CPU may be intentionally burstable; critical memory is not overcommitted. Stateful placement binds storage, failure domain, architecture, and kernel-feature requirements explicitly.

At least 25% maintenance reserve is retained so one node can drain without violating critical replica or quorum requirements.

## Scaling authority

Autoscalers calculate recommendations. Project policy authorizes bounds and destructive changes.

Scale-down requires fresh metrics, stabilization, a post-removal capacity recheck, downstream dependency-budget recheck, disruption-budget and quorum checks, and no more than a 10% reduction per action.

A provider cluster-scaling plugin may create or terminate commodity hosts, but the project controller validates each resulting node against the canonical host image and node-admission policy before workloads can be placed.

## Scheduler-loss continuity

Running workloads must continue when the scheduler control plane is unavailable. Critical artifacts and specifications remain in project custody on or near the runtime sites. Operators must be able to start admitted workloads locally through the systemd/Podman adapter without GitHub, the provider API, public DNS, or the original registry.

## Ownership boundary

### Project-owned
Node inventory, host image, workload specification, placement policy, isolation policy, maintenance and eviction authority, scaling bounds, adapter contract, evidence, and clean-host reconstruction.

### Replaceable
Nomad, Podman, systemd, Kubernetes, containerd, Firecracker, VMs, bare-metal hosts, autoscalers, provider instance APIs, and capacity providers.

### Not physically owned
CPU virtualization behavior, kernel and firmware lineage, hardware fabrication, facilities, power, network transit, BGP, DNS, public CAs, and provider physical operations.

## Remaining proof obligations

Live cgroup enforcement, OOM behavior, PSI-based saturation detection, seccomp denial, rootless containment, host-kernel escape resistance, stateful placement, scheduler outage, manual local start, connection-preserving drain, host-image rollback, provider-capacity loss, and cross-adapter equivalence remain to be demonstrated.
