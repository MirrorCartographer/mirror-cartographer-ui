# Sovereign scaling and capacity authority

This directory defines the project-owned rules for capacity, horizontal scaling, overload behavior, and scale evidence.

## Surviving design

The project owns workload classification, minimum and maximum capacity, signals, control-loop behavior, downstream budgets, overload policy, evidence, and emergency overrides. Kubernetes HPA, KEDA, systemd/Podman automation, cloud autoscalers, and schedulers are replaceable actuators.

Critical services keep two ready replicas across two failure domains and do not scale to zero. Scale decisions use demand plus saturation signals rather than CPU alone. Missing or stale metrics may prevent scale-down but must not prevent an independently justified scale-up. Scale-down uses a five-minute stabilization window and removes no more than ten percent of replicas per minute.

Scaling is bounded by database connections, queue consumers, external API quotas, storage throughput, and network capacity. When safe capacity is exhausted, the platform applies admission control, priority-aware load shedding, backpressure, and bounded queues instead of accepting unbounded work.

## Threat model

The contract addresses metric poisoning or loss, flapping, slow cold starts, thundering herds, downstream exhaustion, scheduler or provider outage, one-site loss, runaway cost, unsafe scale-to-zero, DNS failure, and a single operator performing destructive capacity changes.

## Evidence required for production

The checked-in inventory is a design fixture. Production evidence must be machine-derived from load-generator results, replica and failure-domain identity, metric timestamps, scale-decision logs, cold-start distributions, graceful-drain results, dependency saturation, rejected or shed work, provider-disconnected manual scaling, and signed operator records.

## Ownership boundary

The project can own the scaling policy, desired-state graph, controller, evidence, budgets, and recovery procedures. It does not physically own CPUs, firmware, datacenter power, ISP networks, BGP, DNS registries, certificate authorities, or every host used as a replaceable execution resource.

## Rejected directions

- Provider autoscaling as canonical authority
- CPU-only scaling
- Unlimited maximum replicas
- Scaling without downstream connection and quota budgets
- Immediate scale-down from noisy metrics
- Scale-to-zero for critical synchronous services
- Autoscaling presented as overload protection
- Queue growth presented as capacity
- One site with many replicas presented as failure independence
- Kubernetes adoption solely to obtain an autoscaler

## Run

```sh
node platform/scaling/verify-scaling-contract.mjs
node platform/scaling/test.mjs
```

## Next destructive laboratory

Generate a project-owned capacity controller and adapters for the current two-host Podman runtime and a Kubernetes HPA comparison environment. Drive representative traffic and queue work; lose metrics, one failure domain, the provider adapter, and public DNS; exhaust database and external API budgets; then prove bounded overload, stable scale decisions, local manual control, and signed reconstruction evidence.
