# SportMatch 产品变更日志 (2026-05-26)

本文档记录 2026-05-26 的所有功能变更，按模块分组。

---

## A. PostHog 数据埋点

### 安装与配置

- `npm install posthog-js`
- 新建 `components/PostHogProvider.tsx` — 客户端 SDK 初始化 + 自动 SPA pageview 追踪
- `app/layout.tsx` — `<Suspense>` 内引入 Provider，`<body>` 包裹所有 children
- `.env` 环境变量：
  ```
  NEXT_PUBLIC_POSTHOG_KEY="phc_sUXYUxTZxnnByUxLyqymUpjTXFpQigTD3WhXz3JYrSvE"
  NEXT_PUBLIC_POSTHOG_HOST="https://us.posthog.com"
  ```

### 7 个自定义业务事件

| 事件名 | 触发位置 | 回答什么问题 |
|--------|---------|-------------|
| `user_signed_up` | 注册成功后 (`auth/register`) | 多少人真的注册了 |
| `profile_completed` | 画像 Wizard 完成 (`ProfileWizard`) | 注册后多少人走完画像 |
| `video_imported` | 导入视频成功 (`AddVideoModal`) | 用户平均导入几个视频 |
| `workout_started` | 点"开始跟练" (`TodayPlanCard` × 2 / `SoloWorkout`) | 方案被打开的频率 |
| `workout_completed` | 总结页显示 (`PlanWorkout`) | 多少训练被完整做完 |
| `feedback_given` | 提交反馈成功 (`PlanWorkout`) | 训练后多少人给反馈 |
| `plan_saved` | 点"加入我的" (`TodayPlanCard`) | 每日方案被保存的比例 |

PostHog 还会自动捕获：页面浏览、按钮点击、来源渠道、设备/浏览器/地区。

### 漏斗

`注册 → 画像完成 → 导入视频 → 开始跟练 → 完成训练 → 给反馈`

---

## B. 移动端适配

### B1. 底部导航栏固定

**问题**：移动端只有滚到页面最底部才能看到"首页/发现/计划/我的"四个标签。

**解决**：[MobileTabBar](components/MobileTabBar.tsx) 使用 `fixed bottom-0 left-0 right-0 z-50` 固定在视口底部。`<main>` 添加 `pb-[calc(49px+env(safe-area-inset-bottom,0px))]` 为固定底栏预留空间。桌面端 `lg:hidden` 隐藏底栏，改用 NavBar 顶部导航。

### B2. 移动端注册修复

**问题**：手机通过 ngrok 访问时，注册表单填写后点击按钮内容清空无反应。

**根因**：
1. `ngrok-skip-browser-warning` header 未发送 → ngrok interstitial 页拦截
2. 移动 Safari 的 `type="submit"` 触发原生表单提交，绕过 React 的 `e.preventDefault()`

**解决**：
- `next.config.ts` → `allowedDevOrigins` 加入 ngrok 域名
- 注册/登录按钮改为 `type="button"` + `onClick`（不再依赖 form submit）
- fetch 请求头加 `"ngrok-skip-browser-warning": "1"`
- 添加 try-catch-finally 错误处理，中文提示具体原因

### B3. TodayPlanCard 移动端响应式 ([TodayPlanCard.tsx](components/TodayPlanCard.tsx))

**紧凑卡片视图**：
- 标题区从左右并排改为上下堆叠（`flex-col md:flex-row`）
- 按钮改为横排并放
- 视频列表行：小屏隐藏作者/时长（`hidden sm:inline`）和播放渠道标签（`max-sm:hidden`），只保留编号 + 阶段标签 + 标题
- 内边距调整为 `p-5 md:p-8`

**详情视图**：
- 同步响应式适配：标题字号、间距、列表行

### B4. PlanWorkout 滚动修复 ([PlanWorkout.tsx](components/PlanWorkout.tsx))

移动端训练页和总结页容器添加 `overflow-y-auto`，解决内容超出无法滚动的问题。

---

## C. UI 组件

### C1. TagBadge 选中态优化 ([TagBadge.tsx](components/TagBadge.tsx))

**问题**：画像 Wizard 中标签选择状态让用户困惑。

**设计**：
- **选中**：实心填充 + 白色文字 + 透明边框（`${c.selBg} text-white border-transparent`）
- **未选中**：灰色底板 + 彩色边框 + 彩色文字（`bg-[var(--color-surface-secondary)] ${c.text} ${c.border}`）

6 种颜色：default / green / blue / orange / red / purple，每色一套 {border, text, selBg}。

---

## D. 推荐算法 v2 — "可完成性优先"

### 核心理念

推荐不再是"找最相关视频"，而是"找今天最可能完成的视频"。

