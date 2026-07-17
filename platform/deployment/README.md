# Sovereign Deployment and Rollback Plane

## Authority

The project-owned deployment controller consumes an admitted release-manifest digest and an immutable desired-state revision. It verifies the release, artifact bytes, deployment policy, host state, capacity, failure domains, schema compatibility, and clock safety before invoking a replaceable runtime adapter.

Nomad, Kubernetes, systemd/Podman, cloud deployment APIs, and reverse proxies are actuators. Their status is evidence, not canonical deployment truth.

## Initial implementation

Use a small project controller with a Nomad adapter first. Nomad supports canary, rolling, and blue/green strategies, manual promotion, health deadlines, and automatic reversion. The same canonical deployment document must later drive a systemd/Podman adapter and a Kubernetes adapter to prove the scheduler is replaceable.

Critical services use one canary, manual promotion, a minimum healthy interval, external semantic probes, error-budget gates, and a maximum 25% destructive rollout rate. The old admitted revision remains running or locally restartable until acceptance evidence is signed.

## Rollback

Rollback is a new signed deployment decision referencing a previously admitted release. It never relies on moving a mutable tag backward. Database compatibility must already exist through expand/contract migrations. Rollback must work with the registry, GitHub, public DNS, and provider deployment APIs unavailable.

## Evidence

Production evidence includes release and policy digests, target-host artifact rehashes, desired and observed runtime-state digests, allocation identities, readiness and semantic results, traffic-shift records, connection-drain results, operator identity, and the retained rollback point.

## Adversarial boundary

A healthy process is not necessarily a healthy release. Readiness can pass while writes fail, schema semantics differ, authorization is broken, or only internal routing works. Promotion therefore requires application-level probes and independent external observation.

Automatic rollback can also amplify failure when the previous application version is incompatible with a completed schema change. Database compatibility is checked before rollout and again before rollback authorization.

## Ownership boundary

### Project-owned

Release-to-deployment mapping, desired-state schema, admission policy, rollout strategy, health semantics, promotion rules, rollback authority, runtime-state evidence, adapter interfaces, and recovery procedure.

### Replaceable

Nomad, Kubernetes, systemd, Podman, container runtimes, schedulers, proxies, VMs, physical hosts, and cloud deployment APIs.

### Not physically owned

CPUs, firmware, facilities, power, ISP networks, internet transit, BGP, DNS roots, registrars, public CAs, and upstream hardware supply chains.
