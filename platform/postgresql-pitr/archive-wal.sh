#!/usr/bin/env bash
set -euo pipefail
: "${FI_WAL_ARCHIVE:?set FI_WAL_ARCHIVE}"
src=${1:?source WAL path required}
name=${2:?WAL filename required}
[[ "$name" =~ ^[0-9A-F]{24}(\.partial)?$|^[0-9A-F]{8}\.history$|^[0-9A-F]{24}\.[0-9A-F]{8}\.backup$ ]] || { echo "reject invalid WAL name" >&2; exit 64; }
mkdir -p "$FI_WAL_ARCHIVE"
tmp="$FI_WAL_ARCHIVE/.${name}.$$"
dst="$FI_WAL_ARCHIVE/$name"
if [[ -e "$dst" ]]; then
  cmp -s "$src" "$dst" || { echo "immutable WAL collision: $name" >&2; exit 65; }
  exit 0
fi
install -m 0600 "$src" "$tmp"
sync "$tmp"
mv -n "$tmp" "$dst" || true
if ! cmp -s "$src" "$dst"; then rm -f "$tmp"; echo "archive verification failed: $name" >&2; exit 66; fi
sha256sum "$dst" > "$dst.sha256.tmp"
mv "$dst.sha256.tmp" "$dst.sha256"
sync "$FI_WAL_ARCHIVE"
