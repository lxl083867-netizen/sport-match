import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertVideoExists, requireUser } from "@/lib/guards";
import { err, handleApiError } from "@/lib/responses";

const DIFFICULTY = ["too_easy", "just_right", "too_hard"] as const;
const COMPLETION = ["fully", "partial", "abandoned"] as const;

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { videoId, difficultyRating, bodyFeeling, completionRate, recommend, notes } =
      await req.json();

    if (typeof videoId !== "string" || videoId.length === 0) {
      return err(400, "缺少视频 ID", "INVALID_PARAMS");
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

    await assertVideoExists(videoId);

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

      if (Object.keys(data).length === 0) {
        return err(400, "没有可更新的反馈字段", "INVALID_PARAMS");
      }

      const updated = await prisma.userFeedback.update({
        where: { userId_videoId: { userId, videoId } },
        data,
      });
      return NextResponse.json(updated);
    }

    const feedback = await prisma.userFeedback.create({
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

    return NextResponse.json(feedback);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { searchParams } = new URL(req.url);
    const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;

    const feedbacks = await prisma.userFeedback.findMany({
      where: { userId },
      include: {
        video: {
          select: { id: true, title: true, platform: true, sourceAuthor: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(feedbacks);
  } catch (e) {
    return handleApiError(e);
  }
}
