/**
 * Tag display prioritization and relative intensity mapping.
 *
 * Philosophy: show fewer, more meaningful tags. Intensity is relative
 * to the user's fitness level — the same video should read differently
 * for a beginner vs. an experienced athlete.
 */

export interface DisplayTag {
  name: string;
  category: string;
  nameZh: string;
  /** Already adjusted for user experience (intensity only) */
  displayLabel: string;
  confidence?: number;
  evidence?: string;
}

// Categories ordered by display importance (first = most important)
const CATEGORY_PRIORITY: Record<string, number> = {
  type: 0,
  intensity: 1,
  duration: 2,
  goal: 3,
  muscle: 4,
  equipment: 5,
  audience: 6,
  contraindication: 7,
  phase: 8,
};

// Absolute → relative intensity label based on user fitness level
const INTENSITY_MAP: Record<string, Record<string, string>> = {
  beginner: {
    "低强度": "入门强度",
    "中强度": "中等强度",
    "高强度": "有挑战",
  },
  intermediate: {
    "低强度": "轻松",
    "中强度": "中等强度",
    "高强度": "高强度",
  },
  professional: {
    "低强度": "轻松",
    "中强度": "适度",
    "高强度": "高强度",
  },
};

export type FitnessLevel = "beginner" | "intermediate" | "professional";

/**
 * Convert an absolute intensity label to a user-relative one.
 */
export function relativeIntensity(
  absoluteLabel: string,
  fitnessLevel: FitnessLevel | null
): string {
  if (!fitnessLevel) return absoluteLabel;
  return INTENSITY_MAP[fitnessLevel]?.[absoluteLabel] ?? absoluteLabel;
}

/**
 * Sort and limit tags for display.
 * - Intensity is converted to relative label when user level is known
 * - Contraindication tags are pushed to the end (safety info, less browsable)
 * - Returns at most `limit` tags
 */
export function prioritizeTags(
  tags: Array<{ name: string; category: string; nameZh: string; confidence?: number; evidence?: string }>,
  fitnessLevel: FitnessLevel | null,
  limit = 4
): DisplayTag[] {
  const sorted = [...tags].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category] ?? 99;
    const pb = CATEGORY_PRIORITY[b.category] ?? 99;
    if (pa !== pb) return pa - pb;
    // Within same category, higher confidence first
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  return sorted.slice(0, limit).map((t) => ({
    ...t,
    displayLabel:
      t.category === "intensity"
        ? relativeIntensity(t.nameZh, fitnessLevel)
        : t.nameZh,
  }));
}

/**
 * Color mapping for tag categories (used in TagBadge).
 */
export const categoryColorMap: Record<string, "green" | "blue" | "orange" | "red" | "purple" | "lime" | "coral" | "default"> = {
  goal: "orange",
  muscle: "blue",
  type: "purple",
  phase: "purple",
  intensity: "default",
  contraindication: "red",
  equipment: "green",
  audience: "blue",
  duration: "lime",
};
