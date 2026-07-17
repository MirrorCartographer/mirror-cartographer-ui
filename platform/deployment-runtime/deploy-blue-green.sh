#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat >&2 <<'EOF'
usage: deploy-blue-green.sh deploy IMAGE@sha256:DIGEST RELEASE_ENVELOPE
       deploy-blue-green.sh rollback IMAGE@sha256:DIGEST RELEASE_ENVELOPE

Required environment:
  FOUNDATION_RUNTIME_ROOT   Runtime state directory
  FOUNDATION_ADMISSION_CMD Command that verifies the release envelope and image
  FOUNDATION_PROXY_RELOAD  Command that reloads the reverse proxy

Optional environment:
  FOUNDATION_PODMAN=podman
  FOUNDATION_CURL=curl
  FOUNDATION_HEALTH_PATH=/healthz
  FOUNDATION_BLUE_PORT=18081
  FOUNDATION_GREEN_PORT=18082
  FOUNDATION_HEALTH_SUCCESSES=5
  FOUNDATION_HEALTH_INTERVAL=2
  FOUNDATION_HEALTH_TIMEOUT=2
  FOUNDATION_STABILIZATION=30
EOF
  exit 64
}

[[ $# -eq 3 ]] || usage
ACTION=$1
IMAGE=$2
ENVELOPE=$3
[[ "$ACTION" == deploy || "$ACTION" == rollback ]] || usage
[[ "$IMAGE" =~ ^[^[:space:]]+@sha256:[0-9a-f]{64}$ ]] || { echo "ERROR digest-only image required" >&2; exit 65; }
[[ -r "$ENVELOPE" ]] || { echo "ERROR unreadable release envelope" >&2; exit 66; }

ROOT=${FOUNDATION_RUNTIME_ROOT:?FOUNDATION_RUNTIME_ROOT is required}
ADMIT=${FOUNDATION_ADMISSION_CMD:?FOUNDATION_ADMISSION_CMD is required}
PROXY_RELOAD=${FOUNDATION_PROXY_RELOAD:?FOUNDATION_PROXY_RELOAD is required}
PODMAN=${FOUNDATION_PODMAN:-podman}
CURL=${FOUNDATION_CURL:-curl}
HEALTH_PATH=${FOUNDATION_HEALTH_PATH:-/healthz}
BLUE_PORT=${FOUNDATION_BLUE_PORT:-18081}
GREEN_PORT=${FOUNDATION_GREEN_PORT:-18082}
SUCCESSES=${FOUNDATION_HEALTH_SUCCESSES:-5}
INTERVAL=${FOUNDATION_HEALTH_INTERVAL:-2}
TIMEOUT=${FOUNDATION_HEALTH_TIMEOUT:-2}
STABILIZATION=${FOUNDATION_STABILIZATION:-30}

mkdir -p "$ROOT"/{slots,releases,journal,locks,proxy}
exec 9>"$ROOT/locks/deploy.lock"
flock -n 9 || { echo "ERROR deployment already in progress" >&2; exit 75; }

DIGEST=${IMAGE##*@}
RECORD="$ROOT/releases/${DIGEST#sha256:}.admitted"
if [[ "$ACTION" == rollback && ! -f "$RECORD" ]]; then
  echo "ERROR rollback target has no prior admission record" >&2
  exit 77
fi

# Admission is external to this script so the runtime cannot redefine release policy.
# shellcheck disable=SC2086
$ADMIT "$ENVELOPE" "$IMAGE"

"$PODMAN" pull --quiet "$IMAGE" >/dev/null
RESOLVED=$("$PODMAN" image inspect --format '{{.Digest}}' "$IMAGE")
[[ "$RESOLVED" == "$DIGEST" ]] || { echo "ERROR runtime digest mismatch: $RESOLVED" >&2; exit 78; }

ACTIVE=none
[[ -L "$ROOT/active" ]] && ACTIVE=$(basename "$(readlink "$ROOT/active")")
if [[ "$ACTIVE" == blue ]]; then CANDIDATE=green; PORT=$GREEN_PORT; else CANDIDATE=blue; PORT=$BLUE_PORT; fi
NAME="foundation-app-$CANDIDATE"
PREVIOUS_DIGEST=""
[[ "$ACTIVE" != none && -r "$ROOT/slots/$ACTIVE/digest" ]] && PREVIOUS_DIGEST=$(cat "$ROOT/slots/$ACTIVE/digest")

"$PODMAN" rm -f "$NAME" >/dev/null 2>&1 || true
"$PODMAN" run -d --name "$NAME" \
  --replace \
  --read-only \
  --security-opt=no-new-privileges \
  --cap-drop=all \
  --network=slirp4netns \
  -p "127.0.0.1:${PORT}:8080" \
  "$IMAGE" >/dev/null

cleanup_candidate() { "$PODMAN" rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup_candidate ERR

healthy=0
attempts=$((SUCCESSES * 10))
for ((i=0; i<attempts; i++)); do
  if "$CURL" --fail --silent --show-error --max-time "$TIMEOUT" "http://127.0.0.1:${PORT}${HEALTH_PATH}" >/dev/null; then
    healthy=$((healthy + 1))
    [[ $healthy -ge $SUCCESSES ]] && break
  else
    healthy=0
  fi
  sleep "$INTERVAL"
done
[[ $healthy -ge $SUCCESSES ]] || { echo "ERROR candidate failed health admission" >&2; exit 79; }

mkdir -p "$ROOT/slots/$CANDIDATE"
printf '%s\n' "$IMAGE" > "$ROOT/slots/$CANDIDATE/image"
printf '%s\n' "$DIGEST" > "$ROOT/slots/$CANDIDATE/digest"
printf '%s\n' "$PORT" > "$ROOT/slots/$CANDIDATE/port"

TMP_LINK="$ROOT/.active.$$"
ln -s "$ROOT/slots/$CANDIDATE" "$TMP_LINK"
mv -Tf "$TMP_LINK" "$ROOT/active"
printf '127.0.0.1:%s\n' "$PORT" > "$ROOT/proxy/upstream.next"
mv -f "$ROOT/proxy/upstream.next" "$ROOT/proxy/upstream"
# shellcheck disable=SC2086
$PROXY_RELOAD

end=$((SECONDS + STABILIZATION))
while (( SECONDS < end )); do
  if ! "$CURL" --fail --silent --show-error --max-time "$TIMEOUT" "http://127.0.0.1:${PORT}${HEALTH_PATH}" >/dev/null; then
    if [[ "$ACTIVE" != none ]]; then
      old_port=$(cat "$ROOT/slots/$ACTIVE/port")
      ln -s "$ROOT/slots/$ACTIVE" "$TMP_LINK"
      mv -Tf "$TMP_LINK" "$ROOT/active"
      printf '127.0.0.1:%s\n' "$old_port" > "$ROOT/proxy/upstream.next"
      mv -f "$ROOT/proxy/upstream.next" "$ROOT/proxy/upstream"
      # shellcheck disable=SC2086
      $PROXY_RELOAD
    fi
    echo "ERROR stabilization failed; traffic restored to previous slot" >&2
    exit 80
  fi
  sleep "$INTERVAL"
done

printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ACTION" "$DIGEST" "${PREVIOUS_DIGEST:-none}" "$CANDIDATE" "accepted" \
  >> "$ROOT/journal/deployments.tsv"
printf '%s\n' "$DIGEST" > "$RECORD"
trap - ERR

if [[ "$ACTIVE" != none ]]; then
  old_name="foundation-app-$ACTIVE"
  "$PODMAN" stop --time 30 "$old_name" >/dev/null 2>&1 || true
fi

echo "ACCEPT action=$ACTION slot=$CANDIDATE digest=$DIGEST previous=${PREVIOUS_DIGEST:-none}"
