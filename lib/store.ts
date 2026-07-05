"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  tagTheme: "colorful" | "mono";
  setTagTheme: (theme: "colorful" | "mono") => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      tagTheme: "colorful",
      setTagTheme: (theme) => set({ tagTheme: theme }),
    }),
    { name: "sport-match-ui" },
  ),
);
