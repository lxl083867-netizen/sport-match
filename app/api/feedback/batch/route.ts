import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { err, handleApiError } from "@/lib/responses";

const DIFFICULTY = ["too_easy", "just_right", "too_hard"] as const;
const COMPLETION = ["fully", "partial", "abandoned"] as const;

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { videoIds, difficultyRating, bodyFeeling, completionRate, recommend, notes } =
      await req.json();

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return err(400, "请提供视频 ID 列表", "INVALID_PARAMS");
    }
    if (videoIds.some((id) => typeof id !== "string" || id.length === 0)) {
      return err(400, "视频 ID 列表格式不正确", "INVALID_PARAMS");
    }
    if (difficultyRating !== undefined && !DIFFICULTY.includes(difficultyRating)) {
      return err(400, "难度反馈格式不正确", "INVALID_PARAMS");
    }
    if (completionRate !== undefined && !COMPLETION.includes(completionRate)) {
      return err(400, "完成度反馈格式不正确", "INVALID_PARAMS");
    }
    if (recommend !== undefined && typeof recommend !== "boolean") {
      return err(400, "推荐反馈必须是布尔值", "INVALID_PARAMS");
    }
    if (bodyFeeling !== undefined && bodyFeeling !== null && typeof bodyFeeling !== "string") {
      return err(400, "身体感受格式不正确", "INVALID_PARAMS");
    }
    if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 500)) {
      return err(400, "备注不能超过 500 字", "INVALID_PARAMS");
    }

    const uniqueVideoIds = [...new Set(videoIds)];
    const existingVideos = await prisma.video.count({
      where: { id: { in: uniqueVideoIds } },
    });
    if (existingVideos !== uniqueVideoIds.length) {
      return err(404, "包含不存在的视频", "NOT_FOUND");
    }

    let count = 0;
    for (const videoId of uniqueVideoIds) {
      const existing = await prisma.userFeedback.findUnique({
        where: { userId_videoId: { userId, videoId } },
      });

      if (existing) {
        const data: Record<string, unknown> = {};
        if (difficultyRating !== undefined) data.difficultyRating = difficultyRating;
        if (bodyFeeling !== undefined) data.bodyFeeling = bodyFeeling;
        if (completionRate !== undefined) data.completionRate = completionRate;
        if (recommend !== undefined) data.recommend = recommend;
        if (notes !== undefined) data.notes = notes;

        if (Object.keys(data).length > 0) {
          await prisma.userFeedback.update({
            where: { userId_videoId: { userId, videoId } },
            data,
          });
          count++;
        }
      } else {
        await prisma.userFeedback.create({
          data: {
            userId,
            videoId,
            difficultyRating: difficultyRating || "just_right",
            bodyFeeling,
            completionRate: completionRate || "fully",
            recommend: recommend !== undefined ? recommend : true,
            notes,
          },
        });
        count++;
      }
    }

    return NextResponse.json({ count });
  } catch (e) {
    return handleApiError(e);
  }
}
