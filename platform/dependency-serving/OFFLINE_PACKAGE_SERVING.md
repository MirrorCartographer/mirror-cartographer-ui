# Offline package-serving and restore plane

## Decision

Use a small read-only npm registry projection backed by the immutable dependency vault and the admitted `package-lock.json`.

The serving process is disposable. The authoritative inputs are:

1. the reviewed lockfile;
2. the immutable content-addressed tarball vault;
3. the canonical vault index and its independent signature;
4. independently restorable copies of all three.

The server has no publish endpoint, no upstream proxy, no fallback registry and no database. It reconstructs npm package metadata from lockfile descriptors and maps every tarball request to one admitted vault object.

## Required deployment boundary

Bind the server to loopback or a private build network. Place TLS and client authentication at the project-owned reverse proxy. Release workers must route npm only to this endpoint and must have no general internet egress.

Example:

```bash
VAULT_DIR=/srv/foundation/npm-vault \
LOCKFILE=/srv/foundation/admissions/package-lock.json \
HOST=127.0.0.1 \
PORT=4873 \
PUBLIC_BASE_URL=https://packages.internal.example \
node platform/dependency-serving/vault-registry.mjs
```

Release-worker `.npmrc`:

```ini
registry=https://packages.internal.example/
strict-ssl=true
ignore-scripts=true
audit=false
fund=false
```

The lockfile must have been generated against npm's default registry semantics or rewritten and re-admitted for this endpoint. npm documents that default-registry lockfile resolutions can follow the currently configured registry, while lockfiles generated against a custom registry remain bound to that registry.

## Invariants

- Startup fails if a vault record is absent from the lockfile.
- Startup fails when name, version, integrity, size or path custody disagree.
- Blob paths may not escape the vault directory.
- Two conflicting descriptors for the same package version are rejected.
- Unknown packages return `404 package_not_admitted`.
- Only `GET` and `HEAD` are accepted.
- Tarballs are rehashed on every delivery and are withheld after mutation.
- Package metadata is derived only from admitted lockfile fields.
- The endpoint never requests an upstream resource.
- Server destruction cannot destroy canonical package custody.

## Adversarial reviews

### Before adoption

**Verdaccio as canonical authority — rejected.** Verdaccio is useful as a replaceable compatibility adapter, but a proxy cache can contain partial state and couples recovery to its storage representation.

**Static web server alone — rejected.** It can serve tarballs but does not provide the package metadata endpoint npm expects for ordinary registry resolution and does not enforce lock/index agreement.

**npm cache seeding — rejected as recovery authority.** npm defines its cache as disposable and may remove or refetch content.

**Rewrite the lockfile to `file:` URLs — retained only as emergency exit.** This can restore a build without an HTTP service, but it mutates the admitted build input and requires a separately authorized lockfile transformation.

### After artifact production

The implementation was challenged for:

- path traversal through encoded package names;
- unknown-package fallback;
- post-start blob mutation;
- lock/index disagreement;
- size disagreement;
- duplicate package-version metadata conflict;
- non-read HTTP methods;
- hidden runtime dependency on npmjs.org.

The design now rejects or structurally eliminates each condition.

### Verification review

The included harness proves the following with a synthetic admitted package:

1. health and package metadata are served;
2. the exact tarball bytes are served;
3. an unadmitted package is denied;
4. a mutated vault object is not delivered.

It does not yet prove a real `npm ci` for the application because the repository still lacks an admitted real lockfile and populated vault.

## Build-versus-buy

### Adopted: project-owned minimal adapter

Advantages:

- zero mutable registry state;
- no package publication surface;
- no upstream fallback code path;
- no database backup requirement;
- complete rebuild from canonical inputs;
- small auditable trusted code base;
- standard npm metadata and tarball interfaces.

Costs:

- project owns compatibility testing across pinned npm versions;
- metadata fields required by unusual packages may need explicit support;
- no search, publishing, user management or replication UI;
- high request volumes require a reverse-proxy cache or replicated read-only instances.

### Rejected as authority: Verdaccio

It may be deployed as a disposable mirror or developer convenience layer after the minimal server is proven. It may not become the canonical package store or sole restore path.

### Rejected as authority: hosted npm registries

GitHub Packages, npm Enterprise alternatives and cloud artifact registries remain optional mirrors. Account access, billing, retention and provider availability cannot determine whether a release build is reconstructible.

### Deferred: full self-hosted package platform

A larger package service is justified only if Foundation Intelligence begins publishing many internal packages with independent lifecycles, access controls and retention policies. Until then it expands patching and recovery burden without improving custody.

## Ownership boundary achieved

The project owns:

- package admission policy;
- lockfile-to-metadata projection;
- tarball routing;
- runtime server code;
- failure behavior;
- canonical vault and index format;
- deployment placement;
- restore inputs;
- migration to any other npm-compatible adapter.

The project does not physically own merely by running this software:

- CPUs, disks or firmware on rented machines;
- electricity;
- domain registration and DNS roots;
- certificate authorities;
- internet transit;
- upstream source repositories;
- npm client implementation.

Those are commodity or upstream dependencies. None is intended to be the canonical dependency authority or sole recovery path.

## Risks and operational implications

- npm protocol behavior can change; pin npm and run compatibility tests before upgrades.
- A valid tarball can still contain malicious code.
- Lifecycle scripts remain disabled unless separately admitted.
- Native packages and browser binaries require platform-specific custody.
- Rehashing every response consumes CPU; a verified reverse-proxy cache may be needed at scale.
- The current server loads metadata at startup; vault promotion requires restart or atomic instance replacement.
- TLS and client identity are delegated to the reverse proxy and must be tested independently.
- A single operator can still admit a malicious lockfile until threshold review is implemented.

Software license cost is zero. Operational cost includes storage replication, compatibility testing, patching Node, reverse-proxy operation, vault signing, restore drills and independent review.

## Strongest surviving implementation

```text
signed admitted lockfile + signed immutable vault index + content-addressed tarballs
    -> disposable read-only npm adapter
    -> project reverse proxy with TLS and worker identity
    -> network-isolated release workers
```

## Next falsifiable build step

1. Generate and review a real lockfile with a pinned Node/npm toolchain.
2. Populate and sign the real dependency vault.
3. Start the registry on an isolated build network.
4. Run `npm ci --ignore-scripts` with all non-registry egress blocked.
5. Destroy the registry process and working vault copy.
6. Restore from an independent backup and repeat installation.
7. Compare the installed package inventory and application build digest.
8. Mutate one backup blob and require restore verification to fail before service starts.
9. Upgrade the pinned npm client and run the same conformance suite; reject the upgrade on behavior drift.
