# 网站布局与视觉设计规范（供辽宁魔方网站参考）

> 目的：记录「世界知识库」当前的布局/视觉风格，作为辽宁魔方网站重做时的样板。
> 核心思路：**现代、克制、留白多、信息密度适中**——告别复古拟物风，走 Linear / Notion / Vercel 那一路的扁平简洁。

技术栈：Next.js 16（App Router）+ Tailwind CSS v4 + React 19。下面规则跟框架无关，纯 CSS 也能照抄。

---

## 1. 整体骨架：左侧固定侧边栏 + 右侧主内容区

```
┌──────────┬─────────────────────────────────┐
│ Sidebar  │  main (flex-1, 可滚动)           │
│ 208px    │  内容居中，最大宽度约 1024px      │
│ 固定贴顶  │  四周大留白 (p-8 = 32px)         │
└──────────┴─────────────────────────────────┘
```

- `body`：`flex min-h-screen bg-gray-50 text-gray-900 antialiased`
  - 整站底色用 **极浅灰 `#f9fafb` (gray-50)**，不是纯白——这是「不复古」的关键之一。卡片用纯白浮在浅灰上，层次自然出来。
- 侧边栏 `aside`：`w-52`（208px）、白底、右侧 1px 浅灰描边、`sticky top-0` 贴顶不随滚动。
- 主区 `main`：`flex-1 min-w-0 overflow-auto`，内部页面用 `p-8 max-w-5xl` 控制留白和最大宽度。

---

## 2. 侧边栏设计（最能体现风格的部分）

结构从上到下：**Logo → 分组导航 → 快速新增 → 页脚小字**。

### Logo 区
- 站名 `text-base font-bold text-indigo-700`，下面一行 `text-xs text-gray-400` 副标题。
- 底部 1px 浅灰分隔。

### 分组导航
- 导航按「**分组**」组织，每组有一个全大写小标题：
  `text-[10px] font-semibold text-gray-400 uppercase tracking-widest`（10px、加宽字距、灰色——这种「小标签」是现代后台的标志性细节）。
- 每个导航项：`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm`
  - 左边一个 emoji 图标（`w-5 text-center` 固定宽度对齐），右边文字。
  - **默认态**：`text-gray-600`，悬停 `hover:bg-gray-50 hover:text-gray-900`。
  - **选中态**：`bg-indigo-50 text-indigo-700 font-medium`（淡靛蓝底 + 靛蓝字，不用重色块）。
  - 选中判定：精确匹配或 `pathname.startsWith(href + '/')`。

### 快速新增区
- 顶部分隔线，小标签「快速新增」。
- 几个 `+ 新增XX` 文字链接，`text-xs text-gray-500`，悬停变靛蓝。

### 页脚
- 一行 `text-[10px] text-gray-300` 的弱提示文字（如「私人使用 · 本地运行」）。

---

## 3. 配色系统

| 用途 | 颜色 | Tailwind |
|------|------|----------|
| 页面底色 | 极浅灰 `#f9fafb` | `bg-gray-50` |
| 卡片/侧栏底 | 纯白 | `bg-white` |
| 主文字 | 近黑 `#111827` | `text-gray-900` |
| 次要文字 | 中灰 `#6b7280` | `text-gray-500` |
| 弱提示/标签 | 浅灰 `#9ca3af` | `text-gray-400` |
| 边框 | 极浅灰 | `border-gray-100 / gray-200` |
| **主题色（强调）** | 靛蓝 `#6366f1` | `indigo-600 / indigo-700` |
| 主题浅底 | 淡靛蓝 | `indigo-50` |

**用色原则**：大面积黑白灰，靛蓝只用在「可点击 / 选中 / 强调」上。彩色（绿/蓝/黄/玫红等）只用于不同**内容分类**的标签胶囊，且一律是「浅底 + 同色深字 + 浅同色边框」三件套，例如国家标签：
`bg-green-50 text-green-700 rounded-full border border-green-100`。

---

## 4. 关键组件样式

### 卡片（列表项）
```
p-3 bg-white border border-gray-100 rounded-lg
hover:border-indigo-200 transition-colors group
```
- 圆角 `rounded-lg`（8px），细边框而非阴影，悬停时边框变靛蓝——**克制的交互反馈**。
- 卡内标题用 `group-hover:text-indigo-700` 跟随高亮。

### 标签 / 胶囊（pill）
```
px-2.5 py-1 text-sm rounded-full
bg-{color}-50 text-{color}-700 border border-{color}-100
```
- 全圆角 `rounded-full`，浅底深字。

