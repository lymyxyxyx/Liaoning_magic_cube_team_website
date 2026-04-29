# LN Cubing Deployment Update Log

更新日期：2026-04-29

本文档时间均为北京时间（Asia/Shanghai，UTC+8）。

## 0. 时间线

| 时间 | 事项 |
| --- | --- |
| 2026-04-29 上午 | 完成 `lncubing.com` / `www.lncubing.com` 的 Nginx 域名绑定，并确认站点可通过 HTTP 访问。 |
| 2026-04-29 上午 | 使用 Certbot 为 `lncubing.com` 和 `www.lncubing.com` 配置 HTTPS。 |
| 2026-04-29 12:11:29 | 完成后台密码保护代码提交：`92157b3 Add admin password protection`。 |
| 2026-04-29 14:21:50 | 完成 WCA 数据同步 V1 代码提交：`5101c9c Add WCA data sync script`。 |
| 2026-04-29 14:24:43 | 服务器执行 `npm run wca:check` 成功，检测到 WCA 导出 `2026-04-29T00:00:22Z`。 |
| 2026-04-29 14:25:22 | 服务器开始执行 `npm run wca:update`，下载 WCA TSV 导出包。 |
| 2026-04-29 14:26:02 | WCA 数据成功导入 PostgreSQL，并保存 `last_export_date=2026-04-29T00:00:22Z`。 |
| 2026-04-29 14:35:28 | 完成全国 WCA 排名接口切换 PostgreSQL 代码提交：`04aa955 Read WCA rankings from PostgreSQL`。 |
| 2026-04-29 14:47:00 | 完成辽宁本地排名接口切换 PostgreSQL 代码提交：`0064ee2 Read local rankings from PostgreSQL`。 |
| 2026-04-29 20:58:49 | 整理并写入本部署更新记录。 |

## 1. 域名与 Nginx

LN 魔方站点绑定到服务器：

```text
124.156.140.54
```

Nginx 配置文件：

```text
/etc/nginx/sites-available/ln-cubing
```

原配置：

```nginx
server_name 124.156.140.54 _;
```

修改为：

