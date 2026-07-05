import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { err, handleApiError } from "@/lib/responses";

const FITNESS_LEVELS = ["beginner", "intermediate", "professional"] as const;
const AVAILABLE_TIMES = ["15", "30", "60"] as const;
type FitnessLevel = (typeof FITNESS_LEVELS)[number];
type AvailableTime = (typeof AVAILABLE_TIMES)[number];

function isFitnessLevel(value: unknown): value is FitnessLevel {
  return typeof value === "string" && (FITNESS_LEVELS as readonly string[]).includes(value);
}

function isAvailableTime(value: unknown): value is AvailableTime {
  return typeof value === "string" && (AVAILABLE_TIMES as readonly string[]).includes(value);
}

function parseStringArray(value: unknown, fieldName: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组`);
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export async function GET() {
  try {
    const userId = await requireUser();

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    return NextResponse.json(profile);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const { goals, fitnessLevel, bodyConditions, equipment, availableTime, contraindications } =
      await req.json();

    let normalizedGoals: string[];
    let normalizedBodyConditions: string[];
    let normalizedEquipment: string[];
    let normalizedContraindications: string[];

    try {
      normalizedGoals = parseStringArray(goals, "goals");
      normalizedBodyConditions = parseStringArray(bodyConditions, "bodyConditions");
      normalizedEquipment = parseStringArray(equipment, "equipment");
      normalizedContraindications = parseStringArray(contraindications, "contraindications");
    } catch (error) {
      return err(400, error instanceof Error ? error.message : "画像参数格式不正确", "INVALID_PARAMS");
    }

    const normalizedFitnessLevel = isFitnessLevel(fitnessLevel)
      ? fitnessLevel
      : "beginner";
    const normalizedAvailableTime = isAvailableTime(availableTime)
      ? availableTime
      : "30";

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        goals: JSON.stringify(normalizedGoals),
        fitnessLevel: normalizedFitnessLevel,
        bodyConditions: JSON.stringify(normalizedBodyConditions),
        equipment: JSON.stringify(normalizedEquipment),
        availableTime: normalizedAvailableTime,
        contraindications: JSON.stringify(normalizedContraindications),
      },
      create: {
        userId,
        goals: JSON.stringify(normalizedGoals),
        fitnessLevel: normalizedFitnessLevel,
        bodyConditions: JSON.stringify(normalizedBodyConditions),
        equipment: JSON.stringify(normalizedEquipment),
        availableTime: normalizedAvailableTime,
        contraindications: JSON.stringify(normalizedContraindications),
      },
    });

    return NextResponse.json(profile);
  } catch (e) {
    return handleApiError(e);
  }
}
