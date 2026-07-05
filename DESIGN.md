---
omd: 0.1
brand: sport-match
bootstrapped_from: apple
bootstrapped_at: 2026-05-22T20:20:00+08:00
---

# DESIGN.md — sport-match

## §1 Brand Colors

Apple 的色彩系统建立在克制的二元对比之上 — 大面积的纯白与近黑作为画布，品牌蓝作为唯一的信号色。

| Token | Hex | OKLCH | Usage |
|-------|-----|-------|-------|
| `--color-brand` | `#0071e3` | `lch(52% 0.22 264)` | Primary CTA, interactive states, brand mark |
| `--color-brand-hover` | `#0077ed` | `lch(54% 0.22 264)` | Button hover, focus ring |
| `--color-brand-pressed` | `#0060c7` | `lch(48% 0.22 264)` | Button active/pressed |
| `--color-surface` | `#ffffff` | `lch(100% 0 0)` | Page background |
| `--color-surface-secondary` | `#f5f5f7` | `lch(97% 0 0)` | Card backgrounds, secondary surfaces |
| `--color-text-primary` | `#1d1d1f` | `lch(9% 0 0)` | Headlines, body text |
| `--color-text-secondary` | `#86868b` | `lch(58% 0 0)` | Secondary text, captions |
| `--color-text-tertiary` | `#aeaeb2` | `lch(71% 0 0)` | Placeholder, disabled |
| `--color-border` | `#d2d2d7` | `lch(85% 0 0)` | Dividers, borders |
| `--color-success` | `#34c759` | — | Confirmation, completion |
| `--color-warning` | `#ff9500` | — | Attention states |
| `--color-error` | `#ff3b30` | — | Destructive actions, errors |

**规则：**
- 品牌蓝仅用于可交互元素和品牌标识，不用于装饰
- 内容区（摄影、视频、用户头像）是唯一允许携带额外色彩的区域
- 灰度色板通过透明度叠加实现，避免冷灰或暖灰偏色
- 深色模式下 `--color-surface` 翻转为 `#000000`，`--color-text-primary` 翻转为 `#f5f5f7`

## §2 Typography

### Font Stack
```
--font-display: "SF Pro Display", -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif;
--font-body: "SF Pro Text", -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif;
--font-mono: "SF Mono", "Cascadia Code", monospace;
```

### Type Scale

| Token | Size | Weight | Letter Spacing | Line Height | Usage |
|-------|------|--------|----------------|-------------|-------|
| `hero` | 56px | 600 | -0.025em | 1.05 | Hero headline |
| `title-1` | 40px | 600 | -0.02em | 1.1 | Page titles |
| `title-2` | 32px | 600 | -0.015em | 1.15 | Section headers |
| `title-3` | 24px | 500 | -0.01em | 1.2 | Card titles |
| `headline` | 17px | 600 | -0.005em | 1.3 | List headings |
| `body` | 17px | 400 | 0 | 1.5 | Body text |
| `callout` | 16px | 400 | 0 | 1.4 | Supporting text |
| `subhead` | 15px | 400 | 0 | 1.35 | Secondary labels |
| `footnote` | 13px | 400 | 0 | 1.3 | Captions, metadata |
| `caption-1` | 12px | 400 | 0 | 1.25 | Timestamps, badges |
| `caption-2` | 11px | 500 | 0.005em | 1.2 | Legal, minimum text |

**规则：**
- 所有标题使用负 letter-spacing，越大的字号负值越大
- body 文本不低于 17px — 可读性不可妥协
- 中文最小字号 12px，英文最小字号 11px
- 不使用 font-weight 700 以上的粗细 — Semibold (600) 是最大强调
- 每行中文不超过 40 字符，英文不超过 80 字符

## §3 Spacing

