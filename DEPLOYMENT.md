# Deployment Guide

## 目录

- [本地开发启动](#本地开发启动)
- [生产部署](#生产部署)
- [WCA 数据同步](#wca-数据同步)
- [常见问题排查](#常见问题排查)

---

## 本地开发启动

### 前置条件

- Node 22（推荐通过 nvm 管理）
- Docker（用于本地 PostgreSQL，可选）

### 第一步：安装依赖

```bash
# 如果终端找不到 npm，先切换 Node 版本
source scripts/use-node.sh

npm install
```

### 第二步：配置环境变量

复制示例文件，填入本地值（该文件已被 `.gitignore` 排除）：

```bash
cp .env.example .env.local
```

最小配置：

```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<dbname>
ADMIN_PASSWORD=<自定义本地密码>
WEEKLY_ADMIN_PASSWORD=<自定义本地密码>
```

### 第三步：启动本地 PostgreSQL（如需数据库功能）

首页不需要数据库即可访问。只有排名、辽宁纪录、周赛等页面需要连接数据库。

用 Docker 快速启动：

```bash
docker run -d \
  --name ln-cubing-pg \
  -e POSTGRES_DB=<dbname> \
  -e POSTGRES_USER=<user> \
  -e POSTGRES_PASSWORD=<password> \
  -p 5432:5432 \
  postgres:16-alpine
```

### 第四步：初始化数据库表

```bash
npm run db:init
```

此命令创建周赛、账本、WCA 元数据等应用表（幂等，可重复执行）。

### 第五步：同步 WCA 数据（如需排名页面有数据）

```bash
npm run wca:update
```

首次同步会从 WCA 官方下载完整 TSV 导出包，约数百 MB，需要几分钟。

### 第六步：启动开发服务器

```bash
npm run dev
# 默认地址：http://localhost:3000
# 如端口冲突：npm run dev -- -p 3002
```

---

## 生产部署

### 服务器信息

```text
用户：admin
目录：/opt/ln-cubing/app
```

服务器使用 Docker Compose 运行 `postgres` 和 `web` 两个容器，Nginx 监听 80/443 并反向代理到 `web` 容器的 3000 端口。

### 服务器端不追踪的文件

这些文件保存在服务器本地，不提交到 Git：

```text
/opt/ln-cubing/app/.env.production
/opt/ln-cubing/app/Dockerfile
/opt/ln-cubing/app/docker-compose.yml
/opt/ln-cubing/data/
/opt/ln-cubing/logs/
```

仓库提供对应模板：`.env.example`、`Dockerfile.example`、`docker-compose.example.yml`、`nginx.example.conf`。

### 常规部署流程

从本地执行一键部署脚本：

```bash
scripts/deploy_aliyun.sh
```

该脚本会依次：检查本地工作区并锁定待部署提交、推送到 GitHub 和阿里云 Git 接收端、确认服务器分支已收到完全相同的提交（不一致时停止且不重启服务）、生成运行数据备份、检出目标提交、构建并重启 Web 容器、检查 `/api/health` 和完整烟测，最后将提交号写入服务器部署日志。

部署完成后可查看最近记录：

```bash
ssh admin@39.106.199.195 'tail -n 20 /opt/ln-cubing/logs/deployments.log'
```

> **注意**：从服务器直接推送到 GitHub 可能不稳定，建议始终从本地推送。

### 新服务器初始化

首次在新服务器上部署时：

```bash
# 1. 复制配置模板并填入真实值
cp Dockerfile.example Dockerfile
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env.production
# 编辑 .env.production，填入真实密码和数据库连接串

# 2. 启动容器
sudo docker compose up -d

# 3. 初始化数据库
sudo docker exec ln-cubing-web npm run db:init

# 4. 同步 WCA 数据
sudo docker exec ln-cubing-web npm run wca:update
```

### 健康检查

```bash
ssh admin@<SERVER_IP> \
  'cd /opt/ln-cubing/app && \
   git rev-parse --short HEAD && \
   sudo docker compose ps && \
   curl -fsSL http://127.0.0.1:3000/api/health'
```

### 部署前备份

每次涉及数据迁移或大批量操作前，先备份运行时数据：

```bash
ssh admin@<SERVER_IP> '
  ts=$(date +%Y%m%d%H%M%S)
  mkdir -p /opt/ln-cubing/backups/runtime-$ts
  cp -a /opt/ln-cubing/data/*.json /opt/ln-cubing/data/wca_state \
    /opt/ln-cubing/backups/runtime-$ts/ 2>/dev/null || true
  cd /opt/ln-cubing/app
  sudo docker compose exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    > /opt/ln-cubing/backups/runtime-$ts/ln_cubing.sql
  echo "备份完成：/opt/ln-cubing/backups/runtime-$ts"
'
```

---

## WCA 数据同步

排名页面（`/rankings`、`/liaoning-rankings`、`/liaoning-records`）从 PostgreSQL WCA 同步表读取数据。同步脚本会先检查 WCA 官方 API，只在有新版本时才下载。

### 手动同步

```bash
# 服务器上检查是否有新版本（不下载）
sudo docker exec ln-cubing-web npm run wca:check

# 有新版本时同步
sudo docker exec ln-cubing-web npm run wca:update
```

### 自动同步（cron）

在服务器 root crontab 中配置：

```bash
sudo crontab -e
```

推荐配置（每天 10/14/16/18/22 时各检查一次，`flock` 防止重叠执行）：

```cron
30 10,14,16,18,22 * * * /usr/bin/flock -n /tmp/ln-cubing-wca-update.lock \
  /usr/bin/docker exec ln-cubing-web npm run wca:update \
  >> /opt/ln-cubing/logs/wca_cron.log 2>&1
```

### 同步后强制重建

修改了排名相关索引或表结构后，需要手动触发一次完整同步以重建表：

```bash
sudo docker exec ln-cubing-web npm run wca:update
```

---

## 常见问题排查

### 首页正常，排名/纪录页面报 500

**原因**：未连接 PostgreSQL 或 WCA 同步表不存在。

排查步骤：

1. 确认 `DATABASE_URL` 已在环境变量中设置
2. 确认数据库可连接：
   ```bash
   sudo docker exec ln-cubing-web node -e \
     "require('./lib/postgres').getPostgresPool().query('SELECT 1').then(()=>console.log('ok'))"
   ```
3. 确认 WCA 同步表存在：
   ```bash
   sudo docker exec ln-cubing-postgres \
     psql -U <user> -d <dbname> -c "\dt wca_*"
   ```
4. 如果表不存在，先跑 `npm run db:init`，再跑 `npm run wca:update`

### `docker compose` 提示找不到配置文件

确保在 `/opt/ln-cubing/app` 目录下执行，且 `docker-compose.yml` 存在：

```bash
cd /opt/ln-cubing/app
ls docker-compose.yml
```

### WCA 同步卡住或失败

查看日志：

```bash
tail -100 /opt/ln-cubing/logs/wca_update.log
```

常见原因：
- 网络超时（WCA 导出包较大）：重新执行 `npm run wca:update`，同步脚本支持断点检测
- 磁盘空间不足：检查 `/opt/ln-cubing/data/wca_raw` 和 `wca_tmp` 目录占用

### 本地 npm 找不到

```bash
source scripts/use-node.sh
```

### 端口 3000 被占用

```bash
npm run dev -- -p 3002
```

### 构建失败（TypeScript 错误）

```bash
npm run typecheck
npm run build
```
