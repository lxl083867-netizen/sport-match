import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/responses";
import { addVideoToPlan } from "@/lib/services/plan-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUser();
    const { id: planId } = await params;
    const item = await addVideoToPlan(userId, planId, await req.json());
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
