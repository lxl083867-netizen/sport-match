"""
评论清洗模块 — 过滤无效评论，保留有价值的反馈。

清洗规则：
1. 纯打卡类评论 (day1, 打卡, 第X天)
2. 纯表情/符号评论
3. @好友类评论
4. 求关注/求互关
5. 复制粘贴的队形评论
6. 过短评论 (< 5 个中文字符)
7. 纯链接评论
8. 重复评论去重
"""

import re
from collections import Counter


def is_checkin(text: str) -> bool:
    """检测是否是纯打卡评论"""
    patterns = [
        r"^[dD]ay\s*\d+$",
        r"^第[一二三四五六七八九十\d]+[天次]$",
        r"^打卡[了]?$",
        r"^[0-9]+天$",
        r"^[.\d]+$",  # 纯数字/日期
    ]
    for p in patterns:
        if re.match(p, text.strip()):
            return True
    # 特殊处理 "Day1 打卡" "Day 1 完成" 等变体
    if re.match(r"^[dD]ay\s*\d+\s*(打卡|完成|跟练|运动)?$", text.strip()):
        return True
    return False


def is_emoji_only(text: str) -> bool:
    """检测是否是纯表情/符号"""
    # 移除常见表情和标点后，看看还有没有中英文
    cleaned = re.sub(r"[\U0001F300-\U0001FAFF\U0001F600-\U0001F64F☀-➿✀-➿]+", "", text)
    cleaned = re.sub(r"[，。！？、；：""''【】《》（）…\s!?,.\"']+", "", cleaned)
    # 如果剩余有效字符 < 3 个中文/英文，视为纯表情
    meaningful = re.findall(r"[一-鿿\w]", cleaned)
    return len(meaningful) < 3


def is_at_friend(text: str) -> bool:
    """检测是否主要是@好友"""
    at_count = len(re.findall(r"@\S+", text))
    # @次数 >= 2 或评论长度较短且@占主导
    clean = re.sub(r"@\S+", "", text).strip()
    return at_count >= 2 or (at_count >= 1 and len(clean) < 5)


def is_begging(text: str) -> bool:
    """检测是否是求关注/求互关"""
    patterns = [
        r"求[互关关注赞]",
        r"[互关关注]注",
        r"互[赞关粉]",
        r"加[微信vxVX]",
        r"回[关赞]",
        r"扩[关列]",
        r"[微信vxVX]\s*[:：]?\s*[\w]+",
        r"互[关粉]必回",
        r"赞[了过]",
        r"借[楼]?",
        r"姐妹们[，。]?互",
    ]
    return any(re.search(p, text) for p in patterns)


def is_too_short(text: str) -> bool:
    """检测是否过短（< 5 个中文有效字符）"""
    chinese_chars = re.findall(r"[一-鿿]", text)
    return len(chinese_chars) < 5


def is_just_link(text: str) -> bool:
    """检测是否只是链接"""
    links = re.findall(r"https?://\S+", text)
    clean = re.sub(r"https?://\S+", "", text).strip()
    return len(links) > 0 and len(clean) < 10


def find_copy_paste(comments: list[str], threshold: float = 0.8) -> set[int]:
    """
    检测复制粘贴的队形评论。
    如果某条评论出现次数超过平均的 threshold，标记为队形。
    """
    if len(comments) <= 3:
        return set()

    counter = Counter(comments)
    # 出现 >= 3 次且占比超过 threshold 的视为队形
    total = len(comments)
    duplicate_indices = set()
    for text, count in counter.items():
        if count >= 3 and count / total >= threshold * 0.3:
            for i, c in enumerate(comments):
                if c == text:
                    duplicate_indices.add(i)
    return duplicate_indices


def clean_comments(
    raw_comments: list[dict],
    min_chinese_chars: int = 5,
) -> tuple[list[str], dict]:
    """
    清洗评论列表。

    Args:
        raw_comments: 原始评论列表 [{"content": "...", "likes": 10}, ...]
        min_chinese_chars: 最少中文字符数

    Returns:
        (cleaned_comments, stats): 清洗后的评论文本列表 + 统计信息
    """
    stats = {
        "total": len(raw_comments),
        "removed_checkin": 0,
        "removed_emoji": 0,
        "removed_at": 0,
        "removed_begging": 0,
        "removed_short": 0,
        "removed_link": 0,
        "removed_duplicate": 0,
        "kept": 0,
    }

    # 提取纯文本
    texts = [c.get("content", "").strip() for c in raw_comments]

    # 第一轮：逐条过滤
    kept_indices = []
    for i, text in enumerate(texts):
        if not text:
            continue
        if is_checkin(text):
            stats["removed_checkin"] += 1
            continue
        if is_emoji_only(text):
            stats["removed_emoji"] += 1
            continue
        if is_at_friend(text):
            stats["removed_at"] += 1
            continue
        if is_begging(text):
            stats["removed_begging"] += 1
            continue
        if is_too_short(text):
            stats["removed_short"] += 1
            continue
        if is_just_link(text):
            stats["removed_link"] += 1
            continue
        kept_indices.append(i)

    kept_texts = [texts[i] for i in kept_indices]

    # 第二轮：去队形
    dup_indices = find_copy_paste(kept_texts)
    final_texts = [t for i, t in enumerate(kept_texts) if i not in dup_indices]
    stats["removed_duplicate"] = len(dup_indices)
    stats["kept"] = len(final_texts)

    return final_texts, stats


if __name__ == "__main__":
    # 测试用例
    test_comments = [
        {"content": "零基础跟不下来，太累了"},
        {"content": "膝盖有伤，第三个动作做不了"},
        {"content": "Day1 打卡"},
        {"content": "👍👍👍"},
        {"content": "@小明 @小红 快来看！"},
        {"content": "求互关！点赞必回"},
        {"content": "好"},
        {"content": "https://xxx.com 快看这个"},
        {"content": "这个教练讲解得很清楚，动作简单但效果好"},
        {"content": "这个教练讲解得很清楚，动作简单但效果好"},  # 重复
        {"content": "练了一个月，腰围减了3cm，感动"},
        {"content": "产后6个月，这个比林芊妤的友好，推荐"},
    ]

    cleaned, stats = clean_comments(test_comments)
    print("=== 清洗统计 ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    print(f"\n=== 保留 {len(cleaned)} 条评论 ===")
    for i, c in enumerate(cleaned, 1):
        print(f"  {i}. {c}")
