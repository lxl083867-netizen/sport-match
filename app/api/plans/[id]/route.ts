import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/responses";
import { deletePlan, getPlan, updatePlan } from "@/lib/services/plan-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUser();
    const { id } = await params;
    const updated = await updatePlan(userId, id, await req.json());
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUser();
    const { id } = await params;
    const result = await deletePlan(userId, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const currentUserId = session?.user ? (session.user as { id: string }).id : null;
    const { id } = await params;
    const plan = await getPlan(id, currentUserId);
    return NextResponse.json(plan);
  } catch (error) {
    return handleApiError(error);
  }
}
