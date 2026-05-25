#!/usr/bin/env bash
set -euo pipefail

branch="${1:-main}"
server="admin@39.106.199.195"
app_dir="/opt/ln-cubing/app"

git push origin "$branch"
git push aliyun "$branch"

ssh "$server" "cd $app_dir && git status --short && git rev-parse --short HEAD && sudo docker compose exec -T web npm run build && sudo docker compose restart web && sudo docker compose ps && curl -fsSL http://127.0.0.1:3000/api/health"
