#!/usr/bin/env python3
"""
一键视频分析管道：抓取评论 → 清洗 → LLM打标签 → 输出结构化JSON

使用方法:
  python scripts/pipeline.py --url "https://www.bilibili.com/video/BVxxxx"
  python scripts/pipeline.py --url "https://www.xiaohongshu.com/explore/xxx" --cookie "your_cookie"
  python scripts/pipeline.py --help

输出:
  JSON 文件，包含视频标签、置信度、证据引用等，可直接导入数据库。
"""

import argparse
import json
import sys
import os
import io
from dotenv import load_dotenv

# Fix Unicode output on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Add parent dir to path so we can import sibling modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from clean_comments import clean_comments
from tag_video import tag_video
from fetch_comments import (
    extract_bvid,
    fetch_bilibili_comments,
    fetch_xiaohongshu_comments,
)


def detect_platform(url: str) -> str:
    """自动检测平台"""
    url_lower = url.lower()
    if "bilibili" in url_lower:
        return "bilibili"
    if "xiaohongshu" in url_lower:
        return "xiaohongshu"
    if "douyin" in url_lower:
        return "douyin"
    return "unknown"


def fetch_comments(url: str, cookie: str = "", max_pages: int = 5) -> tuple[list[dict], dict]:
    """
    根据 URL 自动选择抓取策略。

    Returns:
        (raw_comments, video_meta): 原始评论列表 + 视频元信息
    """
    platform = detect_platform(url)

    if platform == "bilibili":
        bvid = extract_bvid(url)
        if not bvid:
            raise ValueError(f"无法从URL提取B站BV号: {url}")
        comments, video_meta = fetch_bilibili_comments(bvid, max_pages)
        video_meta["platform"] = "bilibili"
        return comments, video_meta

    elif platform == "xiaohongshu":
        if not cookie:
            raise ValueError("小红书需要 --cookie 参数")
        # 从URL提取 note_id
        import re
        match = re.search(r"/explore/([a-zA-Z0-9]+)", url)
        if not match:
            raise ValueError(f"无法从URL提取小红书note_id: {url}")
        note_id = match.group(1)
        comments = fetch_xiaohongshu_comments(note_id, cookie)
        meta = {"platform": "xiaohongshu", "author": "", "title": ""}
        return comments, meta

    elif platform == "douyin":
        print("⚠ 抖音评论抓取需要 playwright 方案，目前未实现自动抓取")
        print("请手动提供评论文件: python pipeline.py --comments-file comments.json")

    return [], {"platform": platform}


