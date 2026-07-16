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
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker fail2ban unattended-upgrades

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p "$FOUNDATION_ROOT" /var/lib/foundation/releases /var/lib/foundation/backups
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

cp "$FOUNDATION_ROOT/repository/platform/host/compose.production.yaml" "$FOUNDATION_ROOT/compose.yaml"
cp "$FOUNDATION_ROOT/repository/platform/host/Caddyfile.edge" "$FOUNDATION_ROOT/Caddyfile"

cat > "$FOUNDATION_ROOT/deploy.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/foundation
source "$ROOT/.env"
git -C "$ROOT/repository" fetch origin "$FOUNDATION_REF"
git -C "$ROOT/repository" checkout "$FOUNDATION_REF"
git -C "$ROOT/repository" reset --hard "origin/$FOUNDATION_REF"
COMMIT=$(git -C "$ROOT/repository" rev-parse HEAD)
mkdir -p "/var/lib/foundation/releases/$COMMIT"
cp -a "$ROOT/repository/." "/var/lib/foundation/releases/$COMMIT/source"
ln -sfn "/var/lib/foundation/releases/$COMMIT" /var/lib/foundation/current
cd "$ROOT"
FOUNDATION_DOMAIN="$FOUNDATION_DOMAIN" FOUNDATION_COMMIT="$COMMIT" docker compose build --pull
FOUNDATION_DOMAIN="$FOUNDATION_DOMAIN" FOUNDATION_COMMIT="$COMMIT" docker compose up -d --remove-orphans
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 "https://$FOUNDATION_DOMAIN/healthz" >/dev/null; then
    printf '%s\n' "$COMMIT" > /var/lib/foundation/current-commit
    exit 0
  fi
  sleep 2
done
echo "Health verification failed" >&2
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
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/foundation-backup.service <<'EOF'
[Unit]
Description=Foundation Intelligence backup

[Service]
Type=oneshot
ExecStart=/bin/bash -lc 'set -euo pipefail; stamp=$(date -u +%%Y%%m%%dT%%H%%M%%SZ); tar -C /var/lib -czf /var/lib/foundation/backups/foundation-$stamp.tar.gz foundation/current foundation/current-commit 2>/dev/null || true; find /var/lib/foundation/backups -type f -mtime +14 -delete'
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

echo "Host prepared. Ensure DNS A/AAAA records point to this machine, then run: sudo /opt/foundation/deploy.sh"
