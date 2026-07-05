"use client";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = "确认", cancelLabel = "取消", danger = false, onConfirm, onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--color-surface)] rounded-[20px] shadow-[var(--shadow-xl)] w-full max-w-sm mx-4 p-6 animate-fade-up">
        <h2 className="text-[17px] font-semibold tracking-[-0.005em] mb-2">{title}</h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 text-white rounded-full text-[14px] font-medium active:scale-[0.97] transition-all ${
              danger
                ? "bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
                : "bg-[#3b73ff] hover:bg-[#2f64e8]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
