import React from 'react';
import { Button, Modal } from '@heroui/react';
import { AlertTriangle, Trash2, Info } from 'lucide-react';
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

  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? AlertTriangle : Info;

  const iconBoxClasses =
    variant === 'danger'
      ? 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/25'
      : variant === 'warning'
      ? 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)] border-[var(--warning)]/35'
      : 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/25';

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isProcessing) onCancel();
      }}
      variant="opaque"
      isDismissable={!isProcessing}
      className="z-[100010]"
    >
        <Modal.Container placement="auto" size="sm" className="p-0 sm:p-4">
          <Modal.Dialog className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full">
            {/* Drag Handle Indicator on Mobile */}
            <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />

            {/* Header */}
            <Modal.Header className="px-4 sm:px-5 pt-2.5 sm:pt-4 pb-3 border-b border-[var(--border)] flex-row items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-10">
                <Modal.Icon className={`w-9 h-9 rounded-xl border ${iconBoxClasses}`}>
                  <Icon className="w-4 h-4" />
                </Modal.Icon>
                <Modal.Heading
                  id="app-confirm-dialog-title"
                  className="font-bold text-sm sm:text-base text-[var(--foreground)] leading-snug break-words"
                >
                  {title}
                </Modal.Heading>
              </div>
              <Modal.CloseTrigger
                aria-label="Tutup dialog"
                isDisabled={isProcessing}
                className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
              />
            </Modal.Header>

            {/* Body */}
            <Modal.Body className="!mt-0 px-4 sm:px-5 py-4 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              {description}
            </Modal.Body>

            {/* Sticky Footer: Batal di kiri, Aksi di kanan */}
            <Modal.Footer className="!mt-0 px-4 sm:px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                fullWidth
                isDisabled={isProcessing}
                onPress={onCancel}
                className="flex-1 min-h-[44px] rounded-xl font-bold text-xs sm:text-sm bg-[var(--surface)]"
              >
                {cancelLabel}
              </Button>
              <Button
                variant={variant === 'danger' ? 'danger' : 'primary'}
                fullWidth
                isDisabled={isProcessing}
                onPress={onConfirm}
                className={`flex-1 min-h-[44px] rounded-xl font-bold text-xs sm:text-sm ${
                  variant === 'warning'
                    ? 'bg-[var(--warning)] text-[var(--warning-foreground)] hover:opacity-90'
                    : ''
                }`}
              >
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
  );
};
