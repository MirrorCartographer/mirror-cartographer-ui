#!/usr/bin/env bash
set -euo pipefail

ROOT=$(mktemp -d)
PID=''
cleanup() {
  if [[ -n "$PID" ]]; then kill "$PID" 2>/dev/null || true; fi
  rm -rf "$ROOT"
}
trap cleanup EXIT

mkdir -p "$ROOT/vault/blobs/sha512"
printf fixture > "$ROOT/package.tgz"
SHA512=$(sha512sum "$ROOT/package.tgz" | cut -d' ' -f1)
SHA256=$(sha256sum "$ROOT/package.tgz" | cut -d' ' -f1)
SRI=$(openssl dgst -sha512 -binary "$ROOT/package.tgz" | openssl base64 -A)
SIZE=$(wc -c < "$ROOT/package.tgz" | tr -d ' ')
cp "$ROOT/package.tgz" "$ROOT/vault/blobs/sha512/$SHA512.tgz"

cat > "$ROOT/package-lock.json" <<JSON
{"lockfileVersion":3,"packages":{"":{"name":"fixture"},"node_modules/tiny":{"name":"tiny","version":"1.0.0","integrity":"sha512-$SRI","resolved":"https://registry.npmjs.org/tiny/-/tiny-1.0.0.tgz"}}}
JSON

cat > "$ROOT/vault/index.json" <<JSON
{"canonicalSha256":"fixture-index","records":[{"packagePath":"node_modules/tiny","name":"tiny","version":"1.0.0","integrity":"sha512-$SRI","blob":"blobs/sha512/$SHA512.tgz","size":$SIZE,"sha256":"$SHA256","sha512":"$SHA512"}]}
JSON

VAULT_DIR="$ROOT/vault" \
LOCKFILE="$ROOT/package-lock.json" \
PORT=4987 \
node "$(dirname "$0")/vault-registry.mjs" > "$ROOT/server.log" 2>&1 &
PID=$!
sleep 0.5

curl -fsS http://127.0.0.1:4987/-/health | grep -q 'vault-only'
curl -fsS http://127.0.0.1:4987/tiny | grep -q 'tiny-1.0.0.tgz'
curl -fsS http://127.0.0.1:4987/tiny/-/tiny-1.0.0.tgz | cmp - "$ROOT/package.tgz"

if curl -fsS http://127.0.0.1:4987/not-admitted >/dev/null 2>&1; then
  echo 'FAIL unadmitted package was served' >&2
  exit 1
fi

printf X >> "$ROOT/vault/blobs/sha512/$SHA512.tgz"
if curl -fsS http://127.0.0.1:4987/tiny/-/tiny-1.0.0.tgz >/dev/null 2>&1; then
  echo 'FAIL corrupted package was served' >&2
  exit 1
fi

printf 'PASS vault registry fail-closed tests\n'
