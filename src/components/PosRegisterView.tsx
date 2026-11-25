import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  CreditCard,
  QrCode,
  User,
  Tag,
  Sparkles,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
  TrendingUp,
  ShoppingBag,
  Truck,
  Printer,
  MessageSquare,
  Download,
  RotateCcw,
  Calendar,
  Package,
  Wallet,
  FileSpreadsheet,
  Clock,
  Gift,
  Loader2,
  CalendarDays,
} from 'lucide-react';
import { Product, CartItem, PaymentMethod, BrandConfig, TransactionReceipt } from '../types';
import {
  formatRupiah,
  normalizeDateToYmd,
  StorageService,
  isDateToday,
  calculateFilteredBottleCount,
} from '../services/storageService';
import { PromoSelectorModal } from './PromoSelectorModal';
import { AppConfirmDialog } from './AppConfirmDialog';
import { useOverlayHistory } from '../utils/useOverlayHistory';

export interface CustomDateOption {
  dateStr: string;
  timeStr: string;
  dateTimeStr: string;
  dateYmd: string;
}

// Helper: Menghitung jam otomatis ({kecuali hari ini} +1 menit dari nota terakhir, kalau hari ini sesuai jam input)
export function computeAutoTimeForDate(
  targetYmd: string,
  transactions: TransactionReceipt[] = [],
  currentTodayYmd?: string
): {
  timeStr: string;
  lastTrxId: string | null;
  lastTimeStr: string | null;
  hasPrevious: boolean;
  explanation: string;
} {
  const now = new Date();
  const nowYmd =
    currentTodayYmd ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (!targetYmd || targetYmd === nowYmd) {
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const currentClock = `${h}:${m}:${s}`;
    return {
      timeStr: currentClock,
      lastTrxId: null,
      lastTimeStr: null,
      hasPrevious: false,
      explanation: 'Sesuai jam input (real-time)',
    };
  }

  const dayTrx = (transactions || []).filter((t) => {
    const rawId = String(t.id || '').trim();
    if (
      rawId.toUpperCase().startsWith('VOIDED-') ||
      rawId.toUpperCase().startsWith('#VOIDED-') ||
      t.status === 'VOIDED'
    ) {
      return false;
    }
    const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
    return ymd === targetYmd;
  });

  if (dayTrx.length === 0) {
    return {
      timeStr: '10:00:00',
      lastTrxId: null,
      lastTimeStr: null,
      hasPrevious: false,
      explanation: 'Nota pertama di tanggal ini (default 10:00:00)',
    };
  }

  let maxSeconds = -1;
  let lastTrx: TransactionReceipt | null = null;
  let lastTimeFormatted = '';

  dayTrx.forEach((t) => {
    let raw = (t.websiteTime || '').trim();
    if (!raw && t.transactionDate && t.transactionDate.includes(' ')) {
      raw = t.transactionDate.split(' ')[1].trim();
    }
    if ((!raw || raw === '00:00' || raw === '00:00:00') && t.id) {
      const matchId = String(t.id).match(/TRX-\d{8}-(\d{2})(\d{2})(\d{2})/);
      if (matchId) {
        raw = `${matchId[1]}:${matchId[2]}:${matchId[3]}`;
      }
    }

    if (raw) {
      const clean = raw.replace(/\./g, ':');
      const parts = clean.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (parts) {
        const hh = parseInt(parts[1], 10);
        const mm = parseInt(parts[2], 10);
        const ss = parts[3] ? parseInt(parts[3], 10) : 0;
        const totalSec = hh * 3600 + mm * 60 + ss;
        if (totalSec > maxSeconds) {
          maxSeconds = totalSec;
          lastTrx = t;
          lastTimeFormatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
        }
      }
    }
  });

  if (maxSeconds <= 0) {
    let latestCreated = 0;
    dayTrx.forEach((t) => {
      if (t.createdAt && t.createdAt > latestCreated) {
        latestCreated = t.createdAt;
        lastTrx = t;
      }
    });
    if (latestCreated > 0) {
      const d = new Date(latestCreated);
      maxSeconds = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
      lastTimeFormatted = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    } else {
      maxSeconds = 10 * 3600;
      lastTimeFormatted = '10:00:00';
    }
  }

  const nextSec = Math.min(86399, maxSeconds + 60);
  const nextH = String(Math.floor(nextSec / 3600)).padStart(2, '0');
  const nextM = String(Math.floor((nextSec % 3600) / 60)).padStart(2, '0');
  const nextS = String(nextSec % 60).padStart(2, '0');
  const nextTime = `${nextH}:${nextM}:${nextS}`;

  return {
    timeStr: nextTime,
    lastTrxId: lastTrx ? lastTrx.id : null,
    lastTimeStr: lastTimeFormatted,
    hasPrevious: true,
    explanation: `+1 mnt dari nota #${lastTrx ? lastTrx.id : 'terakhir'} (${lastTimeFormatted} ➔ ${nextTime})`,
  };
}

