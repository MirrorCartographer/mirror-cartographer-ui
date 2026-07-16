# Sovereign release runtime

This layer activates a prebuilt static artifact without making GitHub, a CI vendor, a container registry, or a hosting platform the runtime authority.

## Host target

Debian/Ubuntu-compatible host with `caddy`, `curl`, `flock`, `tar`, `sha256sum`, and `systemd`. The release layout is portable to any POSIX host:

```text
/var/lib/foundation-intelligence/
  releases/<artifact-sha-prefix>/
  current -> immutable release
  previous -> prior immutable release
  release.lock
```

## Install

```bash
sudo useradd --system --home /var/lib/foundation-intelligence --shell /usr/sbin/nologin fia-web || true
sudo install -d -o root -g root -m 0755 /var/lib/foundation-intelligence/releases
sudo install -d -o fia-web -g fia-web -m 0750 /var/lib/caddy /var/log/foundation-intelligence
sudo install -d -o root -g root -m 0755 /etc/foundation-intelligence
sudo install -m 0755 platform/runtime/bin/fia-release /usr/local/sbin/fia-release
sudo install -m 0644 platform/runtime/Caddyfile /etc/foundation-intelligence/Caddyfile
sudo install -m 0644 platform/runtime/systemd/foundation-intelligence-web.service /etc/systemd/system/foundation-intelligence-web.service
sudo systemctl daemon-reload
```

## Activate an exact artifact

The artifact must be a gzip-compressed tar archive whose root contains `index.html`.

```bash
sha256sum mirror-cartographer.tar.gz
sudo fia-release activate mirror-cartographer.tar.gz <exact-sha256>
```

Activation is serialized by `flock`, verifies the supplied SHA-256 before extraction, stages into a private directory, rejects malformed bundles, makes the release immutable, atomically swaps the `current` symlink, restarts the supervised server, and rolls back automatically if `/healthz` fails.

## Manual rollback

```bash
sudo fia-release rollback
```

## Security boundary

- Web process runs as the unprivileged `fia-web` account.
- systemd denies privilege escalation, devices, home directories, kernel mutation, writable executable memory, and broad capabilities.
- Releases are immutable after activation.
- Caddy admin API is loopback-only.
- Access logs are bounded by size, count, and age.
- CSP disallows third-party scripts, frames, objects, microphone, camera, and geolocation.
- Secrets do not belong in static artifacts. Future dynamic services must receive secrets through root-owned credential files or systemd credentials.

## Recovery boundary

The minimum independent recovery set is:

1. Source repository mirror.
2. Exact release tarball plus SHA-256 manifest on two independent storage devices.
3. This runtime directory.
4. DNS zone export and registrar recovery credentials stored offline.
5. Host bootstrap notes and Caddy package/version record.

A valid backup is not assumed until restored onto a disposable host and its artifact hash, `/healthz`, root page, and rollback path are verified.

## Adversarial checks

| Failure | Expected result |
| --- | --- |
| Altered archive | Activation exits 65 before extraction. |
| Missing `index.html` | Staging is deleted and current release is untouched. |
| Concurrent activation | Second operator blocks on the release lock. |
| Web process crash | systemd restarts it after 3 seconds. |
| New release unhealthy | `current` returns to the prior target. |
| Operator requests rollback | `current` and `previous` swap atomically. |
| Log growth | Rotation limits one log to 20 MiB, keeps 10, and expires after 30 days. |
| GitHub unavailable | Existing artifact and host remain operational. |
| Container registry unavailable | This package path does not require a registry. |

## Production gate

Do not change public DNS until a preview host has passed artifact verification, health checks, CSP inspection, restart testing, failed-health auto-rollback, manual rollback, backup export, clean-host restore, certificate issuance/renewal simulation, and operator lockout recovery.
