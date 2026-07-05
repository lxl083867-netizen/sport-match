import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRecommendations, generateDailyPlan } from "@/lib/recommendation";
import { requireUser } from "@/lib/guards";
import { err, handleApiError } from "@/lib/responses";
import { countBy, logEvent } from "@/lib/events";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { searchParams } = new URL(req.url);
    const rawLimit = Number.parseInt(searchParams.get("limit") || "10", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 10;
    const type = searchParams.get("type") || "videos";

    if (!["videos", "plan"].includes(type)) {
      return err(400, "推荐类型不正确", "INVALID_PARAMS");
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });

    if (type === "plan") {
      const plan = await generateDailyPlan(userId);
      logEvent("recommendation_generated", {
        userId,
        context: "daily_plan",
        resultCount: plan.videos.length,
        platforms: JSON.stringify(countBy(plan.videos, (v) => v.platform)),
      });
      return NextResponse.json({ ...plan, fitnessLevel: profile?.fitnessLevel ?? null });
    }

    const recommendations = await getRecommendations(userId, limit);
    logEvent("recommendation_generated", {
      userId,
      context: "video_list",
      limit,
      resultCount: recommendations.length,
      platforms: JSON.stringify(countBy(recommendations, (v) => v.platform)),
      topScores: recommendations.slice(0, 5).map((v) => Math.round(v.matchScore)),
    });
    return NextResponse.json({ recommendations, fitnessLevel: profile?.fitnessLevel ?? null });
  } catch (e) {
    return handleApiError(e);
  }
}
