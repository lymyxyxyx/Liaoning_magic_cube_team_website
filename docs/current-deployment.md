# Current Deployment

Updated: 2026-05-28

## Primary Server

The production site has been fully moved to the Aliyun mainland server.

```text
Host: admin@39.106.199.195
App directory: /opt/ln-cubing/app
Data directory: /opt/ln-cubing/data
Logs directory: /opt/ln-cubing/logs
Domain: lncubing.com / www.lncubing.com
```

The previous Tencent Cloud Hong Kong server `124.156.140.54` is deprecated and should not be used for deployment.

## DNS

Both apex and `www` records should point to Aliyun:

```text
lncubing.com      A 39.106.199.195
www.lncubing.com  A 39.106.199.195
```

## Git Sync

The local repository uses two remotes:

```text
origin  https://github.com/lymyxyxyx/Liaoning_magic_cube_team_website.git
aliyun  admin@39.106.199.195:/opt/ln-cubing/app/.git
```

Aliyun's `/opt/ln-cubing/app` is now a Git worktree. Because outbound GitHub access from the Aliyun server has been unreliable, deploy from local by pushing the same commit to both remotes:

```bash
git push origin main
git push aliyun main
ssh admin@39.106.199.195 'cd /opt/ln-cubing/app && sudo docker compose exec -T web npm run build && sudo docker compose restart web'
```

Or run:

```bash
scripts/deploy_aliyun.sh
```

## Server-Local Files

These are intentionally kept on the server and are not tracked in Git:

```text
/opt/ln-cubing/app/.env.production
/opt/ln-cubing/app/docker-compose.yml
/opt/ln-cubing/app/Dockerfile
/opt/ln-cubing/data
/opt/ln-cubing/logs
/opt/ln-cubing/backups
```

The repository includes templates for recovery and new environments:

```text
Dockerfile.example
docker-compose.example.yml
.env.example
nginx.example.conf
```

Do not commit real production secrets. For a new server, copy the examples on the server and fill in real values there:

```bash
cp Dockerfile.example Dockerfile
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env.production
```

Current production `APP_URL` should be:

```text
APP_URL=https://lncubing.com
```

## Runtime Data Backups

Server-entered runtime data should be backed up regularly, but should not be blindly committed to GitHub.

Back up these server-local paths before risky deploys, data imports, migrations, or manual cleanup:

```text
/opt/ln-cubing/data/local-profiles.json
/opt/ln-cubing/data/judges.json
/opt/ln-cubing/data/commercial-teams.json
/opt/ln-cubing/data/account-books.json
/opt/ln-cubing/data/wca_state
PostgreSQL database ln_cubing
```

Recommended server-side backup pattern:

```bash
ssh admin@39.106.199.195 'ts=$(date +%Y%m%d%H%M%S) && mkdir -p /opt/ln-cubing/backups/runtime-$ts && cp -a /opt/ln-cubing/data/*.json /opt/ln-cubing/data/wca_state /opt/ln-cubing/backups/runtime-$ts/ 2>/dev/null || true && cd /opt/ln-cubing/app && sudo docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /opt/ln-cubing/backups/runtime-$ts/ln_cubing.sql && echo /opt/ln-cubing/backups/runtime-$ts'
```

Recommended local copy pattern:

```bash
scp -r admin@39.106.199.195:/opt/ln-cubing/backups/runtime-YYYYMMDDHHMMSS /path/to/local/backups/
```

Only commit runtime data to GitHub after reviewing that it is public, stable, and intentionally versioned. Public list data such as judges or commercial teams may be committed if that is the chosen source of truth. Account books, feedback, credentials, WCA raw exports, generated databases, and private local profile working files should stay out of GitHub.

## Health Checks

```bash
ssh admin@39.106.199.195 'cd /opt/ln-cubing/app && git status --short && git rev-parse --short HEAD && sudo docker compose ps && curl -fsSL http://127.0.0.1:3000/api/health'
```

The public page can be checked from the server through Nginx:

```bash
ssh admin@39.106.199.195 'curl -fsSL -H "Host: www.lncubing.com" http://127.0.0.1/judges | grep -E "裁判员（录入中）|编号"'
```

## Scheduled Jobs

Aliyun has:

- Certbot renewal through `certbot.timer`.
- WCA update cron in root crontab:

```text
30 10,14,16,18,22 * * * /usr/bin/flock -n /tmp/ln-cubing-wca-update.lock /usr/bin/docker exec ln-cubing-web npm run wca:update >> /opt/ln-cubing/logs/wca_cron.log 2>&1
```
