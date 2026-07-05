const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  LevelFormat
} = require("docx");

// ── Helpers ──

const FONT = "PingFang SC";
const MONO = "Cascadia Code";
const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: "D2D2D7" };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

function heading(level, text) {
  return new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, font: FONT })] });
}

function para(text, opts = {}) {
  const children = parseInline(text, opts.boldAll);
  return new Paragraph({
    spacing: { after: opts.after ?? 120 },
    alignment: opts.center ? AlignmentType.CENTER : undefined,
    children,
  });
}

function emptyPara() {
  return new Paragraph({ spacing: { after: 0 }, children: [] });
}

// Parse markdown inline: **bold**, `code`, plain text
function parseInline(text, boldAll) {
  if (boldAll) return [new TextRun({ text, font: FONT, bold: true })];

  const runs = [];
  // Split by **pairs** for bold
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), font: FONT, bold: true }));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: MONO, size: 20 }));
    } else if (part) {
      runs.push(new TextRun({ text: part, font: FONT }));
    }
  }
  if (runs.length === 0) runs.push(new TextRun({ text, font: FONT }));
  return runs;
}

// Bullet list item
function bullet(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
    children: parseInline(text),
  });
}

// Numbered list item
function numItem(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
    children: parseInline(text),
  });
}

// Table from array of arrays (first row = header)
function makeTable(rows) {
  const colW = Math.floor(9360 / rows[0].length);
  const columnWidths = rows[0].map(() => colW);

  return new Table({
    columnWidths,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: rows.map((row, ri) =>
      new TableRow({
        tableHeader: ri === 0,
        children: row.map((cell) =>
          new TableCell({
            borders: cellBorders,
            width: { size: colW, type: WidthType.DXA },
            shading: ri === 0 ? { fill: "F5F5F7", type: ShadingType.CLEAR } : undefined,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              spacing: { after: 0 },
              children: [new TextRun({ text: cell, font: FONT, bold: ri === 0, size: ri === 0 ? 20 : 20 })],
            })],
          })
        ),
      })
    ),
  });
}

const numbering = {
  config: [],
};
let bulletRefCounter = 0;
let numRefCounter = 0;

function nextBulletRef() { return `bl-${bulletRefCounter++}`; }
function nextNumRef() { return `nl-${numRefCounter++}`; }

// Add bullet configs used
const bulletConfigs = new Set();
function ensureBulletConfig(ref) {
  if (bulletConfigs.has(ref)) return;
  bulletConfigs.add(ref);
  numbering.config.push({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  });
}

const numConfigs = new Set();
function ensureNumConfig(ref) {
  if (numConfigs.has(ref)) return;
  numConfigs.add(ref);
  numbering.config.push({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  });
}

function hRule() {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "D2D2D7", space: 1 } },
  });
}

// ═══════════════════════════════════════
// DOCUMENT 1: 产品规划过程
// ═══════════════════════════════════════

