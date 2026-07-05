import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertVideoExists, requireUser } from "@/lib/guards";
import { err, handleApiError } from "@/lib/responses";

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const { videoId } = await request.json();

    if (!videoId || typeof videoId !== "string") {
      return err(400, "缺少视频 ID", "INVALID_PARAMS");
    }

    await assertVideoExists(videoId);

    await prisma.videoCheckIn.create({ data: { userId, videoId } });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentCount, totalCount] = await Promise.all([
      prisma.videoCheckIn.count({
        where: { videoId, createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.videoCheckIn.count({ where: { videoId } }),
    ]);

    return NextResponse.json({ recentCount, totalCount });
  } catch (e) {
    return handleApiError(e);
  }
}
