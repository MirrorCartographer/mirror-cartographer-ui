#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root or with sudo." >&2
  exit 1
fi

archive=${1:?Usage: restore-backup.sh /path/to/foundation-*.tar.gz}
checksum="$archive.sha256"
LOCK=${FOUNDATION_DATA_LOCK:-/run/lock/foundation-data.lock}
[[ -f "$archive" ]] || { echo "Backup not found: $archive" >&2; exit 1; }
[[ -f "$checksum" ]] || { echo "Checksum not found: $checksum" >&2; exit 1; }

(
  cd "$(dirname "$archive")"
  sha256sum -c "$(basename "$checksum")"
)
tar -tzf "$archive" >/dev/null

case "$(tar -tzf "$archive")" in
  *"../"*|*"/../"*)
    echo "Unsafe path detected in backup; refusing restore." >&2
    exit 1
    ;;
esac

# Restore owns the data tree exclusively from shutdown through final sync. This
# is the exclusive counterpart to backup.sh's shared lock and prevents backups,
# peer-triggered reads, or duplicate restore attempts from observing a partially
# replaced persistent state.
install -d -m 0755 "$(dirname "$LOCK")"
exec 9>"$LOCK"
if ! flock -x -w 30 9; then
  echo "Foundation data is busy; refusing concurrent restore mutation." >&2
  exit 75
fi

if systemctl is-active --quiet foundation-deploy.service; then
  systemctl stop foundation-deploy.service
fi
if command -v docker >/dev/null 2>&1 && [[ -f /opt/foundation/compose.yaml ]]; then
  (cd /opt/foundation && docker compose down) || true
fi

restore_stage=$(mktemp -d /var/lib/foundation/.restore.XXXXXX)
trap 'rm -rf "$restore_stage"' EXIT
tar --numeric-owner -C "$restore_stage" -xzf "$archive"

install -d -m 0750 /srv/foundation /var/lib/foundation
if [[ -d "$restore_stage/srv/foundation/data" ]]; then
  rm -rf /srv/foundation/data.restore
  mv "$restore_stage/srv/foundation/data" /srv/foundation/data.restore
  rm -rf /srv/foundation/data.previous
  [[ -d /srv/foundation/data ]] && mv /srv/foundation/data /srv/foundation/data.previous
  mv /srv/foundation/data.restore /srv/foundation/data
fi

for marker in current-commit current-image; do
  if [[ -f "$restore_stage/var/lib/foundation/$marker" ]]; then
    install -m 0600 "$restore_stage/var/lib/foundation/$marker" "/var/lib/foundation/$marker"
  fi
done

sync
printf 'Restore completed from %s. Run sudo /opt/foundation/deploy.sh to reconstitute the active containers.\n' "$archive"