### 统计数字行
- 一行 inline 统计：`<大号深色数字> + <小号灰色单位>`，整体可点击跳转，悬停变靛蓝。极简，不做大色块仪表盘。

### 「快速录入」宫格
- `grid grid-cols-3 sm:grid-cols-6 gap-2.5`，每格 `flex-col items-center` 图标在上文字在下，`rounded-xl border`，每类一个浅色主题。

### 焦点内容大卡（首页聚焦区）
- `bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-indigo-100 p-7`
- 渐变浅底大圆角卡，**唯一**允许用渐变的地方，用来突出「本期焦点」。内部再嵌纯白小卡分区展示字段。
- 警示类信息用琥珀色系：`bg-amber-50 border-amber-200 text-amber-800` + ⚠️ 图标。

### 空状态
```
text-center py-8 text-gray-400
border-2 border-dashed border-gray-200 rounded-lg
```
- 虚线框 + 灰字 + 一个「添加第一个 →」的引导链接。别让空页面显得是 bug。

### 表单（globals.css 里定义）
- `.form-input`：1px 灰边、`rounded`(6px)、`padding .5rem .75rem`、聚焦时靛蓝边 + 3px 淡靛蓝光晕 `box-shadow: 0 0 0 3px rgba(99,102,241,.1)`。
- `.form-label`：`text-sm font-medium text-gray-700`。

---

## 5. 排版

- 字体栈优先系统字体（苹方 / 微软雅黑 等中文系统字），`antialiased` 抗锯齿：
  `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`
- 字号阶梯：页面主标题 `text-2xl font-bold`，区块标题 `font-semibold text-gray-700`，正文 `text-sm`，辅助 `text-xs`，标签 `text-[10px] uppercase tracking-widest`。
- 行距：长段落用 `leading-relaxed`。
- 间距用 8 的倍数（Tailwind 默认刻度）：`gap-2 / gap-3 / mb-3 / mb-8 / p-8`。

---

## 6. 「不复古」要点小结（给辽宁魔方的避坑清单）

1. **底色用浅灰不用纯白**，卡片用白色浮上去——立刻有层次和呼吸感。
2. **细边框代替阴影/凸起**，圆角统一 `rounded-lg/xl`，绝不用 1px 黑实线网格表格那种老后台感。
3. **强调色单一**（靛蓝），到处都用同一个色，不要每个按钮一个颜色。
4. **大量留白**，`p-8` 起步，区块之间 `mb-8`，宁可空也别挤。
5. **小号全大写加字距的灰色分组标题**，是现代感的廉价高级细节。
6. **悬停反馈要轻**：变个边框色 / 文字色 / 浅底，别整发光、放大、动画一堆。
7. **emoji 当图标**够用且亲切（要更专业可换成 lucide / heroicons 线性图标，风格一致即可）。
8. 内容分类才用彩色，且固定「50 底 / 700 字 / 100 边」三件套。
9. 系统字体 + `antialiased`，别上花体/衬线/像素字。

---

## 7. 可直接复用的最小模板

```html
<body class="flex min-h-screen bg-gray-50 text-gray-900 antialiased">
  <aside class="w-52 shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen sticky top-0">
    <!-- logo -->
    <div class="px-4 py-5 border-b border-gray-100">
      <div class="text-base font-bold text-indigo-700">辽宁魔方</div>
      <div class="text-xs text-gray-400 mt-0.5">副标题</div>
    </div>
    <!-- nav -->
    <nav class="flex-1 px-2 py-3 overflow-y-auto">
      <div class="mb-4">
        <p class="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">分组名</p>
        <a class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm bg-indigo-50 text-indigo-700 font-medium">
          <span class="w-5 text-center">🏠</span><span>当前页</span>
        </a>
        <a class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">
          <span class="w-5 text-center">📦</span><span>其它页</span>
        </a>
      </div>
    </nav>
  </aside>
  <main class="flex-1 min-w-0 overflow-auto">
    <div class="p-8 max-w-5xl">
      <h1 class="text-2xl font-bold text-gray-900">页面标题</h1>
      <p class="text-gray-500 mt-0.5 text-sm">页面副标题</p>
      <!-- 卡片 -->
      <a class="block p-3 mt-6 bg-white border border-gray-100 rounded-lg hover:border-indigo-200 transition-colors">
        卡片内容
      </a>
    </div>
  </main>
</body>
```

---

*参考源文件：`app/layout.tsx`、`components/Sidebar.tsx`、`app/page.tsx`、`app/globals.css`*
