#!/usr/bin/env bash
set -euo pipefail

: "${COSIGN_KEY:?set COSIGN_KEY to the encrypted project signing key path or supported KMS URI}"
ENVELOPE=${1:?usage: sign-release.sh release-envelope.json [bundle.json]}
BUNDLE=${2:-release-envelope.sigstore.json}
command -v cosign >/dev/null || { echo 'cosign is required' >&2; exit 127; }

umask 077
cosign sign-blob --yes --key "$COSIGN_KEY" --bundle "$BUNDLE" "$ENVELOPE"
chmod 0600 "$BUNDLE"
printf '%s\n' "$BUNDLE"
