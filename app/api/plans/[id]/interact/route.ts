import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/responses";
import { getPlanInteractions, togglePlanInteraction } from "@/lib/services/plan-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user ? (session.user as { id: string }).id : null;
    const { id: planId } = await params;
    const interactions = await getPlanInteractions(userId, planId);
    return NextResponse.json(interactions);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUser();
    const { id: planId } = await params;
    const { type } = await req.json();
    const result = await togglePlanInteraction(userId, planId, type);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
