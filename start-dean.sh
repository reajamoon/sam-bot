#!/usr/bin/env bash
set -euo pipefail

# Always use PM2 to run Dean
if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is required. Install via: npm i -g pm2" >&2
  exit 1
fi

pm2 start ecosystem.dean.config.cjs --env production
