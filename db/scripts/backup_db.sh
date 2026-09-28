#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ -f ./.env ]; then
  set -a
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-183}"
DB_NAME="${DB_DATABASE_NAME:-about_games_db}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"
TMP="${FILE}.tmp"

mkdir -p "$BACKUP_DIR"

echo "Dumping database ${DB_NAME} to ${FILE}..."

if docker compose exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --databases "$MYSQL_DATABASE" --single-transaction --quick --routines --triggers --no-tablespaces' \
  | gzip > "$TMP"; then
  chmod 600 "$TMP"
  mv "$TMP" "$FILE"
else
  rm -f "$TMP"
  echo "Backup failed, no file written." >&2
  exit 1
fi

DELETED="$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -print -delete | wc -l)"
echo "Backup complete. Removed ${DELETED} backup(s) older than ${RETENTION_DAYS} days."
