# 项目与部署历史记录

记录日期：2026-04-29  
完成时间：2026-04-29 21:00:56 北京时间  
适用项目：

- 辽宁/区域魔方数据平台：`Liaoning_magic_cube_team_website`
- sttimer 静态计时器站点：`sttimer`

## 1. 当前本地项目

辽宁项目本地路径：

```text
/Users/novak-2/Documents/Codex/2026-04-24/git-https-github-com-lymyxyxyx-liaoning/Liaoning_magic_cube_team_website
```

GitHub 远端：

```text
https://github.com/lymyxyxyx/Liaoning_magic_cube_team_website.git
```

sttimer 本地路径：

```text
/Users/novak-2/Documents/GitHub/sttimer
```

sttimer GitHub 远端：

```text
https://github.com/cuber520/sttimer.git
```

## 2. 辽宁项目当前技术栈

辽宁项目是一个 `Next.js 14 App Router` 单体应用：

- 前端：React 18 + Next.js 14
- 语言：TypeScript
- 样式：全局 CSS，主要在 `app/globals.css`
- 图标：`lucide-react`
- API：Next.js Route Handlers，位于 `app/api/*/route.ts`
- 当前 WCA 数据：本地 SQLite，文件为 `data/wca_rankings.sqlite`
- 当前 WCA 导入脚本：`scripts/build_wca_china_333_rankings.py`

现有 API：

```text
app/api/wca-rankings/route.ts
app/api/wca-metadata/route.ts
app/api/local-rankings/route.ts
app/api/local-profiles/route.ts
```

当前不是独立后端，而是 Next.js 内置 API。后续可以先继续保持单体架构，再逐步引入 PostgreSQL 和服务层。

## 3. 辽宁项目未来平台方向

目标是从“辽宁魔方战队展示网站”升级为“区域魔方数据平台”。

核心功能规划：

1. WCA 官方数据导入与更新
2. 辽宁、内蒙古等区域选手库
3. WCA ID 绑定
4. 区域排名查询
5. 非 WCA 比赛与非官方项目记录
6. 管理员后台
7. 数据审核
8. 纠错/隐藏申请

建议第一阶段仍然使用 Next.js 单体，不急着新增独立 `backend` 目录。

推荐后续新增逻辑目录：

```text
lib/db/
lib/repositories/
lib/services/
lib/importers/
lib/validators/
```

## 4. 数据库建议

正式平台建议使用 PostgreSQL。

SQLite 适合：

- 本地开发
- 临时导入
- 只读查询 Demo

PostgreSQL 更适合：

- 多区域选手库
- WCA ID 绑定
- 管理后台
- 审核流程
- 非 WCA 比赛成绩
- 数据纠错与隐藏申请

WCA 原始数据不要提交 GitHub，只能放服务器本地目录。

## 5. 腾讯云香港服务器信息

服务器：

```text
公网 IP：124.156.140.54
用户：ubuntu
系统：Ubuntu 24.04
配置：2核 4G 70GB
```

已安装：

```text
git
curl
wget
unzip
Docker
Docker Compose
Nginx
postgresql-client
```

已开放端口：

```text
22
80
443
```

已创建快照：

```text
init-nginx-docker-20260427
```

## 6. 服务器推荐目录

辽宁/区域平台：

```text
/opt/ln-cubing/app
/opt/ln-cubing/data/wca
/opt/ln-cubing/data/imports
/opt/ln-cubing/backups
/opt/ln-cubing/logs
```

sttimer：

```text
/opt/sttimer/app
```

两个项目不要混放。

## 7. 辽宁项目第一阶段部署方案

建议使用 Docker Compose：

- `web`：Next.js 前端 + API
- `postgres`：PostgreSQL
- Nginx：宿主机运行，反向代理到 `127.0.0.1:3000`

建议环境变量文件：

```text
/opt/ln-cubing/app/.env.production
```

示例：

```env
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
APP_URL=http://124.156.140.54

POSTGRES_DB=ln_cubing
POSTGRES_USER=ln_cubing
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>
DATABASE_URL=postgresql://ln_cubing:<POSTGRES_PASSWORD>@postgres:5432/ln_cubing

WCA_DATA_DIR=/app/data/wca
LOCAL_DATA_DIR=/app/data
```

建议先跑通：

```text
/api/health
```

第一阶段暂时不要导入 WCA 全量数据。

## 8. WCA 数据原则

WCA 原始数据只能放服务器本地：

```text
/opt/ln-cubing/data/wca/
```

不要提交：

```text
*.sql
*.zip
WCA_export*/
data/*.sqlite
data/*.json
```

上传示例：

```bash
scp /本地真实路径/WCA_export_xxx.zip ubuntu@124.156.140.54:/opt/ln-cubing/data/wca/
```