function buildDoc1() {
  const children = [];

  children.push(heading(HeadingLevel.HEADING_1, "SportMatch 产品规划过程记录"));
  children.push(para("日期: 2026-05-22", { boldAll: true, after: 80 }));
  children.push(hRule());
  children.push(heading(HeadingLevel.HEADING_2, "心流轨迹与决策记录"));

  // ── 起点 ──
  children.push(heading(HeadingLevel.HEADING_3, "起点：审视现状，规划方向"));
  children.push(para("用户思考：网站核心功能已建成——认证、画像、视频库、反馈、推荐引擎、训练计划社区都有了。但感觉还不够深入，接下来该做什么？", { boldAll: true }));
  children.push(para("分析输出：审查了全部 11 个页面和核心组件后，提出 5 个优先级建议：", { boldAll: true }));
  const refN0 = nextNumRef(); ensureNumConfig(refN0);
  children.push(numItem("深色模式 —— DESIGN.md 明确规定了翻转变量的规则，运动场景夜间使用频繁", refN0));
  children.push(numItem("计划详情页互动按钮 —— 点赞/收藏的 API 和数据库字段都已就绪，但页面缺少可操作的按钮", refN0));
  children.push(numItem("移动端适配 —— DESIGN.md 定义了完整的响应式断点和 49px Tab Bar 规范", refN0));
  children.push(numItem("Python AI 评论分析管道跑通 —— 产品核心差异化能力，脚本已写完但未用真实数据验证", refN0));
  children.push(numItem("计划\"跟练\"模式 —— 从\"看到\"到\"做到\"的闭环", refN0));

  children.push(para("用户决策：先做 1（深色模式），改动小、效果明显，顺手彻底验证 CSS 变量体系。", { boldAll: true }));
  children.push(hRule());

  // ── 阶段 1 ──
  children.push(heading(HeadingLevel.HEADING_3, "阶段 1：深色模式"));
  children.push(para("用户思考：运动场景用户大概率夜间使用，深色模式体验断崖最明显。", { boldAll: true }));
  children.push(para("实施方案：", { boldAll: true }));
  const refB1 = nextBulletRef(); ensureBulletConfig(refB1);
  children.push(bullet("方案选择：手动切换 + 系统偏好回退，localStorage 持久化，用 data-theme 属性控制而非纯 CSS media query", refB1));
  children.push(bullet("组件拆解：ThemeProvider（Context 状态管理）+ ThemeToggle（日/月双图标）+ 布局层注入阻塞脚本消除首帧闪烁", refB1));
  children.push(bullet("变量收敛：21 个 CSS 变量在 [data-theme=\"dark\"] 下重新赋值，所有组件零改动——因为全部使用 var(--color-*) 引用", refB1));
  children.push(para("关键决策：不在组件中写 dark mode 特殊样式，完全依赖 CSS 变量层。这是 DESIGN.md 设计系统的核心价值——变量体系建立后，主题切换是 O(1) 的变量重赋值。", { boldAll: true }));
  children.push(hRule());

  // ── 阶段 2 ──
  children.push(heading(HeadingLevel.HEADING_3, "阶段 2：计划跟练模式"));
  children.push(para("用户思考：现在计划只是一个视频清单。要做成\"开始跟练 → 自动播放 → 每个完成打卡 → 全部结束总结\"的完整闭环。", { boldAll: true }));
  children.push(para("实施方案：", { boldAll: true }));
  const refB2 = nextBulletRef(); ensureBulletConfig(refB2);
  children.push(bullet("全屏沉浸式跟练界面 PlanWorkout，包含：进度条 + 计时器、嵌入视频播放（B站 iframe）、视频列表（已完成/当前/待完成三种状态）", refB2));
  children.push(bullet("\"完成并继续\"按钮 → 调打卡 API → 自动步进到下一个视频", refB2));
  children.push(bullet("全部完成后弹出总结页：完成视频数、总时长、实际用时、逐项清单", refB2));
  children.push(bullet("非 B站视频（小红书/抖音）显示缩略图 + 外链引导", refB2));
  children.push(para("关键决策：不做成页内小组件，而是全屏覆盖层。跟练是专注场景，需要排除导航干扰。", { boldAll: true }));
  children.push(hRule());

  // ── 阶段 3 ──
  children.push(heading(HeadingLevel.HEADING_3, "阶段 3：互动按钮改进"));
  children.push(para("用户思考：计划详情页的互动按钮不够好——有 emoji（违反 DESIGN.md §10 反模式）、没有选中态反馈、跟练按钮只是计数没有实际功能。", { boldAll: true }));
  children.push(para("实施方案：", { boldAll: true }));
  const refB3 = nextBulletRef(); ensureBulletConfig(refB3);
  children.push(bullet("将 emoji 替换为 SVG 图标（心形/星形/播放三角）", refB3));
  children.push(bullet("点赞按钮：已赞状态下填充 + brand 蓝高亮", refB3));
  children.push(bullet("收藏按钮：已收藏状态下填充 + 橙色调高亮", refB3));
  children.push(bullet("新增 GET 端点返回用户互动状态，页面加载时同步", refB3));
  children.push(bullet("\"跟练\"按钮重新定位为主 CTA——brand 蓝填充 + 播放图标，点击启动跟练模式", refB3));
  children.push(para("关键决策：DESIGN.md §10 规定\"emoji 不出现在产品文案中\"——这是规范落地的具体体现。互动按钮同时解决审美合规 + 交互反馈两个问题。", { boldAll: true }));
  children.push(hRule());

  // ── 阶段 4 ──
  children.push(heading(HeadingLevel.HEADING_3, "阶段 4：移动端适配"));
  children.push(para("用户思考：用户大概率在手机上刷运动视频。目前桌面端 OK，但移动端缺少底部导航，布局也未针对小屏优化。", { boldAll: true }));
  children.push(para("实施方案：", { boldAll: true }));
  const refB4 = nextBulletRef(); ensureBulletConfig(refB4);
  children.push(bullet("新建 MobileTabBar：49px 高度 + safe-area-inset-bottom 安全区，5 个标签（首页/发现/计划/推荐/我的），SVG 图标填充态区分选中", refB4));
  children.push(bullet("NavBar 响应式：桌面端保留完整导航链接，移动端（<768px）隐藏，仅保留 Logo 和主题切换", refB4));
  children.push(bullet("<main> 增加底部 padding 防止内容被 Tab Bar 遮挡", refB4));
  children.push(bullet("viewport 导出配置 themeColor 用于浏览器顶栏着色", refB4));
  children.push(bullet("已有页面响应式网格审查通过（grid-cols-1 md:grid-cols-2 lg:grid-cols-3 模式一致）", refB4));
  children.push(para("关键决策：Tab Bar 仅在 <1024px 显示，而非 <768px——考虑到平板横屏场景，1024px 是更合理的桌面/移动分界线。DESIGN.md §7 定义了 1024px 为 Wide 断点起点。", { boldAll: true }));
  children.push(hRule());

  // ── 技术决策总览 ──
  children.push(heading(HeadingLevel.HEADING_2, "今日技术决策总览"));
  children.push(emptyPara());
  children.push(makeTable([
    ["决策", "选择", "原因"],
    ["主题切换方式", "data-theme 属性 + localStorage", "手动覆盖系统偏好，persist 跨会话"],
    ["反闪烁策略", "<head> 阻塞脚本 + suppressHydrationWarning", "在首帧绘制前完成变量赋值"],
    ["跟练模式形态", "全屏覆盖层", "专注场景不应有导航干扰"],
    ["互动按钮图标", "SVG 内联", "符合 DESIGN.md §10 反模式禁 emoji"],
    ["移动端导航", "底部 Tab Bar（49px + 安全区）", "符合 DESIGN.md §8 Tab Bar 规范"],
    ["断点策略", "1024px 为桌面/移动分界", "覆盖平板横屏场景"],
  ]));

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 40, bold: true, color: "000000", font: FONT },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, color: "000000", font: FONT },
          paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, color: "1D1D1F", font: FONT },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
      ],
    },
    numbering,
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  return doc;
}

