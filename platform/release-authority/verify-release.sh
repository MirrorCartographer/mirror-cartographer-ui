#!/usr/bin/env bash
set -euo pipefail

PUBKEY=${1:?usage: verify-release.sh public-key.pem release-envelope.json bundle.json provenance.json sbom-file}
ENVELOPE=${2:?missing release envelope}
BUNDLE=${3:?missing signature bundle}
PROVENANCE=${4:?missing provenance}
SBOM=${5:?missing SBOM}
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
command -v cosign >/dev/null || { echo 'cosign is required' >&2; exit 127; }

cosign verify-blob --key "$PUBKEY" --bundle "$BUNDLE" "$ENVELOPE"
node "$ROOT/verify-release-envelope.mjs" "$ROOT/policy.json" "$ENVELOPE" "$PROVENANCE" "$SBOM"