基于 4px 网格，以 8px 为基准单元。

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Icon-label gap, inline spacing |
| `--space-sm` | 8px | Tight component padding |
| `--space-md` | 16px | Standard padding, card padding |
| `--space-lg` | 24px | Section gaps, header padding |
| `--space-xl` | 32px | Content block separation |
| `--space-2xl` | 48px | Major layout breaks |
| `--space-3xl` | 64px | Hero to content transition |
| `--space-4xl` | 96px | Page-level separators |

**布局原则：**
- 主内容列最大宽度 980px，居中
- 宽屏下内容不无限拉伸 — 留白是内容的一部分
- 模块间间距大于模块内间距 — 邻近性表达归属
- 首屏 hero 至少保留 120px 上下呼吸空间

## §4 Radii & Shadows

### Radii

Apple 的核心 UI 默认 0px 直角 — 内容容器不抢戏。仅少数交互元素使用圆角。

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0px | Cards, panels, images |
| `--radius-sm` | 6px | Input fields, small buttons |
| `--radius-md` | 8px | Standard buttons |
| `--radius-lg` | 12px | Modals, sheets |
| `--radius-full` | 9999px | Pills, tags, floating action |

**规则：**
- 卡片默认 0px 直角 — 让摄影和内容定义边界
- CTA 按钮使用 `--radius-md` (8px) 或 `--radius-full` (pill)
- 输入框、搜索栏使用 `--radius-sm` (6px) 或 `--radius-full`
- 模态框/面板使用 `--radius-lg` (12px)

### Shadows

阴影极克制 — 只用透明度表达层级，不用色相。

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-none` | none | Default state |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Subtle card lift |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.1)` | Elevated cards, dropdowns |
| `--shadow-lg` | `0 8px 30px rgba(0,0,0,0.12)` | Modals, sheets |
| `--shadow-xl` | `0 20px 60px rgba(0,0,0,0.15)` | Full-screen overlays |

**规则：**
- 默认状态无阴影 — 平面是基准
- 阴影仅通过模糊半径和透明度表达深度，不使用 spread
- 不叠加多层阴影 — 一层足够
- 悬浮元素使用 `--shadow-md`，模态使用 `--shadow-lg`

## §5 Iconography

使用 SF Symbols 作为图标系统 — 9种字重 × 3种尺寸 × 4种渲染模式。

- **线宽一致性**：所有图标使用 Regular weight，交互态切换为 Medium
- **尺寸**：导航栏 24px，列表行 20px，标签内 16px
- **颜色继承**：图标默认继承文本色 `--color-text-secondary`，交互态使用 `--color-brand`
- **自定义图标**：如需要，使用 24×24px 画布，1.5px 描边，与 SF Symbols 视觉重量对齐

## §6 Photography & Video

这是 Apple 式设计中最核心的差异化层 — 摄影和视频是唯一被允许携带完整色彩饱和度的元素。

**规则：**
- 全幅摄影作为 hero — 产品截图/运动场景照片占满视口宽度
- 视频缩略图 16:9，圆角可选 0px（全幅）或 8px（卡片内）
- 内容图片不加阴影、不加边框 — 让内容自己说话
- 用户 UGC 内容保留原始色彩，不做去色或滤镜处理
- 视频播放器控件遵循系统原生风格 — 半透明叠加，不遮挡内容

## §7 Grid & Layout

### 响应式断点

| Breakpoint | Min Width | Columns | Gutter | Margin |
|------------|-----------|---------|--------|--------|
| Compact | 320px | 4 | 16px | 16px |
| Regular | 768px | 8 | 20px | 24px |
| Wide | 1024px | 12 | 24px | 32px |

### 内容列

- 最大内容宽度 980px，居中锁
- 运动视频网格：Regular 下 3 列，Wide 下 4 列
- 个人资料/设置等表单页：单列 600px 居中

## §8 Component Tokens

### Button
- Height: 44px（最小触摸目标）
- Radius: `--radius-md` (8px) 或 `--radius-full`
- Primary: `background: var(--color-brand); color: #ffffff`
- Secondary: `background: transparent; border: 1px solid var(--color-border); color: var(--color-text-primary)`
- Hover: primary 变亮 `--color-brand-hover`，secondary 背景变 `--color-surface-secondary`
- Pressed: 缩放至 0.97，200ms spring
- Disabled: opacity 0.4

