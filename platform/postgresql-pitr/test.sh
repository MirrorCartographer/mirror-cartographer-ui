#!/usr/bin/env bash
set -euo pipefail
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
export FI_WAL_ARCHIVE="$root/archive"
mkdir -p "$FI_WAL_ARCHIVE"
name=000000010000000000000001
printf original > "$root/wal"
bash "$(dirname "$0")/archive-wal.sh" "$root/wal" "$name"
bash "$(dirname "$0")/restore-wal.sh" "$name" "$root/restored"
cmp "$root/wal" "$root/restored"
printf evil > "$root/evil"
if bash "$(dirname "$0")/archive-wal.sh" "$root/evil" "$name" 2>/dev/null; then exit 1; fi
printf x >> "$FI_WAL_ARCHIVE/$name"
if bash "$(dirname "$0")/restore-wal.sh" "$name" "$root/rejected" 2>/dev/null; then exit 1; fi
node "$(dirname "$0")/verify-pitr-contract.mjs" "$(dirname "$0")/postgresql.conf.fragment" "$(dirname "$0")/archive-wal.sh" "$(dirname "$0")/restore-wal.sh"
echo 'PASS PITR archive/restore negative controls'
