#!/usr/bin/env bash
set -euo pipefail

# Automated backup script for ln-cubing
# Usage:
#   scripts/backup.sh              # Run backup on the server
#   scripts/backup.sh --dry-run    # Show what would be backed up
#   scripts/backup.sh --keep 14    # Keep last 14 backups (default: 7)

BACKUP_ROOT="/opt/ln-cubing/backups"
DATA_DIR="/opt/ln-cubing/data"
APP_DIR="/opt/ln-cubing/app"
KEEP_COUNT=7
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --keep) KEEP_COUNT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

ts=$(date +%Y%m%d%H%M%S)
backup_dir="${BACKUP_ROOT}/runtime-${ts}"
if ! $DRY_RUN; then
  mkdir -p "$backup_dir"
fi

echo "[backup] Starting backup at $(date -Iseconds)"
echo "[backup] Backup directory: ${backup_dir}"

# 1. Dump PostgreSQL database
echo "[backup] Dumping PostgreSQL database..."
if $DRY_RUN; then
  echo "[backup]   Would dump database to ${backup_dir}/ln_cubing.sql"
else
  cd "$APP_DIR"
  docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-ln_cubing}" "${POSTGRES_DB:-ln_cubing}" \
    > "${backup_dir}/ln_cubing.sql"
  echo "[backup]   Database dumped: $(wc -c < "${backup_dir}/ln_cubing.sql") bytes"
fi

# 2. Copy all JSON data files (auto-discovered, so new files are never missed)
echo "[backup] Copying JSON data files..."
shopt -s nullglob
json_files=("${DATA_DIR}"/*.json)
shopt -u nullglob
if (( ${#json_files[@]} == 0 )); then
  echo "[backup]   No JSON data files found in ${DATA_DIR}"
fi
for src in "${json_files[@]}"; do
  json_file=$(basename "$src")
  if $DRY_RUN; then
    echo "[backup]   Would copy ${json_file} ($(stat -f%z "$src" 2>/dev/null || stat -c%s "$src" 2>/dev/null) bytes)"
  else
    cp "$src" "${backup_dir}/${json_file}"
    echo "[backup]   Copied ${json_file}"
  fi
done

# 3. Copy WCA state files
if [[ -d "${DATA_DIR}/wca_state" ]]; then
  if $DRY_RUN; then
    echo "[backup]   Would copy wca_state/"
  else
    cp -a "${DATA_DIR}/wca_state" "${backup_dir}/wca_state"
    echo "[backup]   Copied wca_state/"
  fi
fi

# 4. Create compressed archive
if $DRY_RUN; then
  echo "[backup]   Would create archive ${backup_dir}.tar.gz"
else
  tar -czf "${backup_dir}.tar.gz" -C "$BACKUP_ROOT" "runtime-${ts}"
  echo "[backup]   Archive created: $(du -h "${backup_dir}.tar.gz" | cut -f1)"
  rm -rf "$backup_dir"
fi

# 5. Prune old backups. Runtime directories and compressed archives share one
# retention budget; otherwise a mix of both kinds can grow past KEEP_COUNT.
echo "[backup] Pruning old backups (keeping last ${KEEP_COUNT})..."
mapfile -t backup_items < <(
  find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -name 'runtime-*' -printf '%T@ %p\n' \
    | sort -nr \
    | cut -d' ' -f2-
)
total=${#backup_items[@]}

if (( total > KEEP_COUNT )); then
  for item in "${backup_items[@]:${KEEP_COUNT}}"; do
    if $DRY_RUN; then
      echo "[backup]   Would remove $(basename "$item")"
    elif [[ -d "$item" ]]; then
      rm -rf "$item"
      echo "[backup]   Removed $(basename "$item")"
    else
      rm -f "$item"
      echo "[backup]   Removed $(basename "$item")"
    fi
  done
else
  echo "[backup]   No old backups to prune (${total} <= ${KEEP_COUNT})"
fi

echo "[backup] Backup complete at $(date -Iseconds)"
