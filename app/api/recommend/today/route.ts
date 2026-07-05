import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertVideoExists, requireUser } from "@/lib/guards";
import { err, handleApiError } from "@/lib/responses";

type DailyFeedback = {
  videoId: string;
  liked: boolean;
  reason: string | null;
  at: string;
};

function parseFeedback(value: string | null): DailyFeedback[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DailyFeedback =>
      item &&
      typeof item === "object" &&
      typeof item.videoId === "string" &&
      typeof item.liked === "boolean"
    );
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { videoId, liked, reason } = await req.json();

    if (typeof videoId !== "string" || videoId.length === 0) {
      return err(400, "缺少视频 ID", "INVALID_PARAMS");
    }
    if (typeof liked !== "boolean") {
      return err(400, "反馈结果必须是布尔值", "INVALID_PARAMS");
    }
    if (reason !== undefined && reason !== null && (typeof reason !== "string" || reason.length > 500)) {
      return err(400, "反馈原因不能超过 500 字", "INVALID_PARAMS");
    }

    await assertVideoExists(videoId);

    const dateStr = new Date().toISOString().slice(0, 10);

    let dailyRec = await prisma.dailyRecommendation.findUnique({
      where: { userId_date: { userId, date: dateStr } },
    });

    if (!dailyRec) {
      dailyRec = await prisma.dailyRecommendation.create({
        data: { userId, date: dateStr, videoIds: "[]", reason: "手动反馈" },
      });
    }

    const existingFeedback = parseFeedback(dailyRec.feedback);
    const updatedFeedback = existingFeedback.filter((f) => f.videoId !== videoId);
    updatedFeedback.push({
      videoId,
      liked,
      reason: reason || null,
      at: new Date().toISOString(),
    });

    await prisma.dailyRecommendation.update({
      where: { id: dailyRec.id },
      data: { feedback: JSON.stringify(updatedFeedback) },
    });

    if (!liked) {
      await prisma.userFeedback.upsert({
        where: { userId_videoId: { userId, videoId } },
        create: {
          userId,
          videoId,
          difficultyRating: "just_right",
          completionRate: "fully",
          recommend: false,
          notes: reason || "今日推荐不满意",
        },
        update: { recommend: false, notes: reason || "今日推荐不满意" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
