#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root or with sudo." >&2
  exit 1
fi

: "${FOUNDATION_DOMAIN:?Set FOUNDATION_DOMAIN}"
: "${FOUNDATION_REPOSITORY:=https://github.com/MirrorCartographer/mirror-cartographer-ui.git}"
: "${FOUNDATION_REF:=preview}"
: "${FOUNDATION_ROOT:=/opt/foundation}"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git gnupg ufw fail2ban unattended-upgrades
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
if [[ ${ID:-} != ubuntu ]]; then
  echo "Unsupported distribution: ${ID:-unknown}; this bootstrap currently requires Ubuntu." >&2
  exit 1
fi
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker fail2ban unattended-upgrades

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

mkdir -p "$FOUNDATION_ROOT" /var/lib/foundation/releases /var/lib/foundation/backups /var/lib/foundation/deployment-evidence /srv/foundation/data/caddy /srv/foundation/data/caddy-config
if [[ ! -d "$FOUNDATION_ROOT/repository/.git" ]]; then
  git clone --branch "$FOUNDATION_REF" "$FOUNDATION_REPOSITORY" "$FOUNDATION_ROOT/repository"
else
  git -C "$FOUNDATION_ROOT/repository" fetch --all --prune
  git -C "$FOUNDATION_ROOT/repository" checkout "$FOUNDATION_REF"
  git -C "$FOUNDATION_ROOT/repository" reset --hard "origin/$FOUNDATION_REF"
fi

cat > "$FOUNDATION_ROOT/.env" <<EOF
FOUNDATION_DOMAIN=$FOUNDATION_DOMAIN
FOUNDATION_REF=$FOUNDATION_REF
EOF
chmod 0600 "$FOUNDATION_ROOT/.env"

cp "$FOUNDATION_ROOT/repository/platform/host/compose.production.yaml" "$FOUNDATION_ROOT/compose.yaml"
cp "$FOUNDATION_ROOT/repository/platform/host/Caddyfile.edge" "$FOUNDATION_ROOT/Caddyfile"
install -m 0750 "$FOUNDATION_ROOT/repository/platform/host/backup.sh" "$FOUNDATION_ROOT/backup.sh"
install -m 0750 "$FOUNDATION_ROOT/repository/platform/host/restore-backup.sh" "$FOUNDATION_ROOT/restore-backup.sh"

cat > "$FOUNDATION_ROOT/deploy.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/foundation
STATE=/var/lib/foundation
EVIDENCE="$STATE/deployment-evidence"
LOCK=/run/lock/foundation-deploy.lock
source "$ROOT/.env"
mkdir -p "$EVIDENCE" "$(dirname "$LOCK")"

# All deployment triggers share one non-blocking lock. Concurrent or duplicate
# triggers fail closed before mutating repository, containers, or release state.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "A Foundation deployment is already in progress; refusing concurrent mutation." >&2
  exit 75
fi

health_ok() {
  curl -fsS --max-time 5 "https://$FOUNDATION_DOMAIN/healthz" >/dev/null
}

record_evidence() {
  local outcome=$1 candidate_commit=$2 candidate_image=$3 active_commit=$4 active_image=$5
  local timestamp evidence_file
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  evidence_file="$EVIDENCE/${timestamp}-${candidate_commit}-${outcome}.env"
  umask 077
  {
    printf 'timestamp_utc=%s\n' "$timestamp"
    printf 'hostname=%s\n' "$(hostname --fqdn 2>/dev/null || hostname)"
    printf 'domain=%s\n' "$FOUNDATION_DOMAIN"
    printf 'outcome=%s\n' "$outcome"
    printf 'candidate_commit=%s\n' "$candidate_commit"
    printf 'candidate_image=%s\n' "$candidate_image"
    printf 'active_commit=%s\n' "$active_commit"
    printf 'active_image=%s\n' "$active_image"
  } > "$evidence_file"
  sha256sum "$evidence_file" > "$evidence_file.sha256"
}

PREVIOUS_COMMIT=$(cat "$STATE/current-commit" 2>/dev/null || true)
PREVIOUS_IMAGE=$(cat "$STATE/current-image" 2>/dev/null || true)

