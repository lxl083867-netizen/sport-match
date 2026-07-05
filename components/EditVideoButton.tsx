"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EditVideoModal from "./EditVideoModal";

interface Props {
  videoId: string;
  title: string;
  sourceAuthor: string;
  isImported: boolean;
}

export default function EditVideoButton({ videoId, title, sourceAuthor, isImported }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!isImported) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] transition-colors self-center"
      >
        编辑信息
      </button>
      <EditVideoModal
        open={open}
        videoId={videoId}
        initialTitle={title}
        initialAuthor={sourceAuthor}
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
