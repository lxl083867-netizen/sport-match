"use client";

import { useState } from "react";
import PlanWorkout from "./PlanWorkout";
import posthog from "posthog-js";

interface Props {
  video: {
    id: string;
    title: string;
    url: string;
    platform: string;
    duration: number | null;
    sourceAuthor: string;
  };
}

export default function SoloWorkout({ video }: Props) {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <PlanWorkout
        items={[{ id: "solo", order: 1, note: "main", repeatCount: 1, video }]}
        onClose={() => setActive(false)}
      />
    );
  }

  return (
    <button
      onClick={() => { posthog.capture("workout_started", { source: "solo", video_id: video.id }); setActive(true); }}
      className="flex items-center gap-2 px-5 py-2.5 bg-[#3b73ff] hover:bg-[#2f64e8] active:bg-[#2952c4] text-white font-medium rounded-full transition-all active:scale-[0.97] text-[14px]"
    >
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
      </svg>
      开始跟练
    </button>
  );
}
