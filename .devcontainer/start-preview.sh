#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${TMPDIR:-/tmp}/mirror-cartographer-vite.log"
PID_FILE="${TMPDIR:-/tmp}/mirror-cartographer-vite.pid"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Mirror Cartographer preview is already running."
else
  nohup npm run dev -- --host 0.0.0.0 --port 5173 >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
fi

node scripts/preview-links.mjs
