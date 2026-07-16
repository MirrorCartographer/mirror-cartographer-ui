#!/usr/bin/env bash
set -euo pipefail
: "${FI_WAL_ARCHIVE:?set FI_WAL_ARCHIVE}"
name=${1:?WAL filename required}
dst=${2:?restore destination required}
[[ "$name" =~ ^[0-9A-F]{24}(\.partial)?$|^[0-9A-F]{8}\.history$|^[0-9A-F]{24}\.[0-9A-F]{8}\.backup$ ]] || exit 64
src="$FI_WAL_ARCHIVE/$name"
[[ -f "$src" && -f "$src.sha256" ]] || exit 1
( cd "$FI_WAL_ARCHIVE" && sha256sum -c "$name.sha256" >/dev/null ) || exit 65
install -m 0600 "$src" "$dst"
cmp -s "$src" "$dst" || exit 66
