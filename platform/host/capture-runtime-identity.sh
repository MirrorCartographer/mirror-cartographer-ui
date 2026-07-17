#!/usr/bin/env bash
set -euo pipefail

ROOT=${FOUNDATION_ROOT:-/opt/foundation}
STATE=${FOUNDATION_STATE:-/var/lib/foundation}
COMPOSE_FILE=${FOUNDATION_COMPOSE_FILE:-$ROOT/compose.yaml}
OUTPUT=${1:-$STATE/runtime-identity.env}

[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo "Run as root or with sudo." >&2; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "Missing Compose file: $COMPOSE_FILE" >&2; exit 1; }
[[ -f "$ROOT/.env" ]] || { echo "Missing runtime environment: $ROOT/.env" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ROOT/.env"
set +a

: "${FOUNDATION_DOMAIN:?FOUNDATION_DOMAIN is required}"
: "${FOUNDATION_COMMIT:?FOUNDATION_COMMIT is required}"
: "${FOUNDATION_IMAGE:?FOUNDATION_IMAGE is required}"
: "${FOUNDATION_EDGE_IMAGE:=caddy:2.10.0-alpine}"
export FOUNDATION_DOMAIN FOUNDATION_COMMIT FOUNDATION_IMAGE FOUNDATION_EDGE_IMAGE

compose=(docker compose --env-file "$ROOT/.env" -f "$COMPOSE_FILE")
"${compose[@]}" config --quiet

app_container=$("${compose[@]}" ps -q app)
edge_container=$("${compose[@]}" ps -q edge)
[[ -n "$app_container" ]] || { echo "Application container is not running." >&2; exit 1; }
[[ -n "$edge_container" ]] || { echo "Edge container is not running." >&2; exit 1; }

app_image_id=$(docker inspect --format '{{.Image}}' "$app_container")
edge_image_id=$(docker inspect --format '{{.Image}}' "$edge_container")
[[ -n "$app_image_id" && -n "$edge_image_id" ]] || { echo "Unable to resolve running image IDs." >&2; exit 1; }

edge_repo_digest=$(docker image inspect "$edge_image_id" --format '{{join .RepoDigests "\n"}}' | grep -F "${FOUNDATION_EDGE_IMAGE%%:*}@sha256:" | head -n1 || true)
if [[ -z "$edge_repo_digest" ]]; then
  edge_repo_digest=$(docker image inspect "$edge_image_id" --format '{{join .RepoDigests "\n"}}' | grep '@sha256:' | head -n1 || true)
fi
[[ -n "$edge_repo_digest" ]] || { echo "Edge image has no resolvable registry digest; refusing incomplete identity evidence." >&2; exit 1; }

app_running_commit=$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$app_container" 2>/dev/null || true)
if [[ -n "$app_running_commit" && "$app_running_commit" != "$FOUNDATION_COMMIT" ]]; then
  echo "Running application revision does not match FOUNDATION_COMMIT." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"
umask 077
tmp=$(mktemp "${OUTPUT}.tmp.XXXXXX")
trap 'rm -f "$tmp"' EXIT
{
  printf 'schema=foundation-runtime-identity/v1\n'
  printf 'captured_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'host_id=%s\n' "$(cat /etc/machine-id)"
  printf 'hostname=%s\n' "$(hostname --fqdn 2>/dev/null || hostname)"
  printf 'domain=%s\n' "$FOUNDATION_DOMAIN"
  printf 'application_commit=%s\n' "$FOUNDATION_COMMIT"
  printf 'application_image_ref=%s\n' "$FOUNDATION_IMAGE"
  printf 'application_image_id=%s\n' "$app_image_id"
  printf 'edge_image_ref=%s\n' "$FOUNDATION_EDGE_IMAGE"
  printf 'edge_image_id=%s\n' "$edge_image_id"
  printf 'edge_repo_digest=%s\n' "$edge_repo_digest"
  printf 'compose_sha256=%s\n' "$(sha256sum "$COMPOSE_FILE" | awk '{print $1}')"
  printf 'caddyfile_sha256=%s\n' "$(sha256sum "$ROOT/Caddyfile" | awk '{print $1}')"
} > "$tmp"

sha256sum "$tmp" >/dev/null
mv -f "$tmp" "$OUTPUT"
sha256sum "$OUTPUT" > "$OUTPUT.sha256"
chmod 0600 "$OUTPUT" "$OUTPUT.sha256"
trap - EXIT

printf 'Captured runtime identity: %s\n' "$OUTPUT"
