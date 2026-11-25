import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Printer,
  Share2,
  X,
  CheckCircle2,
  MessageSquare,
  Download,
  Loader2,
  Ban,
  Trash2,
  AlertTriangle,
  Copy,
  CheckCheck,
  MoreHorizontal,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { TransactionReceipt, BrandConfig } from '../types';
import { formatRupiah } from '../services/storageService';
import { useOverlayHistory } from '../utils/useOverlayHistory';

interface ReceiptModalProps {
  receipt: TransactionReceipt | null;
  brand: BrandConfig;
  isOpen: boolean;
  onClose: () => void;
  onNewTransaction?: () => void;
  onVoidTransaction?: (id: string, reason: string) => void;
  onDeleteTransaction?: (id: string) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
}

interface PreRenderedReceiptAsset {
  key: string;
  blob: Blob;
  file: File;
  objectUrl: string;
}

function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(ua);
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  brand,
  isOpen,
  onClose,
  onNewTransaction,
  onVoidTransaction,
  onDeleteTransaction,
  onShowToast,
}) => {
  const [copiedPng, setCopiedPng] = useState(false);
  const [pngStatus, setPngStatus] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLongPressSheet, setShowLongPressSheet] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);
  const preRenderedRef = useRef<PreRenderedReceiptAsset | null>(null);
  const voidReasonInputRef = useRef<HTMLInputElement>(null);
  const renderRunIdRef = useRef(0);

  // History Back + Body Scroll Lock for Receipt and its nested sheets (LIFO stack)
  useOverlayHistory(isOpen && !!receipt, onClose, 'receipt-modal');
  useOverlayHistory(showMoreMenu, () => setShowMoreMenu(false), 'receipt-more-menu');
  useOverlayHistory(showLongPressSheet, () => setShowLongPressSheet(false), 'receipt-long-press-sheet');
  useOverlayHistory(showVoidConfirm, () => setShowVoidConfirm(false), 'receipt-void-confirm');
  useOverlayHistory(showDeleteConfirm, () => setShowDeleteConfirm(false), 'receipt-delete-confirm');

  const notifyUser = useCallback(
    (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (onShowToast) {
        onShowToast(msg, type, 4000);
      } else {
        setLocalNotice(msg);
        window.setTimeout(() => {
          setLocalNotice((prev) => (prev === msg ? null : prev));
        }, 4000);
      }
    },
    [onShowToast]
  );

  // Auto-focus void reason input when Void sheet opens
  useEffect(() => {
    if (showVoidConfirm) {
      const timer = window.setTimeout(() => {
        voidReasonInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [showVoidConfirm]);

  // Reset nested overlays when receipt closes
  useEffect(() => {
    if (!isOpen) {
      setShowMoreMenu(false);
      setShowLongPressSheet(false);
      setShowVoidConfirm(false);
      setShowDeleteConfirm(false);
      setCopiedPng(false);
      setLocalNotice(null);
    }
  }, [isOpen]);

  const revokePreRenderedAsset = useCallback(() => {
    if (preRenderedRef.current?.objectUrl) {
      try {
        URL.revokeObjectURL(preRenderedRef.current.objectUrl);
      } catch {
        // ignore
      }
    }
    preRenderedRef.current = null;
  }, []);

  const generateCanvasBlobFallback = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!receipt) return resolve(null);
      try {
        const canvas = document.createElement('canvas');
        const width = 420;
        const padding = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        const dynamicHeight = 400 + receipt.items.length * 44;
        canvas.width = width;
        canvas.height = dynamicHeight;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, dynamicHeight);

        ctx.fillStyle = '#0c0a09';
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(brand.NAME || 'ORTUKILL POS', width / 2, 40);

        ctx.font = '12px monospace';
        ctx.fillStyle = '#44403c';
        ctx.fillText(brand.SUBTITLE || 'POS / KASIR', width / 2, 60);
        ctx.fillText(brand.DESCRIPTION_1 || '', width / 2, 78);
        ctx.fillText(`WA: ${brand.PHONE || ''}`, width / 2, 96);

        ctx.strokeStyle = '#cbd5e1';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding, 110);
        ctx.lineTo(width - padding, 110);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.font = '11px monospace';
        ctx.fillStyle = '#334155';
        let y = 132;
        ctx.fillText(`No. Nota : ${receipt.id}`, padding, y);
        y += 18;
        ctx.fillText(`Waktu    : ${receipt.transactionDate}`, padding, y);
        y += 18;
        ctx.fillText(`Metode   : ${receipt.paymentMethod}`, padding, y);
        if (receipt.customerName) {
          y += 18;
          ctx.fillText(`Customer : ${receipt.customerName}`, padding, y);
        }

        y += 14;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        y += 22;

        const regularCanvasItems = receipt.items.filter(
          (i) => i.price >= 0 && !String(i.sku || '').toUpperCase().includes('PROMO')
        );
        const itemsForCanvas = regularCanvasItems.length > 0 ? regularCanvasItems : receipt.items;

        itemsForCanvas.forEach((item) => {
          const itemSubtotal = item.total ?? item.subtotal ?? item.qty * item.price;
          ctx.textAlign = 'left';
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(item.name, padding, y);
          y += 16;
          ctx.font = '11px monospace';
          ctx.fillStyle = '#64748b';
          ctx.fillText(`${item.qty} x ${formatRupiah(item.price)}`, padding, y);
          ctx.textAlign = 'right';
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(formatRupiah(itemSubtotal), width - padding, y);
          y += 22;
        });

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        y += 20;

        ctx.textAlign = 'left';
        ctx.font = '11px monospace';
        ctx.fillStyle = '#475569';
        ctx.fillText(`Total Item: ${receipt.totalQty} botol`, padding, y);
        y += 18;

        if (receipt.discount > 0) {
          ctx.fillText(`Subtotal`, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(formatRupiah(receipt.subtotal), width - padding, y);
          y += 18;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#dc2626';
          const promoLabel = receipt.promoName ? `Diskon (${receipt.promoName})` : 'Diskon';
          ctx.fillText(promoLabel.length > 28 ? promoLabel.slice(0, 26) + '..' : promoLabel, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(`-${formatRupiah(receipt.discount)}`, width - padding, y);
          y += 18;
        }

        if (receipt.shippingFee && receipt.shippingFee > 0) {
          ctx.textAlign = 'left';
          ctx.fillStyle = '#ea580c';
          ctx.fillText(`Ongkir`, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(`+${formatRupiah(receipt.shippingFee)}`, width - padding, y);
          y += 18;
        }

        ctx.strokeStyle = '#0f172a';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        y += 24;

        ctx.textAlign = 'left';
        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = '#020617';
        ctx.fillText(`TOTAL AKHIR`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(formatRupiah(receipt.total), width - padding, y);
        y += 24;

        if (receipt.paymentMethod === 'CASH' && receipt.cashReceived) {
          ctx.font = '11px monospace';
          ctx.fillStyle = '#475569';
          ctx.textAlign = 'left';
          ctx.fillText(`Uang Diterima`, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(formatRupiah(receipt.cashReceived), width - padding, y);
          y += 18;
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#059669';
          ctx.textAlign = 'left';
          ctx.fillText(`Kembalian`, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(formatRupiah(receipt.cashChange || 0), width - padding, y);
          y += 24;
        }

        ctx.textAlign = 'center';
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`***SELAMAT BERSENANG-SENANG BESOK MINUM LAGIII!!***`, width / 2, y);
        y += 16;
        ctx.font = '9px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`JANGAN LUPA BINTANG 5 DI GOOGLE MAPS YAA.`, width / 2, y);
        y += 14;
        ctx.fillText(`••• ATLAS AMER KEDIRI •••`, width / 2, y);

        canvas.toBlob((b) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });
  }, [receipt, brand]);

  const receiptRenderKey = receipt
    ? `${receipt.id}|${receipt.total}|${receipt.status}|${receipt.items.length}|${receipt.discount}|${receipt.shippingFee || 0}|${receipt.customerName || ''}`
    : '';

  const prepareReceiptPng = useCallback(async () => {
    if (!isOpen || !receipt) return;
    const runId = ++renderRunIdRef.current;
    setPngStatus('preparing');

    try {
      if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        await (document as any).fonts.ready.catch(() => undefined);
      }
      if (runId !== renderRunIdRef.current) return;

      let blob: Blob | null = null;

      if (receiptRef.current) {
        try {
          const toPngOpts = {
            cacheBust: true,
            pixelRatio: 2.5,
            backgroundColor: '#ffffff',
            skipFonts: true,
            fontEmbedCSS: '',
          };
          // Khusus Safari: panggil toPng dua kali agar SVG foreignObject ter-render bersih
          if (isSafariBrowser()) {
            await toPng(receiptRef.current, toPngOpts);
          }
          const dataUrl = await toPng(receiptRef.current, toPngOpts);
          const res = await fetch(dataUrl);
          blob = await res.blob();
        } catch (err) {
          console.warn('toPng pre-render failed, using canvas fallback:', err);
        }
      }

      if (!blob) {
        blob = await generateCanvasBlobFallback();
      }

      if (runId !== renderRunIdRef.current) return;

      if (!blob) {
        setPngStatus('error');
        return;
      }

      const file = new File([blob], `Struk_${receipt.id}.png`, { type: 'image/png' });
      const objectUrl = URL.createObjectURL(blob);

      revokePreRenderedAsset();
      preRenderedRef.current = {
        key: receiptRenderKey,
        blob,
        file,
        objectUrl,
      };
      setPngStatus('ready');
    } catch (err) {
      console.error('Pre-render receipt PNG failed:', err);
      if (runId === renderRunIdRef.current) {
        setPngStatus('error');
      }
    }
  }, [isOpen, receipt, receiptRenderKey, generateCanvasBlobFallback, revokePreRenderedAsset]);

  // Trigger background pre-render as soon as receipt opens or changes
  useEffect(() => {
    if (!isOpen || !receipt) {
      revokePreRenderedAsset();
      setPngStatus('idle');
      return;
    }

    let cancelled = false;
    let idleId: number | undefined;
    let timerId: number | undefined;

    const scheduleRender = () => {
      if (!cancelled) {
        void prepareReceiptPng();
      }
    };

    if (typeof (window as any).requestIdleCallback === 'function') {
      idleId = (window as any).requestIdleCallback(scheduleRender, { timeout: 350 });
    } else {
      timerId = window.setTimeout(scheduleRender, 60);
    }

    return () => {
      cancelled = true;
      renderRunIdRef.current += 1;
      if (idleId !== undefined && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [isOpen, receiptRenderKey, prepareReceiptPng, revokePreRenderedAsset]);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      revokePreRenderedAsset();
    };
  }, [revokePreRenderedAsset]);

  if (!isOpen || !receipt) return null;

  const handleConfirmVoid = () => {
    if (onVoidTransaction && receipt) {
      onVoidTransaction(receipt.id, voidReason || 'Dibatalkan oleh kasir');
      setShowVoidConfirm(false);
      setVoidReason('');
      onClose();
    }
  };

  const handleConfirmDelete = () => {
    if (onDeleteTransaction && receipt) {
      onDeleteTransaction(receipt.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getWhatsAppShareText = () => {
    const regularItems = receipt.items.filter(
      (i) => i.price >= 0 && !String(i.sku || '').toUpperCase().includes('PROMO')
    );
    const itemsToDisplay = regularItems.length > 0 ? regularItems : receipt.items;

    const itemLines = itemsToDisplay
      .map((i) => {
        const itemSubtotal = i.total ?? i.subtotal ?? i.qty * i.price;
        const isPromo = i.price < 0 || String(i.sku || '').toUpperCase().includes('PROMO');
        if (isPromo) {
          return `• [PROMO] ${i.name} (SKU: ${i.sku})\n  ${i.qty} x -${formatRupiah(Math.abs(i.price))} = -${formatRupiah(Math.abs(itemSubtotal))}`;
        }
        return `• ${i.name}\n  ${i.qty} x ${formatRupiah(i.price)} = ${formatRupiah(itemSubtotal)}`;
      })
      .join('\n');

    return encodeURIComponent(
      `*STRUK PEMBELIAN - ${brand.NAME}*\n` +
        `${brand.DESCRIPTION_1}\n` +
        `--------------------------------\n` +
        `No. Struk: ${receipt.id}\n` +
        `Waktu: ${receipt.transactionDate}\n` +
        `Metode: ${receipt.paymentMethod}\n` +
        (receipt.customerName ? `Pelanggan: ${receipt.customerName}\n` : '') +
        `--------------------------------\n` +
        `${itemLines}\n` +
        `--------------------------------\n` +
        (receipt.discount > 0
          ? `Subtotal: ${formatRupiah(receipt.subtotal)}\nPromo/Diskon: -${formatRupiah(receipt.discount)}${receipt.promoName ? ` (${receipt.promoName})` : ''}\n`
          : '') +
        (receipt.shippingFee && receipt.shippingFee > 0
          ? `Ongkir: +${formatRupiah(receipt.shippingFee)}\n`
          : '') +
        `*TOTAL: ${formatRupiah(receipt.total)}*\n` +
        (receipt.paymentMethod === 'CASH' && receipt.cashReceived
          ? `Tunai: ${formatRupiah(receipt.cashReceived)}\nKembalian: ${formatRupiah(receipt.cashChange || 0)}\n`
          : '') +
        `--------------------------------\n` +
        `TERIMAKASIH SELAMAT-BERSENANG-SENANG * ATLAS AMER KEDIRI SIAP SEDIA Melayani Setiap Kebutuhan Minum Kamu.\n` +
        `WA/Info: ${brand.PHONE}`
    );
  };

  const handleShareWA = () => {
    const text = getWhatsAppShareText();
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // SYNCHRONOUS clipboard write from pre-rendered ref (preserves iOS Safari user activation)
  const handleCopyImage = () => {
    const asset = preRenderedRef.current;
    if (!asset || asset.key !== receiptRenderKey) {
      if (pngStatus === 'error') {
        void prepareReceiptPng();
        notifyUser('Menyiapkan ulang gambar struk...', 'info');
      } else {
        notifyUser('Gambar struk masih disiapkan...', 'info');
      }
      return;
    }

    if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem !== 'undefined') {
      try {
        const clipboardItem = new ClipboardItem({ 'image/png': asset.blob });
        navigator.clipboard
          .write([clipboardItem])
          .then(() => {
            setCopiedPng(true);
            window.setTimeout(() => setCopiedPng(false), 3000);
            notifyUser('Gambar disalin - tempel di chat', 'success');
          })
          .catch(() => {
            setShowLongPressSheet(true);
          });
        return;
      } catch {
        setShowLongPressSheet(true);
        return;
      }
    }

    setShowLongPressSheet(true);
  };

  // SYNCHRONOUS navigator.share from pre-rendered File (feature detection via canShare)
  const handleShareImage = () => {
    const asset = preRenderedRef.current;
    if (!asset || asset.key !== receiptRenderKey) {
      if (pngStatus === 'error') {
        void prepareReceiptPng();
        notifyUser('Menyiapkan ulang gambar struk...', 'info');
      } else {
        notifyUser('Gambar struk masih disiapkan...', 'info');
      }
      return;
    }

    const canNativeShareFiles =
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      (() => {
        try {
          return navigator.canShare({ files: [asset.file] });
        } catch {
          return false;
        }
      })();

    if (canNativeShareFiles) {
      navigator
        .share({
          files: [asset.file],
          title: `Struk ${receipt.id}`,
        })
        .catch((err: any) => {
          if (err?.name === 'AbortError') return;
          handleCopyImage();
        });
      return;
    }

    handleCopyImage();
  };

  // Manual download for Android/Desktop from menu Lainnya or fallback sheet (never auto-download on iPhone)
  const handleManualDownloadImage = () => {
    const asset = preRenderedRef.current;
    if (!asset || asset.key !== receiptRenderKey) {
      notifyUser('Gambar struk masih disiapkan...', 'info');
      return;
    }
    if (isIosDevice()) {
      setShowMoreMenu(false);
      setShowLongPressSheet(true);
      return;
    }
    const link = document.createElement('a');
    link.download = `Struk_${receipt.id}.png`;
    link.href = asset.objectUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowMoreMenu(false);
    notifyUser('Gambar struk diunduh', 'success');
  };

  const handlePrimaryNewTransaction = () => {
    if (onNewTransaction) {
      onNewTransaction();
    } else {
      onClose();
    }
  };

  const isPreparingPng = pngStatus === 'preparing' || pngStatus === 'idle';
  const isVoided = receipt.status === 'VOIDED';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Struk ${receipt.id}`}
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
    >
      <div className="fixed inset-0 hidden sm:block" onClick={onClose} aria-hidden="true" />

      <div
        id="receipt-modal-card"
        className="relative z-10 w-full h-dvh sm:h-auto sm:max-h-[90dvh] sm:max-w-sm bg-white dark:bg-[#1B1B20] sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
      >
        {/* ZONA 1 (ATAS TETAP): Status + Nomor Nota + Total + Menu Lainnya + Tutup */}
        <div className="px-4 pt-safe pb-3 pt-3 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isVoided
                    ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                }`}
              >
                {isVoided ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-extrabold text-[#0F172A] dark:text-[#F4F4F6] truncate">
                    {isVoided ? 'Nota Dibatalkan' : 'Transaksi Berhasil'}
                  </span>
                  <span className="text-xs font-black font-mono text-[#2563EB] dark:text-[#C084FC] num-tabular shrink-0">
                    · {formatRupiah(receipt.total)}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                  #{receipt.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                id="btn-receipt-more"
                onClick={() => setShowMoreMenu(true)}
                aria-label="Menu opsi struk lainnya"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white hover:bg-slate-100 border border-slate-200 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] dark:border-[#343440] flex items-center justify-center text-slate-600 dark:text-zinc-300 transition-colors active:scale-[0.97] cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup struk"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white hover:bg-slate-100 border border-slate-200 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] dark:border-[#343440] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] transition-colors active:scale-[0.97] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {localNotice && (
            <div className="mt-2 bg-slate-900 dark:bg-[#1B1B20] border border-slate-700 dark:border-purple-500/40 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-between gap-2">
              <span className="truncate">{localNotice}</span>
              <button
                type="button"
                onClick={() => setLocalNotice(null)}
                aria-label="Tutup pesan"
                className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ZONA 2 (TENGAH — SATU-SATUNYA AREA SCROLL): Kertas Struk Thermal (Format & Isi Tetap Utuh) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-4 bg-slate-100 dark:bg-[#121215]">
          <div className="w-full max-w-sm mx-auto">
            <div
              ref={receiptRef}
              id="thermal-receipt-container"
              className="w-full bg-white text-stone-900 p-5 rounded-2xl shadow-sm font-mono text-xs border border-stone-200 select-all space-y-3"
            >
              {/* Header */}
              <div className="text-center pb-3 border-b border-dashed border-stone-300">
                <div className="font-black text-base tracking-wider uppercase text-stone-950">
                  {brand.NAME}
                </div>
                <p className="text-[11px] font-bold text-stone-600 mt-0.5">{brand.SUBTITLE}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">{brand.DESCRIPTION_1}</p>
                <p className="text-[10px] text-stone-800 font-bold mt-1">WA: {brand.PHONE}</p>
              </div>

              {/* Meta */}
              <div className="py-2 border-b border-dashed border-stone-300 space-y-1 text-[11px] text-stone-600">
                <div className="flex justify-between gap-2">
                  <span>No. Nota</span>
                  <span className="font-bold text-stone-900 text-right">{receipt.id}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Waktu</span>
                  <span className="text-right">{receipt.transactionDate}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Metode</span>
                  <span className="font-bold px-1.5 py-0.2 rounded-md bg-stone-100 text-stone-900">
                    {receipt.paymentMethod}
                  </span>
                </div>
                {receipt.customerName && (
                  <div className="flex justify-between gap-2">
                    <span>Pelanggan</span>
                    <span className="font-semibold text-stone-900 text-right">{receipt.customerName}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="py-2 border-b border-dashed border-stone-300 space-y-1.5">
                {(() => {
                  const regularItems = receipt.items.filter(
                    (item) => item.price >= 0 && !String(item.sku || '').toUpperCase().includes('PROMO')
                  );
                  const itemsToDisplay = regularItems.length > 0 ? regularItems : receipt.items;
                  return itemsToDisplay.map((item, idx) => {
                    const itemSubtotal = item.total ?? item.subtotal ?? item.qty * item.price;
                    const isPromo = item.price < 0 || String(item.sku || '').toUpperCase().includes('PROMO');
                    return (
                      <div key={idx} className={`space-y-0.5 ${isPromo ? 'text-rose-600' : ''}`}>
                        <div
                          className={`font-semibold leading-tight flex items-center justify-between gap-2 ${
                            isPromo ? 'text-rose-600' : 'text-stone-900'
                          }`}
                        >
                          <span>
                            {item.name} {isPromo ? '(PROMO)' : ''}
                          </span>
                          {isPromo && (
                            <span className="text-[9px] font-mono text-rose-500 font-normal shrink-0">
                              SKU: {item.sku}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between text-stone-500 text-[11px]">
                          <span className={isPromo ? 'text-rose-600 font-medium' : ''}>
                            {item.qty} x {isPromo ? `-${formatRupiah(Math.abs(item.price))}` : formatRupiah(item.price)}
                          </span>
                          <span
                            className={`font-bold tabular-nums text-right ${
                              isPromo ? 'text-rose-600 font-mono' : 'text-stone-900'
                            }`}
                          >
                            {isPromo ? `-${formatRupiah(Math.abs(itemSubtotal))}` : formatRupiah(itemSubtotal)}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Totals */}
              <div className="py-2 border-b border-dashed border-stone-300 space-y-1 text-[11px]">
                <div className="flex justify-between text-stone-500">
                  <span>Total Item</span>
                  <span className="tabular-nums text-right">{receipt.totalQty} botol</span>
                </div>
                {receipt.discount > 0 && (
                  <>
                    <div className="flex justify-between text-stone-500">
                      <span>Subtotal</span>
                      <span className="tabular-nums text-right">{formatRupiah(receipt.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Diskon {receipt.promoName ? `(${receipt.promoName})` : ''}</span>
                      <span className="tabular-nums text-right">-{formatRupiah(receipt.discount)}</span>
                    </div>
                  </>
                )}
                {receipt.shippingFee && receipt.shippingFee > 0 && (
                  <div className="flex justify-between text-[#FF5E36] font-semibold">
                    <span>Ongkir (Pengiriman)</span>
                    <span className="tabular-nums text-right">+{formatRupiah(receipt.shippingFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black pt-1.5 text-stone-950 border-t border-stone-200">
                  <span>TOTAL AKHIR</span>
                  <span className="tabular-nums text-right">{formatRupiah(receipt.total)}</span>
                </div>

                {receipt.paymentMethod === 'CASH' && receipt.cashReceived !== undefined && (
                  <>
                    <div className="flex justify-between text-stone-600 pt-1">
                      <span>Uang Diterima</span>
                      <span className="tabular-nums text-right">{formatRupiah(receipt.cashReceived)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-700">
                      <span>Kembalian</span>
                      <span className="tabular-nums text-right">{formatRupiah(receipt.cashChange || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="text-center pt-2 text-[10px] text-stone-500 space-y-0.5">
                <p className="font-bold text-stone-800">***SELAMAT BERSENANG-SENANG BESOK MINUM LAGIII!!***</p>
                <p>JANGAN LUPA BINTANG 5 DI GOOGLE MAPS YAA.</p>
                <p className="text-[9px] text-stone-400">••• ATLAS AMER KEDIRI ••• </p>
              </div>
            </div>
          </div>
        </div>

        {/* ZONA 3 (BAWAH MENEMPEL, SAFE AREA): Baris 1 (3 tombol sama besar) + Baris 2 (Transaksi Baru penuh) */}
        <div className="px-3.5 sm:px-4 pt-3 pb-safe bg-white dark:bg-[#1B1B20] border-t border-slate-200 dark:border-[#2B2B33] shrink-0 space-y-2">
          {pngStatus === 'error' && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/15 dark:border-red-500/35 text-xs">
              <span className="font-semibold text-red-700 dark:text-red-300 truncate">
                Gagal menyiapkan gambar struk
              </span>
              <button
                type="button"
                onClick={() => void prepareReceiptPng()}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1 shrink-0 active:scale-[0.97] cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Coba lagi</span>
              </button>
            </div>
          )}

          {/* Baris 1: 3 tombol sejajar sama besar (>= 48px) */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              id="share-receipt-png-button"
              onClick={handleShareImage}
              disabled={isPreparingPng}
              className="min-h-[48px] px-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-[0.97] cursor-pointer disabled:opacity-70"
            >
              {isPreparingPng ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Share2 className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate max-w-full leading-tight">
                {isPreparingPng ? 'Menyiapkan...' : 'Kirim Gambar'}
              </span>
            </button>

            <button
              type="button"
              id="copy-receipt-png-button"
              onClick={handleCopyImage}
              disabled={isPreparingPng}
              className="min-h-[48px] px-2 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6] font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-[0.97] cursor-pointer disabled:opacity-70"
            >
              {isPreparingPng ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB] dark:text-[#C084FC] shrink-0" />
              ) : copiedPng ? (
                <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC] shrink-0" />
              )}
              <span className="truncate max-w-full leading-tight">
                {isPreparingPng ? 'Menyiapkan...' : copiedPng ? 'Tersalin' : 'Salin Gambar'}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[48px] px-2 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6] font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-[0.97] cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-zinc-300 shrink-0" />
              <span className="truncate max-w-full leading-tight">Cetak</span>
            </button>
          </div>

          {/* Baris 2: Satu tombol lebar penuh paling menonjol */}
          <button
            type="button"
            id="btn-new-transaction"
            onClick={handlePrimaryNewTransaction}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white font-extrabold text-sm tracking-wide flex items-center justify-center gap-2 transition-colors active:scale-[0.97] cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Transaksi Baru</span>
          </button>
        </div>

        {/* MENU "LAINNYA" (BOTTOM SHEET KECIL) — TANPA EDIT TRANSAKSI */}
        {showMoreMenu && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Opsi Struk Lainnya"
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
          >
            <div className="fixed inset-0" onClick={() => setShowMoreMenu(false)} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
              <div className="px-4 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-extrabold">Opsi Struk Lainnya</h4>
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(false)}
                    aria-label="Tutup opsi lainnya"
                    className="min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center text-slate-500 hover:bg-white dark:text-zinc-400 dark:hover:bg-[#2E2E37] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2.5 pb-safe overflow-y-auto overscroll-contain">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    handleShareWA();
                  }}
                  className="w-full min-h-[48px] flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440] bg-white hover:bg-slate-50 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] text-left transition-colors active:scale-[0.97] cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/35 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold">Kirim WA Teks (wa.me)</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      Kirim format teks rincian nota ke WhatsApp
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  id="download-receipt-png-button"
                  onClick={handleManualDownloadImage}
                  disabled={isPreparingPng}
                  className="w-full min-h-[48px] flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440] bg-white hover:bg-slate-50 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] text-left transition-colors active:scale-[0.97] cursor-pointer disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-200 dark:bg-purple-500/15 dark:text-[#C084FC] dark:border-purple-500/40 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold">Simpan / Unduh Gambar</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {isIosDevice()
                        ? 'Buka gambar untuk tekan lama & simpan ke Foto'
                        : 'Simpan file PNG struk ke perangkat'}
                    </p>
                  </div>
                </button>

                {/* Bagian Merah Terpisah: Void & Hapus Permanen */}
                {((!isVoided && onVoidTransaction) || (isVoided && onDeleteTransaction)) && (
                  <div className="pt-3 mt-2 border-t border-red-200 dark:border-red-500/30 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 px-1">
                      Tindakan Berbahaya
                    </p>
                    {!isVoided && onVoidTransaction && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowVoidConfirm(true);
                        }}
                        className="w-full min-h-[48px] flex items-center gap-3 p-3.5 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:hover:bg-red-500/25 dark:text-red-400 font-bold text-xs text-left transition-colors active:scale-[0.97] cursor-pointer"
                      >
                        <Ban className="w-4 h-4 shrink-0" />
                        <span>Void Nota & Hapus di Google Sheets</span>
                      </button>
                    )}
                    {isVoided && onDeleteTransaction && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full min-h-[48px] flex items-center gap-3 p-3.5 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:hover:bg-red-500/25 dark:text-red-400 font-bold text-xs text-left transition-colors active:scale-[0.97] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Hapus Permanen Nota VOID</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SHEET FALLBACK GAMBAR TEKAN-LAMA (UNTUK SAFARI iOS / CLIPBOARD DITOLAK) */}
        {showLongPressSheet && preRenderedRef.current && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Salin Gambar Struk"
            className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
          >
            <div className="fixed inset-0" onClick={() => setShowLongPressSheet(false)} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
              <div className="px-4 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold">Salin / Simpan Gambar Struk</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Tekan lama gambar, lalu pilih Salin atau Simpan ke Foto
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLongPressSheet(false)}
                    aria-label="Tutup pratinjau gambar"
                    className="min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center text-slate-500 hover:bg-white dark:text-zinc-400 dark:hover:bg-[#2E2E37] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 bg-slate-100 dark:bg-[#121215] flex flex-col items-center gap-3">
                <img
                  src={preRenderedRef.current.objectUrl}
                  alt={`Struk ${receipt.id}`}
                  className="w-full max-w-[320px] rounded-xl border border-slate-300 shadow-sm select-auto [-webkit-touch-callout:default] [-webkit-user-select:auto]"
                />
              </div>

              <div className="px-4 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-white dark:bg-[#1B1B20] pb-safe flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowLongPressSheet(false)}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-[#24242B] dark:border-[#343440] dark:text-zinc-200 font-bold text-xs active:scale-[0.97] cursor-pointer"
                >
                  Tutup
                </button>
                {!isIosDevice() && (
                  <button
                    type="button"
                    onClick={handleManualDownloadImage}
                    className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PNG</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SHEET KONFIRMASI VOID & HAPUS DI SPREADSHEET */}
        {showVoidConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi Void Nota"
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
          >
            <div className="fixed inset-0" onClick={() => setShowVoidConfirm(false)} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl border-t sm:border border-red-200 dark:border-red-500/40 shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
              <div className="px-4 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h4 className="font-extrabold text-sm text-[#0F172A] dark:text-[#F4F4F6]">
                    Konfirmasi VOID & Hapus
                  </h4>
                </div>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto overscroll-contain">
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Struk <strong className="text-[#0F172A] dark:text-[#F4F4F6]">#{receipt.id}</strong> akan
                  dibatalkan, stok barang dikembalikan, dan seluruh barisnya di{' '}
                  <strong className="text-[#0F172A] dark:text-[#F4F4F6]">
                    Google Sheets (LOG_PENJUALAN & LAIN-LAIN)
                  </strong>{' '}
                  akan dihapus permanen.
                </p>
                <div>
                  <label
                    htmlFor="receipt-void-reason-input"
                    className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1.5"
                  >
                    Alasan Pembatalan:
                  </label>
                  <input
                    ref={voidReasonInputRef}
                    id="receipt-void-reason-input"
                    type="text"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="Contoh: Salah pesanan / Pelanggan batal"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                  />
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowVoidConfirm(false)}
                  className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-zinc-200 font-bold text-xs sm:text-sm active:scale-[0.97] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmVoid}
                  className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm active:scale-[0.97] cursor-pointer"
                >
                  Hapus & VOID
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SHEET KONFIRMASI HAPUS STRUK PERMANEN */}
        {showDeleteConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi Hapus Permanen"
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
          >
            <div className="fixed inset-0" onClick={() => setShowDeleteConfirm(false)} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl border-t sm:border border-red-200 dark:border-red-500/40 shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
              <div className="px-4 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Trash2 className="w-5 h-5 shrink-0" />
                  <h4 className="font-extrabold text-sm text-[#0F172A] dark:text-[#F4F4F6]">
                    Hapus Struk Permanen
                  </h4>
                </div>
              </div>

              <div className="p-4 overflow-y-auto overscroll-contain">
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Hapus struk <strong className="text-[#0F172A] dark:text-[#F4F4F6]">#{receipt.id}</strong>{' '}
                  permanen dari database dan Google Sheets? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-zinc-200 font-bold text-xs sm:text-sm active:scale-[0.97] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm active:scale-[0.97] cursor-pointer"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
