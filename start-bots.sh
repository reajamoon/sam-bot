#!/usr/bin/env bash
# Starts both Sam and Jack bots using PM2
echo "Starting Sam bot..."
pm2 start ecosystem.sam.config.js
echo "Starting Jack bot..."
pm2 start ecosystem.jack.config.js
