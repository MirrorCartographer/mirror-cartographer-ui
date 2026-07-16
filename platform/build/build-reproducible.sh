#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

: "${NODE_IMAGE:?Set NODE_IMAGE to an immutable node image reference containing @sha256:}"
[[ "$NODE_IMAGE" == *@sha256:* ]] || { echo "NODE_IMAGE must be digest-pinned" >&2; exit 64; }
[[ -f package-lock.json ]] || { echo "package-lock.json is mandatory; refusing an unfrozen dependency graph" >&2; exit 65; }

command -v docker >/dev/null || { echo "docker is required" >&2; exit 69; }
docker buildx version >/dev/null || { echo "docker buildx is required" >&2; exit 69; }

SOURCE_COMMIT="$(git rev-parse HEAD)"
SOURCE_DATE_EPOCH="$(git show -s --format=%ct HEAD)"
OUT="${BUILD_OUTPUT_DIR:-$ROOT/.sovereign-build}"
rm -rf "$OUT"
mkdir -p "$OUT/run-1" "$OUT/run-2"

build_once() {
  local destination="$1"
  docker buildx build \
    --no-cache \
    --network=none \
    --build-arg "NODE_IMAGE=$NODE_IMAGE" \
    --build-arg "SOURCE_COMMIT=$SOURCE_COMMIT" \
    --build-arg "SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH" \
    --file platform/build/Dockerfile.reproducible \
    --target artifact \
    --output "type=local,dest=$destination,rewrite-timestamp=true" \
    --provenance=false \
    --sbom=false \
    .
}

build_once "$OUT/run-1"
build_once "$OUT/run-2"

(
  cd "$OUT/run-1"
  find . -type f -print0 | sort -z | xargs -0 sha256sum
) > "$OUT/run-1.inventory"
(
  cd "$OUT/run-2"
  find . -type f -print0 | sort -z | xargs -0 sha256sum
) > "$OUT/run-2.inventory"

if ! cmp -s "$OUT/run-1.inventory" "$OUT/run-2.inventory"; then
  diff -u "$OUT/run-1.inventory" "$OUT/run-2.inventory" || true
  echo "REJECT: clean builds from identical declared inputs differ" >&2
  exit 1
fi

ARTIFACT_SHA256="$(sha256sum "$OUT/run-1.inventory" | awk '{print $1}')"
cat > "$OUT/result.json" <<JSON
{
  "schema": "foundation.sovereign-build-result.v1",
  "sourceCommit": "$SOURCE_COMMIT",
  "sourceDateEpoch": $SOURCE_DATE_EPOCH,
  "nodeImage": "$NODE_IMAGE",
  "artifactInventorySha256": "$ARTIFACT_SHA256",
  "reproducibleRuns": 2,
  "networkDuringCompilation": "none"
}
JSON

printf 'ACCEPT %s\n' "$ARTIFACT_SHA256"