注意：`WCA_export_xxx.zip` 是占位符，必须替换成真实文件名。

## 9. 本地、GitHub、服务器同步规则

推荐同步链路：

```text
本地开发 -> git commit -> git push -> 服务器 git pull -> 重新部署
```

服务器不要直接改业务代码。

服务器只保留：

- `.env.production`
- WCA 原始数据
- PostgreSQL 数据
- Nginx 配置
- Docker volume
- logs
- backups

辽宁项目服务器更新命令：

```bash
cd /opt/ln-cubing/app
git pull origin main
docker compose up -d --build
docker compose ps
```

## 10. sttimer 项目情况

sttimer 是纯静态站，不需要 Node、不需要 Docker、不需要构建。

结构：

```text
index.html
css/
js/
font/
```

本地 GitHub 工作区：

```text
/Users/novak-2/Documents/GitHub/sttimer
```

远端：

```text
https://github.com/cuber520/sttimer.git
```

服务器目录：

```text
/opt/sttimer/app
```

服务器更新：

```bash
cd /opt/sttimer/app
git pull origin main
sudo nginx -t
sudo systemctl reload nginx
```

## 11. sttimer 域名和 DNS

域名：

```text
sttimer.com
www.sttimer.com
```

DNS 已配置：

```text
A    @      124.156.140.54
A    www    124.156.140.54
```

说明：

- 域名是别人购买的，也可以指向这台服务器。
- 只需要域名所有者在 DNS 后台添加 A 记录。
- 不一定要把整个域名转移到当前腾讯云账号。

## 12. sttimer Nginx 配置

配置文件：

```text
/etc/nginx/sites-available/sttimer
```

推荐内容：

```nginx
server {
    listen 80;
    server_name sttimer.com www.sttimer.com;

    root /opt/sttimer/app;
    index index.html;

    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        try_files $uri =404;
    }
}
```

启用：

```bash
sudo ln -sf /etc/nginx/sites-available/sttimer /etc/nginx/sites-enabled/sttimer
sudo nginx -t
sudo systemctl reload nginx
```

如果仍显示 Nginx 默认欢迎页，可移除默认站点：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 13. HTTPS / Certbot

如果 `certbot` 不存在：

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

申请证书：

```bash
sudo certbot --nginx -d sttimer.com -d www.sttimer.com
```

交互提示：

- 邮箱：输入可接收通知的邮箱
- 同意条款：`Y`
- 接收推广邮件：可选 `N`
- HTTP 跳转 HTTPS：选择 `2`，即 Redirect

测试：

```bash
curl -I --max-time 10 https://sttimer.com
curl -I --max-time 10 https://www.sttimer.com
```

如果卡住，检查：

```bash
sudo nginx -t
sudo ss -lntp | grep ':443'
sudo ufw status
sudo ls -lah /etc/letsencrypt/live/sttimer.com/
```

## 14. sttimer 访问慢的优化

已建议：

1. Nginx 开启 gzip
2. 静态资源设置 30 天缓存
3. HTML 中删除 PHP 风格缓存参数：

```html
<link rel="stylesheet" href="/css/index2.css?v=<?php echo time(); ?>">
```

4. 可将 CSS 引用从普通版改为 min 版：

```html
./css/module.min.css
./css/index2.min.css
```

## 15. 常见误操作记录

### scp 占位文件名错误

错误：

```bash
scp WCA_export_xxx.zip ubuntu@124.156.140.54:/opt/ln-cubing/data/wca/
```

如果当前目录没有真实文件，会报：

```text
No such file or directory
```

应替换为真实路径。

### root 指令误当 Shell 命令

错误：

```bash
root /opt/sttimer/app;
```

这是 Nginx 配置指令，不是 Linux 命令。应该写入：

```text
/etc/nginx/sites-available/sttimer
```

### GitHub 私有仓库 clone 要求用户名

如果执行：

```bash
git clone https://github.com/cuber520/sttimer.git app
```

提示：

```text
Username for 'https://github.com':
```

说明仓库可能是私有，建议：

1. 改成 public；或
2. 使用 GitHub Token；或
3. 配置 SSH key。

## 16. 当前建议的下一步

短期优先级：

1. 确认 `https://sttimer.com` 正常访问
2. 确认 `www.sttimer.com` 自动跳转或正常访问
3. 清理 sttimer HTML 中多余 PHP 样式引用
4. 给 sttimer 建一个简单部署脚本
5. 辽宁平台补 `/api/health`
6. 辽宁平台 PostgreSQL schema 第一版设计

暂时不要：

- 不要导入 WCA 全量数据
- 不要把 WCA 原始文件提交 GitHub
- 不要在服务器直接改业务代码
- 不要把 sttimer 放进 `/opt/ln-cubing/app`
