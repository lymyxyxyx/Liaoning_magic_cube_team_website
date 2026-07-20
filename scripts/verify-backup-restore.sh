#!/usr/bin/env bash
set -euo pipefail

# Restore one backup into an isolated throwaway PostgreSQL database, validate
# that the dump contains application and WCA data, then always drop the test
# database. Run this on the production server; it never writes to ln_cubing.

BACKUP_ROOT="/opt/ln-cubing/backups"
APP_DIR="/opt/ln-cubing/app"
DB_USER="${POSTGRES_USER:-ln_cubing}"
archive="${1:-}"

if [[ -z "$archive" ]]; then
  archive="$(find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'runtime-*.tar.gz' -printf '%T@ %p\n' \
    | sort -nr \
    | head -n 1 \
    | cut -d' ' -f2-)"
fi

if [[ -z "$archive" || ! -f "$archive" ]]; then
  echo "[restore-verify] No runtime archive found. Pass its absolute path as the first argument." >&2
  exit 1
fi

archive_base="$(basename "$archive" .tar.gz)"
sql_entry="${archive_base}/ln_cubing.sql"

if ! tar -tzf "$archive" "$sql_entry" >/dev/null; then
  echo "[restore-verify] Archive is missing ${sql_entry}." >&2
  exit 1
fi

verify_db="ln_cubing_restore_verify_$(date +%Y%m%d%H%M%S)"

cleanup() {
  cd "$APP_DIR"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"${verify_db}\"" >/dev/null
}
trap cleanup EXIT

cd "$APP_DIR"
echo "[restore-verify] Creating isolated database ${verify_db}."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres \
  -c "CREATE DATABASE \"${verify_db}\"" >/dev/null

echo "[restore-verify] Restoring $(basename "$archive")."
tar -xOzf "$archive" "$sql_entry" \
  | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$verify_db" >/dev/null

echo "[restore-verify] Validating restored data."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$verify_db" -Atc \
  "SELECT 'tables=' || count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
  | grep -Eq '^tables=[1-9][0-9]*$'
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$verify_db" -Atc \
  "SELECT 'wca_persons=' || count(*) FROM wca_persons;" \
  | grep -Eq '^wca_persons=[1-9][0-9]*$'

echo "[restore-verify] Restore verification passed; dropping ${verify_db}."
