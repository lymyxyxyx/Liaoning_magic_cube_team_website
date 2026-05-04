# 2026-05-01 工作记录

记录时间：2026-05-01 22:57:16 CST

## 后台录入功能

- 优化了 `/admin` 辽宁选手库录入界面。
- 有 WCA ID 录入支持输入后自动预查 WCA 人员库。
- 无 WCA ID 录入支持一次输入多个姓名，支持空格、换行、逗号、中文逗号、顿号、分号分隔。
- 无 WCA ID 批量新增时，来源赛事会在保存后保留，姓名框会清空，方便同一场比赛连续录入。
- 已存在的“姓名 + 来源赛事”会自动跳过。
- 列表增加筛选：全部、未核对、未匹配、无 WCA ID、已修改。
- “核对”按钮文案调整为：未核对时显示“核对”，点过后显示“已核对”。
- 后台密码支持 `ADMIN_PASSWORD` 环境变量。

## 已提交到 GitHub 的提交

- `9808162 Improve local profile entry workflow`
- `ff0dcab Support batch local profile names`
- `dacf2b8 Update profile check status label`

GitHub 推送在本机直连不稳定，成功方式是走本机代理：

```bash
HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 git -c http.version=HTTP/1.1 push origin main
```

## 服务器状态

- 服务器路径：`/opt/ln-cubing/app`
- 持久数据文件：`/opt/ln-cubing/data/local-profiles.json`
- 已确认服务器后台录入会写入宿主机持久文件。
- 2026-05-01 21:16 左右，`local-profiles.json` 修改时间更新，大小约 64K，说明录入数据已落盘。
- Docker Compose 需要在 `/opt/ln-cubing/app` 目录下执行，否则会提示 `no configuration file provided: not found`。

常用部署命令：

```bash
cd /opt/ln-cubing/app
git pull origin main
sudo docker compose up -d --build
sudo docker compose ps
```

数据目录写入测试：

```bash
cd /opt/ln-cubing/app
sudo docker compose exec web sh -lc 'touch /app/data/.write-test && rm /app/data/.write-test && echo data-ok'
```

## WCA 数据同步

- 服务器当前 WCA 导入状态文件：`/opt/ln-cubing/data/wca_state/last_export_date.txt`
- 服务器当前记录的 WCA export date：`2026-04-29T00:00:22Z`
- 日志显示 WCA 数据已导入 PostgreSQL，包含 `wca_persons`、`wca_events`、`wca_countries`、`wca_competitions`、`wca_results`、`wca_ranks_single`、`wca_ranks_average`。
- 当前没有配置自动同步，仍然手动执行。

手动检查：

```bash
cd /opt/ln-cubing/app
sudo docker compose run --rm web npm run wca:check
```

如检测到新版本，再执行：

```bash
sudo docker compose run --rm web npm run wca:update
```

## 录入进度

- 2026 年数据已暂时补到 4 月结束。
- 由于当前日期是 2026-05-01，后续 2026 年比赛等新比赛结束后再继续录入。
- 已开始补 2025 年数据。
- 2025 年 9 月已录入完毕。
- 当天因眼睛疼痛，停止继续录入。

详细录入节点见：

```text
docs/local-profile-entry-log.md
```

## 后续提醒

- 服务器录入数据不会自动同步回 GitHub 或本地。
- 如需拉回本地，可用：

```bash
scp ubuntu@124.156.140.54:/opt/ln-cubing/data/local-profiles.json \
  /Users/stevenovak/Documents/GitHub/Liaoning_magic_cube_team_website/data/local-profiles.json
```

- 不建议把 `data/local-profiles.json` 直接提交到主仓库，除非后续明确决定把人员库版本化。
- 每次大批量录入前后建议备份：

```bash
sudo mkdir -p /opt/ln-cubing/backups
sudo cp /opt/ln-cubing/data/local-profiles.json /opt/ln-cubing/backups/local-profiles-$(date +%Y%m%d-%H%M%S).json
```
