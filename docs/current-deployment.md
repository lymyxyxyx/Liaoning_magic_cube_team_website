# Current Deployment

Updated: 2026-05-25

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

Current production `APP_URL` should be:

```text
APP_URL=https://lncubing.com
```

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
