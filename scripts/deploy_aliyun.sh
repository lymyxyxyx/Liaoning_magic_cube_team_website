#!/usr/bin/env bash
set -euo pipefail

branch="${1:-main}"
server="admin@39.106.199.195"
app_dir="/opt/ln-cubing/app"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[deploy] Refusing to deploy with an uncommitted local worktree." >&2
  exit 1
fi

target_commit="$(git rev-parse "${branch}^{commit}")"
target_short="${target_commit:0:12}"

echo "[deploy] Branch: ${branch}"
echo "[deploy] Target: ${target_short}"

# Both remotes must accept the exact local commit before the production
# worktree is changed. The server-side check below catches a stale or
# misconfigured receive target instead of silently rebuilding old code.
git push origin "${branch}"
git push aliyun "${branch}"

ssh "$server" bash -s -- "$app_dir" "$branch" "$target_commit" <<'REMOTE'
set -euo pipefail

app_dir="$1"
branch="$2"
target_commit="$3"
target_short="${target_commit:0:12}"

cd "$app_dir"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[deploy] Refusing to replace a dirty production worktree." >&2
  git status --short >&2
  exit 1
fi

server_ref="$(git rev-parse "refs/heads/${branch}" 2>/dev/null || true)"
if [[ "$server_ref" != "$target_commit" ]]; then
  echo "[deploy] Server branch ${branch} is ${server_ref:-missing}, expected ${target_commit}." >&2
  echo "[deploy] No files or containers were changed." >&2
  exit 1
fi

echo "[deploy] Creating a pre-deploy runtime backup."
sudo "$app_dir/scripts/backup.sh" --keep 7

echo "[deploy] Checking out ${target_short}."
git checkout -B "$branch" "$target_commit"

echo "[deploy] Building application."
sudo docker compose exec -T web npm run build

echo "[deploy] Restarting web container."
sudo docker compose restart web
sudo docker compose ps

echo "[deploy] Waiting for health endpoint."
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsSL --max-time 5 http://127.0.0.1:3000/api/health; then
    break
  fi
  if [[ "$attempt" == "10" ]]; then
    echo "[deploy] Health check did not recover after restart." >&2
    exit 1
  fi
  sleep 2
done

echo "[deploy] Running production smoke test."
sudo docker compose exec -T -e BASE_URL=http://127.0.0.1:3000 web npm run test:smoke

deployed_commit="$(git rev-parse HEAD)"
if [[ "$deployed_commit" != "$target_commit" ]]; then
  echo "[deploy] Worktree changed unexpectedly: ${deployed_commit}, expected ${target_commit}." >&2
  exit 1
fi

timestamp="$(date -Iseconds)"
sudo mkdir -p /opt/ln-cubing/logs
printf '%s branch=%s commit=%s health=ok smoke=ok\n' "$timestamp" "$branch" "$target_commit" \
  | sudo tee -a /opt/ln-cubing/logs/deployments.log >/dev/null

echo "[deploy] Completed: ${target_short}"
REMOTE
