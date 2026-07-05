"""
将 pipeline 输出的标签 JSON 导入 SQLite 数据库。

使用方法:
  python scripts/db_import.py scripts/test_output.json
  python scripts/db_import.py scripts/test_output.json --dry-run  # 仅预览，不写入
"""

import argparse
import json
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "dev.db")


def import_tags(json_path: str, dry_run: bool = False):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    video = data["video"]
    tags = data["tags"]
    analysis = data.get("analysis", {})

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Upsert Video
    url = video["url"]
    cur.execute("SELECT id FROM Video WHERE url = ?", (url,))
    row = cur.fetchone()

    if row:
        video_id = row[0]
        cur.execute(
            """UPDATE Video SET title = ?, duration = ?, sourceAuthor = ?, thumbnailUrl = ?
               WHERE id = ?""",
            (video["title"], video.get("duration"), video.get("author"), None, video_id),
        )
        print(f"[Video] Updated: {video['title'][:50]} (id={video_id})")
    else:
        import uuid
        video_id = uuid.uuid4().hex[:16]
        cur.execute(
            """INSERT INTO Video (id, title, url, platform, duration, sourceAuthor, thumbnailUrl, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (video_id, video["title"], url, video.get("platform", ""),
             video.get("duration"), video.get("author", ""), None),
        )
        print(f"[Video] Created: {video['title'][:50]} (id={video_id})")

    # 2. Upsert Tags and VideoTags
    created_tags = 0
    created_vt = 0
    updated_vt = 0
    skipped = 0

    for tag in tags:
        cat = tag["category"]
        val = tag["value"]
        conf = tag["confidence"]
        evidence = tag.get("evidence", "")

        # Validate
        if not cat or not val:
            skipped += 1
            continue

        # Find or create Tag (name is the value, nameZh is also the value for Chinese tags)
        cur.execute("SELECT id FROM Tag WHERE name = ? AND category = ?", (val, cat))
        row = cur.fetchone()
        if row:
            tag_id = row[0]
        else:
            import uuid as _uuid
            tag_id = _uuid.uuid4().hex[:16]
            cur.execute(
                "INSERT INTO Tag (id, name, category, nameZh) VALUES (?, ?, ?, ?)",
                (tag_id, val, cat, val),
            )
            created_tags += 1

        # Upsert VideoTag
        cur.execute(
            "SELECT id, confidence FROM VideoTag WHERE videoId = ? AND tagId = ?",
            (video_id, tag_id),
        )
        vt_row = cur.fetchone()
        if vt_row:
            # Only update if new confidence is higher
            if conf > (vt_row[1] or 0):
                cur.execute(
                    """UPDATE VideoTag SET confidence = ?, source = ?, evidence = ?, createdAt = datetime('now')
                       WHERE id = ?""",
                    (conf, "ai", evidence, vt_row[0]),
                )
                updated_vt += 1
        else:
            import uuid as _uuid2
            vt_id = _uuid2.uuid4().hex[:16]
            cur.execute(
                """INSERT INTO VideoTag (id, videoId, tagId, confidence, source, evidence, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))""",
                (vt_id, video_id, tag_id, conf, "ai", evidence),
            )
            created_vt += 1

    if not dry_run:
        conn.commit()
        print(f"\n[Summary] Tags new: {created_tags}, VideoTags new: {created_vt}, updated: {updated_vt}, skipped: {skipped}")
        print(f"[Quality] {analysis.get('quality', 'N/A')}")
        print(f"[Summary] {analysis.get('summary', '')}")
    else:
        conn.rollback()
        print(f"\n[DRY RUN] Would create {created_tags} tags, {created_vt} video-tags, update {updated_vt}")

    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import pipeline output to database")
    parser.add_argument("json_file", help="Pipeline output JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()
    import_tags(args.json_file, dry_run=args.dry_run)
