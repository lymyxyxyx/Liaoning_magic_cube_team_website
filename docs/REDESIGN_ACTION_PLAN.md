# 辽宁魔方网站 视觉现代化 · 落地改造清单

> 目标：去掉「复古/俗气」感，向 Linear / Vercel / 世界知识库 那种**扁平、克制、轻投影**的现代风靠拢。
> 配套参考：`docs/REFERENCE_LAYOUT_DESIGN_SPEC.md`（样板站的完整规范）。
>
> **原则：调，不是推倒重来。** 本站底子不差——已有完整 CSS 变量体系、暗色模式、`lucide-react` 线性图标、响应式 sticky header。改动集中在 `app/globals.css` 的**设计 token + 几处装饰样式**，几乎不动结构和数据逻辑，风险小、可 `git diff` 逐步预览。

技术栈：Next.js 14 + 纯 CSS（`app/globals.css`，约 8070 行，CSS 变量驱动）。**不是 Tailwind**，所以样板规范里的工具类要翻译成本站的 `--变量` / 选择器写法（本清单已翻译好）。

---

## 诊断：丑在 4 个具体地方（按"改了最值"排序）

| # | 问题 | 位置 | 为什么显复古 |
|---|------|------|------------|
| P0-1 | **重投影** `--shadow: 0 18px 45px` | `:root`，被 6+ 处卡片共用 | 45px 大扩散投影是「老气/廉价」头号来源 |
| P0-2 | **彩色投影** brand-mark 红底+红投影 | `globals.css:157` | 带颜色的大投影非常俗 |
| P1-1 | **红蓝撞色** `--red #d33b3f` + `--blue #2457c5` 同台高饱和 | `:root` + 多处 | 双高饱和强调色互相打架，没有主次 |
| P1-2 | **装饰渐变** 红蓝渐变条 / 深蓝渐变 hero | `:root`、`354`、`411` | 现代风渐变要么不用、要么只留一处焦点 |

> 最高杠杆：**P0-1 只改 `:root` 一个变量定义，6 处卡片同时变清爽。** 先做这个，立刻见效。

---

## P0 · 改 `:root` 设计 token（最高性价比，先做）

### 1. 软化全局投影 —— `app/globals.css` 顶部 `:root`（亮色，约第 14–15 行）

```css
/* 旧 */
--shadow: 0 18px 45px rgba(23, 32, 51, 0.1);
--shadow-soft: 0 10px 28px rgba(23, 32, 51, 0.07);

/* 新：双层极轻投影，贴近 Linear/Vercel */
--shadow: 0 1px 2px rgba(23, 32, 51, 0.04), 0 4px 12px rgba(23, 32, 51, 0.06);
--shadow-soft: 0 1px 2px rgba(23, 32, 51, 0.04);
```

对应**暗色模式**块（约第 35–36 行）一起改：
```css
/* 旧 */
--shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
--shadow-soft: 0 10px 28px rgba(0, 0, 0, 0.35);
/* 新 */
--shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.35);
--shadow-soft: 0 1px 2px rgba(0, 0, 0, 0.3);
```
> 这一步让第 261/493/1238/1901/3874/5346 行那些 `box-shadow: var(--shadow)` 的卡片全部同时变轻。**改完先跑 `npm run dev` 看首页，大概率已经清爽一大半。**

### 2. 收敛强调色 —— `:root`（约第 9–11 行）

思路：**蓝为唯一主强调色，红降级为"点缀/纪录/警示"专用**，并把饱和度压一点。

```css
/* 旧 */
--blue: #2457c5;
--blue-deep: #173b8f;
--red: #d33b3f;

/* 新：蓝更沉稳，红只在必要处出现 */
--blue: #2563eb;        /* 主强调色，全站可点击/选中/重点 */
--blue-deep: #1e40af;
--red: #dc2626;         /* 仅用于纪录/警示/删除，不做大背景、不进渐变 */
```
> 若想更贴近样板的靛蓝气质，可用 `--blue: #4f46e5; --blue-deep: #4338ca;`（indigo）。二选一，重开后我可以两版各截一张图给你对比。

---

## P0 · 改 brand-mark 彩色重投影（`app/globals.css:157` `.brand-mark, .icon-tile`）

```css
/* 旧 */
background: var(--red);
box-shadow: 0 10px 22px rgba(211, 59, 63, 0.2);

/* 新：用主蓝、去掉彩色大投影 */
background: var(--blue);
box-shadow: none;            /* 或极轻：0 1px 2px rgba(23,32,51,.08) */
```

---

## P1 · 去装饰渐变

1. **`.page-hero::before` 红蓝渐变顶条**（约第 411 行）
   ```css
   /* 旧 */ background: linear-gradient(90deg, var(--red), var(--blue));
   /* 新 */ background: var(--blue);            /* 单色细线；或直接删掉 ::before 这条 */
   ```
2. **`.hero-band` 深蓝渐变**（约第 354 行）
   ```css
   /* 旧 */ background: linear-gradient(160deg, #0d1829 0%, #1a3257 100%);
   /* 新 */ background: #0f1d36;                /* 纯深色，更干净。或改浅色卡风格 */
   ```
3. 其余渐变（1695/2064/3263 等多为进度条/装饰）**非必须**，可后续逐个评估。美国国旗渐变（5619/5633）是功能性图案，**不要动**。

---

## P1 · 卡片样式统一为「细边框 + 轻投影」

第 261/493/1238/3874/5346 行这批卡片已是 `border 1px var(--line) + radius 8px + var(--shadow)`，
改完 P0-1 后已达标。可选微调：圆角 `8px → 10px`（`--radius` 若有就统一），悬停反馈改"边框变蓝"而非加深投影：
```css
.card:hover { border-color: var(--blue); }   /* 按实际卡片选择器名替换 */
```

---

## P2 · 字重/字距等细节（锦上添花）

- header 导航 `font-weight: 650`（`globals.css:201` 区）偏重 → 改 `550`，更轻盈。
- 分组小标题统一用样板风格：`font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted);`
- 间距尽量走 8 的倍数。

---

## 执行顺序建议（重开后）

1. **P0-1 软投影**（改 :root 4 个值）→ `npm run dev` 看首页 → 截图
2. **P0-2 brand-mark** + **P1-2 渐变** → 看 header 和 hero
3. **P0 收敛配色**（蓝/红二选一方案）→ 全站扫一遍
4. P1 卡片悬停、P2 字重细节
5. `npm run typecheck && npm run build` 确认没破东西，再 commit

每步都小、可回滚。建议每完成一个 P 级别 `git add -p` 看 diff、`git commit` 一次，方便对比和回退。

---

## 不要动的东西

- 数据逻辑（`lib/*`、PostgreSQL、WCA 同步、`middleware.ts`）
- header / 导航的**结构**（下拉、移动端、无障碍都写得不错，只调样式）
- 美国国旗等功能性 CSS 图案
- 暗色模式的存在（保留，只同步更新新变量值）

---

*现状关键文件：`app/globals.css`（样式总表）、`app/layout.tsx`、`components/site-header.tsx`、`components/cards.tsx`、`components/page-hero.tsx`*
