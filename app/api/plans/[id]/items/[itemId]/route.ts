import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/responses";
import { deletePlanItem, updatePlanItem } from "@/lib/services/plan-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const userId = await requireUser();
    const { id: planId, itemId } = await params;
    const result = await deletePlanItem(userId, planId, itemId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const userId = await requireUser();
    const { id: planId, itemId } = await params;
    const updated = await updatePlanItem(userId, planId, itemId, await req.json());
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