interface PosRegisterViewProps {
  products: Product[];
  transactions?: TransactionReceipt[];
  cart: CartItem[];
  customerName: string;
  setCustomerName: (name: string) => void;
  discount: number;
  setDiscount: (discount: number) => void;
  promoCode?: string;
  setPromoCode?: (code: string) => void;
  promoName?: string;
  setPromoName?: (name: string) => void;
  shippingFee: number;
  setShippingFee: (fee: number) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (pm: PaymentMethod) => void;
  cashReceived: number;
  setCashReceived: (cash: number) => void;
  onAddToCart: (product: Product) => void;
  onUpdateQty: (productId: string, qty: number) => void;
  onUpdateItemPrice: (productId: string, newPrice: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onRestoreCartItem?: (item: CartItem, index?: number) => void;
  onClearCart: () => void;
  onProcessCheckout: (customDateOption?: CustomDateOption) => Promise<void> | void;
  onShowToast?: (
    message: string,
    type?: 'success' | 'error' | 'info',
    duration?: number,
    action?: { label: string; onAction: () => void }
  ) => void;
  brand?: BrandConfig;
  todayOmset?: number;
  todayMargin?: number;
  todayCount?: number;
  todayFilteredBottleQty?: number;
  isConnectedGas?: boolean;
  onNavigateTab?: (tab: 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas' | 'finance') => void;
  isRedPriceMode?: boolean;
  onToggleRedPriceMode?: (enabled: boolean) => void;
}

const LiveClockLabel: React.FC = React.memo(() => {
  const [liveClock, setLiveClock] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setLiveClock(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <span>Jam input: {liveClock} (Live)</span>;
});

interface PosProductCardProps {
  product: Product;
  inCartQty: number;
  isRedPriceMode: boolean;
  onAddToCart: (product: Product) => void;
  onUpdateQty: (productId: string, qty: number) => void;
}

const PosProductCard: React.FC<PosProductCardProps> = React.memo(({
  product,
  inCartQty,
  isRedPriceMode,
  onAddToCart,
  onUpdateQty,
}) => {
  const isOutOfStock = product.stock <= 0;
  const hasRedPrice = !!(product.redPrice && product.redPrice > 0);
  const displayPrice = isRedPriceMode
    ? hasRedPrice
      ? product.redPrice!
      : product.price
    : product.price;
  const isRedApplied = isRedPriceMode && hasRedPrice;
  const redMarkup = isRedApplied ? product.redPrice! - product.price : 0;

  return (
    <div
      id={`product-card-${product.sku}`}
      className={`[content-visibility:auto] [contain-intrinsic-size:auto_220px] bg-white dark:bg-[#1B1B20] rounded-2xl p-3 sm:p-4 border transition-colors duration-150 flex flex-col justify-between select-none relative min-w-0 ${
        isOutOfStock
          ? 'border-slate-200 opacity-55 bg-slate-50 dark:border-[#2B2B33] dark:bg-[#16161A]'
          : inCartQty > 0
          ? 'border-[#2563EB] ring-2 ring-blue-500/15 bg-blue-50/20 dark:border-[#A855F7] dark:ring-purple-500/25 dark:bg-purple-500/10'
          : isRedApplied
          ? 'border-red-300 bg-red-50/15 hover:border-red-400 dark:border-red-500/40 dark:bg-red-500/10 dark:hover:border-red-400/60'
          : 'border-slate-200 hover:border-slate-300 dark:border-[#2B2B33] dark:hover:border-[#343440]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 truncate min-w-0">
            {product.category || 'Minuman'}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 num-tabular ${
              isOutOfStock
                ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/35'
                : product.stock < 10
                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/35'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/35'
            }`}
          >
            {isOutOfStock ? 'Habis' : `Sisa ${product.stock}`}
          </span>
        </div>

        <div className="mb-3">
          <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] leading-snug line-clamp-2 break-words min-h-[2.25rem] sm:min-h-[2.5rem]">
            {product.name}
          </h3>
          <p className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 mt-1 truncate">
            {product.sku}
          </p>
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-100 dark:border-[#2B2B33] flex flex-col gap-2 mt-auto min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className={`text-sm font-extrabold tracking-tight num-tabular ${
                isRedApplied ? 'text-red-600 dark:text-red-400' : 'text-[#0F172A] dark:text-[#F4F4F6]'
              }`}
            >
              {formatRupiah(displayPrice)}
            </p>
            {isRedApplied && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white uppercase tracking-wide shrink-0">
                Reseller
              </span>
            )}
          </div>
          {isRedApplied ? (
            <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 num-tabular truncate mt-0.5">
              Normal {formatRupiah(product.price)} (+{formatRupiah(redMarkup)})
            </p>
          ) : (
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 num-tabular truncate mt-0.5">
              +Laba {formatRupiah(product.price - product.cost)}
            </p>
          )}
        </div>

        <div>
          {inCartQty > 0 ? (
            <div className="w-full flex items-center justify-between gap-1 bg-slate-100 border border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:border-[#343440] dark:text-[#F4F4F6] p-1 rounded-xl">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQty(product.id, inCartQty - 1);
                }}
                className="min-w-[44px] min-h-[44px] rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 dark:bg-[#1B1B20] dark:border-[#343440] dark:hover:bg-[#2E2E37] dark:text-[#F4F4F6] active:scale-[0.97] transition-colors text-[#0F172A] cursor-pointer shrink-0"
                aria-label={`Kurangi ${product.name}`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xs font-extrabold flex-1 min-w-0 text-center num-tabular">
                {inCartQty}
              </span>
              <button
                type="button"
                disabled={inCartQty >= product.stock}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQty(product.id, inCartQty + 1);
                }}
                className="min-w-[44px] min-h-[44px] rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] flex items-center justify-center active:scale-[0.97] transition-colors text-white disabled:opacity-40 cursor-pointer shrink-0"
                aria-label={`Tambah ${product.name}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => !isOutOfStock && onAddToCart(product)}
              aria-label={`Tambah ${product.name}`}
              className={`w-full py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-xs font-bold cursor-pointer min-h-[44px] ${
                isOutOfStock
                  ? 'bg-slate-200 text-slate-400 dark:bg-[#24242B] dark:text-zinc-600 cursor-not-allowed'
                  : isRedApplied
                  ? 'bg-red-600 hover:bg-red-700 text-white active:scale-[0.97]'
                  : 'bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white active:scale-[0.97]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isOutOfStock ? 'Habis' : 'Pilih'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

interface PosCartItemRowProps {
  item: CartItem;
  onUpdateQty: (productId: string, qty: number) => void;
  onUpdateItemPrice: (productId: string, newPrice: number) => void;
  onRemoveItem: (item: CartItem) => void;
}

const PosCartItemRow: React.FC<PosCartItemRowProps> = React.memo(({
  item,
  onUpdateQty,
  onUpdateItemPrice,
  onRemoveItem,
}) => {
  const isPromoItem = item.price < 0 || String(item.sku || '').toUpperCase().includes('PROMO');
  const isCustomPrice = !isPromoItem && item.originalPrice !== undefined && item.price !== item.originalPrice;

  if (isPromoItem) {
    return (
      <div className="p-3 rounded-2xl border border-red-200 bg-red-50/60 dark:border-red-500/35 dark:bg-red-500/10 space-y-2.5 min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                <Gift className="w-2.5 h-2.5" />
                <span>Promo</span>
              </span>
              <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] leading-snug line-clamp-2 break-words min-w-0">
                {item.name}
              </p>
            </div>
            <p className="text-[11px] font-mono text-red-600 dark:text-red-400 font-bold num-tabular mt-1 truncate">
              Potongan {formatRupiah(Math.abs(item.price))}/pcs
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <p className="text-xs sm:text-sm font-extrabold text-red-600 dark:text-red-400 font-mono num-tabular text-right">
              -{formatRupiah(Math.abs(item.subtotal))}
            </p>
            <button
              type="button"
              onClick={() => onRemoveItem(item)}
              aria-label={`Hapus promo ${item.name}`}
              className="min-w-[44px] min-h-[44px] text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-100/80 dark:hover:bg-red-500/15 transition-colors active:scale-[0.97] flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-red-200/70 dark:border-red-500/30">
          <span className="text-xs text-red-700 dark:text-red-400 font-semibold truncate">
            Jumlah Kupon:
          </span>

          <div className="flex items-center gap-1.5 bg-white border border-red-200 dark:bg-[#1B1B20] dark:border-red-500/35 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (item.qty <= 1) {
                  onRemoveItem(item);
                } else {
                  onUpdateQty(item.productId, item.qty - 1);
                }
              }}
              aria-label={`Kurangi kupon ${item.name}`}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#2E2E37] rounded-lg transition-colors active:scale-[0.97] cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs sm:text-sm text-red-600 dark:text-red-400 px-2 min-w-[28px] text-center font-mono num-tabular">
              {item.qty}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQty(item.productId, item.qty + 1)}
              aria-label={`Tambah kupon ${item.name}`}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#2E2E37] rounded-lg transition-colors active:scale-[0.97] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-2xl border space-y-2.5 min-w-0 ${
        item.isRedPrice
          ? 'bg-red-50/40 border-red-200 dark:bg-red-500/10 dark:border-red-500/35'
          : 'bg-white border-slate-200 dark:bg-[#24242B] dark:border-[#343440]'
      }`}
    >
      {/* Row 1: Product Name (2-line clamp) + Right-aligned Subtotal + Trash 44px */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] leading-snug line-clamp-2 break-words">
            {item.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 num-tabular">
              {formatRupiah(item.price)} / btl
            </span>
            {item.isRedPrice && (
              <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-md">
                Harga Merah
              </span>
            )}
            {isCustomPrice && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/35 px-1.5 py-0.5 rounded-md">
                Diubah
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-xs sm:text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] font-mono num-tabular text-right">
            {formatRupiah(item.subtotal)}
          </p>
          <button
            type="button"
            onClick={() => onRemoveItem(item)}
            aria-label={`Hapus ${item.name} dari keranjang`}
            className="min-w-[44px] min-h-[44px] text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors active:scale-[0.97] flex items-center justify-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Existing Unit Price Input + 44px Qty Control */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200 dark:border-[#343440] flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[11px] text-slate-400 dark:text-zinc-500 font-mono font-bold pointer-events-none">
              Rp
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              aria-label={`Harga satuan ${item.name}`}
              value={item.price}
              onChange={(e) => onUpdateItemPrice(item.productId, Number(e.target.value) || 0)}
              className="w-28 pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-mono font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[40px]"
            />
          </div>
          {isCustomPrice && item.originalPrice !== undefined && (
            <button
              type="button"
              onClick={() => onUpdateItemPrice(item.productId, item.originalPrice!)}
              className="min-h-[36px] px-2 text-[11px] text-[#2563EB] dark:text-[#C084FC] hover:underline font-bold flex items-center gap-1 cursor-pointer active:scale-[0.97]"
              title="Kembalikan ke harga katalog asli"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 dark:bg-[#1B1B20] dark:border-[#343440] rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (item.qty <= 1) {
                onRemoveItem(item);
              } else {
                onUpdateQty(item.productId, item.qty - 1);
              }
            }}
            aria-label={`Kurangi jumlah ${item.name}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 dark:text-zinc-300 bg-white dark:bg-[#24242B] hover:bg-slate-50 dark:hover:bg-[#2E2E37] rounded-lg transition-colors active:scale-[0.97] cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="font-extrabold text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] px-1.5 min-w-[28px] text-center font-mono num-tabular">
            {item.qty}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQty(item.productId, item.qty + 1)}
            aria-label={`Tambah jumlah ${item.name}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] rounded-lg transition-colors active:scale-[0.97] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export const PosRegisterView: React.FC<PosRegisterViewProps> = ({
  products,
  transactions = [],
  cart,
  customerName,
  setCustomerName,
  discount,
  setDiscount,
  promoCode = '',
  setPromoCode,
  promoName = '',
  setPromoName,
  shippingFee,
  setShippingFee,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  onAddToCart,
  onUpdateQty,
  onUpdateItemPrice,
  onRemoveFromCart,
  onRestoreCartItem,
  onClearCart,
  onProcessCheckout,
  onShowToast,
  brand,
  todayOmset = 0,
  todayMargin = 0,
  todayCount = 0,
  todayFilteredBottleQty,
  isConnectedGas = false,
  onNavigateTab,
  isRedPriceMode = false,
  onToggleRedPriceMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(debouncedQuery);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);

  // Debounce SKU / product search (~150ms)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // History Back + Body Scroll Lock for Cart Sheet
  useOverlayHistory(isCartSheetOpen, () => setIsCartSheetOpen(false), 'pos-cart-sheet');

  // Menghitung botol keluar hari ini (kecuali bir, promo, dan harga minuman di bawah 30rb)
  const computedFilteredBottleQty = useMemo(() => {
    if (typeof todayFilteredBottleQty === 'number') {
      return todayFilteredBottleQty;
    }
    const todayList = (transactions || []).filter((t) => t.status !== 'VOIDED' && isDateToday(t.date));
    return calculateFilteredBottleCount(todayList);
  }, [todayFilteredBottleQty, transactions]);

  const todayYmd = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [txDate, setTxDate] = useState<string>(todayYmd);
  const [txTime, setTxTime] = useState<string>('');
  const [timeExplanation, setTimeExplanation] = useState<string>('');

  const updateAutoTimeForDate = useCallback(
    (dateYmd: string) => {
      const calc = computeAutoTimeForDate(dateYmd, transactions, todayYmd);
      setTxTime(calc.timeStr);
      setTimeExplanation(calc.explanation);
    },
    [transactions, todayYmd]
  );

  useEffect(() => {
    updateAutoTimeForDate(txDate);
  }, [txDate, updateAutoTimeForDate]);

  const availablePromos = useMemo(() => {
    return StorageService.getPromos().filter((p) => p.isActive !== false);
  }, [isPromoModalOpen]);

  const presentCategories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p) => (p.category ? String(p.category).trim() : ''))
            .filter((c): c is string => Boolean(c) && c.toUpperCase() !== 'PROMO' && c.toUpperCase() !== 'DAFTAR PROMO')
        )
      ) as string[],
    [products]
  );

