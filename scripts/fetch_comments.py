"""
抓取各平台视频评论。

目前各平台 API 情况：
- B站: 有公开 API (https://api.bilibili.com/x/v2/medialist/resource/list)
  需要 BV 号，不需要登录即可获取评论
- 小红书: 需要登录 Cookie，API 有反爬，建议用 playwright 模拟
- 抖音: 需要登录，API 加密较复杂

本脚本提供 B站评论抓取的完整实现，以及小红书/抖音的抓取思路。
"""

import json
import re
import httpx
from typing import Optional


def extract_bvid(url: str) -> Optional[str]:
    """从B站URL提取BV号"""
    match = re.search(r"BV[a-zA-Z0-9]+", url)
    return match.group(0) if match else None


def fetch_bilibili_comments(bvid: str, max_pages: int = 5) -> tuple[list[dict], dict]:
    """
    抓取B站视频评论。

    Args:
        bvid: 视频的 BV 号
        max_pages: 最多抓取页数（每页20条）

    Returns:
        (comments, video_meta): 评论列表 + 视频元信息(title, author, duration等)
    """
    # Step 1: 获取视频信息（拿到 oid 和元信息）
    info_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
    info_resp = httpx.get(info_url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.bilibili.com/",
    })
    info = info_resp.json()
    if info.get("code") != 0:
        return [], {}

    vdata = info["data"]
    oid = vdata.get("aid")  # 评论区用 av 号作为 oid
    video_meta = {
        "title": vdata.get("title", ""),
        "author": vdata.get("owner", {}).get("name", ""),
        "duration_seconds": vdata.get("duration"),
        "description": vdata.get("desc", ""),
    }

    # Step 2: 抓取评论 (使用 /reply/main 端点获得更多评论)
    comments = []
    seen = set()  # 去重（置顶评论可能跨页重复）
    for page in range(1, max_pages + 1):
        url = (
            f"https://api.bilibili.com/x/v2/reply/main"
            f"?type=1&oid={oid}&pn={page}&ps=20&sort=2"
        )
        resp = httpx.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": f"https://www.bilibili.com/video/{bvid}",
        })
        data = resp.json()

        if data.get("code") != 0:
            break

        replies = data.get("data", {}).get("replies", [])
        if not replies:
            break

        for r in replies:
            msg = r.get("content", {}).get("message", "")
            if msg and msg not in seen:
                seen.add(msg)
                comments.append({
                    "content": msg,
                    "likes": r.get("like", 0),
                    "ctime": r.get("ctime", 0),
                })

    return comments, video_meta


def fetch_xiaohongshu_comments(note_id: str, cookie: str) -> list[dict]:
    """
    抓取小红书笔记评论（需要登录 Cookie）

    使用方法:
    1. 浏览器登录 xiaohongshu.com
    2. F12 → Application → Cookies → 复制所有 cookie
    3. 调用此函数

    小红书 API: POST https://edith.xiaohongshu.com/api/sns/web/v2/comment/page
    """
    comments = []
    cursor = ""

    for _ in range(10):  # 最多10页
        resp = httpx.post(
            "https://edith.xiaohongshu.com/api/sns/web/v2/comment/page",
            headers={
                "Cookie": cookie,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Content-Type": "application/json",
                "X-S": "xxx",  # 需要计算签名，建议用 playwright 方案
            },
            json={
                "note_id": note_id,
                "cursor": cursor,
                "top_comment_id": "",
                "image_formats": ["jpg", "webp", "avif"],
            },
        )

        data = resp.json()
        comments_list = data.get("data", {}).get("comments", [])
        if not comments_list:
            break

        for c in comments_list:
            comments.append({
                "content": c.get("content", ""),
                "likes": c.get("like_count", 0),
                "ctime": c.get("create_time", 0),
            })

        cursor = data.get("data", {}).get("cursor", "")
        if not cursor:
            break

    return comments


def fetch_douyin_comments(video_id: str) -> list[dict]:
    """
    抓取抖音视频评论。

    抖音的评论抓取较为复杂，建议方案：
    1. 使用抖音开放平台 API (需要审核通过的应用)
    2. 使用 playwright 模拟浏览器 (需要扫码登录)
    3. 使用第三方数据服务 (如新榜、飞瓜等)

    这里提供 API 抓取思路（需要 access_token）：
    POST https://open.douyin.com/api/v2/video/comment/list/
    """
    # 抖音需要 access_token，不提供完整实现
    # 建议用 playwright 方案：
    # 1. 打开 playwright
    # 2. 用 saved storage state 恢复登录
    # 3. 访问视频页面
    # 4. 滚动加载评论
    # 5. 提取评论文本
    return []


if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("=== B站评论抓取示例 ===\n")

    test_url = "https://www.bilibili.com/video/BV1GJ411x7h7"
    bvid = extract_bvid(test_url)

    if bvid:
        print(f"视频 BV 号: {bvid}")
        comments, meta = fetch_bilibili_comments(bvid, max_pages=2)
        print(f"标题: {meta.get('title', 'N/A')}")
        print(f"作者: {meta.get('author', 'N/A')}")
        print(f"获取到 {len(comments)} 条评论:")
        for i, c in enumerate(comments[:5], 1):
            content = c["content"][:80]
            print(f"  {i}. [{c['likes']}赞] {content}...")
    else:
        print(f"无法从 URL 提取 BV 号: {test_url}")

    print("\n=== 小红书 / 抖音抓取说明 ===")
    print("小红书: 需要登录 Cookie，建议用 playwright 方案")
    print("抖音: 需要 access_token 或 playwright 方案")
