import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/responses";
import { createPlan, listPlans } from "@/lib/services/plan-service";

function parsePage(value: string | null) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "12", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 12;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user ? (session.user as { id: string }).id : null;
    const { searchParams } = new URL(req.url);

    const result = await listPlans({
      userId,
      page: parsePage(searchParams.get("page")),
      limit: parseLimit(searchParams.get("limit")),
      sort: searchParams.get("sort") || "hot",
      myOnly: searchParams.get("my") === "1",
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const plan = await createPlan(userId, await req.json());
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
