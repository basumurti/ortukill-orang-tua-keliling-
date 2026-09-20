import React, { useState, useRef } from 'react';
import { 
  Printer, 
  Share2, 
  X, 
  CheckCircle2, 
  MessageSquare, 
  Check,
  Download,
  Loader2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { TransactionReceipt, BrandConfig } from '../types';
import { formatRupiah } from '../services/storageService';

interface ReceiptModalProps {
  receipt: TransactionReceipt | null;
  brand: BrandConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  brand,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const getWhatsAppShareText = () => {
    const itemLines = receipt.items
      .map((i) => {
        const itemSubtotal = i.total ?? i.subtotal ?? (i.qty * i.price);
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
      (receipt.discount > 0 ? `Subtotal: ${formatRupiah(receipt.subtotal)}\nPromo/Diskon: -${formatRupiah(receipt.discount)}${receipt.promoName ? ` (${receipt.promoName})` : ''}\n` : '') +
      (receipt.shippingFee && receipt.shippingFee > 0 ? `Ongkir: +${formatRupiah(receipt.shippingFee)}\n` : '') +
      `*TOTAL: ${formatRupiah(receipt.total)}*\n` +
      (receipt.paymentMethod === 'CASH' && receipt.cashReceived ? 
        `Tunai: ${formatRupiah(receipt.cashReceived)}\nKembalian: ${formatRupiah(receipt.cashChange || 0)}\n` : '') +
      `--------------------------------\n` +
      `TERIMAKASIH SELAMAT-BERSENANG-SENANG * ATLAS AMER KEDIRI SIAP SEDIA Melayani Setiap Kebutuhan Minum Kamu.\n` +
      `WA/Info: ${brand.PHONE}`
    );
  };

  const handleShareWA = () => {
    const text = getWhatsAppShareText();
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const downloadReceiptCanvasFallback = () => {
    try {
      const canvas = document.createElement('canvas');
      const width = 420;
      const padding = 24;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dynamicHeight = 400 + (receipt.items.length * 44);
      canvas.width = width;
      canvas.height = dynamicHeight;

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, dynamicHeight);

      // Brand Title
      ctx.fillStyle = '#0c0a09';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(brand.NAME || 'ORTUKILL POS', width / 2, 40);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#44403c';
      ctx.fillText(brand.SUBTITLE || 'POS / KASIR', width / 2, 60);
      ctx.fillText(brand.DESCRIPTION_1 || '', width / 2, 78);
      ctx.fillText(`WA: ${brand.PHONE || ''}`, width / 2, 96);

      // Dash line
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding, 110);
      ctx.lineTo(width - padding, 110);
      ctx.stroke();

      // Meta
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

      // Items
      receipt.items.forEach((item) => {
        const itemSubtotal = item.total ?? item.subtotal ?? (item.qty * item.price);
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

      // Separator
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 20;

      // Totals
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

      // Total Final
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

      // Footer
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

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Struk_${receipt.id}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Canvas fallback error:', e);
    }
  };

  const handleDownloadPng = async () => {
    if (!receiptRef.current) return;
    setIsGeneratingPng(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        skipFonts: true,
        fontEmbedCSS: '',
      });
      const link = document.createElement('a');
      link.download = `Struk_${receipt.id}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('html-to-image render failed, using canvas fallback:', err);
      downloadReceiptCanvasFallback();
    } finally {
      setIsGeneratingPng(false);
    }
  };

  const handleCopyText = () => {
    const plainText = decodeURIComponent(getWhatsAppShareText());
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="receipt-modal-card"
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 my-6"
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-50 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-extrabold text-stone-900 text-xs">
              Struk #{receipt.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200/60 hover:bg-stone-200 flex items-center justify-center text-stone-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Paper */}
        <div className="p-4 bg-stone-100/70 flex justify-center">
          <div 
            ref={receiptRef}
            id="thermal-receipt-container"
            className="w-full bg-white text-stone-900 p-5 rounded-2xl shadow-xs font-mono text-xs border border-stone-200/80 select-all space-y-3"
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
              <div className="flex justify-between">
                <span>No. Nota</span>
                <span className="font-bold text-stone-900">{receipt.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu</span>
                <span>{receipt.transactionDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Metode</span>
                <span className="font-bold px-1.5 py-0.2 rounded-md bg-stone-100 text-stone-900">{receipt.paymentMethod}</span>
              </div>
              {receipt.customerName && (
                <div className="flex justify-between">
                  <span>Pelanggan</span>
                  <span className="font-semibold text-stone-900">{receipt.customerName}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="py-2 border-b border-dashed border-stone-300 space-y-1.5">
              {receipt.items.map((item, idx) => {
                const itemSubtotal = item.total ?? item.subtotal ?? (item.qty * item.price);
                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-semibold text-stone-900 leading-tight">
                      {item.name}
                    </div>
                    <div className="flex justify-between text-stone-500 text-[11px]">
                      <span>
                        {item.qty} x {formatRupiah(item.price)}
                      </span>
                      <span className="font-bold text-stone-900">
                        {formatRupiah(itemSubtotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-stone-300 space-y-1 text-[11px]">
              <div className="flex justify-between text-stone-500">
                <span>Total Item</span>
                <span>{receipt.totalQty} botol</span>
              </div>
              {receipt.discount > 0 && (
                <>
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span>
                    <span>{formatRupiah(receipt.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Diskon {receipt.promoName ? `(${receipt.promoName})` : ''}</span>
                    <span>-{formatRupiah(receipt.discount)}</span>
                  </div>
                </>
              )}
              {receipt.shippingFee && receipt.shippingFee > 0 && (
                <div className="flex justify-between text-[#FF5E36] font-semibold">
                  <span>Ongkir (Pengiriman)</span>
                  <span>+{formatRupiah(receipt.shippingFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1.5 text-stone-950 border-t border-stone-200">
                <span>TOTAL AKHIR</span>
                <span>{formatRupiah(receipt.total)}</span>
              </div>

              {receipt.paymentMethod === 'CASH' && receipt.cashReceived !== undefined && (
                <>
                  <div className="flex justify-between text-stone-600 pt-1">
                    <span>Uang Diterima</span>
                    <span>{formatRupiah(receipt.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Kembalian</span>
                    <span>{formatRupiah(receipt.cashChange || 0)}</span>
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

        {/* Modal Action Buttons (min 44px touch targets) */}
        <div className="p-3.5 bg-white border-t border-stone-100 flex flex-col gap-2">
          <button
            onClick={handleShareWA}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wide transition-all cursor-pointer shadow-xs min-h-[46px]"
          >
            <MessageSquare className="w-4 h-4 fill-current" />
            <span>Kirim Nota ke WhatsApp</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition-colors cursor-pointer min-h-[44px]"
            >
              <Printer className="w-3.5 h-3.5 text-[#FF5E36]" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPng}
              disabled={isGeneratingPng}
              id="download-receipt-png-button"
              className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition-colors cursor-pointer min-h-[44px]"
              title="Download Struk sebagai Gambar PNG"
            >
              {isGeneratingPng ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF5E36]" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[#FF5E36]" />
              )}
              <span>{isGeneratingPng ? 'Proses...' : 'Download PNG'}</span>
            </button>
            <button
              onClick={handleCopyText}
              className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition-colors cursor-pointer min-h-[44px]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-stone-500" />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