**权重优先级：时长匹配 > 目标匹配，身体限制 > 热门程度，可站内播放 > 外跳，历史完成率 > 标签相似度。**

---

## §1 评分权重体系

### Tier 1 — 安全性（硬惩罚，最高幅度）

| 规则 | 权重 | 说明 |
|------|------|------|
| 禁忌动作匹配 | `-30` | 视频标签含用户身体禁忌（膝部禁忌/腰部禁忌等） |
| 身体信号惩罚 | `-25` | 用户既往反馈过 kine_pain / back_pain，碰到同类禁忌视频 |
| 康复适配奖励 | `+12` | 用户有身体限制，视频标注"康复期"/"产后恢复" |

### Tier 2 — 可完成性（时长是王道）

| 规则 | 权重 | 说明 |
|------|------|------|
| 时长精确匹配 | `+20` | 视频时长区间在用户可用时间内 |
| 时长邻近匹配 | `+10` | 视频时长略短于用户可用时间（可轻松完成） |
| 时长过长惩罚 | `-10` | 视频时长超过用户可用时间上限 |
| 历史完成标签 | `+8 × freq` | 标签匹配用户历史上 **完整完成** 的视频标签，freq 上限 3 |
| 历史放弃标签 | `-6 × freq` | 标签匹配用户历史上 **放弃** 的视频标签 |

### Tier 3 — 目标对齐

| 规则 | 权重 | 说明 |
|------|------|------|
| 目标匹配 | `+8` | goal 类别标签命中用户目标（↓ 原 +10） |
| 肌群匹配 | `+3` | muscle 类别标签（↓ 原 +5） |

### Tier 4 — 可及性

| 规则 | 权重 | 说明 |
|------|------|------|
| B站可嵌入 | `+10` | workout_plan 场景下优先站内播放（↑ 原 +8） |
| 外跳惩罚 | `-6` | 需跳转第三方平台的视频（↑ 原 -4） |
| 器材匹配 | `+5` | equipment 标签命中用户可用器材（↓ 原 +6） |

### Tier 5 — 经验适配

| 规则 | 权重 | 说明 |
|------|------|------|
| 经验水平匹配 | `+5` | audience 标签匹配 fitnessLevel（↓ 原 +8） |
| 强度匹配 | 分档 | 保持不变：新手避免高强度、老手匹配专业级 |

### Tier 6 — 内容亲和（最低权重）

| 规则 | 权重 | 说明 |
|------|------|------|
| 收藏意图相似 (goal/muscle/type) | `+3` | ↓ 原 +7 |
| 收藏其他标签相似 | `+2` | ↓ 原 +4 |
| 流行度 boost | `+1 × checkins` | 打卡次数，上限 5 分 |

---

## §2 新增：用户历史完成画像

在 `getCompletionProfile(userId)` 中：

- 读取所有 `UserFeedback` 记录
- 按 `completionRate` 分类：
  - `"fully"` → 收集标签 → `completedTagCounts`
  - `"abandoned"` → 收集标签 → `abandonedTagCounts`
- 后续评分时：
  - 候选视频标签命中 `completedTagCounts` → 加分
  - 候选视频标签命中 `abandonedTagCounts` → 扣分
  - 之前完整完成的视频 → 轻度推荐 boost (+3)
  - 之前放弃的视频 → 避免推荐 (-15)

---

## §3 今日方案生成改进

### `trimToBudget()` — 时间约束裁剪

- 永远保留至少 1 热身 + 1 拉伸（安全不可妥协）
- 主训练按分数从高到低填充，超出时间预算的裁剪
- 至少保留 1 段主训练（即使单段已经超预算）

### `scoreVideo()` — 同步新权重

`lib/today-plan.ts` 中的收藏视频排序也同步了新权重：
- 时长适配 +20/+10/-8
- 禁忌惩罚 -30
- 康复适配 +12
- 目标 +8、肌群 +3、器材 +5、经验 +5

### 主训练排序：分数优先 → 时长次优

```ts
// 分数相同时，选时长更短的（更可能完成）
const sortedMains = [...mains].sort((a, b) => {
  const diff = scoreVideo(b, profile) - scoreVideo(a, profile);
  if (diff !== 0) return diff;
  return (a.duration || 9999) - (b.duration || 9999);
});
```

---

## E. 今日方案持久化 — "每日 30 首"模式

### 问题

`app/page.tsx` 每次请求实时调用 `generateTodayPlan()`，用户新增收藏视频 → 刷新 → 方案就变。

### 设计

像 QQ 音乐"每日 30 首"：当天打开多少次都是同一个方案，除非主动换。

### 数据模型 (prisma/schema.prisma)

