#!/usr/bin/env bash
set -euo pipefail

branch="main"
backup_mode="full"
smoke_mode="full"
for argument in "$@"; do
  case "$argument" in
    --fast)
      backup_mode="skip"
      smoke_mode="skip"
      ;;
    --full)
      backup_mode="full"
      smoke_mode="full"
      ;;
    --skip-smoke)
      smoke_mode="skip"
      ;;
    --smoke)
      smoke_mode="full"
      ;;
    *)
      branch="$argument"
      ;;
  esac
done
server="admin@39.106.199.195"
app_dir="/opt/ln-cubing/app"

ssh_args=()
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  ssh_args=(-i "$DEPLOY_SSH_KEY" -o IdentitiesOnly=yes)
  export GIT_SSH_COMMAND="ssh -i $DEPLOY_SSH_KEY -o IdentitiesOnly=yes"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[deploy] Refusing to deploy with an uncommitted local worktree." >&2
  exit 1
fi

target_commit="$(git rev-parse "${branch}^{commit}")"
target_short="${target_commit:0:12}"

echo "[deploy] Branch: ${branch}"
echo "[deploy] Target: ${target_short}"
echo "[deploy] Backup: ${backup_mode}"
echo "[deploy] Smoke test: ${smoke_mode}"

# Both remotes must accept the exact local commit before the production
# worktree is changed. The server-side check below catches a stale or
# misconfigured receive target instead of silently rebuilding old code.
git push origin "${branch}"
git push aliyun "${branch}"

ssh "${ssh_args[@]}" "$server" bash -s -- "$app_dir" "$branch" "$target_commit" "$backup_mode" "$smoke_mode" <<'REMOTE'
set -euo pipefail

app_dir="$1"
branch="$2"
target_commit="$3"
backup_mode="$4"
smoke_mode="$5"
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

if [[ "$backup_mode" == "full" ]]; then
  echo "[deploy] Creating a pre-deploy runtime backup."
  sudo "$app_dir/scripts/backup.sh" --keep 7
else
  echo "[deploy] Fast mode: skipping the pre-deploy runtime backup."
fi

echo "[deploy] Checking out ${target_short}."
git checkout -B "$branch" "$target_commit"

echo "[deploy] Applying database migrations."
sudo docker compose exec -T web npm run db:migrate </dev/null

echo "[deploy] Building application."
sudo docker compose exec -T web npm run build </dev/null

# Next.js regenerates this tracked type shim according to the container's
# installed minor version. It is not a production source change and must not
# leave the receive worktree dirty for the next deployment.
if ! git diff --quiet -- next-env.d.ts; then
  echo "[deploy] Restoring generated next-env.d.ts."
  git restore -- next-env.d.ts
fi

echo "[deploy] Restarting web container with the fresh build."
# The application build lives in the bind-mounted worktree. A restart swaps
# the Next.js process without discarding that build; force-recreating this
# service may start before the mounted .next directory is available.
sudo docker compose restart web
if [[ "$(sudo docker compose ps --status running -q web)" == "" ]]; then
  echo "[deploy] Web container did not reach the running state." >&2
  exit 1
fi

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

# Keep fast deploys fast, but still prove that the actual public page renders;
# /api/health alone cannot catch a stale or broken Next.js page bundle.
echo "[deploy] Checking public weekly page."
if ! curl -fsSL --max-time 10 http://127.0.0.1:3000/weekly >/dev/null; then
  echo "[deploy] Weekly page did not render after deployment." >&2
  exit 1
fi

if [[ "$smoke_mode" == "full" ]]; then
  echo "[deploy] Running production smoke test."
  sudo docker compose exec -T -e BASE_URL=http://127.0.0.1:3000 web npm run test:smoke </dev/null
else
  echo "[deploy] Fast mode: skipping the production smoke test."
fi

deployed_commit="$(git rev-parse HEAD)"
if [[ "$deployed_commit" != "$target_commit" ]]; then
  echo "[deploy] Worktree changed unexpectedly: ${deployed_commit}, expected ${target_commit}." >&2
  exit 1
fi

timestamp="$(date -Iseconds)"
sudo mkdir -p /opt/ln-cubing/logs
printf '%s branch=%s commit=%s health=ok smoke=%s\n' "$timestamp" "$branch" "$target_commit" "$smoke_mode" \
  | sudo tee -a /opt/ln-cubing/logs/deployments.log >/dev/null

echo "[deploy] Completed: ${target_short}"
REMOTE
