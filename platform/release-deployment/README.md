# Sovereign Release and Deployment Plane

## Authority

The project owns the release ledger, verification policy, deployment desired state, promotion gates, rollback classification, and evidence. GitHub, registries, Sigstore services, Nomad, HAProxy, and hosted deployment products are replaceable mechanisms.

A release is a signed decision binding an artifact digest to provenance, SBOM, vulnerability evidence, configuration compatibility, migration policy, and a monotonic sequence. A deployment is a separate signed decision binding that release to an environment and rollout plan.

## Surviving flow

```text
artifact and attestations
        ↓
offline-capable verification
        ↓
signed release manifest
        ↓
signed environment deployment plan
        ↓
shadow and canary stages
        ↓
semantic and comparative gates
        ↓
separate promotion authority
        ↓
bounded traffic shift
        ↓
post-deployment verification
```

## Rollback boundary

Traffic rollback, application rollback, database rollback, queue replay, and external-effect compensation are distinct operations. Automatic rollback is allowed only for changes classified as reversible code-only changes with proven backward compatibility. Destructive schema or external-effect changes require a forward fix or explicit two-person data-recovery action.

## Ownership boundary

### Project-owned

Release manifest, sequence, verification policy, signer quorum, deployment plan, environment binding, stage gates, promotion decision, rollback manifest, traffic evidence, and recovery.

### Replaceable

Cosign, in-toto, SLSA tooling, TUF clients, Nomad, systemd, HAProxy, registries, GitHub, hosted CD services, VMs, and physical hosts.

### Not physically owned

Hardware fabrication, public transparency services, OIDC providers, public networks, DNS, domain registration, internet transit, facilities, and utility power.