`DailyRecommendation` 扩展：
- `date` 改为 `String`（YYYY-MM-DD），加 `@@unique([userId, date])` 每人每天一条
- 新增 `planData`（完整方案 JSON）、`profileHash`（画像 SHA256 指纹）、`refreshCount`（当日已换次数，上限 3）

### 数据流

| 场景 | 行为 |
|------|------|
| 首次打开 | 生成 → 写入 DB → 渲染 |
| 再次打开 + 画像未变 | 直接读 DB 缓存的 planData，跳过生成 |
| 画像变更 | 自动重新生成（不计入 3 次），更新 DB |
| 点"换一个" | 重新生成 → 更新 DB（refreshCount + 1） |
| 换够 3 次 | 返回 429，按钮变灰 |
| 第二天 | 新日期 → 全新生成 |

### "换一个"分层排除策略

**问题**：素材少时（如只导入了 2 个视频），`pick()` 随机洗牌仍可能抽到同一批视频，用户点"换一个"感觉没变化。

**策略**：按 refreshCount 分层排除，优先换库补而非收藏。

| 次数 | 排除范围 | 效果 |
|------|---------|------|
| 第 1 次换 | 只排除库补视频 ID | 收藏的视频不动，热身/拉伸/额外主训练从库中换 |
| 第 2 次换 | 只排除库补视频 ID | 同上，用户收藏保持稳定 |
| 第 3 次换 | 排除全部当前方案视频 ID | 连收藏的主训练也一起换，给全新方案 |

**实现**：
- `pick()` 接受可选 `excludeIds?: string[]`，将排除项推到候选池末尾
- `generateTodayPlan()` 接受 `options.currentVideoIds` + `options.refreshCount`，按策略计算实际排除列表
- 收藏视频 vs 库视频通过 `userId` 字段区分

> 首次生成（`app/page.tsx`）不传 options，无排除，正常生成。

---

## §4 完整改动文件清单

| 文件 | 改动 |
|------|------|
| `components/PostHogProvider.tsx` | **新建** — PostHog SDK 初始化 + 自动 pageview |
| `components/MobileTabBar.tsx` | **(已存在)** — `fixed bottom-0` 移动端底部固定导航 |
| `app/layout.tsx` | 引入 PostHogProvider + Suspense + MobileTabBar + `pb-*` 底栏预留 |
| `.env` | PostHog key + host 环境变量 |
| `next.config.ts` | `allowedDevOrigins` 加入 ngrok 域名 |
| `app/auth/register/page.tsx` | `type="button"` + PostHog `user_signed_up` + ngrok header + 错误处理 |
| `app/auth/login/page.tsx` | `type="button"` + 错误处理 |
| `components/ProfileWizard.tsx` | PostHog `profile_completed` |
| `components/AddVideoModal.tsx` | PostHog `video_imported` |
| `components/SoloWorkout.tsx` | PostHog `workout_started` |
| `components/PlanWorkout.tsx` | PostHog `workout_completed` + `feedback_given` + `overflow-y-auto` 滚动修复 |
| `components/TodayPlanCard.tsx` | PostHog `workout_started`(×2) + `plan_saved` + 移动端响应式 + "换一个"按钮 |
| `components/TagBadge.tsx` | 选中态实心填充 / 未选中灰底彩边 |
| `lib/recommendation.ts` | 重新设计评分权重（6级 Tier）+ `getCompletionProfile()` + `scoreDuration()` |
| `lib/today-plan.ts` | `trimToBudget()` + `scoreVideo()` 同步权重 + 主训练时长次优排序 + `pick()` 随机化 + 分层排除 |
| `prisma/schema.prisma` | `DailyRecommendation` 扩展字段 + `@@unique([userId, date])` |
| `app/api/daily-plan/refresh/route.ts` | **新建** — 方案手动刷新 API（3 次/天限制 + 画像指纹 + 分层排除） |
| `app/api/recommend/today/route.ts` | 适配 `date` String 类型变更 |
| `app/page.tsx` | `availableTime` 传入 + DailyRecommendation 持久化 + 画像变更检测 |
| `docs/recommendation-v2.md` | **本文件** |

---

## §5 验收标准

1. 选择"15-30分钟"的用户，生成方案总时长应接近 30 分钟（不再出现 83 分钟）
2. 有膝盖不适的用户，含膝部禁忌的视频排序大幅下降
3. 历史顺利完成过"减脂·HIIT"的用户，同类视频排序靠前
4. 历史放弃过"高强度·胸肌"的用户，同类视频排序靠后
5. workout_plan 场景下 B站视频优先于外跳平台
6. 新增收藏视频后刷新 → 当天方案不变（已固化）
7. 修改画像后刷新 → 方案自动更新，refreshCount 不变
8. 连点 3 次"换一个"→ 第 4 次被拒绝
