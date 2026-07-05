"""
LLM 标签提取模块 — 调用 DeepSeek API 分析评论 + 视频信息，输出结构化标签。

使用前设置环境变量:
    export DEEPSEEK_API_KEY=sk-xxx

标签体系 (Tag.category):
  goal            — 减脂 / 增肌 / 康复 / 体能提升 / 柔韧性
  muscle          — 核心 / 臀腿 / 肩背 / 全身 / 上肢 / 下肢
  type            — 热身 / HIIT / 瑜伽 / 普拉提 / 力量训练 / 拉伸 / 有氧 / 放松
  phase           — 热身激活 / 主体训练 / 冷身拉伸
  intensity       — 低强度 / 中强度 / 高强度
  contraindication — 含跳跃 / 含深蹲 / 需仰卧 / 需跪姿 / 膝部禁忌 / 腰部禁忌
  equipment       — 无器材 / 弹力带 / 哑铃 / 瑜伽垫
  audience        — 零基础 / 有经验 / 大基数 / 产后恢复 / 康复期 / 办公室久坐
  duration        — 15分钟以内 / 15-30分钟 / 30分钟以上
"""

import json
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

ALL_VALID_TAGS = {
    "goal": ["减脂", "增肌", "康复", "体能提升", "柔韧性"],
    "muscle": ["核心", "臀腿", "肩背", "全身", "上肢", "下肢"],
    "type": ["热身", "HIIT", "瑜伽", "普拉提", "力量训练", "拉伸", "有氧", "放松"],
    "phase": ["热身激活", "主体训练", "冷身拉伸"],
    "intensity": ["低强度", "中强度", "高强度"],
    "contraindication": ["含跳跃", "含深蹲", "需仰卧", "需跪姿", "膝部禁忌", "腰部禁忌"],
    "equipment": ["无器材", "弹力带", "哑铃", "瑜伽垫"],
    "audience": ["零基础", "有经验", "大基数", "产后恢复", "康复期", "办公室久坐"],
    "duration": ["15分钟以内", "15-30分钟", "30分钟以上"],
}

SYSTEM_PROMPT = """你是一个运动视频内容分析专家。你的任务是根据视频信息和用户评论，为运动教程视频打上精准的标签。

## 标签体系

你可以从以下标签中选择（只能从这些标签中选择，不能创造新的）：

**运动目标 (goal)**：减脂、增肌、康复、体能提升、柔韧性
**目标肌群 (muscle)**：核心、臀腿、肩背、全身、上肢、下肢
**运动类型 (type)**：热身、HIIT、瑜伽、普拉提、力量训练、拉伸、有氧、放松
**训练阶段 (phase)**：热身激活、主体训练、冷身拉伸
**强度 (intensity)**：低强度、中强度、高强度
**禁忌动作 (contraindication)**：含跳跃、含深蹲、需仰卧、需跪姿、膝部禁忌、腰部禁忌
**器材需求 (equipment)**：无器材、弹力带、哑铃、瑜伽垫
**适合人群 (audience)**：零基础、有经验、大基数、产后恢复、康复期、办公室久坐
**时长 (duration)**：15分钟以内、15-30分钟、30分钟以上

## 分析规则

1. 结合视频标题、简介和评论做综合判断
2. 每条标签必须附带：
   - confidence (0.0-1.0)：置信度
   - evidence：来自评论的原文引用，或说明推断依据
3. 如果评论中提到"零基础跟不上""太难了"，应该降低"零基础"标签置信度
4. 如果评论中多人提到膝盖问题，需要加"膝部禁忌"标签
5. 如果评论有矛盾（有人说简单有人说太难），降低对应标签置信度，保留'争议'标记
6. 不要编造标签，只从上述列表中选择

## 输出格式

返回一个 JSON 对象（不要 markdown 代码块）：
{
  "tags": [
    {
      "category": "goal",
      "value": "减脂",
      "confidence": 0.9,
      "evidence": "评论：'一周三次，两周瘦了3斤'"
    }
  ],
  "summary": "一句话总结这个视频的定位和适用人群",
  "quality": "high/medium/low - 评论中有价值信息的丰富程度"
}"""


def build_tagging_prompt(
    title: str,
    description: str = "",
    duration_seconds: int | None = None,
    platform: str = "",
    author: str = "",
    original_tags: list[str] | None = None,
    comments: list[str] | None = None,
) -> str:
    """构建给 LLM 的 prompt"""
    parts = [f"## 视频信息\n标题：{title}"]

    if description:
        parts.append(f"简介：{description}")
    if duration_seconds:
        mins = duration_seconds // 60
        parts.append(f"时长：{mins} 分钟")
    if platform:
        parts.append(f"平台：{platform}")
    if author:
        parts.append(f"作者：{author}")
    if original_tags:
        parts.append(f"原标签：{', '.join(original_tags)}")

    if comments:
        sample = comments[:80]
        parts.append(f"\n## 用户评论（共 {len(comments)} 条，选取 {len(sample)} 条）")
        for i, c in enumerate(sample, 1):
            display = c[:200]
            parts.append(f"{i}. {display}")

    return "\n".join(parts)


def tag_video(
    title: str,
    comments: list[str],
    description: str = "",
    duration_seconds: int | None = None,
    platform: str = "",
    author: str = "",
    original_tags: list[str] | None = None,
    model: str = "deepseek-chat",
) -> dict:
    """
    调用 DeepSeek API 分析视频并返回标签。

    Args:
        title: 视频标题
        comments: 清洗后的评论文本列表
        description: 视频简介
        duration_seconds: 视频时长（秒）
        platform: 平台 (bilibili/xiaohongshu/douyin)
        author: 作者名称
        original_tags: 视频原始标签
        model: DeepSeek 模型（默认 deepseek-chat）

    Returns:
        {
            "tags": [{"category": "...", "value": "...", "confidence": 0.9, "evidence": "..."}],
            "summary": "...",
            "quality": "high/medium/low"
        }
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("请设置环境变量 DEEPSEEK_API_KEY")

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.deepseek.com",
    )

    prompt = build_tagging_prompt(
        title=title,
        description=description,
        duration_seconds=duration_seconds,
        platform=platform,
        author=author,
        original_tags=original_tags,
        comments=comments,
    )

    response = client.chat.completions.create(
        model=model,
        max_tokens=2000,
        temperature=0.1,  # 低温度，保证输出稳定
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )

    text = response.choices[0].message.content.strip()

    # Parse JSON response (handle possible markdown wrapping)
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    result = json.loads(text)

    # Validate tags
    valid_tags = []
    for tag in result.get("tags", []):
        cat = tag.get("category", "")
        val = tag.get("value", "")
        if cat in ALL_VALID_TAGS and val in ALL_VALID_TAGS[cat]:
            valid_tags.append({
                "category": cat,
                "value": val,
                "confidence": max(0.0, min(1.0, tag.get("confidence", 0.5))),
                "evidence": tag.get("evidence", ""),
            })

    return {
        "tags": valid_tags,
        "summary": result.get("summary", ""),
        "quality": result.get("quality", "medium"),
    }


if __name__ == "__main__":
    print("=== DeepSeek 标签提取演示 ===\n")
    print("使用方法：")
    print("  1. 设置环境变量: export DEEPSEEK_API_KEY=<your_key>")
    print("  2. 运行: python tag_video.py")
    print()
    print("完整流程请运行: python pipeline.py --url <B站视频URL> --title <视频标题>")
