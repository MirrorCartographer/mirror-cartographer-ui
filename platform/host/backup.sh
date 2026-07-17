#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT=${FOUNDATION_BACKUP_ROOT:-/var/lib/foundation/backups}
DATA_ROOT=${FOUNDATION_DATA_ROOT:-/srv/foundation/data}
STATE_ROOT=${FOUNDATION_STATE_ROOT:-/var/lib/foundation}
RETENTION_DAYS=${FOUNDATION_BACKUP_RETENTION_DAYS:-14}
LOCK=${FOUNDATION_DATA_LOCK:-/run/lock/foundation-data.lock}

# Backups take a shared lock so multiple read-only backup consumers may coexist,
# while restore takes the exclusive side of the same lock. Refuse to snapshot a
# data tree while a restore is replacing it; a mixed-generation archive is not
# valid recovery evidence.
install -d -m 0755 "$(dirname "$LOCK")"
exec 9>"$LOCK"
if ! flock -s -w 30 9; then
  echo "Foundation data is under exclusive mutation; refusing inconsistent backup." >&2
  exit 75
fi

install -d -m 0700 "$BACKUP_ROOT"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
work=$(mktemp -d "$BACKUP_ROOT/.backup-${stamp}.XXXXXX")
trap 'rm -rf "$work"' EXIT

manifest="$work/manifest.txt"
{
  echo "format=foundation-backup-v1"
  echo "created_at=$stamp"
  echo "hostname=$(hostname -f 2>/dev/null || hostname)"
  echo "data_root=$DATA_ROOT"
  if [[ -f "$STATE_ROOT/current-commit" ]]; then
    echo "current_commit=$(cat "$STATE_ROOT/current-commit")"
  else
    echo "current_commit=UNDEPLOYED"
  fi
  if [[ -f "$STATE_ROOT/current-image" ]]; then
    echo "current_image=$(cat "$STATE_ROOT/current-image")"
  else
    echo "current_image=UNDEPLOYED"
  fi
} > "$manifest"

archive="$work/foundation-${stamp}.tar.gz"
paths=("${DATA_ROOT#/}")
[[ -f "$STATE_ROOT/current-commit" ]] && paths+=("${STATE_ROOT#/}/current-commit")
[[ -f "$STATE_ROOT/current-image" ]] && paths+=("${STATE_ROOT#/}/current-image")

tar --one-file-system --numeric-owner -C / -czf "$archive" "${paths[@]}"
tar -tzf "$archive" >/dev/null
sha256sum "$archive" > "$archive.sha256"
cp "$manifest" "$archive.manifest"
chmod 0600 "$archive" "$archive.sha256" "$archive.manifest"

final="$BACKUP_ROOT/$(basename "$archive")"
mv "$archive" "$final"
mv "$archive.sha256" "$final.sha256"
mv "$archive.manifest" "$final.manifest"

find "$BACKUP_ROOT" -maxdepth 1 -type f \
  \( -name 'foundation-*.tar.gz' -o -name 'foundation-*.tar.gz.sha256' -o -name 'foundation-*.tar.gz.manifest' \) \
  -mtime "+$RETENTION_DAYS" -delete

printf '%s\n' "$final"
