import { ApiError } from "@/lib/api";
import { assertPlanItemInPlan, assertPlanOwner, assertVideoExists } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

type PlanItemInput = {
  videoId?: unknown;
  order?: unknown;
  note?: unknown;
  repeatCount?: unknown;
};

type PlanInput = {
  title?: unknown;
  description?: unknown;
  targetAudience?: unknown;
  items?: unknown;
};

type AddPlanVideoInput = {
  videoId?: unknown;
  note?: unknown;
  repeatCount?: unknown;
};

type UpdatePlanItemInput = {
  repeatCount?: unknown;
  note?: unknown;
};

const INTERACTION_TYPES = ["like", "favorite", "follow"] as const;
type InteractionType = (typeof INTERACTION_TYPES)[number];

export type ListPlansOptions = {
  userId: string | null;
  page: number;
  limit: number;
  sort: string;
  myOnly: boolean;
};

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTargetAudience(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ApiError(400, "目标人群必须是数组", "INVALID_PARAMS");
  }
  return value;
}

function normalizePlanItems(items: unknown[]) {
  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ApiError(400, "计划项格式不正确", "INVALID_PARAMS");
    }

    const raw = item as PlanItemInput;
    if (typeof raw.videoId !== "string" || raw.videoId.length === 0) {
      throw new ApiError(400, "计划项缺少视频 ID", "INVALID_PARAMS");
    }

    const order = parsePositiveInt(raw.order, index + 1);
    const repeatCount = parsePositiveInt(raw.repeatCount, 1);

    if (order < 1) {
      throw new ApiError(400, "计划项顺序必须是正整数", "INVALID_PARAMS");
    }
    if (repeatCount < 1 || repeatCount > 20) {
      throw new ApiError(400, "重复次数必须在 1 到 20 之间", "INVALID_PARAMS");
    }
    if (raw.note !== undefined && raw.note !== null && typeof raw.note !== "string") {
      throw new ApiError(400, "计划项备注格式不正确", "INVALID_PARAMS");
    }

    return {
      videoId: raw.videoId,
      order,
      note: raw.note || null,
      repeatCount,
    };
  });
}

function parseAudienceJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function assertVideosExist(videoIds: string[]) {
  const uniqueVideoIds = [...new Set(videoIds)];
  const existingVideos = await prisma.video.count({
    where: { id: { in: uniqueVideoIds } },
  });

  if (existingVideos !== uniqueVideoIds.length) {
    throw new ApiError(404, "包含不存在的视频", "NOT_FOUND");
  }
}

function counterField(type: InteractionType) {
  if (type === "like") return "likesCount";
  if (type === "favorite") return "favoritesCount";
  return "followCount";
}

function parseInteractionType(type: unknown): InteractionType {
  if (typeof type !== "string" || !INTERACTION_TYPES.includes(type as InteractionType)) {
    throw new ApiError(400, "无效的互动类型", "INVALID_PARAMS");
  }
  return type as InteractionType;
}

export async function listPlans(options: ListPlansOptions) {
  const orderBy =
    options.sort === "new"
      ? { createdAt: "desc" as const }
      : { likesCount: "desc" as const };

  const where = options.myOnly && options.userId
    ? { userId: options.userId }
    : { isPublic: true };

  const [plans, total] = await Promise.all([
    prisma.trainingPlan.findMany({
      where,
      include: {
        user: { select: { name: true } },
        items: {
          include: {
            video: { select: { id: true, title: true, duration: true, platform: true } },
          },
          orderBy: { order: "asc" },
        },
        _count: { select: { interactions: true } },
      },
      orderBy,
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    }),
    prisma.trainingPlan.count({ where }),
  ]);

  return {
    plans: plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      description: plan.description,
      targetAudience: parseAudienceJson(plan.targetAudience),
      authorName: plan.user.name,
      likesCount: plan.likesCount,
      favoritesCount: plan.favoritesCount,
      followCount: plan.followCount,
      videoCount: plan.items.length,
      totalDuration: plan.items.reduce((sum, item) => sum + (item.video.duration || 0), 0),
      items: plan.items.map((item) => ({
        id: item.video.id,
        title: item.video.title,
        duration: item.video.duration,
        platform: item.video.platform,
        order: item.order,
        note: item.note,
        repeatCount: item.repeatCount,
      })),
      createdAt: plan.createdAt,
    })),
    total,
    page: options.page,
    totalPages: Math.ceil(total / options.limit),
  };
}

