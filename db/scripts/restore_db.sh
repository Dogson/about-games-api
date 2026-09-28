#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

FILE="${1:?usage: restore_db.sh <backup.sql.gz> [--yes]}"
if [ ! -f "$FILE" ]; then
  echo "Backup file not found: ${FILE}" >&2
  exit 1
fi

if [ "${2:-}" != "--yes" ]; then
  printf 'This will overwrite the current database with "%s". Type "yes" to continue: ' "$FILE"
  read -r answer
  if [ "$answer" != "yes" ]; then
    echo "Aborted. No changes were made."
    exit 0
  fi
fi

echo "Restoring ${FILE}..."
gunzip -c "$FILE" | docker compose exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
echo "Restore complete."