```nginx
server_name lncubing.com www.lncubing.com;
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

确认 443 监听：

```bash
sudo ss -tlnp | grep ':443'
```

## 2. HTTPS

使用 Certbot 配置 HTTPS：

```bash
sudo certbot --nginx -d lncubing.com -d www.lncubing.com
```

证书位置：

```text
/etc/letsencrypt/live/lncubing.com/fullchain.pem
/etc/letsencrypt/live/lncubing.com/privkey.pem
```

证书到期时间：

```text
2026-07-28
```

Certbot 已设置自动续期。

## 3. 服务器部署结构

项目 Git 仓库目录：

```text
/opt/ln-cubing/app
```

Nginx 代理：

```nginx
proxy_pass http://127.0.0.1:3000;
```

Docker 容器：

```text
ln-cubing-web       127.0.0.1:3000
ln-cubing-postgres  127.0.0.1:5432
```

Docker Compose 文件：

```text
/opt/ln-cubing/app/docker-compose.yml
```

挂载：

```text
/opt/ln-cubing/data -> /app/data
/opt/ln-cubing/logs -> /app/logs
```

## 4. 后台密码保护

后台入口：

```text
/admin
```

登录页：

```text
/admin/login
```

管理密码：

```text
123456
```

相关文件：

```text
app/admin/login/page.tsx
app/admin/login/admin-login-form.tsx
app/api/admin-auth/route.ts
middleware.ts
app/globals.css
```

效果：

- 未登录访问 `/admin` 会跳转到 `/admin/login`
- 输入密码后写入登录 cookie
- 登录后可进入后台
- `/api/local-profiles` 写入操作需要登录

验证：

```bash
npm run typecheck
npm run build
```

## 5. WCA 数据同步 V1

新增 WCA 官方数据同步脚本：

```text
scripts/update_wca_data.mjs
docs/wca-sync.md
```

修改：

```text
package.json
package-lock.json
.gitignore
```

新增命令：

```bash
npm run wca:check
npm run wca:update
```

调用 WCA 官方 API：

```text
https://www.worldcubeassociation.org/api/v0/export/public
```

已成功同步的导出：

```text
export_date=2026-04-29T00:00:22Z
format=2.0.2
```

导入 PostgreSQL 的表：

```text
wca_persons
wca_events
wca_countries
wca_ranks_single
wca_ranks_average
```

导入行数：

```text
wca_persons        286,972
wca_events         21
wca_countries      207
wca_ranks_single   1,004,004
wca_ranks_average  870,661
```

导入策略：

- 先导入 `_new` 临时表
- 全部表导入成功后，在事务中替换正式表
- 如果任一步失败，保留旧表
- 成功或失败后清理临时解压目录

日志：

```text
/opt/ln-cubing/logs/wca_update.log
```

状态文件：

```text
/opt/ln-cubing/data/wca_state/last_export_date.txt
```

手动同步：

```bash
cd /opt/ln-cubing/app
sudo docker compose run --rm web npm run wca:check
sudo docker compose run --rm web npm run wca:update
```

## 6. 全国 WCA 排名接口改为 PostgreSQL

新增：

```text
lib/postgres.ts
```

修改：

```text
app/api/wca-metadata/route.ts
app/api/wca-rankings/route.ts
app/rankings/rankings-client.tsx
```

当前行为：

- `/api/wca-metadata` 读取 `wca_events`、`wca_countries`
- `/api/wca-rankings` 读取 `wca_ranks_single` 或 `wca_ranks_average`
- 人员信息读取 `wca_persons`
- 国家信息读取 `wca_countries`
- 页面文案改为 PostgreSQL API

限制：

V1 暂未导入 `competitions` 和 `results`，因此比赛名称和日期暂时为空。

## 7. 辽宁本地排名接口改为 PostgreSQL

问题表现：

`/rankings` 页面一直显示“加载中...”，web 日志显示旧接口仍在读 SQLite：

```text
sqlite3 -json /app/data/wca_rankings.sqlite
Error: no such table: ranks
```

定位到：

```text
app/api/local-rankings/route.ts
```

仍使用旧 SQLite。

本地已修复：

```text
app/api/local-rankings/route.ts
lib/local-profile-store.ts
app/liaoning-rankings/liaoning-rankings-client.tsx
```

修复内容：

- `/api/local-rankings` 改读 PostgreSQL
- 本地选手 WCA ID 校验改读 `wca_persons`
- 辽宁排名页面文案从 SQLite 改为 PostgreSQL

验证：

```bash
npm run typecheck
npm run build
```

部署：

```bash
git add app/api/local-rankings/route.ts lib/local-profile-store.ts app/liaoning-rankings/liaoning-rankings-client.tsx
git commit -m "Read local rankings from PostgreSQL"
git push
```

服务器：

```bash
cd /opt/ln-cubing/app
git pull
sudo docker compose up -d --build
```

## 8. 常用运维命令

查看 Docker 容器：

```bash
sudo docker ps
```

重建站点：

```bash
cd /opt/ln-cubing/app
sudo docker compose up -d --build
```

查看 web 日志：

```bash
sudo docker compose logs --tail=120 web
```

查看 WCA 同步日志：

```bash
sudo tail -f /opt/ln-cubing/logs/wca_update.log
```

检查 WCA 表：

```bash
sudo docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt wca_*"'
```

查询行数：

```bash
sudo docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from wca_persons;"'
sudo docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from wca_ranks_single;"'
sudo docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from wca_ranks_average;"'
```

测试 API：

```bash
curl -i "http://127.0.0.1:3000/api/wca-metadata"
curl -i "http://127.0.0.1:3000/api/wca-rankings?event=333&country=China&mode=single&gender=all&page=1"
curl -i "http://127.0.0.1:3000/api/local-rankings?event=333&province=辽宁&city=沈阳&scope=city&mode=single&gender=all&page=1"
```

## 9. 当前状态

已完成：

- 域名绑定
- HTTPS
- 后台密码
- WCA 数据同步 V1
- PostgreSQL 数据导入
- 全国 WCA 排名接口改造
- 辽宁本地排名接口本地改造

待确认：

- 将辽宁本地排名接口切 PostgreSQL 的最后一批改动提交并推送
- 服务器 `git pull`
- 服务器 `sudo docker compose up -d --build`
- 确认 `/rankings` 和 `/liaoning-rankings` 不再卡在加载中

## 10. WCA 数据同步 V1.5

计划补充导入：

```text
wca_competitions
wca_results
```

用途：

- 全国 WCA 排名页显示最佳成绩来源比赛
- 辽宁本地排名页显示最佳成绩来源比赛

脚本更新点：

- `scripts/update_wca_data.mjs` 增加 `competitions` 和 `results`
- 增加 `schema_version.txt`
- 即使 WCA `export_date` 不变，只要同步 schema 版本升级，也会重新导入
- 增加 `wca_results` 查询索引
- 继续不导入 `result_attempts` 和 `scrambles`

接口更新点：

- `/api/wca-rankings` 使用 `wca_results` + `wca_competitions` 匹配比赛来源
- `/api/local-rankings` 使用 `wca_results` + `wca_competitions` 匹配比赛来源
- 单次榜按 `results.best`
- 平均榜按 `results.average`

## 11. 后续建议

1. 完成最后一次同步部署。
2. 确认两个排名页面正常。
3. 跑通 V1.5 后观察排名页查询速度。
4. 稳定后再加 cron，每天自动检查并同步 WCA 数据。