### Input
- Height: 44px
- Radius: `--radius-sm` (6px) 或 `--radius-full`
- Border: 1px `--color-border`
- Focus: border `--color-brand`，外围 3px `rgba(0,113,227,0.15)` ring
- Placeholder: `--color-text-tertiary`

### Card
- Background: `--color-surface` 或 `--color-surface-secondary`
- Radius: `--radius-none` (0px) 默认，视频内容卡可使用 8px
- Border: 无默认边框，hover 时可出现 hairline
- Hover: 轻微 lift — `transform: translateY(-2px)` + `--shadow-sm`，200ms ease

### Navigation Bar
- Height: 48px（移动端 44px）
- Background: `rgba(255,255,255,0.85)` + `backdrop-filter: blur(20px)` 毛玻璃
- Bottom border: 0.5px `--color-border`
- Sticky: 始终置顶

### Tab Bar (移动端)
- Height: 49px + safe area
- Background: 同 NavBar 毛玻璃
- 选中态: `--color-brand` icon + text
- 未选中: `--color-text-secondary`

## §9 Accessibility

- 所有文本-背景组合满足 WCAG 2.1 AA（对比度 ≥ 4.5:1）
- 大字号文本（≥24px）满足 3:1 最低对比度
- 焦点环使用 3px `rgba(0,113,227,0.4)` outline，offset 2px
- `prefers-reduced-motion` 时禁用所有 spring/transform 动画
- 支持 Dynamic Type — 字号可随系统设置缩放至 135%
- VoiceOver 标签为所有交互元素提供清晰的 accessibility label

## §10 Voice

**Register: 自信而克制。** 不说多余的话。

- 句子短。一段一个意思。
- 不用惊叹号。信息本身的力量足够。
- 不用 "革命性"、"颠覆式" 之类的修饰词。
- 中文：口语化但不随意。用 "你" 不用 "您"。
- 运动场景使用精准动词（完成、记录、开始），不堆形容词。
- 空状态不说 "暂无数据" — 说下一步该做什么。
- 按钮文案用动词，不用名词：说 "开始训练" 而不是 "训练入口"。

**反模式 (antipatterns)：**
- ❌ 惊叹号在 CTA 上
- ❌ "revolutionary" / "颠覆式" 作为装饰形容词
- ❌ emoji 出现在产品文案中
- ❌ "暂无数据" / "加载失败，请重试" 的机械报错
- ❌ 超过三行的说明文字

## §11 Brand Narrative

收藏夹里存了那么多运动视频，为什么从来没打开过？

因为看到一条视频 → 点收藏只需要 1 秒，但把它变成今天要做的训练需要判断——哪个是热身、哪个强度太高、练完怎么拉伸、自己能坚持多久。这些决策的摩擦力远大于"收藏一下"。

SportMatch 做的是中间这一层翻译：把你散落在各平台的收藏，自动组装成匹配你身体条件的今日训练方案。不需要规划，不需要对比，打开就能开始。

## §12 Principles

Apple 的设计原则在 sport-match 语境下的映射：

**Simplicity is the ultimate sophistication.**
界面只保留必要元素。视频内容、运动数据、行动按钮 — 三者构成每个页面的全部。删除一切装饰。

**Design for the content, not the chrome.**
运动摄影和训练视频是主角。UI chrome（导航、按钮、标签）在不需要时退场，需要时半透明叠加。

**Every interaction should feel natural.**
Spring physics 驱动的滚动、手势、过渡 — 模拟物理世界的动量与摩擦。列表滚动的惯性、卡片悬浮的 lift、按钮按压的 scale-down，都在暗示"这是真实的"。

**Clarity above all.**
字号够大，对比够强，间距够宽。运动数据（时间、次数、进度百分比）用最大字号展示，不允许歧义。

## §13 Personas