  const categories: string[] = useMemo(
    () => ['ALL', ...presentCategories, 'Daftar Promo'],
    [presentCategories]
  );

  const categoryCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: products.length,
      'Daftar Promo': availablePromos.length,
    };
    products.forEach((p) => {
      const cat = p.category ? String(p.category).trim() : 'Lainnya';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products, availablePromos.length]);

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      map.set(item.productId, item.qty);
    });
    return map;
  }, [cart]);

  const filteredProducts = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const skuUpper = String(p.sku || '').toUpperCase();
      const nameUpper = String(p.name || '').toUpperCase();
      if (
        skuUpper.includes('PROMO') ||
        nameUpper.includes('PROMO') ||
        nameUpper.includes('POTONGAN') ||
        p.category === 'PROMO'
      ) {
        return false;
      }
      const cat = p.category || 'Belum dikategorikan';
      if (selectedCategory !== 'ALL' && cat !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, deferredSearchQuery]);

  // Calculations preserved intact
  const regularItems = cart.filter((i) => i.price >= 0 && !String(i.sku || '').toUpperCase().includes('PROMO'));
  const promoCartItems = cart.filter((i) => i.price < 0 || String(i.sku || '').toUpperCase().includes('PROMO'));

  const itemsSubtotal = regularItems.reduce((sum, item) => sum + item.subtotal, 0);
  const promoCartDiscount = Math.abs(promoCartItems.reduce((sum, item) => sum + item.subtotal, 0));
  const effectiveDiscount = discount + promoCartDiscount;

  const subtotal = itemsSubtotal > 0 ? itemsSubtotal : cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalBottleQty = regularItems.reduce((sum, item) => sum + item.qty, 0);
  const totalQty = totalBottleQty > 0 ? totalBottleQty : cart.reduce((sum, item) => sum + item.qty, 0);
  const finalTotal = Math.max(0, subtotal - effectiveDiscount + shippingFee);
  const change = cashReceived >= finalTotal ? cashReceived - finalTotal : 0;
  const isCashShort = paymentMethod === 'CASH' && finalTotal > 0 && cashReceived < finalTotal;

  const sheetsRegularSubtotal = regularItems.reduce((sum, item) => {
    const reg = item.regularPrice || item.originalPrice || item.price;
    return sum + reg * item.qty;
  }, 0);
  const sheetsRegularTotal = Math.max(
    0,
    (sheetsRegularSubtotal > 0 ? sheetsRegularSubtotal : subtotal) - effectiveDiscount + shippingFee
  );

  // Quick cash presets: Uang Pas, 50rb, 100rb (+ 200rb if needed)
  const quickCashOptions = useMemo(() => {
    const opts: Array<{ amount: number; label: string }> = [
      { amount: finalTotal, label: 'Uang Pas' },
      { amount: 50000, label: '50rb' },
      { amount: 100000, label: '100rb' },
    ];
    if (finalTotal > 100000) {
      const rounded = Math.ceil(finalTotal / 100000) * 100000;
      if (rounded !== finalTotal) {
        opts.push({ amount: rounded, label: `${rounded / 1000}rb` });
      }
    }
    const seen = new Set<number>();
    return opts.filter((o) => {
      if (o.amount < 0 || seen.has(o.amount)) return false;
      if (o.amount === 0 && finalTotal > 0) return false;
      seen.add(o.amount);
      return true;
    });
  }, [finalTotal]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRemoveWithUndo = useCallback(
    (item: CartItem) => {
      const idx = cart.findIndex((c) => c.productId === item.productId && c.sku === item.sku);
      onRemoveFromCart(item.productId);
      if (onShowToast) {
        onShowToast(`"${item.name}" dihapus dari keranjang`, 'info', 4500, {
          label: 'Urungkan',
          onAction: () => {
            onRestoreCartItem?.(item, idx >= 0 ? idx : undefined);
          },
        });
      }
    },
    [cart, onRemoveFromCart, onRestoreCartItem, onShowToast]
  );

  const moreOptionsSummary = useMemo(() => {
    const parts: string[] = [];
    if (customerName.trim()) parts.push(customerName.trim());
    if (effectiveDiscount > 0) parts.push(`Diskon ${formatRupiah(effectiveDiscount)}`);
    if (shippingFee > 0) parts.push(`Ongkir ${formatRupiah(shippingFee)}`);
    if (txDate !== todayYmd) parts.push(`Tgl ${txDate}`);
    return parts.join(' · ');
  }, [customerName, effectiveDiscount, shippingFee, txDate, todayYmd]);

  const disabledCheckoutReason = useMemo(() => {
    if (cart.length === 0) return 'Keranjang masih kosong';
    if (isSubmitting) return 'Sedang menyimpan transaksi...';
    if (isCashShort) {
      if (cashReceived <= 0) return 'Isi uang diterima atau pilih Uang Pas';
      return `Uang tunai kurang ${formatRupiah(finalTotal - cashReceived)}`;
    }
    return '';
  }, [cart.length, isSubmitting, isCashShort, cashReceived, finalTotal]);

  const handleCheckoutAndClose = async () => {
    if (isSubmitting || cart.length === 0 || isCashShort) return;
    setIsSubmitting(true);
    try {
      const parts = txDate.split('-').map(Number);
      const d = String(parts[2]).padStart(2, '0');
      const m = String(parts[1]).padStart(2, '0');
      const y = String(parts[0]);
      const dateStr = `${d}/${m}/${y}`;
      let finalTime = '';
      if (txDate === todayYmd) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        finalTime = `${hh}:${mm}:${ss}`;
      } else {
        const calc = computeAutoTimeForDate(txDate, transactions, todayYmd);
        finalTime = calc.timeStr || txTime || '10:00:00';
      }

      const timeStr = finalTime || '00:00:00';
      const dateTimeStr = `${dateStr} ${timeStr}`;

      await onProcessCheckout({
        dateStr,
        timeStr,
        dateTimeStr,
        dateYmd: txDate,
      });
      setIsCartSheetOpen(false);
    } finally {
      setTimeout(() => setIsSubmitting(false), 600);
    }
  };

  const getCartOrderShareText = () => {
    const itemLines = cart
      .map((i) => {
        const isPromo = i.price < 0 || String(i.sku || '').toUpperCase().includes('PROMO');
        if (isPromo) {
          return `• [PROMO] ${i.name} (SKU: ${i.sku}) x${i.qty} = -${formatRupiah(Math.abs(i.subtotal))}`;
        }
        return `• ${i.name} (${formatRupiah(i.price)}/btl) x${i.qty} = ${formatRupiah(i.subtotal)}${i.isRedPrice ? ' [Harga Merah]' : ''}`;
      })
      .join('\n');

    return encodeURIComponent(
      `*NOTA PESANAN - ${brand?.NAME || 'ORTUKILL POS'}*${isRedPriceMode ? ' [MODE RESELLER]' : ''}\n` +
        `Waktu: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}\n` +
        (customerName ? `Pelanggan: ${customerName}\n` : '') +
        `Metode: ${paymentMethod}\n` +
        `--------------------------------\n` +
        `${itemLines}\n` +
        `--------------------------------\n` +
        `Subtotal: ${formatRupiah(subtotal)}\n` +
        (effectiveDiscount > 0 ? `Diskon: -${formatRupiah(effectiveDiscount)}\n` : '') +
        (shippingFee > 0 ? `Ongkir: +${formatRupiah(shippingFee)}\n` : '') +
        `*TOTAL: ${formatRupiah(finalTotal)}*\n` +
        (paymentMethod === 'CASH' && cashReceived ? `Tunai: ${formatRupiah(cashReceived)}\nKembalian: ${formatRupiah(change)}\n` : '') +
        `--------------------------------\n` +
        `TERIMAKASIH SELAMAT-BERSENANG-SENANG * ATLAS AMER KEDIRI SIAP SEDIA Melayani Setiap Kebutuhan Minum Kamu.\n` +
        `Info: ${brand?.PHONE || '08777-977-9796'}`
    );
  };

  const handleShareCartWA = () => {
    if (cart.length === 0) return;
    const text = getCartOrderShareText();
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleDownloadCartOrder = () => {
    if (cart.length === 0) return;
    try {
      const canvas = document.createElement('canvas');
      const width = 420;
      const padding = 24;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dynamicHeight = 380 + cart.length * 44;
      canvas.width = width;
      canvas.height = dynamicHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, dynamicHeight);

      ctx.fillStyle = '#0c0a09';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(brand?.NAME || 'ORTUKILL POS', width / 2, 40);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#44403c';
      ctx.fillText(brand?.SUBTITLE || 'POS / KASIR', width / 2, 60);
      ctx.fillText(brand?.DESCRIPTION_1 || '', width / 2, 78);
      ctx.fillText(`WA: ${brand?.PHONE || '087779779796'}`, width / 2, 96);

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
      ctx.fillText(`DRAF PESANAN / NOTA`, padding, y);
      y += 18;
      ctx.fillText(
        `Waktu    : ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        padding,
        y
      );
      y += 18;
      ctx.fillText(`Metode   : ${paymentMethod}`, padding, y);
      if (customerName) {
        y += 18;
        ctx.fillText(`Customer : ${customerName}`, padding, y);
      }

      y += 14;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 22;

      cart.forEach((item) => {
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
        ctx.fillText(formatRupiah(item.subtotal), width - padding, y);
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
      ctx.fillText(`Total Item: ${totalQty} botol`, padding, y);
      y += 18;

      if (discount > 0) {
        ctx.fillText(`Subtotal`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(formatRupiah(subtotal), width - padding, y);
        y += 18;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#dc2626';
        ctx.fillText(`Diskon`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(`-${formatRupiah(discount)}`, width - padding, y);
        y += 18;
      }

      if (shippingFee > 0) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ea580c';
        ctx.fillText(`Ongkir`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(`+${formatRupiah(shippingFee)}`, width - padding, y);
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
      ctx.fillText(formatRupiah(finalTotal), width - padding, y);
      y += 24;

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
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Nota_${customerName ? customerName.replace(/[^a-zA-Z0-9]/g, '_') : 'Pesanan'}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Error generating cart order PNG:', e);
    }
  };

  const handlePrintCart = () => {
    window.print();
  };

  return (
    <div className="pb-40 md:pb-24 max-w-7xl mx-auto space-y-4 sm:space-y-5">
      {/* 1. RINGKASAN SHIFT HARI INI (Tanpa tombol Buka Keranjang duplikat) */}
      <section
        id="pos-hero-section"
        className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] shadow-xs space-y-3.5 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <span>Total Omset Hari Ini</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  isConnectedGas
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-amber-600 dark:text-amber-400 font-semibold'
                }
              >
                {isConnectedGas ? 'Live Google Sheets' : 'Mode Lokal'}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-display text-[#0F172A] dark:text-[#F4F4F6] tracking-tight mt-0.5 num-tabular">
              {todayCount > 0 ? formatRupiah(todayOmset) : 'Rp 0'}
            </p>
            {!isConnectedGas && todayCount === 0 && (
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Belum ada transaksi hari ini · Siap melayani
              </p>
            )}
          </div>
        </div>

        {/* Sub-Metric Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-slate-50 border border-slate-200/80 dark:bg-[#24242B] dark:border-[#343440] rounded-xl p-2.5 sm:p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Estimasi Laba</p>
            <p className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 num-tabular">
              {todayCount > 0 ? formatRupiah(todayMargin) : 'Rp 0'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 dark:bg-[#24242B] dark:border-[#343440] rounded-xl p-2.5 sm:p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Total Transaksi</p>
            <p className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5 num-tabular">
              {todayCount > 0 ? `${todayCount} Nota` : '0 Nota'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 dark:bg-[#24242B] dark:border-[#343440] rounded-xl p-2.5 sm:p-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">Botol Keluar (≥30rb)</p>
            <p className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 num-tabular">
              {todayCount > 0 ? `${computedFilteredBottleQty} Botol` : '0 Botol'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 dark:bg-[#24242B] dark:border-[#343440] rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Status Kasir</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              Siap Melayani
            </p>
          </div>
        </div>
      </section>

      {/* 2. AKSI CEPAT KASIR (Tanpa duplikasi tombol Keranjang / Reseller) */}
      <section className="-mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          <button
            type="button"
            onClick={() => setIsPromoModalOpen(true)}
            className="flex items-center gap-2 bg-white dark:bg-[#1B1B20] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#2B2B33] hover:bg-slate-50 dark:hover:bg-[#24242B] active:scale-[0.97] transition-colors cursor-pointer whitespace-nowrap text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] min-h-[44px] shrink-0"
          >
            <Gift className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Daftar Promo</span>
            <span className="bg-slate-100 text-slate-700 dark:bg-[#24242B] dark:text-zinc-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md num-tabular">
              {promoCode ? promoCode : availablePromos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab?.('today')}
            className="flex items-center gap-2 bg-white dark:bg-[#1B1B20] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#2B2B33] hover:bg-slate-50 dark:hover:bg-[#24242B] active:scale-[0.97] transition-colors cursor-pointer whitespace-nowrap text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] min-h-[44px] shrink-0"
          >
            <Calendar className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
            <span>Nota Hari Ini</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab?.('history')}
            className="flex items-center gap-2 bg-white dark:bg-[#1B1B20] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#2B2B33] hover:bg-slate-50 dark:hover:bg-[#24242B] active:scale-[0.97] transition-colors cursor-pointer whitespace-nowrap text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] min-h-[44px] shrink-0"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
            <span>Laporan</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab?.('stock')}
            className="flex items-center gap-2 bg-white dark:bg-[#1B1B20] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#2B2B33] hover:bg-slate-50 dark:hover:bg-[#24242B] active:scale-[0.97] transition-colors cursor-pointer whitespace-nowrap text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] min-h-[44px] shrink-0"
          >
            <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Cek Stok</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab?.('shift')}
            className="flex items-center gap-2 bg-white dark:bg-[#1B1B20] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#2B2B33] hover:bg-slate-50 dark:hover:bg-[#24242B] active:scale-[0.97] transition-colors cursor-pointer whitespace-nowrap text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] min-h-[44px] shrink-0"
          >
            <Wallet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Tutup Shift</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab?.('gas')}
            className="flex items-center gap-2 bg-white dark:bg-[#1B1B20] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#2B2B33] hover:bg-slate-50 dark:hover:bg-[#24242B] active:scale-[0.97] transition-colors cursor-pointer whitespace-nowrap text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] min-h-[44px] shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
            <span>Google Sheets</span>
          </button>
        </div>
      </section>

      {/* 3. PENCARIAN SKU + CHIP TOGGLE UMUM | RESELLER + KATEGORI */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              id="search-product-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari minuman / SKU..."
              className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#2B2B33] rounded-xl text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] dark:focus:ring-purple-500/25 dark:focus:border-[#A855F7] transition-colors min-h-[46px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedQuery('');
                }}
                aria-label="Hapus pencarian"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] active:scale-[0.97] cursor-pointer"
              >
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#24242B] flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </span>
              </button>
            )}
          </div>

          {/* Tempat 1 (selalu kelihatan): Chip Toggle Umum | Reseller di sebelah kolom cari */}
          <div
            role="group"
            aria-label="Pilih mode harga"
            id="search-price-mode-chip"
            className={`shrink-0 inline-flex items-center p-1 rounded-xl border transition-colors min-h-[46px] ${
              isRedPriceMode
                ? 'bg-red-50 border-red-300 dark:bg-red-500/15 dark:border-red-500/45'
                : 'bg-white border-slate-200 dark:bg-[#1B1B20] dark:border-[#2B2B33]'
            }`}
          >
            <button
              type="button"
              onClick={() => onToggleRedPriceMode?.(false)}
              aria-pressed={!isRedPriceMode}
              className={`min-h-[36px] px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer ${
                !isRedPriceMode
                  ? 'bg-[#0F172A] text-white dark:bg-[#9333EA]'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6]'
              }`}
            >
              Umum
            </button>
            <button
              type="button"
              id="quick-toggle-red-price"
              onClick={() => onToggleRedPriceMode?.(true)}
              aria-pressed={isRedPriceMode}
              className={`min-h-[36px] px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer flex items-center gap-1 ${
                isRedPriceMode
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400'
              }`}
            >
              {isRedPriceMode && (
                <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" aria-hidden="true" />
              )}
              <span>Reseller</span>
            </button>
          </div>
        </div>

        {/* Category Chips */}
        <div className="-mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const label = cat === 'ALL' ? 'Semua Minuman' : cat;
              const count = categoryCounts[cat] || 0;

              return (
                <button
                  key={cat}
                  type="button"
                  id={`cat-chip-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors active:scale-[0.97] cursor-pointer min-h-[40px] shrink-0 ${
                    isSelected
                      ? 'bg-[#0F172A] text-white dark:bg-[#9333EA] dark:text-white dark:shadow-[0_0_14px_rgba(168,85,247,0.3)]'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 dark:bg-[#1B1B20] dark:text-zinc-300 dark:hover:bg-[#24242B] dark:border-[#2B2B33]'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold num-tabular ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-[#24242B] dark:text-zinc-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. KATALOG PRODUK RESPONSIF */}
      <section>
        <div className="flex items-center justify-between mb-2.5 px-0.5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs font-bold text-slate-600 dark:text-zinc-400 truncate">
              {selectedCategory === 'Daftar Promo'
                ? `Daftar Promo (${availablePromos.length})`
                : `Daftar Minuman (${filteredProducts.length})`}
            </p>
            {isRedPriceMode && (
              <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-md shrink-0">
                Harga Merah Aktif
              </span>
            )}
          </div>
          {selectedCategory !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className="text-xs text-[#2563EB] dark:text-[#C084FC] font-semibold hover:underline cursor-pointer shrink-0 min-h-[36px] flex items-center"
            >
              Lihat Semua
            </button>
          )}
        </div>

        {selectedCategory === 'Daftar Promo' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availablePromos.map((promo) => {
              const promoProduct: Product = {
                id: promo.id,
                sku: promo.code,
                name: promo.name,
                stock: 99999,
                price: -Math.abs(promo.value),
                cost: 0,
                category: 'Daftar Promo',
              };
              const inCart = cart.find((i) => i.productId === promo.id || i.sku === promo.code);
              const discountEach = Math.abs(promo.value);
              const totalDiscount = inCart ? Math.abs(inCart.subtotal) : discountEach;

              return (
                <div
                  key={promo.id}
                  id={`promo-card-${promo.code.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  className={`bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border transition-colors select-none flex flex-col justify-between ${
                    inCart
                      ? 'border-[#2563EB] ring-2 ring-blue-500/15 bg-blue-50/20 dark:border-[#A855F7] dark:ring-purple-500/20 dark:bg-purple-500/10'
                      : 'border-slate-200 hover:border-slate-300 dark:border-[#2B2B33] dark:hover:border-[#343440]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>Voucher Promo</span>
                      </span>
                      <span className="text-xs font-bold font-mono text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-500/15 dark:border-red-500/35 px-2 py-0.5 rounded-lg">
                        {promo.type === 'PERCENT' ? `Diskon ${promo.value}%` : `-${formatRupiah(promo.value)}/pcs`}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] leading-snug">
                      {promo.name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5">
                      SKU: {promo.code}
                    </p>
                    {promo.description && (
                      <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                        {promo.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#2B2B33] flex items-center justify-between gap-2 mt-4">
                    <div>
                      {inCart ? (
                        <p className="text-xs font-bold text-red-600 dark:text-red-400 font-mono num-tabular">
                          Total: -{formatRupiah(totalDiscount)}
                        </p>
                      ) : (
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {promo.minOrder ? `Min. ${formatRupiah(promo.minOrder)}` : 'Tanpa min. order'}
                        </span>
                      )}
                    </div>

                    <div>
                      {inCart ? (
                        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:border-[#343440] dark:text-[#F4F4F6] p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQty(inCart.productId, inCart.qty - 1);
                            }}
                            aria-label={`Kurangi kupon ${promo.name}`}
                            className="min-w-[40px] min-h-[40px] rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 dark:bg-[#1B1B20] dark:border-[#343440] dark:hover:bg-[#2E2E37] dark:text-[#F4F4F6] active:scale-[0.97] text-[#0F172A] cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold px-2 min-w-[24px] text-center num-tabular">
                            {inCart.qty}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQty(inCart.productId, inCart.qty + 1);
                            }}
                            aria-label={`Tambah kupon ${promo.name}`}
                            className="min-w-[40px] min-h-[40px] rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 dark:bg-[#1B1B20] dark:border-[#343440] dark:hover:bg-[#2E2E37] dark:text-[#F4F4F6] active:scale-[0.97] text-[#0F172A] cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddToCart(promoProduct)}
                          className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white font-bold text-xs flex items-center gap-1.5 active:scale-[0.97] transition-colors cursor-pointer min-h-[44px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pilih</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-10 text-center border border-slate-200 dark:border-[#2B2B33] space-y-2">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#24242B] text-slate-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">Tidak ada produk ditemukan</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
              Coba kata kunci lain atau beralih ke kategori Semua Minuman.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
            {filteredProducts.map((product) => (
              <PosProductCard
                key={product.id}
                product={product}
                inCartQty={cartQtyMap.get(product.id) || 0}
                isRedPriceMode={isRedPriceMode}
                onAddToCart={onAddToCart}
                onUpdateQty={onUpdateQty}
              />
            ))}
          </div>
        )}

        {/* DAFTAR PROMO DI LIST BAWAH */}
        {selectedCategory !== 'Daftar Promo' && (
          <div className="mt-6 bg-white dark:bg-[#1B1B20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-3.5 text-[#0F172A] dark:text-[#F4F4F6] transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-100 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">Daftar Promo</h4>
                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">· Diskon Kasir</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Pilih potongan promo langsung untuk transaksi keranjang</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCategory('Daftar Promo')}
                className="text-xs font-bold text-[#2563EB] hover:bg-blue-50 dark:text-[#C084FC] dark:hover:bg-purple-500/15 flex items-center justify-center gap-1 cursor-pointer bg-slate-50 dark:bg-[#24242B] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#343440] transition-colors min-h-[44px] self-start sm:self-auto active:scale-[0.97]"
              >
                <span>Lihat Semua Promo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {availablePromos.slice(0, 3).map((p) => {
                const promoProduct: Product = {
                  id: p.id,
                  sku: p.code,
                  name: p.name,
                  stock: 99999,
                  price: -Math.abs(p.value),
                  cost: 0,
                  category: 'Daftar Promo',
                };
                const inCart = cart.find((i) => i.productId === p.id || i.sku === p.code);
                const discountEach = Math.abs(p.value);
                const totalDiscount = inCart ? Math.abs(inCart.subtotal) : discountEach;

                return (
                  <div
                    key={p.id}
                    id={`promo-card-bottom-${p.code.replace(/[^a-zA-Z0-9]/g, '-')}`}
                    className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between ${
                      inCart
                        ? 'bg-blue-50/30 border-[#2563EB] ring-1 ring-[#2563EB] dark:bg-purple-500/15 dark:border-[#A855F7] dark:ring-[#A855F7]'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 dark:bg-[#24242B] dark:border-[#343440] dark:hover:border-purple-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              inCart
                                ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white'
                                : 'bg-white text-[#2563EB] border border-slate-200 dark:bg-[#1B1B20] dark:text-[#C084FC] dark:border-[#343440]'
                            }`}
                          >
                            %
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">{p.name}</h5>
                            <p className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 truncate">SKU: {p.code}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-500/15 dark:border-red-500/35 px-2 py-0.5 rounded-md font-mono shrink-0">
                          {p.type === 'PERCENT' ? `-${p.value}%` : `-${formatRupiah(p.value)}/pcs`}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3">
                        {p.description || `Potongan ${formatRupiah(p.value)}/pcs`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-200/80 dark:border-[#343440]">
                      <div>
                        {inCart ? (
                          <p className="text-xs font-bold text-red-600 dark:text-red-400 font-mono num-tabular">
                            Total: -{formatRupiah(totalDiscount)}
                          </p>
                        ) : (
                          <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                            {p.minOrder ? `Min. ${formatRupiah(p.minOrder)}` : 'Tanpa min. belanja'}
                          </span>
                        )}
                      </div>

                      <div>
                        {inCart ? (
                          <div className="flex items-center gap-1 bg-white border border-slate-200 text-[#0F172A] dark:bg-[#1B1B20] dark:border-[#343440] dark:text-[#F4F4F6] p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateQty(inCart.productId, inCart.qty - 1);
                              }}
                              aria-label={`Kurangi kupon ${p.name}`}
                              className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#2E2E37] active:scale-[0.97] text-[#0F172A] dark:text-[#F4F4F6] cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold px-1.5 min-w-[20px] text-center font-mono num-tabular">
                              {inCart.qty}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateQty(inCart.productId, inCart.qty + 1);
                              }}
                              aria-label={`Tambah kupon ${p.name}`}
                              className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#2E2E37] active:scale-[0.97] text-[#0F172A] dark:text-[#F4F4F6] cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAddToCart(promoProduct)}
                            className="text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] active:scale-[0.97] px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1 min-h-[44px]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Pilih</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 5. SATU PINTU MASUK KERANJANG: BAR MELAYANG DI ATAS BOTTOM NAVIGATION */}
      {cart.length > 0 && (
        <aside
          aria-label="Keranjang Belanja"
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px)+8px)] md:bottom-6 left-3 right-3 max-w-lg mx-auto z-30 no-print"
        >
          <div className="bg-[#0F172A] dark:bg-[#1B1B20] text-white rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 shadow-xl border border-slate-800 dark:border-purple-500/50">
            <button
              type="button"
              onClick={() => setIsCartSheetOpen(true)}
              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 pl-1 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#2563EB] dark:bg-[#9333EA] flex items-center justify-center text-white font-bold relative shrink-0">
                <ShoppingBag className="w-4 h-4" />
                <span
                  key={totalQty}
                  className="animate-cart-pop absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white text-[10px] font-bold min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center ring-2 ring-[#0F172A] dark:ring-[#1B1B20] num-tabular"
                >
                  {totalQty}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[11px] text-slate-300 dark:text-zinc-400 font-medium truncate">
                    {totalQty} Item · Total
                  </p>
                  {isRedPriceMode && (
                    <span className="text-[9px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded uppercase shrink-0">
                      Reseller
                    </span>
                  )}
                </div>
                <p className="text-sm sm:text-base font-extrabold text-white truncate leading-tight num-tabular">
                  {formatRupiah(finalTotal)}
                </p>
              </div>
            </button>

            <button
              type="button"
              id="btn-open-floating-cart"
              onClick={() => setIsCartSheetOpen(true)}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] active:scale-[0.97] text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[44px]"
            >
              <span>Lihat · Bayar</span>
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* 6. SHEET KERANJANG: 92dvh TETAP, TIGA ZONA (ATAS TETAP, TENGAH SCROLL, BAWAH MENEMPEL) */}
      {isCartSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keranjang Kasir"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div
            className="fixed inset-0"
            onClick={() => setIsCartSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl h-[92dvh] sm:h-auto sm:max-h-[90dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 text-[#0F172A] dark:text-[#F4F4F6]">
            {/* ZONA 1 (ATAS TETAP): Handle + Judul + Jumlah Item + Kosongkan + Tutup + Segmen Umum | Reseller */}
            <div className="px-4 sm:px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0 space-y-2.5">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto sm:hidden" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#2563EB] dark:bg-[#9333EA] flex items-center justify-center text-white shrink-0">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-[#0F172A] dark:text-[#F4F4F6] truncate">
                      Keranjang ({totalQty} item)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {isRedPriceMode ? 'Harga Merah Reseller aktif' : 'Harga standar kasir'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClearCartConfirm(true)}
                      className="min-h-[44px] px-3 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors active:scale-[0.97] cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCartSheetOpen(false)}
                    aria-label="Tutup keranjang"
                    className="min-w-[44px] min-h-[44px] -mr-1 rounded-full bg-white border border-slate-200 dark:bg-[#1B1B20] dark:border-[#343440] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-slate-100 dark:hover:bg-[#2E2E37] transition-colors active:scale-[0.97] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tempat 2 (selalu kelihatan di atas sheet keranjang): Segmen Umum | Reseller */}
              <div
                role="group"
                aria-label="Mode Harga Keranjang"
                id="cart-price-mode-segment"
                className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440]"
              >
                <button
                  type="button"
                  onClick={() => onToggleRedPriceMode?.(false)}
                  aria-pressed={!isRedPriceMode}
                  className={`min-h-[40px] px-3 rounded-lg text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer ${
                    !isRedPriceMode
                      ? 'bg-[#0F172A] text-white dark:bg-[#9333EA]'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-[#24242B]'
                  }`}
                >
                  Umum (Harga Biasa)
                </button>
                <button
                  type="button"
                  onClick={() => onToggleRedPriceMode?.(true)}
                  aria-pressed={isRedPriceMode}
                  className={`min-h-[40px] px-3 rounded-lg text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer flex items-center justify-center gap-1.5 ${
                    isRedPriceMode
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400'
                  }`}
                >
                  <span>Reseller</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      isRedPriceMode
                        ? 'bg-white/20 text-white'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    }`}
                  >
                    Merah
                  </span>
                </button>
              </div>
            </div>

            {/* ZONA 2 (TENGAH — SATU-SATUNYA AREA SCROLL): Daftar Item + Opsi Lainnya */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3.5 space-y-3">
              {cart.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#24242B] text-slate-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">Keranjang kosong</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Tambahkan minuman dari katalog kasir untuk mulai transaksi.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cart.map((item) => (
                    <PosCartItemRow
                      key={item.productId}
                      item={item}
                      onUpdateQty={onUpdateQty}
                      onUpdateItemPrice={onUpdateItemPrice}
                      onRemoveItem={handleRemoveWithUndo}
                    />
                  ))}
                </div>
              )}

              {/* Info Sheets saat Mode Reseller Aktif */}
              {isRedPriceMode && cart.length > 0 && (
                <div className="p-2.5 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/35 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-red-700 dark:text-red-400">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                      <span>Catatan Google Sheets:</span>
                    </span>
                    <span className="font-mono font-bold num-tabular">{formatRupiah(sheetsRegularTotal)}</span>
                  </div>
                  <p className="text-[10px] text-red-700/85 dark:text-red-300/85 leading-snug">
                    LOG_PENJUALAN tetap mencatat harga biasa secara otomatis.
                  </p>
                </div>
              )}

              {/* Bagian Lipat "Opsi lainnya" (Collapsed secara default) */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#343440] bg-slate-50/70 dark:bg-[#24242B]/70 overflow-hidden">
                <button
                  type="button"
                  id="btn-toggle-cart-more-options"
                  aria-expanded={isMoreOptionsOpen}
                  onClick={() => setIsMoreOptionsOpen((prev) => !prev)}
                  className="w-full min-h-[48px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-100/70 dark:hover:bg-[#2E2E37] transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] block">
                      Opsi lainnya
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate block">
                      {moreOptionsSummary || 'Pelanggan/catatan, diskon, ongkir, tanggal, ekspor'}
                    </span>
                  </div>
                  {isMoreOptionsOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                  )}
                </button>

                {isMoreOptionsOpen && (
                  <div className="px-3.5 pb-4 pt-2 border-t border-slate-200 dark:border-[#343440] space-y-4 bg-white dark:bg-[#1B1B20]">
                    {/* Tanggal Transaksi */}
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-[#343440] bg-slate-50 dark:bg-[#24242B] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CalendarDays className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC] shrink-0" />
                          <span className="text-xs font-bold truncate">Tanggal Nota</span>
                        </div>
                        {txDate !== todayYmd && (
                          <button
                            type="button"
                            onClick={() => setTxDate(todayYmd)}
                            className="min-h-[32px] text-[11px] font-bold text-white bg-[#2563EB] dark:bg-[#9333EA] px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            Hari Ini
                          </button>
                        )}
                      </div>
                      <input
                        type="date"
                        aria-label="Pilih tanggal transaksi"
                        value={txDate}
                        onChange={(e) => {
                          if (e.target.value) setTxDate(e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                      />
                      <div className="text-[11px] truncate">
                        {txDate === todayYmd ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <LiveClockLabel />
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5" title={timeExplanation}>
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Jam nota: {txTime} (+1 mnt nota terakhir)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pelanggan / Meja / Catatan */}
                    <div>
                      <label
                        htmlFor="customer-name-input"
                        className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1.5"
                      >
                        Pelanggan / Meja / Catatan
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="text"
                          id="customer-name-input"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Contoh: Mas Budi / Meja 03 / Tanpa es"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                        />
                      </div>
                    </div>

                    {/* Diskon / Promo */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="discount-input"
                          className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <Gift className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
                          <span>Diskon / Promo</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsPromoModalOpen(true)}
                          className="min-h-[36px] text-[11px] text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] font-bold flex items-center gap-1 cursor-pointer px-3 py-1 rounded-lg active:scale-[0.97]"
                        >
                          <Gift className="w-3 h-3" />
                          <span>Pilih Promo</span>
                        </button>
                      </div>

                      {promoCode && discount > 0 && (
                        <div className="p-2.5 bg-blue-50 border border-blue-200 dark:bg-purple-500/15 dark:border-purple-500/40 rounded-xl flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 bg-[#2563EB] dark:bg-[#9333EA] text-white font-mono text-[10px] font-bold rounded-md shrink-0">
                              {promoCode}
                            </span>
                            <span className="font-semibold truncate">{promoName || 'Promo Aktif'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscount(0);
                              setPromoCode?.('');
                              setPromoName?.('');
                            }}
                            aria-label="Hapus promo"
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-500 hover:text-red-600 cursor-pointer shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="relative">
                        <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="text"
                          inputMode="numeric"
                          id="discount-input"
                          value={discount === 0 ? '' : discount.toLocaleString('id-ID')}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0);
                            setDiscount(val);
                            if (val === 0) {
                              setPromoCode?.('');
                              setPromoName?.('');
                            } else if (!promoCode) {
                              setPromoCode?.('DISKON-MANUAL');
                              setPromoName?.('Diskon Manual Kasir');
                            }
                          }}
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm font-mono text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[
                          { code: 'PROMO-5K', name: 'Diskon Rp 5.000', val: 5000 },
                          { code: 'PROMO-10K', name: 'Diskon Rp 10.000', val: 10000 },
                          { code: 'PROMO-20K', name: 'Diskon Rp 20.000', val: 20000 },
                        ].map((pre) => (
                          <button
                            key={pre.code}
                            type="button"
                            onClick={() => {
                              setDiscount(pre.val);
                              setPromoCode?.(pre.code);
                              setPromoName?.(pre.name);
                            }}
                            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer num-tabular active:scale-[0.97] ${
                              discount === pre.val && promoCode === pre.code
                                ? 'border-[#2563EB] bg-[#2563EB] dark:border-[#A855F7] dark:bg-[#9333EA] text-white font-bold'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#343440] dark:bg-[#24242B] dark:text-zinc-300'
                            }`}
                          >
                            -{formatRupiah(pre.val)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ongkos Kirim */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="shipping-fee-input"
                          className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
                          <span>Ongkos Kirim (LAIN-LAIN)</span>
                        </label>
                        {shippingFee > 0 && (
                          <button
                            type="button"
                            onClick={() => setShippingFee(0)}
                            className="text-[11px] text-red-600 dark:text-red-400 hover:underline font-semibold cursor-pointer min-h-[32px]"
                          >
                            Hapus Ongkir
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-zinc-500 font-mono">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          id="shipping-fee-input"
                          value={shippingFee === 0 ? '' : shippingFee.toLocaleString('id-ID')}
                          onChange={(e) =>
                            setShippingFee(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))
                          }
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm font-mono text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[0, 5000, 10000, 15000, 20000].map((fee) => (
                          <button
                            key={fee}
                            type="button"
                            onClick={() => setShippingFee(fee)}
                            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium border transition-colors cursor-pointer num-tabular active:scale-[0.97] ${
                              shippingFee === fee
                                ? 'border-[#2563EB] bg-[#2563EB] dark:border-[#A855F7] dark:bg-[#9333EA] text-white font-bold'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#343440] dark:bg-[#24242B] dark:text-zinc-300'
                            }`}
                          >
                            {fee === 0 ? 'Gratis' : formatRupiah(fee)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tombol Ekspor / Bagikan Draf */}
                    <div className="pt-2 border-t border-slate-200 dark:border-[#343440]">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                        Draf Pesanan
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={handlePrintCart}
                          disabled={cart.length === 0}
                          className="min-h-[44px] flex items-center justify-center gap-1.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6] font-bold text-xs cursor-pointer disabled:opacity-40 active:scale-[0.97]"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleShareCartWA}
                          disabled={cart.length === 0}
                          className="min-h-[44px] flex items-center justify-center gap-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-400 font-bold text-xs cursor-pointer disabled:opacity-40 active:scale-[0.97]"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WA Teks</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadCartOrder}
                          disabled={cart.length === 0}
                          className="min-h-[44px] flex items-center justify-center gap-1.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6] font-bold text-xs cursor-pointer disabled:opacity-40 active:scale-[0.97]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Simpan</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ZONA 3 (BAWAH MENEMPEL, TIDAK IKUT SCROLL): Ringkasan Total, Metode Bayar (Tunai/Transfer/QRIS), Uang Diterima + Kembalian, 1 Tombol Bayar Besar */}
            <div className="px-4 sm:px-5 pt-3 pb-safe border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0 space-y-2.5">
              {/* Total Summary */}
              <div className="space-y-1">
                {(effectiveDiscount > 0 || shippingFee > 0) && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400 flex-wrap">
                    <span className="num-tabular">Subtotal: {formatRupiah(subtotal)}</span>
                    <div className="flex items-center gap-2">
                      {effectiveDiscount > 0 && (
                        <span className="text-red-600 dark:text-red-400 font-bold num-tabular">
                          Diskon -{formatRupiah(effectiveDiscount)}
                        </span>
                      )}
                      {shippingFee > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold num-tabular">
                          Ongkir +{formatRupiah(shippingFee)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6]">
                    Total Bayar
                  </span>
                  <span className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-[#C084FC] font-mono num-tabular">
                    {formatRupiah(finalTotal)}
                  </span>
                </div>
              </div>

              {/* 3 Segmen Besar Metode Bayar: Tunai / Transfer / QRIS */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  id="btn-pay-cash"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`min-h-[48px] px-2 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.97] cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'border-[#2563EB] bg-[#2563EB] dark:border-[#A855F7] dark:bg-[#9333EA] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#343440] dark:bg-[#1B1B20] dark:text-zinc-300'
                  }`}
                >
                  <Banknote className="w-4 h-4 shrink-0" />
                  <span>Tunai</span>
                </button>

                <button
                  type="button"
                  id="btn-pay-transfer"
                  onClick={() => setPaymentMethod('TRANSFER')}
                  className={`min-h-[48px] px-2 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.97] cursor-pointer ${
                    paymentMethod === 'TRANSFER'
                      ? 'border-[#2563EB] bg-[#2563EB] dark:border-[#A855F7] dark:bg-[#9333EA] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#343440] dark:bg-[#1B1B20] dark:text-zinc-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>Transfer</span>
                </button>

                <button
                  type="button"
                  id="btn-pay-qris"
                  onClick={() => setPaymentMethod('QRIS')}
                  className={`min-h-[48px] px-2 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.97] cursor-pointer ${
                    paymentMethod === 'QRIS'
                      ? 'border-[#2563EB] bg-[#2563EB] dark:border-[#A855F7] dark:bg-[#9333EA] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#343440] dark:bg-[#1B1B20] dark:text-zinc-300'
                  }`}
                >
                  <QrCode className="w-4 h-4 shrink-0" />
                  <span>QRIS</span>
                </button>
              </div>

              {/* Input Uang Diterima + Tombol Cepat + Kembalian Besar untuk Tunai */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-2 bg-white dark:bg-[#1B1B20] p-3 rounded-2xl border border-slate-200 dark:border-[#343440]">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="cash-received-input"
                      className="text-xs font-bold text-slate-600 dark:text-zinc-300 shrink-0"
                    >
                      Uang Diterima
                    </label>
                    <div className="relative flex-1 max-w-[180px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-slate-400 dark:text-zinc-500 pointer-events-none">
                        Rp
                      </span>
                      <input
                        id="cash-received-input"
                        type="text"
                        inputMode="numeric"
                        value={cashReceived === 0 ? '' : cashReceived.toLocaleString('id-ID')}
                        onChange={(e) => {
                          const numeric = Number(e.target.value.replace(/\D/g, '')) || 0;
                          setCashReceived(numeric);
                        }}
                        placeholder="0"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-right text-sm font-mono font-extrabold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] num-tabular min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* Quick Cash Buttons: Uang Pas, 50rb, 100rb */}
                  <div className="flex flex-wrap gap-2">
                    {quickCashOptions.map((opt) => (
                      <button
                        key={opt.amount}
                        type="button"
                        onClick={() => setCashReceived(opt.amount)}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors active:scale-[0.97] cursor-pointer num-tabular flex-1 min-w-[78px] ${
                          cashReceived === opt.amount
                            ? 'border-[#2563EB] bg-[#2563EB] dark:border-[#A855F7] dark:bg-[#9333EA] text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#343440] dark:bg-[#24242B] dark:text-zinc-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian Besar (Hijau bila cukup, Merah "Kurang Rp X" bila kurang) */}
                  {cashReceived > 0 && (
                    <div
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                        cashReceived >= finalTotal
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-400'
                          : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/35 dark:text-red-400'
                      }`}
                    >
                      <span className="text-xs font-bold">
                        {cashReceived >= finalTotal ? 'Kembalian' : 'Kurang Bayar'}
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono num-tabular">
                        {cashReceived >= finalTotal
                          ? formatRupiah(change)
                          : `Kurang ${formatRupiah(finalTotal - cashReceived)}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 1 Tombol Bayar Besar (>= 52px) + Alasan singkat di bawah saat nonaktif */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={handleCheckoutAndClose}
                  disabled={cart.length === 0 || isCashShort || isSubmitting}
                  id="btn-process-checkout"
                  className={`w-full min-h-[52px] py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base tracking-wide transition-colors flex items-center justify-center gap-2 ${
                    cart.length === 0 || isCashShort || isSubmitting
                      ? 'bg-slate-200 text-slate-400 dark:bg-[#2E2E37] dark:text-zinc-500 cursor-not-allowed'
                      : 'bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] active:scale-[0.97] text-white cursor-pointer'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current text-blue-200 dark:text-purple-200" />
                      <span>Bayar · {formatRupiah(finalTotal)}</span>
                    </>
                  )}
                </button>
                {disabledCheckoutReason && (
                  <p className="text-[11px] font-semibold text-center text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{disabledCheckoutReason}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Kosongkan Keranjang */}
      <AppConfirmDialog
        isOpen={showClearCartConfirm}
        title="Kosongkan Keranjang?"
        description={`Semua ${totalQty} item di keranjang saat ini akan dihapus.`}
        confirmLabel="Ya, Kosongkan"
        cancelLabel="Batal"
        variant="danger"
        onCancel={() => setShowClearCartConfirm(false)}
        onConfirm={() => {
          setShowClearCartConfirm(false);
          onClearCart();
        }}
      />

      {/* Promo & Voucher Selector Modal */}
      <PromoSelectorModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        subtotal={subtotal}
        currentPromoCode={promoCode}
        onApplyPromo={(p, calcDisc) => {
          setDiscount(calcDisc);
          setPromoCode?.(p.code);
          setPromoName?.(p.name);
        }}
        onRemovePromo={() => {
          setDiscount(0);
          setPromoCode?.('');
          setPromoName?.('');
        }}
      />
    </div>
  );
};