// ═══════════════════════════════════════
// DOCUMENT 2: 产品介绍
// ═══════════════════════════════════════

function buildDoc2() {
  // Reset counters for fresh numbering config
  bulletRefCounter = 0;
  numRefCounter = 0;
  bulletConfigs.clear();
  numConfigs.clear();
  numbering.config = [];

  const children = [];

  children.push(heading(HeadingLevel.HEADING_1, "SportMatch 产品介绍"));
  children.push(heading(HeadingLevel.HEADING_2, "一句话定位"));
  children.push(para("跨平台运动内容策展引擎 — 把散落在 B站/小红书/抖音的收藏，变成可执行、可追踪、越用越懂你的训练计划。", { boldAll: true }));
  children.push(hRule());

  // ── 解决什么问题 ──
  children.push(heading(HeadingLevel.HEADING_2, "解决什么问题"));
  children.push(heading(HeadingLevel.HEADING_3, "用户画像"));
  children.push(para("在社交媒体上频繁刷到运动教程短视频的人。Ta 们："));
  const refB10 = nextBulletRef(); ensureBulletConfig(refB10);
  children.push(bullet("看到运动视频会点收藏，但收藏夹从此变成信息坟场", refB10));
  children.push(bullet("不确定哪个教程真的适合自己——膝盖有旧伤能不能做？大基数能不能跟？", refB10));
  children.push(bullet("缺乏工具把分散在不同平台的视频组织成有结构的训练计划", refB10));
  children.push(bullet("没有记录和追踪，练了等于没练", refB10));
  children.push(para("核心痛点：收藏即终点。信息过载导致行动瘫痪。", { boldAll: true }));

  children.push(heading(HeadingLevel.HEADING_3, "SportMatch 怎么做"));
  children.push(emptyPara());
  children.push(makeTable([
    ["痛点", "解决方案"],
    ["收藏夹吃灰", "将收藏行为转化为\"加入训练计划\"——有序列表 + 跟练模式"],
    ["不确定适不适合自己", "运动画像匹配引擎：根据目标/水平/身体状况/禁忌动作过滤"],
    ["无法判断视频质量", "AI 分析评论区真实反馈，自动提取训练标签"],
    ["多平台视频无法统一管理", "支持 B站/小红书/抖音三平台视频统一编入计划"],
    ["练了等于没练", "打卡系统 + 个人数据看板 + 反馈闭环持续优化推荐"],
  ]));
  children.push(hRule());

  // ── 核心功能 ──
  children.push(heading(HeadingLevel.HEADING_2, "核心功能"));
  const features = [
    ["运动画像", "注册后引导完成画像设置：运动目标（减脂/增肌/康复/体能/柔韧）、当前水平、身体状况（含禁忌动作）、可用器材、单次训练时长。这是推荐引擎的输入。"],
    ["AI 评论分析打标签", "自动抓取视频评论区内容，通过 DeepSeek 大模型分析提取结构化标签。例如从\"我是大基数，跟这个有点吃力但没伤膝盖\"中提取——适用人群：大基数、膝部：安全。标签含置信度 + 证据原文 + 来源。这是产品最核心的差异化能力。"],
    ["个性化推荐", "基于画像标签与 AI 标签的规则匹配引擎，考虑标签置信度、用户反馈历史、难度适配、禁忌排除。推荐结果附带匹配理由（如\"匹配你的目标：减脂\"\"适合零基础人群\"），可解释性强。"],
    ["跟练反馈闭环", "每次训练后一键反馈：难度感知、身体感受、完成度、是否推荐。反馈数据实时修正推荐权重——越用越懂你。"],
    ["训练计划社区", "用户可以创建训练计划（选择视频 + 编排顺序 + 标注阶段 + 添加适用人群标签），公开发布到社区。他人可点赞/收藏/跟练计划。"],
    ["跟练追踪模式", "点击\"开始跟练\"进入专注模式：计时器、进度条、按顺序打卡、全部完成后总结。SportMatch 是训练搭子，不是播放器。"],
    ["个人数据看板", "7 天活动柱状图、周目标打卡环形进度、运动类型分布、最近跟练时间线。将训练行为可视化。"],
    ["深色模式", "手动切换或跟随系统，CSS 变量体系确保一致体验。"],
  ];
  for (let i = 0; i < features.length; i++) {
    children.push(heading(HeadingLevel.HEADING_3, `${i + 1}. ${features[i][0]}`));
    children.push(para(features[i][1]));
  }
  children.push(hRule());

  // ── 技术架构 ──
  children.push(heading(HeadingLevel.HEADING_2, "技术架构"));
  children.push(emptyPara());
  children.push(makeTable([
    ["层", "技术"],
    ["前端框架", "Next.js 16 (App Router)"],
    ["样式", "Tailwind CSS + Apple Design System CSS 变量"],
    ["数据库", "SQLite (Prisma ORM)"],
    ["认证", "NextAuth.js v5"],
    ["AI 管道", "Python (Anthropic SDK)"],
    ["设计系统", "Apple Human Interface Guidelines 映射的运动场景"],
  ]));
  children.push(hRule());

  // ── 明天优化优先级 ──
  children.push(heading(HeadingLevel.HEADING_2, "明天优化优先级"));

  children.push(heading(HeadingLevel.HEADING_3, "P0 — 立即开工"));
  children.push(para("1. Python AI 评论分析管道跑通", { boldAll: true }));
  const refB20 = nextBulletRef(); ensureBulletConfig(refB20);
  children.push(bullet("当前状态：scripts/ 下有完整代码框架（fetch → clean → tag → pipeline），但未用真实数据验证", refB20));
  children.push(bullet("为什么是 P0：这是产品最核心的差异化能力。没有 AI 标签，推荐引擎的匹配精度大打折扣。Seed 数据的标签是手工标注的，无法规模化", refB20));
  children.push(bullet("具体任务：用 B站 API 拉一条热门视频的评论区 → 跑通完整管道 → 将标签写入数据库 → 验证推荐结果变化", refB20));
  children.push(bullet("预计：2-3 小时", refB20));

  children.push(para("2. 视频搜索增强", { boldAll: true }));
  const refB21 = nextBulletRef(); ensureBulletConfig(refB21);
  children.push(bullet("当前状态：搜索仅匹配标题和作者名，不支持标签搜索", refB21));
  children.push(bullet("为什么是 P0：视频库超过 50 个后，仅靠筛选已经不够。用户需要直接搜\"膝盖友好的 HIIT\"", refB21));
  children.push(bullet("具体任务：搜索框增加标签名匹配、支持多关键词、搜索结果高亮匹配词", refB21));
  children.push(bullet("预计：1-2 小时", refB21));

  children.push(heading(HeadingLevel.HEADING_3, "P1 — 当天完成"));
  children.push(para("3. 计划\"关注\"功能", { boldAll: true }));
  const refB22 = nextBulletRef(); ensureBulletConfig(refB22);
  children.push(bullet("当前状态：计划可以被点赞/收藏/跟练，但没有\"关注\"——即用户无法持续跟踪一个计划的更新", refB22));
  children.push(bullet("具体任务：关注按钮 + 关注列表 + \"我关注的计划\"筛选", refB22));
  children.push(bullet("预计：1 小时", refB22));

  children.push(para("4. 首页未登录用户引导优化", { boldAll: true }));
  const refB23 = nextBulletRef(); ensureBulletConfig(refB23);
  children.push(bullet("当前状态：Hero + 三列价值主张 + 热门计划。但缺乏产品演示和具体数据说服力", refB23));
  children.push(bullet("具体任务：加入视频数/计划数/用户数的实时计数、增加一个 3 步使用流程说明、优化 CTA 按钮文案", refB23));
  children.push(bullet("预计：1 小时", refB23));

  children.push(heading(HeadingLevel.HEADING_3, "P2 — 有时间则做"));
  children.push(para("5. 通知系统基础版", { boldAll: true }));
  const refB24 = nextBulletRef(); ensureBulletConfig(refB24);
  children.push(bullet("有人点赞/收藏了你的计划 → 站内通知", refB24));
  children.push(bullet("推荐引擎生成了新的每日推荐 → 提醒查看", refB24));

  children.push(para("6. 性能优化", { boldAll: true }));
  const refB25 = nextBulletRef(); ensureBulletConfig(refB25);
  children.push(bullet("视频列表图片懒加载", refB25));
  children.push(bullet("首页数据缓存策略", refB25));

  children.push(para("7. SEO 基础", { boldAll: true }));
  const refB26 = nextBulletRef(); ensureBulletConfig(refB26);
  children.push(bullet("各页面 meta description/title", refB26));
  children.push(bullet("Open Graph 标签", refB26));
  children.push(bullet("结构化数据", refB26));
  children.push(hRule());

  // ── 页面清单 ──
  children.push(heading(HeadingLevel.HEADING_2, "当前页面清单"));
  children.push(emptyPara());
  children.push(makeTable([
    ["路由", "页面", "状态"],
    ["/", "首页（Hero + 推荐流 + 热门计划）", "✅ 完成"],
    ["/videos", "视频发现（筛选 + 搜索 + 网格）", "✅ 完成"],
    ["/videos/[id]", "视频详情（嵌入播放 + 标签 + 反馈 + 打卡 + 加入计划）", "✅ 完成"],
    ["/plans", "计划广场（排序 + 卡片流）", "✅ 完成"],
    ["/plans/create", "创建计划（搜索视频 + 编排 + 目标人群标签）", "✅ 完成"],
    ["/plans/[id]", "计划详情（互动按钮 + 跟练模式启动）", "✅ 完成"],
    ["/recommend", "每日推荐（个性化 + 理由展示）", "✅ 完成"],
    ["/profile", "个人中心（数据看板 + 运动统计）", "✅ 完成"],
    ["/profile/setup", "画像设置向导", "✅ 完成"],
    ["/auth/login", "登录", "✅ 完成"],
    ["/auth/register", "注册", "✅ 完成"],
  ]));

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 40, bold: true, color: "000000", font: FONT },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, color: "000000", font: FONT },
          paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, color: "1D1D1F", font: FONT },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
      ],
    },
    numbering,
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  return doc;
}

// ═══════════════════════════════════════
// Generate both documents
// ═══════════════════════════════════════

async function main() {
  const outDir = "C:\\Users\\Lenovo\\Desktop";

  const doc1 = buildDoc1();
  const buf1 = await Packer.toBuffer(doc1);
  fs.writeFileSync(`${outDir}\\产品规划过程-2026-05-22.docx`, buf1);
  console.log("Created: 产品规划过程-2026-05-22.docx");

  const doc2 = buildDoc2();
  const buf2 = await Packer.toBuffer(doc2);
  fs.writeFileSync(`${outDir}\\产品介绍.docx`, buf2);
  console.log("Created: 产品介绍.docx");
}

main().catch(console.error);
