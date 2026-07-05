import { auth } from "./auth";
import { prisma } from "./prisma";
import { ApiError } from "./api";

export async function requireUser(): Promise<string> {
  const session = await auth();
  const userId = session?.user ? (session.user as { id?: string }).id : null;

  if (!userId) {
    throw new ApiError(401, "请先登录", "UNAUTHORIZED");
  }

  return userId;
}

export async function assertPlanOwner(planId: string, userId: string) {
  if (!planId || typeof planId !== "string") {
    throw new ApiError(400, "缺少计划 ID", "INVALID_PARAMS");
  }

  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { id: true, userId: true },
  });

  if (!plan) {
    throw new ApiError(404, "计划不存在", "NOT_FOUND");
  }

  if (plan.userId !== userId) {
    throw new ApiError(403, "只能操作自己创建的计划", "FORBIDDEN");
  }

  return plan;
}

export async function assertVideoExists(videoId: string) {
  if (!videoId || typeof videoId !== "string") {
    throw new ApiError(400, "缺少视频 ID", "INVALID_PARAMS");
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true },
  });

  if (!video) {
    throw new ApiError(404, "视频不存在", "NOT_FOUND");
  }

  return video;
}

export async function assertVideoImported(videoId: string, userId: string) {
  await assertVideoExists(videoId);

  const userVideo = await prisma.userVideo.findUnique({
    where: { userId_videoId: { userId, videoId } },
  });

  if (!userVideo) {
    throw new ApiError(403, "你尚未导入此视频", "FORBIDDEN");
  }

  return userVideo;
}

export async function assertVideoOwner(videoId: string, userId: string) {
  if (!videoId || typeof videoId !== "string") {
    throw new ApiError(400, "缺少视频 ID", "INVALID_PARAMS");
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, userId: true },
  });

  if (!video) {
    throw new ApiError(404, "视频不存在", "NOT_FOUND");
  }

  if (video.userId !== userId) {
    throw new ApiError(403, "只能编辑自己原始导入的视频", "FORBIDDEN");
  }

  return video;
}

export async function assertPlanItemInPlan(itemId: string, planId: string) {
  if (!itemId || typeof itemId !== "string") {
    throw new ApiError(400, "缺少计划项 ID", "INVALID_PARAMS");
  }

  const item = await prisma.planItem.findUnique({
    where: { id: itemId },
    select: { id: true, planId: true },
  });

  if (!item || item.planId !== planId) {
    throw new ApiError(404, "计划项不存在", "NOT_FOUND");
  }

  return item;
}
