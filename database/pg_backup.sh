#!/bin/bash
# PostgreSQL backup script for DigitalOcean droplet
# Stores daily backups in /var/backups/sam-bot-pgsql/
# Keeps 7 days of backups, deletes older ones automatically
# Usage: Set up as a daily cron job with crontab -e
# 30 2 * * * /home/bots/sam-bot/database/pg_backup.sh >> /var/log/sam-bot-pg-backup.log 2>&1


# --- LOAD ENVIRONMENT VARIABLES ---
# Try to load .env file from project root if it exists
ENV_PATH="$(dirname "$0")/../.env"
if [ -f "$ENV_PATH" ]; then
  export $(grep -v '^#' "$ENV_PATH" | xargs)
fi

# --- CONFIGURATION ---
BACKUP_DIR="/var/backups/sam-bot-pgsql"
RETENTION_DAYS=7

# --- CHECK ENVIRONMENT ---
if [ -z "$DATABASE_URL" ]; then
  echo "[sam-bot backup] ERROR: DATABASE_URL must be set in .env" >&2
  exit 2
fi

# Extract DB_NAME for filename from DATABASE_URL
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\)$|\1|p')

# --- SCRIPT ---
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_$DATE.sql.gz"
mkdir -p "$BACKUP_DIR"

# Dump and compress
echo "[sam-bot backup] Starting backup for $DB_NAME at $DATE..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
if [ $? -eq 0 ]; then
  echo "[sam-bot backup] Backup successful: $BACKUP_FILE"
else
  echo "[sam-bot backup] Backup FAILED for $DB_NAME at $DATE" >&2
  exit 1
fi

# Prune old backups
find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;
echo "[sam-bot backup] Old backups pruned."