**核心用户：碎片化运动内容消费者**
- 在社交媒体频繁刷到运动教程短视频
- 习惯收藏/保存，但收藏夹成为信息坟场
- 缺乏将分散内容转化为可执行训练计划的能力
- 需要工具降低从"看到"到"做到"的摩擦力

**进阶用户：有规律训练习惯的跟练者**
- 每周固定运动 3-5 次，已形成自己的训练偏好
- 收藏了很多视频但常练的就那几个，其他吃灰
- 希望发现与现有偏好匹配的新内容，但不想花时间筛选
- 对训练计划的结构（热身-主体-拉伸）有认知，愿意自定义编排

**身体受限用户：有运动意愿但被身体条件限制**
- 膝盖不适、腰椎问题、产后恢复等特殊身体状况
- 看到运动视频不敢直接跟练，担心动作不适合自己
- 需要避开特定禁忌动作（跳跃、深蹲、仰卧等）
- 期望有人帮他过滤掉"不适合自己的"，只推荐"安全的"

## §14 States

每个组件覆盖五个状态：

| State | Definition | Default Behavior |
|-------|-----------|------------------|
| **Empty** | 首次使用，无数据 | 一个清晰的 CTA + 一句解释，不说 "暂无数据"。例如："收藏你的第一个训练视频" + action button |
| **Loading** | 数据获取中 | Skeleton screen 而非 spinner — 灰色占位块模拟内容形状，200ms fade-in 延迟（避免闪烁） |
| **Success** | 操作完成 | 短暂确认（checkmark 图标 + "已记录" 文字），800ms 后自动消失 |
| **Error** | 操作失败 | 说明具体原因（不是 "出错了"），提供可操作下一步 |
| **Empty (after data)** | 搜索/过滤无结果 | "没有匹配的训练内容" + 清除过滤的快捷操作 |

**Skeleton 规范：**
- 使用 `--color-surface-secondary` 做骨架底色
- 内容区的 skeleton 圆角 4px
- 图片/视频缩略图的 skeleton 圆角 0px 或 8px（匹配真实内容）
- 不闪动 — Apple 不使用 shimmer 动画，静态骨架即可

## §15 Motion

Apple 的动效哲学：自然的 spring physics，永远不机械。

### Core Tokens

| Token | Curve | Duration | Usage |
|-------|-------|----------|-------|
| `ease-default` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | 300ms | 标准过渡 |
| `ease-enter` | `cubic-bezier(0, 0, 0.58, 1)` | 250ms | 元素入场 |
| `ease-exit` | `cubic-bezier(0.42, 0, 1, 1)` | 200ms | 元素退场 |
| `spring-gentle` | `spring(0.5, 100, 10)` | — | 轻微弹性反馈 |
| `spring-snap` | `spring(0.3, 150, 20)` | — | 快速弹性响应 |

### 交互规范

| Interaction | Behavior |
|-------------|----------|
| 按钮按下 | `transform: scale(0.97)` + 200ms spring-gentle |
| 卡片 hover | `translateY(-2px)` + shadow-sm appear + 200ms ease-default |
| 页面过渡 | 新页面从右 fade+slide(20px) 进入，250ms ease-enter |
| 列表项入场 | 每个 item 延迟 30ms，从下方 8px fade-in，逐步显现 |
| 视频缩略图加载 | opacity 0 → 1，300ms ease-default |
| 签到/完成确认 | checkmark icon scale 0.6→1.0 spring-snap，绿色闪一下 |
| Pull-to-refresh | 跟随手指拖动（spring physics），释放后低于阈值回弹、超过阈值脱离 |

**关键规则：**
- 所有数字变化（计时器、计数、进度%）使用数字滚动过渡，不跳变
- `prefers-reduced-motion` 时所有动画替换为 0ms opacity crossfade
- 不叠加多个同时动画 — 一次一件事

---

*Bootstrapped from Apple design language. 运动内容的能量由内容本身（摄影、视频、数据）承载，UI 保持克制。*
