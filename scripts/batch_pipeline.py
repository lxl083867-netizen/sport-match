"""批量处理 B站 视频：抓取评论 → 清洗 → AI打标签 → 写数据库"""

import sys, os, io, time
sys.path.insert(0, os.path.dirname(__file__))
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from fetch_comments import fetch_bilibili_comments
from clean_comments import clean_comments
from tag_video import tag_video

# Import db_import directly
from db_import import import_tags

BV_IDS = [
    "BV11Autz4EoV", "BV1Gz421C7G1", "BV1XcKSz4EFr", "BV1RoWfeGEKX",
    "BV1r7411E7eJ", "BV181ZQYjEPD", "BV14a4y1W76f", "BV1r5411s7Ck",
    "BV1Y541127G2", "BV1jk4y117eK", "BV1JT411E74U", "BV1hA411Y7gC",
]

OUT_DIR = os.path.join(os.path.dirname(__file__), "batch_outputs")
os.makedirs(OUT_DIR, exist_ok=True)

success = 0
fail = 0

for i, bvid in enumerate(BV_IDS, 1):
    print(f"\n{'='*60}")
    print(f"[{i}/{len(BV_IDS)}] Processing {bvid}")
    print(f"{'='*60}")

    try:
        # Step 1: Fetch
        print("  Fetching comments...")
        raw_comments, meta = fetch_bilibili_comments(bvid, max_pages=5)
        if not raw_comments:
            print("  SKIP: No comments fetched")
            fail += 1
            continue
        print(f"  Got {len(raw_comments)} raw comments")

        # Step 2: Clean
        cleaned, stats = clean_comments(raw_comments)
        print(f"  Kept {stats['kept']} comments (removed {stats['total']-stats['kept']})")

        # Step 3: Tag via LLM
        print(f"  Tagging with DeepSeek...")
        result = tag_video(
            title=meta.get("title", ""),
            comments=cleaned,
            description=meta.get("description", ""),
            duration_seconds=meta.get("duration_seconds"),
            platform="bilibili",
            author=meta.get("author", ""),
        )
        n_tags = len(result["tags"])
        print(f"  Extracted {n_tags} tags (quality: {result['quality']})")

        # Step 4: Save JSON
        out = {
            "video": {
                "title": meta.get("title", ""),
                "url": f"https://www.bilibili.com/video/{bvid}",
                "platform": "bilibili",
                "duration": meta.get("duration_seconds"),
                "author": meta.get("author", ""),
            },
            "analysis": {
                "summary": result["summary"],
                "quality": result["quality"],
                "comment_stats": stats,
            },
            "tags": result["tags"],
        }

        json_path = os.path.join(OUT_DIR, f"{bvid}.json")
        import json
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        # Step 5: Import to DB
        print(f"  Writing to database...")
        import_tags(json_path)

        success += 1
        print(f"  DONE: {meta['title'][:40]} ({n_tags} tags)")

        # Small delay between API calls
        if i < len(BV_IDS):
            time.sleep(1)

    except Exception as e:
        fail += 1
        print(f"  FAILED: {e}")

print(f"\n{'='*60}")
print(f"Batch complete: {success} success, {fail} failed")
print(f"Outputs saved to: {OUT_DIR}")