export async function createPlan(userId: string, input: PlanInput) {
  const { title, description, targetAudience, items } = input;

  if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
    throw new ApiError(400, "标题为必填且不能超过 200 字", "INVALID_PARAMS");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "至少需要一个视频", "INVALID_PARAMS");
  }

  const audience = parseTargetAudience(targetAudience);
  const normalizedItems = normalizePlanItems(items);
  await assertVideosExist(normalizedItems.map((item) => item.videoId));

  return prisma.trainingPlan.create({
    data: {
      userId,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : null,
      targetAudience: JSON.stringify(audience),
      items: {
        create: normalizedItems,
      },
    },
    include: {
      items: {
        include: { video: { select: { id: true, title: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function updatePlan(userId: string, planId: string, input: PlanInput) {
  await assertPlanOwner(planId, userId);

  const { title, description, targetAudience, items } = input;

  if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
    throw new ApiError(400, "训练名称为必填且不能超过 200 字", "INVALID_PARAMS");
  }

  const audience = parseTargetAudience(targetAudience);

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: {
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : null,
      targetAudience: JSON.stringify(audience),
    },
  });

  if (items !== undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, "计划至少需要一个视频", "INVALID_PARAMS");
    }

    const normalizedItems = normalizePlanItems(items);
    await assertVideosExist(normalizedItems.map((item) => item.videoId));

    await prisma.planItem.deleteMany({ where: { planId } });
    await prisma.planItem.createMany({
      data: normalizedItems.map((item) => ({ ...item, planId })),
    });
  }

  return getPlan(planId, userId);
}

export async function deletePlan(userId: string, planId: string) {
  await assertPlanOwner(planId, userId);
  await prisma.trainingPlan.delete({ where: { id: planId } });
  return { success: true };
}

export async function getPlan(planId: string, currentUserId: string | null) {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    include: {
      user: { select: { id: true, name: true } },
      items: {
        include: {
          video: {
            include: {
              tags: { include: { tag: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!plan) {
    throw new ApiError(404, "计划不存在", "NOT_FOUND");
  }

  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    targetAudience: parseAudienceJson(plan.targetAudience),
    authorName: plan.user.name,
    authorId: plan.user.id,
    isOwner: currentUserId === plan.user.id,
    likesCount: plan.likesCount,
    favoritesCount: plan.favoritesCount,
    followCount: plan.followCount,
    isPublic: plan.isPublic,
    items: plan.items.map((item) => ({
      id: item.id,
      order: item.order,
      note: item.note,
      repeatCount: item.repeatCount,
      video: {
        id: item.video.id,
        title: item.video.title,
        url: item.video.url,
        platform: item.video.platform,
        duration: item.video.duration,
        sourceAuthor: item.video.sourceAuthor,
        tags: item.video.tags.map((videoTag) => ({
          name: videoTag.tag.name,
          category: videoTag.tag.category,
          nameZh: videoTag.tag.nameZh,
        })),
      },
    })),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export async function addVideoToPlan(userId: string, planId: string, input: AddPlanVideoInput) {
  await assertPlanOwner(planId, userId);

  if (typeof input.videoId !== "string" || input.videoId.length === 0) {
    throw new ApiError(400, "缺少视频 ID", "INVALID_PARAMS");
  }
  await assertVideoExists(input.videoId);

  const repeatCount = parsePositiveInt(input.repeatCount, 1);
  if (repeatCount < 1 || repeatCount > 20) {
    throw new ApiError(400, "重复次数必须在 1 到 20 之间", "INVALID_PARAMS");
  }
  if (input.note !== undefined && input.note !== null && typeof input.note !== "string") {
    throw new ApiError(400, "备注格式不正确", "INVALID_PARAMS");
  }

  const lastItem = await prisma.planItem.findFirst({
    where: { planId },
    orderBy: { order: "desc" },
  });
  const nextOrder = (lastItem?.order ?? 0) + 1;

  const item = await prisma.planItem.create({
    data: {
      planId,
      videoId: input.videoId,
      order: nextOrder,
      note: input.note || null,
      repeatCount,
    },
    include: {
      video: { select: { id: true, title: true } },
    },
  });

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: { updatedAt: new Date() },
  });

  return item;
}

export async function deletePlanItem(userId: string, planId: string, itemId: string) {
  await assertPlanOwner(planId, userId);
  await assertPlanItemInPlan(itemId, planId);
  await prisma.planItem.delete({ where: { id: itemId } });
  return { success: true };
}

export async function updatePlanItem(
  userId: string,
  planId: string,
  itemId: string,
  input: UpdatePlanItemInput
) {
  await assertPlanOwner(planId, userId);
  await assertPlanItemInPlan(itemId, planId);

  const data: Record<string, unknown> = {};

  if (input.repeatCount !== undefined) {
    const repeatCount = parsePositiveInt(input.repeatCount, 1);
    if (repeatCount < 1 || repeatCount > 20) {
      throw new ApiError(400, "重复次数必须在 1 到 20 之间", "INVALID_PARAMS");
    }
    data.repeatCount = repeatCount;
  }

  if (input.note !== undefined) {
    if (input.note !== null && typeof input.note !== "string") {
      throw new ApiError(400, "备注格式不正确", "INVALID_PARAMS");
    }
    data.note = input.note || null;
  }

  if (Object.keys(data).length === 0) {
    throw new ApiError(400, "没有可更新的字段", "INVALID_PARAMS");
  }

  return prisma.planItem.update({
    where: { id: itemId },
    data,
  });
}

export async function getPlanInteractions(userId: string | null, planId: string) {
  if (!userId) {
    return { liked: false, favorited: false, followed: false };
  }

  const interactions = await prisma.planInteraction.findMany({
    where: { userId, planId },
    select: { type: true },
  });

  return {
    liked: interactions.some((interaction) => interaction.type === "like"),
    favorited: interactions.some((interaction) => interaction.type === "favorite"),
    followed: interactions.some((interaction) => interaction.type === "follow"),
  };
}

export async function togglePlanInteraction(userId: string, planId: string, type: unknown) {
  const interactionType = parseInteractionType(type);

  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { id: true },
  });
  if (!plan) {
    throw new ApiError(404, "计划不存在", "NOT_FOUND");
  }

  const existing = await prisma.planInteraction.findUnique({
    where: { userId_planId_type: { userId, planId, type: interactionType } },
  });

  const field = counterField(interactionType);

  if (existing) {
    await prisma.planInteraction.delete({ where: { id: existing.id } });
    await prisma.trainingPlan.update({
      where: { id: planId },
      data: { [field]: { decrement: 1 } },
    });
    return { active: false };
  }

  await prisma.planInteraction.create({
    data: { userId, planId, type: interactionType },
  });
  await prisma.trainingPlan.update({
    where: { id: planId },
    data: { [field]: { increment: 1 } },
  });

  return { active: true };
}
