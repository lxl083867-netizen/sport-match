import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/responses";
import { importVideo } from "@/lib/services/video-service";
import { logEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { urls } = await req.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { ok: false, error: "请提供链接列表", code: "INVALID_PARAMS" },
        { status: 400 }
      );
    }

    const results: Array<{
      url: string;
      status: "imported" | "existed" | "failed" | "needs_confirmation";
      video?: { id: string; title: string; platform: string };
      error?: string;
      quality?: { level: string; message: string; reasons: string[] };
    }> = [];

    for (const raw of urls.slice(0, 20)) {
      try {
        const result = await importVideo(userId, { url: raw });
        if ("video" in result && result.video) {
          results.push({
            url: raw,
            status: result.existed ? "existed" : "imported",
            video: { id: result.video.id, title: result.video.title, platform: result.video.platform },
            quality: result.quality,
          });
        } else {
          results.push({
            url: raw,
            status: "needs_confirmation",
            error: "疑似非运动内容，需单条确认导入",
            quality: result.quality,
          });
        }
      } catch (e) {
        results.push({
          url: raw,
          status: "failed",
          error: e instanceof Error ? e.message : "导入失败",
        });
      }
    }

    const imported = results.filter((r) => r.status === "imported").length;
    const existed = results.filter((r) => r.status === "existed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const needsConfirmation = results.filter((r) => r.status === "needs_confirmation").length;

    logEvent("video_batch_import", {
      userId,
      total: results.length,
      imported,
      existed,
      failed,
      needsConfirmation,
    });

    return NextResponse.json({ results, imported, existed, failed, needsConfirmation });
  } catch (error) {
    return handleApiError(error);
  }
}