git -C "$ROOT/repository" fetch origin "$FOUNDATION_REF"
git -C "$ROOT/repository" checkout "$FOUNDATION_REF"
git -C "$ROOT/repository" reset --hard "origin/$FOUNDATION_REF"
COMMIT=$(git -C "$ROOT/repository" rev-parse HEAD)
IMAGE="foundation-ui:$COMMIT"
RELEASE="$STATE/releases/$COMMIT"
mkdir -p "$RELEASE"
rm -rf "$RELEASE/source"
cp -a "$ROOT/repository/." "$RELEASE/source"
printf '%s\n' "$IMAGE" > "$RELEASE/image"
cp "$ROOT/repository/platform/host/compose.production.yaml" "$ROOT/compose.yaml"
cp "$ROOT/repository/platform/host/Caddyfile.edge" "$ROOT/Caddyfile"
install -m 0750 "$ROOT/repository/platform/host/backup.sh" "$ROOT/backup.sh"
install -m 0750 "$ROOT/repository/platform/host/restore-backup.sh" "$ROOT/restore-backup.sh"
cd "$ROOT"
export FOUNDATION_DOMAIN FOUNDATION_COMMIT="$COMMIT" FOUNDATION_IMAGE="$IMAGE"
docker compose config --quiet
docker compose build --pull app
docker image inspect "$IMAGE" --format '{{.Id}}' > "$RELEASE/image-id"
docker compose up -d --remove-orphans
for _ in $(seq 1 60); do
  if health_ok; then
    ln -sfn "$RELEASE" "$STATE/current"
    printf '%s\n' "$COMMIT" > "$STATE/current-commit"
    printf '%s\n' "$IMAGE" > "$STATE/current-image"
    record_evidence promoted "$COMMIT" "$IMAGE" "$COMMIT" "$IMAGE"
    exit 0
  fi
  sleep 2
done

echo "Candidate health verification failed; release was not promoted" >&2
docker compose ps >&2 || true

if [[ -n "$PREVIOUS_COMMIT" && -n "$PREVIOUS_IMAGE" ]] && docker image inspect "$PREVIOUS_IMAGE" >/dev/null 2>&1; then
  echo "Rolling back to promoted image $PREVIOUS_IMAGE" >&2
  export FOUNDATION_COMMIT="$PREVIOUS_COMMIT" FOUNDATION_IMAGE="$PREVIOUS_IMAGE"
  docker compose up -d --no-build --remove-orphans
  for _ in $(seq 1 30); do
    if health_ok; then
      record_evidence rolled-back "$COMMIT" "$IMAGE" "$PREVIOUS_COMMIT" "$PREVIOUS_IMAGE"
      echo "Rollback verified; previous promoted release is healthy" >&2
      exit 1
    fi
    sleep 2
  done
  record_evidence rollback-failed "$COMMIT" "$IMAGE" "$PREVIOUS_COMMIT" "$PREVIOUS_IMAGE"
  echo "CRITICAL: candidate and rollback health verification both failed" >&2
  docker compose ps >&2 || true
  exit 2
fi

# No promoted image exists, so leave no unverified public runtime running.
docker compose down --remove-orphans || true
record_evidence rejected-no-rollback "$COMMIT" "$IMAGE" UNDEPLOYED UNDEPLOYED
echo "No previous promoted image was available; unverified runtime stopped" >&2
exit 1
EOF
chmod 0755 "$FOUNDATION_ROOT/deploy.sh"

cat > /etc/systemd/system/foundation-deploy.service <<'EOF'
[Unit]
Description=Foundation Intelligence deployment
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/opt/foundation/.env
ExecStart=/opt/foundation/deploy.sh
TimeoutStartSec=30min
# Do not retain an active state after completion: every explicit start must
# execute a fresh deployment attempt and pass through the script-level lock.
RemainAfterExit=no

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/foundation-backup.service <<'EOF'
[Unit]
Description=Foundation Intelligence backup
RequiresMountsFor=/srv/foundation/data

[Service]
Type=oneshot
ExecStart=/opt/foundation/backup.sh
User=root
Group=root
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/foundation/backups /srv/foundation/data
EOF

cat > /etc/systemd/system/foundation-backup.timer <<'EOF'
[Unit]
Description=Daily Foundation Intelligence backup

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=900

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable foundation-deploy.service foundation-backup.timer
systemctl start foundation-backup.timer

# Prove the backup path works even before the first application deployment.
systemctl start foundation-backup.service
latest_backup=$(find /var/lib/foundation/backups -maxdepth 1 -type f -name 'foundation-*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)
[[ -n "$latest_backup" ]] || { echo "Backup verification produced no archive" >&2; exit 1; }
(
  cd "$(dirname "$latest_backup")"
  sha256sum -c "$(basename "$latest_backup.sha256")"
)

echo "Host prepared and backup path verified. Ensure DNS A/AAAA records point to this machine, then run: sudo /opt/foundation/deploy.sh"
