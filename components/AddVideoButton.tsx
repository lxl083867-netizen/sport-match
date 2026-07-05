"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import AddVideoModal from "./AddVideoModal";

export default function AddVideoButton() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <>
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 bg-[#1d1d1f] text-white text-[14px] font-medium shadow-[var(--shadow-lg)] animate-fade-up"
          style={{ borderRadius: "var(--radius-full)" }}>
          {toast}
        </div>
      )}

      <button
        onClick={() => setShowModal(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#6C57FF] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_12px_24px_rgba(108,87,255,0.22)] transition-all hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98] sm:px-5 sm:py-3 sm:text-[14px]"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        导入视频
      </button>

      <AddVideoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onAdded={(video, existed) => {
          if (existed) {
            showToast(`"${video.title.slice(0, 20)}..." 已导入过`);
          }
          router.refresh();
        }}
      />
    </>
  );
}
