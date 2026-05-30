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
mkdir -p "$backup_dir"

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

# 2. Copy JSON data files
echo "[backup] Copying JSON data files..."
for json_file in local-profiles.json judges.json commercial-teams.json account-books.json; do
  src="${DATA_DIR}/${json_file}"
  if [[ -f "$src" ]]; then
    if $DRY_RUN; then
      echo "[backup]   Would copy ${json_file} ($(stat -f%z "$src" 2>/dev/null || stat -c%s "$src" 2>/dev/null) bytes)"
    else
      cp "$src" "${backup_dir}/${json_file}"
      echo "[backup]   Copied ${json_file}"
    fi
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

# 5. Prune old backups
echo "[backup] Pruning old backups (keeping last ${KEEP_COUNT})..."
backup_list=($(ls -1d "${BACKUP_ROOT}"/runtime-* 2>/dev/null | sort -r))
archive_list=($(ls -1 "${BACKUP_ROOT}"/runtime-*.tar.gz 2>/dev/null | sort -r))
total=$((${#backup_list[@]} + ${#archive_list[@]}))

if (( total > KEEP_COUNT )); then
  remove_count=$((total - KEEP_COUNT))
  # Remove old directories first
  for dir in "${backup_list[@]:${KEEP_COUNT}}"; do
    if $DRY_RUN; then
      echo "[backup]   Would remove directory $(basename "$dir")"
    else
      rm -rf "$dir"
      echo "[backup]   Removed $(basename "$dir")"
    fi
  done
  # Remove old archives
  for archive in "${archive_list[@]:${KEEP_COUNT}}"; do
    if $DRY_RUN; then
      echo "[backup]   Would remove archive $(basename "$archive")"
    else
      rm -f "$archive"
      echo "[backup]   Removed $(basename "$archive")"
    fi
  done
else
  echo "[backup]   No old backups to prune (${total} <= ${KEEP_COUNT})"
fi

echo "[backup] Backup complete at $(date -Iseconds)"
