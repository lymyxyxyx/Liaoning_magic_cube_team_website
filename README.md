# 辽宁地区魔方信息查询网

本网站为辽宁地区魔方玩家建立魔方信息查询平台，汇总魔方选手、排名、赛事活动、荣誉经历等资料，让选手、家长、合作单位和魔方爱好者都能清楚查询本地魔方信息。

## 本地运行

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

WCA 原始 SQL 和生成后的 SQLite/JSON 文件都不提交到 GitHub。仓库只提交生成脚本和页面代码。

本地 WCA 排名页依赖：

```text
data/wca_rankings.sqlite
```

生成方式：

1. 下载或准备 WCA 官方导出的 `WCA_export.sql`。
2. 放到脚本默认读取的位置：

```text
../WCA_export_v2_114_20260424T000025Z.sql/WCA_export.sql
```

3. 在项目根目录运行：

```bash
python3 scripts/build_wca_china_333_rankings.py
```

脚本会生成：

```text
data/wca_rankings.sqlite
data/wca_china_333_rankings.json
```

其中 SQLite 是当前 `/rankings` 页面 API 的主要数据源；JSON 只是保留给旧版/调试用，不建议提交。

## 上传 GitHub

建议提交：

- `app/`
- `components/`
- `lib/`
- `public/`
- `scripts/`
- `README.md`
- `data/README.md`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next.config.mjs`

不要提交：

- `node_modules/`
- `.next/`
- `*.sql`
- `WCA_export*/`
- `data/*.sqlite`
- `data/*.json`
- `.env*`
- `*.tsbuildinfo`

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
