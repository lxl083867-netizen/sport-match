/**
 * AI tagging: call DeepSeek API to analyze video + comments → structured tags.
 *
 * Runs asynchronously after video import. Falls back to title-only analysis
 * when comments aren't available yet.
 */

const ALL_VALID_TAGS: Record<string, string[]> = {
  goal: ["减脂", "增肌", "康复", "体能提升", "柔韧性"],
  muscle: ["核心", "臀腿", "肩背", "全身", "上肢", "下肢"],
  type: ["热身", "HIIT", "瑜伽", "普拉提", "力量训练", "拉伸", "有氧", "放松"],
  phase: ["热身激活", "主体训练", "冷身拉伸"],
  intensity: ["低强度", "中强度", "高强度"],
  contraindication: ["含跳跃", "含深蹲", "需仰卧", "需跪姿", "膝部禁忌", "腰部禁忌"],
  equipment: ["无器材", "弹力带", "哑铃", "瑜伽垫"],
  audience: ["零基础", "有经验", "大基数", "产后恢复", "康复期", "办公室久坐"],
  duration: ["15分钟以内", "15-30分钟", "30分钟以上"],
};

const SYSTEM_PROMPT = `你是一个运动视频内容分析专家。根据视频信息为运动教程视频打标签。

## 标签体系（只从中选择，不创造新标签）

运动目标 (goal)：减脂、增肌、康复、体能提升、柔韧性
目标肌群 (muscle)：核心、臀腿、肩背、全身、上肢、下肢
运动类型 (type)：热身、HIIT、瑜伽、普拉提、力量训练、拉伸、有氧、放松
训练阶段 (phase)：热身激活、主体训练、冷身拉伸
强度 (intensity)：低强度、中强度、高强度
禁忌动作 (contraindication)：含跳跃、含深蹲、需仰卧、需跪姿、膝部禁忌、腰部禁忌
器材需求 (equipment)：无器材、弹力带、哑铃、瑜伽垫
适合人群 (audience)：零基础、有经验、大基数、产后恢复、康复期、办公室久坐
时长 (duration)：15分钟以内、15-30分钟、30分钟以上

## 规则
1. 结合标题做综合判断，每条标签附带 confidence (0.0-1.0) 和 evidence
2. 时长标签根据视频实际时长推导
3. 强度判断：标题含"新手/零基础/入门/温和"→低强度；"暴汗/燃脂/HIIT/高强度"→高强度
4. 不要编造标签

## 输出格式
返回纯 JSON（不要 markdown 代码块）：
{"tags":[{"category":"type","value":"HIIT","confidence":0.9,"evidence":"标题含HIIT"}],"summary":"一句话总结"}`;

interface TagResult {
  category: string;
  value: string;
  confidence: number;
  evidence: string;
}

interface TaggingOutput {
  tags: TagResult[];
  summary: string;
}

export async function tagVideo(video: {
  id: string;
  title: string;
  platform: string;
  duration: number | null;
  sourceAuthor: string;
  comments?: string[];
}): Promise<TaggingOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[ai-tagging] DEEPSEEK_API_KEY not set, skipping tagging");
    return null;
  }

  const parts = [`标题：${video.title}`];
  if (video.duration) parts.push(`时长：${Math.floor(video.duration / 60)} 分钟`);
  if (video.platform) parts.push(`平台：${video.platform}`);
  if (video.sourceAuthor && video.sourceAuthor !== "未知") parts.push(`作者：${video.sourceAuthor}`);
  if (video.comments && video.comments.length > 0) {
    const sample = video.comments.slice(0, 50);
    parts.push(`\n用户评论（${video.comments.length} 条，选取 ${sample.length} 条）：`);
    sample.forEach((c, i) => parts.push(`${i + 1}. ${c.slice(0, 200)}`));
  }

  const userPrompt = parts.join("\n");

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[ai-tagging] API error ${res.status}`);
      return null;
    }

    const json = await res.json() as {
      choices: { message: { content: string } }[];
    };
    let text = json.choices[0]?.message?.content?.trim() || "";
    if (!text) return null;

    // Strip markdown code fences
    if (text.startsWith("```")) {
      text = text.split("\n").slice(1).join("\n");
      if (text.endsWith("```")) text = text.slice(0, -3);
      text = text.trim();
    }

    const result = JSON.parse(text) as TaggingOutput;

    // Validate tags
    const validTags = result.tags.filter((t) => {
      const allowed = ALL_VALID_TAGS[t.category];
      return allowed && allowed.includes(t.value);
    }).map((t) => ({
      ...t,
      confidence: Math.max(0, Math.min(1, t.confidence)),
    }));

    return { tags: validTags, summary: result.summary || "" };
  } catch (e) {
    console.warn("[ai-tagging] Failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Persist AI tags to the database (upsert Tag + VideoTag rows).
 */
export async function saveTagsToDb(
  videoId: string,
  tags: TagResult[],
) {
  const { prisma } = await import("@/lib/prisma");
  for (const t of tags) {
    const tag = await (prisma as any).tag.upsert({
      where: { name_category: { name: t.value, category: t.category } },
      create: { name: t.value, category: t.category, nameZh: t.value },
      update: {},
    });

    await (prisma as any).videoTag.upsert({
      where: { videoId_tagId: { videoId, tagId: (tag as any).id } },
      create: {
        videoId,
        tagId: (tag as any).id,
        confidence: t.confidence,
        source: "ai",
        evidence: t.evidence || null,
      },
      update: {
        confidence: t.confidence,
        source: "ai",
        evidence: t.evidence || null,
      },
    });
  }
}
