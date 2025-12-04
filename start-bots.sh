#!/usr/bin/env bash
set -euo pipefail

if ! command -v pm2 >/dev/null 2>&1; then
	echo "pm2 is required. Install via: npm i -g pm2" >&2
	exit 1
fi

echo "Starting Sam bot..."
pm2 start ecosystem.sam.config.cjs --env production

echo "Starting Dean bot..."
pm2 start ecosystem.dean.config.cjs --env production

echo "Starting Cas bot..."
pm2 start ecosystem.cas.config.cjs --env production

echo "Starting Jack bot..."
pm2 start ecosystem.jack.config.cjs --env production

echo "All bots started via PM2."
