import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 1. Get all audience tags from the fixed Tag table
  const audienceTags = await prisma.tag.findMany({
    where: { category: "audience" },
    select: { nameZh: true },
  });

  // 2. Count how many plans use each tag
  const plans = await prisma.trainingPlan.findMany({
    where: { isPublic: true },
    select: { targetAudience: true },
  });

  const counts: Record<string, number> = {};
  for (const plan of plans) {
    const tags = JSON.parse(plan.targetAudience) as string[];
    for (const tag of tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }

  // 3. Merge: all audience tags with their plan usage counts
  const tags = audienceTags
    .map((t) => ({ label: t.nameZh, count: counts[t.nameZh] || 0 }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ tags });
}
