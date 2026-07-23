# Foundation OS

Foundation OS is the owned software control plane beneath Mirror Cartographer and future Foundation applications.

It does not claim physical ownership of hardware, internet transit, domain registries, public certificate authorities, or power. It owns the lifecycle decisions that remain portable across those commodities: source admission, normalization, builds, dependencies, artifacts, tests, releases, runtime, identity, secrets, storage, networking policy, observability, recovery, and migration.

## Three modes

1. **Invisible mode** — users interact with applications; subsystem artifacts remain internal.
2. **Archive mode** — every research run, receipt, decision, rejection, and test result remains cataloged.
3. **Operational mode** — admitted controls execute through one living repository and one command surface.

## Command surface

```bash
python3 foundation-os/tools/fia.py status
python3 foundation-os/tools/fia.py verify
python3 foundation-os/tools/fia.py plan
```

## Current phase

Bootstrap establishes the lifecycle graph, capability registry, verification command, and archive catalog. Capability implementations migrate into this tree incrementally. Nothing in this branch changes production.
