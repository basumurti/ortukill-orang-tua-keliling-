import { useEffect, useRef } from 'react';

interface OverlayEntry {
  id: string;
  onClose: () => void;
}

const overlayStack: OverlayEntry[] = [];
let listenersAttached = false;
let suppressNextPopCount = 0;
let lockedBodyOverflow: string | null = null;

function syncBodyScrollLock() {
  if (typeof document === 'undefined') return;
  if (overlayStack.length > 0) {
    if (lockedBodyOverflow === null) {
      lockedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  } else if (lockedBodyOverflow !== null) {
    document.body.style.overflow = lockedBodyOverflow;
    lockedBodyOverflow = null;
  }
}

function handleGlobalPopState() {
  if (suppressNextPopCount > 0) {
    suppressNextPopCount -= 1;
    return;
  }
  const top = overlayStack[overlayStack.length - 1];
  if (!top) return;

  // Pop entry immediately so close cleanup sees it was closed via Back button
  overlayStack.pop();
  syncBodyScrollLock();
  top.onClose();
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  const top = overlayStack[overlayStack.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopPropagation();
  top.onClose();
}

function ensureGlobalListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('popstate', handleGlobalPopState);
  window.addEventListener('keydown', handleGlobalKeyDown);
  listenersAttached = true;
}

let overlayCounter = 0;

/**
 * Mengunci scroll halaman di belakang modal/sheet, menangani tombol Escape desktop,
 * serta mendaftarkan entri history.pushState agar tombol Kembali perangkat menutup
 * overlay teratas terlebih dahulu dan membersihkan history jika ditutup lewat UI.
 */
export function useOverlayHistory(
  isOpen: boolean,
  onClose: () => void,
  debugName: string = 'overlay'
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const entryIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    ensureGlobalListeners();
    overlayCounter += 1;
    const id = `${debugName}-${overlayCounter}`;
    entryIdRef.current = id;

    overlayStack.push({
      id,
      onClose: () => onCloseRef.current(),
    });
    syncBodyScrollLock();

    let pushedHistory = false;
    try {
      const currentState =
        typeof window.history.state === 'object' && window.history.state !== null
          ? window.history.state
          : {};
      window.history.pushState({ ...currentState, __ortukillOverlayId: id }, '');
      pushedHistory = true;
    } catch {
      pushedHistory = false;
    }

    return () => {
      const idx = overlayStack.findIndex((item) => item.id === id);
      const wasStillInStack = idx !== -1;

      if (wasStillInStack) {
        const isTopOfStack = idx === overlayStack.length - 1;
        overlayStack.splice(idx, 1);
        syncBodyScrollLock();

        // Hapus entri history.pushState jika overlay ditutup via UI / Esc (bukan via tombol Back)
        if (
          pushedHistory &&
          isTopOfStack &&
          typeof window !== 'undefined' &&
          window.history.state?.__ortukillOverlayId === id
        ) {
          suppressNextPopCount += 1;
          try {
            window.history.back();
          } catch {
            suppressNextPopCount = Math.max(0, suppressNextPopCount - 1);
          }
        }
      } else {
        syncBodyScrollLock();
      }

      if (entryIdRef.current === id) {
        entryIdRef.current = null;
      }
    };
  }, [isOpen, debugName]);
}
