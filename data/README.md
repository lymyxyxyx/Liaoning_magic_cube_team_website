# WCA 本地数据目录

这个目录用于存放本地生成的数据文件。大文件不提交到 GitHub。

## 不提交的文件

```text
wca_rankings.sqlite
wca_china_333_rankings.json
local-profiles.json
```

原因：

- 文件体积大，SQLite 当前约数百 MB。
- 数据来自 WCA 官方导出，可以重新生成。
- Git 不适合保存频繁更新的大型数据库文件。

## 如何生成

项目根目录运行：

```bash
python3 scripts/build_wca_china_333_rankings.py
```

脚本默认读取：

```text
../WCA_export_v2_114_20260424T000025Z.sql/WCA_export.sql
```

生成后，`/rankings` 页面会通过 Next.js API 查询：

```text
data/wca_rankings.sqlite
```

## 给其他开发者的说明

如果 clone 仓库后 `/rankings` 页面提示无法读取排名数据，需要先准备 WCA 官方导出 SQL，并运行生成脚本。

代码仓库只负责保存：

- 数据生成脚本
- API 查询逻辑
- 前端页面

本地机器或服务器负责保存：

- WCA 原始 SQL
- 生成后的 SQLite 数据库
- 后台保存的本地省市归属 JSON
