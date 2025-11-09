#!/bin/bash
# PostgreSQL backup script for DigitalOcean droplet
# Stores daily backups in /var/backups/sam-bot-pgsql/
# Keeps 7 days of backups, deletes older ones automatically
# Usage: Set up as a daily cron job (see instructions below)


# --- LOAD ENVIRONMENT VARIABLES ---
# Try to load .env file from project root if it exists
ENV_PATH="$(dirname "$0")/../.env"
if [ -f "$ENV_PATH" ]; then
  export $(grep -v '^#' "$ENV_PATH" | xargs)
fi

# --- CONFIGURATION ---
DB_NAME="${DATABASE_NAME}"
DB_USER="${DATABASE_USER}"
DB_HOST="${DATABASE_HOST:-localhost}"
BACKUP_DIR="/var/backups/sam-bot-pgsql"
RETENTION_DAYS=7

# Optionally parse DB_HOST from DATABASE_URL if present
if [ -n "$DATABASE_URL" ]; then
  # Extract host, user, db from DATABASE_URL (format: postgres://user:pass@host:port/dbname)
  DB_USER_FROM_URL=$(echo "$DATABASE_URL" | sed -n 's|postgres://\([^:]*\):.*@.*:.*\/.*|\1|p')
  DB_HOST_FROM_URL=$(echo "$DATABASE_URL" | sed -n 's|postgres://[^@]*@\([^:/]*\).*|\1|p')
  DB_NAME_FROM_URL=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\)$|\1|p')
  DB_USER="${DB_USER:-$DB_USER_FROM_URL}"
  DB_HOST="${DB_HOST:-$DB_HOST_FROM_URL}"
  DB_NAME="${DB_NAME:-$DB_NAME_FROM_URL}"
fi

# --- SCRIPT ---
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"


# Check required variables
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DATABASE_PASSWORD" ]; then
  echo "[sam-bot backup] ERROR: DB_NAME, DB_USER, and DATABASE_PASSWORD must be set in .env" >&2
  exit 2
fi

# Dump and compress
echo "[sam-bot backup] Starting backup for $DB_NAME at $DATE..."
PGPASSWORD="$DATABASE_PASSWORD" pg_dump -U "$DB_USER" -h "$DB_HOST" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "[sam-bot backup] Backup successful: $BACKUP_FILE"
else
  echo "[sam-bot backup] Backup FAILED for $DB_NAME at $DATE" >&2
  exit 1
fi

# Prune old backups
find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;

echo "[sam-bot backup] Old backups pruned."