def main():
    parser = argparse.ArgumentParser(
        description="运动视频标签分析管道",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python pipeline.py --url "https://www.bilibili.com/video/BVxxxx" --title "10分钟燃脂"
  python pipeline.py --url "https://www.bilibili.com/video/BVxxxx" --title "燃脂" --author "帕梅拉" --duration 600
  python pipeline.py --comments-file comments.json --title "核心训练"
        """,
    )
    parser.add_argument("--url", help="视频 URL")
    parser.add_argument("--cookie", default="", help="小红书 Cookie (仅小红书需要)")
    parser.add_argument("--comments-file", help="手动提供的评论 JSON 文件路径 (格式: [{'content': '...', 'likes': 0}])")
    parser.add_argument("--title", required=True, help="视频标题")
    parser.add_argument("--description", default="", help="视频简介")
    parser.add_argument("--duration", type=int, help="视频时长（秒）")
    parser.add_argument("--author", default="", help="作者名称")
    parser.add_argument("--tags", default="", help="视频原始标签，逗号分隔")
    parser.add_argument("--max-pages", type=int, default=5, help="最多抓取评论页数")
    parser.add_argument("--max-comments", type=int, default=200, help="最多分析评论数")
    parser.add_argument("--output", default="", help="输出 JSON 文件路径（默认输出到 stdout）")
    parser.add_argument("--model", default="deepseek-chat",
                        help="DeepSeek 模型 (默认 deepseek-chat)")

    args = parser.parse_args()

    raw_comments = []
    video_meta = {
        "platform": "",
        "author": args.author,
        "title": args.title,
        "description": args.description,
        "duration_seconds": args.duration,
    }

    # Step 1: 获取评论
    if args.comments_file:
        print(f"📂 从文件加载评论: {args.comments_file}")
        with open(args.comments_file, "r", encoding="utf-8") as f:
            raw_comments = json.load(f)
    elif args.url:
        print(f"🌐 抓取评论: {args.url}")
        platform = detect_platform(args.url)
        print(f"   检测到平台: {platform}")

        if platform == "bilibili":
            bvid = extract_bvid(args.url)
            if bvid:
                print(f"   BV号: {bvid}")
                raw_comments, fetched_meta = fetch_bilibili_comments(bvid, args.max_pages)
                video_meta.update(fetched_meta)
                video_meta["platform"] = "bilibili"
            else:
                print("❌ 无法提取 BV 号")
                sys.exit(1)
        elif platform == "xiaohongshu":
            if not args.cookie:
                print("❌ 小红书需要 --cookie 参数")
                sys.exit(1)
            import re
            match = re.search(r"/explore/([a-zA-Z0-9]+)", args.url)
            if match:
                raw_comments = fetch_xiaohongshu_comments(match.group(1), args.cookie)
                video_meta["platform"] = "xiaohongshu"
        else:
            print(f"❌ 不支持的平台或无法自动抓取: {platform}")
            print("   请使用 --comments-file 手动提供评论")
            sys.exit(1)
    else:
        print("❌ 请提供 --url 或 --comments-file")
        sys.exit(1)

    if not raw_comments:
        print("❌ 未获取到任何评论")
        print("   建议：检查 URL 是否正确，或手动提供评论文件")
        sys.exit(1)

    print(f"   获取到 {len(raw_comments)} 条原始评论")

    # Step 2: 清洗评论
    print("🧹 清洗评论...")
    cleaned, clean_stats = clean_comments(raw_comments)
    print(f"   保留 {clean_stats['kept']} 条有效评论")
    print(f"   移除: 打卡{clean_stats['removed_checkin']} "
          f"表情{clean_stats['removed_emoji']} "
          f"@好友{clean_stats['removed_at']} "
          f"求关注{clean_stats['removed_begging']} "
          f"过短{clean_stats['removed_short']} "
          f"重复{clean_stats['removed_duplicate']}")

    # 限制评论数量
    if len(cleaned) > args.max_comments:
        cleaned = cleaned[:args.max_comments]
        print(f"   限制为 {args.max_comments} 条评论用于分析")

    # Step 3: LLM 打标签
    print("🤖 LLM 分析中...")
    original_tags = [t.strip() for t in args.tags.split(",") if t.strip()] if args.tags else None

    result = tag_video(
        title=video_meta.get("title") or args.title,
        comments=cleaned,
        description=video_meta.get("description") or args.description or "",
        duration_seconds=video_meta.get("duration_seconds") or args.duration,
        platform=video_meta["platform"],
        author=video_meta.get("author") or args.author or "",
        original_tags=original_tags,
        model=args.model,
    )

    # Step 4: 输出结果
    output = {
        "video": {
            "title": video_meta.get("title") or args.title,
            "url": args.url or "",
            "platform": video_meta["platform"],
            "duration": video_meta.get("duration_seconds") or args.duration,
            "author": video_meta.get("author") or args.author,
        },
        "analysis": {
            "summary": result["summary"],
            "quality": result["quality"],
            "comment_stats": clean_stats,
        },
        "tags": result["tags"],
    }

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"\n✅ 结果已保存到: {args.output}")
    else:
        print("\n" + "=" * 60)
        print(json.dumps(output, ensure_ascii=False, indent=2))

    print(f"\n标签列表 ({len(result['tags'])} 个):")
    for tag in result["tags"]:
        bar = "█" * int(tag["confidence"] * 10) + "░" * (10 - int(tag["confidence"] * 10))
        print(f"  [{bar}] {tag['category']}/{tag['value']} ({tag['confidence']:.0%})")
        if tag.get("evidence"):
            print(f"         📝 {tag['evidence'][:100]}")

    print(f"\n📊 评论质量: {result['quality']}")
    print(f"📝 总结: {result['summary']}")


if __name__ == "__main__":
    main()
