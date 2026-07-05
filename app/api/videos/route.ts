import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/responses";
import { importVideo, listVideos } from "@/lib/services/video-service";

function parsePage(value: string | null) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "12", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 12;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const result = await importVideo(userId, await req.json());
    return NextResponse.json(result, { status: result.existed ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await listVideos({
      tag: searchParams.get("tag"),
      platform: searchParams.get("platform"),
      search: searchParams.get("search"),
      page: parsePage(searchParams.get("page")),
      limit: parseLimit(searchParams.get("limit")),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
