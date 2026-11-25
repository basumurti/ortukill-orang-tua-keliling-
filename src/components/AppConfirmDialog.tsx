import React from 'react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';
import { useOverlayHistory } from '../utils/useOverlayHistory';

export interface AppConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export const AppConfirmDialog: React.FC<AppConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  useOverlayHistory(isOpen, onCancel, 'app-confirm-dialog');

  if (!isOpen) return null;

  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? AlertTriangle : Info;

  const iconBoxClasses =
    variant === 'danger'
      ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/35'
      : variant === 'warning'
      ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/35'
      : 'bg-blue-50 text-[#2563EB] border-blue-200 dark:bg-purple-500/15 dark:text-[#C084FC] dark:border-purple-500/40';

  const confirmBtnClasses =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-confirm-dialog-title"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
    >
      <div className="fixed inset-0" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
        {/* Handle + Header */}
        <div className="px-4 sm:px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBoxClasses}`}>
                <Icon className="w-4 h-4" />
              </div>
              <h3 id="app-confirm-dialog-title" className="font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F4F4F6] leading-snug break-words">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Tutup dialog"
              className="min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center text-slate-500 hover:text-[#0F172A] hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-[#F4F4F6] dark:hover:bg-[#2E2E37] transition-colors active:scale-[0.97] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
          {description}
        </div>

        {/* Sticky Footer: Batal di kiri, Aksi di kanan */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-zinc-200 font-bold text-xs sm:text-sm transition-colors active:scale-[0.97] cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors active:scale-[0.97] cursor-pointer disabled:opacity-50 ${confirmBtnClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
