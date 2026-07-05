import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/responses";
import { getVideo, removeVideoFromCollection, updateVideo } from "@/lib/services/video-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUser();
    const { id } = await params;
    const result = await removeVideoFromCollection(userId, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUser();
    const { id } = await params;
    const updated = await updateVideo(userId, id, await req.json());
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user ? (session.user as { id: string }).id : null;
    const video = await getVideo(id, userId);
    return NextResponse.json(video);
  } catch (error) {
    return handleApiError(error);
  }
}
