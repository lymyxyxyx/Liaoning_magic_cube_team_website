# 辽宁地区魔方信息查询网

本网站为辽宁地区魔方玩家建立魔方信息查询平台，汇总魔方选手、排名、赛事活动、荣誉经历等资料，让选手、家长、合作单位和魔方爱好者都能清楚查询本地魔方信息。

## 本地运行

如果当前终端找不到 `npm`，并且本机使用 `nvm` 管理 Node，可以先切到项目使用的 Node 22：

```bash
source scripts/use-node.sh
```

```bash
npm install
npm run dev
```

默认开发地址：

```text
http://localhost:3000
```

如果 3000 端口被占用，可以指定端口：

```bash
npm run dev -- -p 3002
```

## WCA 排名数据

当前 `/rankings` 和 `/liaoning-rankings` 都从 PostgreSQL WCA 同步表查询。仓库只提交同步脚本和页面代码，不提交 WCA 原始导出文件、生成数据文件或生产数据库内容。

首次部署或新环境需要先配置：

```text
DATABASE_URL=postgresql://user:password@host:port/database
```

初始化应用表：

```bash
npm run db:init
```

同步 WCA 官方公开 TSV 导出到 PostgreSQL：

```bash
npm run wca:update
```

同步脚本会访问 WCA 官方导出 API，下载 TSV 包，导入这些 PostgreSQL 表：

```text
wca_persons
wca_events
wca_countries
wca_competitions
wca_results
wca_result_attempts
wca_ranks_single
wca_ranks_average
```

本地历史 SQLite 生成脚本仍保留给旧版/调试用途：

```bash
python3 scripts/build_wca_china_333_rankings.py
```

该脚本会生成以下文件，但当前 `/rankings` API 不再依赖它们：

```text
data/wca_rankings.sqlite
data/wca_china_333_rankings.json
```

这些文件不建议提交。

## 生产部署

当前生产环境在阿里云国内服务器：

```text
admin@39.106.199.195
/opt/ln-cubing/app
```

部署流程见 `docs/current-deployment.md`。常用命令：

```bash
scripts/deploy_aliyun.sh
```

## 验证

```bash
npm run typecheck
npm run build
```

## 数据设计说明

WCA 官方排名数据和辽宁本地标签数据分开维护。

- `/rankings`：只展示 WCA 官方口径的国家/地区、项目、单次/平均、性别和分页排名。
- 后续“辽宁排名”：单独维护 `wca_id -> 辽宁/城市/标签` 的本地映射，再关联 WCA 官方成绩。

这样不会污染 WCA 原始数据，也方便后续维护辽宁选手库。
