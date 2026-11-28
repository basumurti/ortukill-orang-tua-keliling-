import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { Button, Card, Chip, Drawer, Input, Separator } from '@heroui/react';
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
import { AnimatedTabPill } from './ui/motion/MotionPrimitives';
import { SmartCountUp, FadeContent } from './ui/animated/ReactBitsPrimitives';
import { LiquidSurface } from './ui/glass/LiquidSurface';

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
    <Card
      id={`product-card-${product.sku}`}
      variant={isOutOfStock ? 'secondary' : 'default'}
      className={`[content-visibility:auto] [contain-intrinsic-size:auto_220px] rounded-2xl p-3 sm:p-4 gap-0 border transition-colors duration-150 flex flex-col justify-between select-none relative min-w-0 shadow-none ${
        isOutOfStock
          ? 'border-[var(--border)] opacity-55 bg-[var(--surface-secondary)]'
          : inCartQty > 0
          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20 bg-[var(--accent-soft)]/50'
          : isRedApplied
          ? 'border-[var(--warning)]/70 bg-[var(--warning-soft)]/45 hover:border-[var(--warning)]'
          : 'border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--surface)]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
          <span className="text-[11px] font-semibold text-[var(--muted)] truncate min-w-0">
            {product.category || 'Minuman'}
          </span>
          <Chip
            size="sm"
            variant="soft"
            color={isOutOfStock ? 'danger' : product.stock < 10 ? 'warning' : 'success'}
            className="text-[10px] font-bold rounded-md shrink-0 num-tabular"
          >
            <Chip.Label>{isOutOfStock ? 'Habis' : `Sisa ${product.stock}`}</Chip.Label>
          </Chip>
        </div>

        <div className="mb-3">
          <h3 className="text-xs sm:text-sm font-bold text-[var(--foreground)] leading-snug line-clamp-2 break-words min-h-[2.25rem] sm:min-h-[2.5rem]">
            {product.name}
          </h3>
          <p className="text-[10px] font-mono text-[var(--muted)] mt-1 truncate">
            {product.sku}
          </p>
        </div>
      </div>

      <div className="pt-2.5 border-t border-[var(--separator)] flex flex-col gap-2 mt-auto min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className={`text-sm font-extrabold tracking-tight num-tabular ${
                isRedApplied
                  ? 'text-amber-700 dark:text-[var(--warning)]'
                  : 'text-[var(--foreground)]'
              }`}
            >
              {formatRupiah(displayPrice)}
            </p>
            {isRedApplied && (
              <Chip
                size="sm"
                variant="primary"
                color="warning"
                className="text-[9px] font-bold px-1.5 py-0 rounded uppercase tracking-wide shrink-0"
              >
                <Chip.Label>Reseller</Chip.Label>
              </Chip>
            )}
          </div>
          {isRedApplied ? (
            <p className="text-[10px] font-semibold text-amber-700 dark:text-[var(--warning)] num-tabular truncate mt-0.5">
              Normal {formatRupiah(product.price)} (+{formatRupiah(redMarkup)})
            </p>
          ) : (
            <p className="text-[10px] font-semibold text-emerald-700 dark:text-[var(--success)] num-tabular truncate mt-0.5">
              +Laba {formatRupiah(product.price - product.cost)}
            </p>
          )}
        </div>

        <div>
          {inCartQty > 0 ? (
            <div className="w-full flex items-center justify-between gap-1 bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] p-1 rounded-xl">
              <Button
                isIconOnly
                size="sm"
                variant="outline"
                onPress={() => onUpdateQty(product.id, inCartQty - 1)}
                className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] shrink-0"
                aria-label={`Kurangi ${product.name}`}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-xs font-extrabold flex-1 min-w-0 text-center num-tabular text-[var(--foreground)]">
                {inCartQty}
              </span>
              <Button
                isIconOnly
                size="sm"
                variant="primary"
                isDisabled={inCartQty >= product.stock}
                onPress={() => onUpdateQty(product.id, inCartQty + 1)}
                className={`min-w-[44px] min-h-[44px] rounded-lg shrink-0 ${
                  isRedApplied
                    ? 'bg-[var(--warning)] text-[var(--warning-foreground)]'
                    : ''
                }`}
                aria-label={`Tambah ${product.name}`}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              fullWidth
              size="sm"
              variant={isOutOfStock ? 'secondary' : 'primary'}
              isDisabled={isOutOfStock}
              onPress={() => !isOutOfStock && onAddToCart(product)}
              aria-label={`Tambah ${product.name}`}
              className={`rounded-xl text-xs font-bold min-h-[44px] ${
                isOutOfStock
                  ? 'bg-[var(--surface-tertiary)] text-[var(--muted)]'
                  : isRedApplied
                  ? 'bg-[var(--warning)] text-[var(--warning-foreground)]'
                  : ''
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isOutOfStock ? 'Habis' : 'Pilih'}</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
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
      <Card
        variant="secondary"
        className="p-3 rounded-2xl gap-2.5 border border-[var(--danger)]/35 bg-[var(--danger-soft)]/70 shadow-none min-w-0"
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Chip
                size="sm"
                variant="primary"
                color="danger"
                className="text-[10px] font-bold rounded-md shrink-0"
              >
                <Gift className="w-2.5 h-2.5" />
                <Chip.Label>Promo</Chip.Label>
              </Chip>
              <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] leading-snug line-clamp-2 break-words min-w-0">
                {item.name}
              </p>
            </div>
            <p className="text-[11px] font-mono text-[var(--danger)] font-bold num-tabular mt-1 truncate">
              Potongan {formatRupiah(Math.abs(item.price))}/pcs
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <p className="text-xs sm:text-sm font-extrabold text-[var(--danger)] font-mono num-tabular text-right">
              -{formatRupiah(Math.abs(item.subtotal))}
            </p>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => onRemoveItem(item)}
              aria-label={`Hapus promo ${item.name}`}
              className="min-w-[44px] min-h-[44px] rounded-xl text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--danger)]/20">
          <span className="text-xs text-[var(--danger)] font-semibold truncate">
            Jumlah Kupon:
          </span>

          <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--danger)]/35 rounded-xl p-1 shrink-0">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => {
                if (item.qty <= 1) {
                  onRemoveItem(item);
                } else {
                  onUpdateQty(item.productId, item.qty - 1);
                }
              }}
              aria-label={`Kurangi kupon ${item.name}`}
              className="min-w-[44px] min-h-[44px] rounded-lg text-[var(--foreground)]"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="font-bold text-xs sm:text-sm text-[var(--danger)] px-2 min-w-[28px] text-center font-mono num-tabular">
              {item.qty}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => onUpdateQty(item.productId, item.qty + 1)}
              aria-label={`Tambah kupon ${item.name}`}
              className="min-w-[44px] min-h-[44px] rounded-lg text-[var(--foreground)]"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      variant={item.isRedPrice ? 'secondary' : 'default'}
      className={`p-3 rounded-2xl gap-2.5 border shadow-none min-w-0 ${
        item.isRedPrice
          ? 'bg-[var(--warning-soft)]/50 border-[var(--warning)]/60'
          : 'bg-[var(--surface)] border-[var(--border)]'
      }`}
    >
      {/* Row 1: Product Name (2-line clamp) + Right-aligned Subtotal + Trash 44px */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] leading-snug line-clamp-2 break-words">
            {item.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[11px] font-mono text-[var(--muted)] num-tabular">
              {formatRupiah(item.price)} / btl
            </span>
            {item.isRedPrice && (
              <Chip
                size="sm"
                variant="primary"
                color="warning"
                className="text-[10px] font-bold rounded-md"
              >
                <Chip.Label>Harga Merah</Chip.Label>
              </Chip>
            )}
            {isCustomPrice && (
              <Chip
                size="sm"
                variant="soft"
                color="accent"
                className="text-[10px] font-bold rounded-md"
              >
                <Chip.Label>Diubah</Chip.Label>
              </Chip>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] font-mono num-tabular text-right">
            {formatRupiah(item.subtotal)}
          </p>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => onRemoveItem(item)}
            aria-label={`Hapus ${item.name} dari keranjang`}
            className="min-w-[44px] min-h-[44px] rounded-xl text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Row 2: Existing Unit Price Input + 44px Qty Control */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-[var(--border)] flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[11px] text-[var(--muted)] font-mono font-bold pointer-events-none z-10">
              Rp
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              aria-label={`Harga satuan ${item.name}`}
              value={item.price}
              onChange={(e) => onUpdateItemPrice(item.productId, Number(e.target.value) || 0)}
              className="w-28 pl-8 pr-2 py-1.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs font-mono font-bold text-[var(--foreground)] min-h-[40px]"
            />
          </div>
          {isCustomPrice && item.originalPrice !== undefined && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onUpdateItemPrice(item.productId, item.originalPrice!)}
              className="min-h-[36px] px-2 text-[11px] text-[var(--accent)] font-bold"
              aria-label="Kembalikan ke harga katalog asli"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl p-1 shrink-0">
          <Button
            isIconOnly
            size="sm"
            variant="outline"
            onPress={() => {
              if (item.qty <= 1) {
                onRemoveItem(item);
              } else {
                onUpdateQty(item.productId, item.qty - 1);
              }
            }}
            aria-label={`Kurangi jumlah ${item.name}`}
            className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="font-extrabold text-xs sm:text-sm text-[var(--foreground)] px-1.5 min-w-[28px] text-center font-mono num-tabular">
            {item.qty}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="primary"
            onPress={() => onUpdateQty(item.productId, item.qty + 1)}
            aria-label={`Tambah jumlah ${item.name}`}
            className="min-w-[44px] min-h-[44px] rounded-lg"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
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
  isRedPriceMode = true,
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
      <Card
        id="pos-hero-section"
        variant="default"
        className="rounded-2xl p-4 sm:p-5 border border-[var(--border)] shadow-xs space-y-3.5 gap-0 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] font-medium">
              <span>Total Omset Hari Ini</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  isConnectedGas
                    ? 'text-emerald-700 dark:text-[var(--success)] font-semibold'
                    : 'text-amber-700 dark:text-[var(--warning)] font-semibold'
                }
              >
                {isConnectedGas ? 'Live Google Sheets' : 'Mode Lokal'}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)] tracking-tight mt-0.5 num-tabular">
              <SmartCountUp value={todayCount > 0 ? todayOmset : 0} formatter={formatRupiah} />
            </p>
            {!isConnectedGas && todayCount === 0 && (
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                Belum ada transaksi hari ini · Siap melayani
              </p>
            )}
          </div>
        </div>

        {/* Sub-Metric Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl p-2.5 sm:p-3">
            <p className="text-[11px] font-medium text-[var(--muted)]">Estimasi Laba</p>
            <p className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-[var(--success)] mt-0.5 num-tabular">
              <SmartCountUp value={todayCount > 0 ? todayMargin : 0} formatter={formatRupiah} />
            </p>
          </div>

          <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl p-2.5 sm:p-3">
            <p className="text-[11px] font-medium text-[var(--muted)]">Total Transaksi</p>
            <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)] mt-0.5 num-tabular">
              <SmartCountUp value={todayCount} formatter={(v) => `${Math.round(v)} Nota`} />
            </p>
          </div>

          <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl p-2.5 sm:p-3">
            <p className="text-[11px] font-medium text-[var(--muted)] truncate">Botol Keluar (≥30rb)</p>
            <p className="text-sm sm:text-base font-extrabold text-amber-700 dark:text-[var(--warning)] mt-0.5 num-tabular">
              <SmartCountUp value={todayCount > 0 ? computedFilteredBottleQty : 0} formatter={(v) => `${Math.round(v)} Botol`} />
            </p>
          </div>

          <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <p className="text-[11px] font-medium text-[var(--muted)]">Status Kasir</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-[var(--success)] mt-0.5">
              Siap Melayani
            </p>
          </div>
        </div>
      </Card>

      {/* 2. AKSI CEPAT KASIR (Tanpa duplikasi tombol Keranjang / Reseller) */}
      <section className="-mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          <Button
            variant="outline"
            size="sm"
            onPress={() => setIsPromoModalOpen(true)}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2 whitespace-nowrap text-xs font-semibold text-[var(--foreground)] min-h-[44px] shrink-0"
          >
            <Gift className="w-3.5 h-3.5 text-[var(--danger)]" />
            <span>Daftar Promo</span>
            <Chip size="sm" variant="soft" color="default" className="text-[10px] font-bold rounded-md num-tabular">
              <Chip.Label>{promoCode ? promoCode : availablePromos.length}</Chip.Label>
            </Chip>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onPress={() => onNavigateTab?.('today')}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2 whitespace-nowrap text-xs font-semibold text-[var(--foreground)] min-h-[44px] shrink-0"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Nota Hari Ini</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onPress={() => onNavigateTab?.('history')}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2 whitespace-nowrap text-xs font-semibold text-[var(--foreground)] min-h-[44px] shrink-0"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Laporan</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onPress={() => onNavigateTab?.('stock')}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2 whitespace-nowrap text-xs font-semibold text-[var(--foreground)] min-h-[44px] shrink-0"
          >
            <Package className="w-3.5 h-3.5 text-emerald-700 dark:text-[var(--success)]" />
            <span>Cek Stok</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onPress={() => onNavigateTab?.('shift')}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2 whitespace-nowrap text-xs font-semibold text-[var(--foreground)] min-h-[44px] shrink-0"
          >
            <Wallet className="w-3.5 h-3.5 text-amber-700 dark:text-[var(--warning)]" />
            <span>Tutup Shift</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onPress={() => onNavigateTab?.('gas')}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2 whitespace-nowrap text-xs font-semibold text-[var(--foreground)] min-h-[44px] shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--muted)]" />
            <span>Google Sheets</span>
          </Button>
        </div>
      </section>

      {/* 3. PENCARIAN SKU + CHIP TOGGLE UMUM | RESELLER + KATEGORI */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none z-10" />
            <Input
              fullWidth
              type="text"
              id="search-product-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari minuman / SKU..."
              className="pl-10 pr-11 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] min-h-[46px]"
            />
            {searchQuery && (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => {
                  setSearchQuery('');
                  setDebouncedQuery('');
                }}
                aria-label="Hapus pencarian"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] rounded-xl text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <span className="w-6 h-6 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </span>
              </Button>
            )}
          </div>

          {/* Tempat 1 (selalu kelihatan): Chip Toggle Umum | Reseller di sebelah kolom cari */}
          <div
            role="group"
            aria-label="Pilih mode harga"
            id="search-price-mode-chip"
            className={`shrink-0 inline-flex items-center p-1 rounded-xl border transition-colors min-h-[46px] ${
              isRedPriceMode
                ? 'bg-[var(--warning-soft)] border-[var(--warning)]'
                : 'bg-[var(--surface)] border-[var(--border)]'
            }`}
          >
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onToggleRedPriceMode?.(false)}
              aria-pressed={!isRedPriceMode}
              className={`relative min-h-[36px] px-2.5 sm:px-3 rounded-lg text-xs font-bold ${
                !isRedPriceMode
                  ? 'text-[var(--accent-foreground)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {!isRedPriceMode && (
                <AnimatedTabPill
                  layoutId="pos-search-price-mode-pill"
                  className="absolute inset-0 rounded-lg bg-[var(--accent)] pointer-events-none"
                />
              )}
              <span className="relative z-10">Umum</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              id="quick-toggle-red-price"
              onPress={() => onToggleRedPriceMode?.(true)}
              aria-pressed={isRedPriceMode}
              className={`relative min-h-[36px] px-2.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 ${
                isRedPriceMode
                  ? 'text-[var(--warning-foreground)]'
                  : 'text-[var(--muted)] hover:text-amber-700 dark:hover:text-[var(--warning)]'
              }`}
            >
              {isRedPriceMode && (
                <AnimatedTabPill
                  layoutId="pos-search-price-mode-pill"
                  className="absolute inset-0 rounded-lg bg-[var(--warning)] shadow-xs pointer-events-none"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1">
                {isRedPriceMode && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning-foreground)] shrink-0" aria-hidden="true" />
                )}
                <span>Reseller</span>
              </span>
            </Button>
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
                <Button
                  key={cat}
                  size="sm"
                  variant={isSelected ? 'primary' : 'outline'}
                  id={`cat-chip-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  onPress={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap min-h-[40px] shrink-0 ${
                    isSelected
                      ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                      : 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold num-tabular ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--surface-secondary)] text-[var(--muted)]'
                    }`}
                  >
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. KATALOG PRODUK RESPONSIF */}
      <section>
        <div className="flex items-center justify-between mb-2.5 px-0.5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs font-bold text-[var(--muted)] truncate">
              {selectedCategory === 'Daftar Promo'
                ? `Daftar Promo (${availablePromos.length})`
                : `Daftar Minuman (${filteredProducts.length})`}
            </p>
            {isRedPriceMode && (
              <Chip
                size="sm"
                variant="primary"
                color="warning"
                className="text-[10px] font-bold rounded-md shrink-0"
              >
                <Chip.Label>Harga Merah Aktif</Chip.Label>
              </Chip>
            )}
          </div>
          {selectedCategory !== 'ALL' && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setSelectedCategory('ALL')}
              className="text-xs text-[var(--accent)] font-semibold shrink-0 min-h-[36px] px-2"
            >
              Lihat Semua
            </Button>
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
                <Card
                  key={promo.id}
                  id={`promo-card-${promo.code.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  variant="default"
                  className={`rounded-2xl p-4 gap-0 border transition-colors select-none flex flex-col justify-between shadow-none ${
                    inCart
                      ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20 bg-[var(--accent-soft)]/50'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-[var(--danger)] flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>Voucher Promo</span>
                      </span>
                      <Chip size="sm" variant="soft" color="danger" className="font-mono font-bold rounded-lg">
                        <Chip.Label>
                          {promo.type === 'PERCENT' ? `Diskon ${promo.value}%` : `-${formatRupiah(promo.value)}/pcs`}
                        </Chip.Label>
                      </Chip>
                    </div>

                    <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">
                      {promo.name}
                    </h3>
                    <p className="text-[11px] font-mono text-[var(--muted)] mt-0.5">
                      SKU: {promo.code}
                    </p>
                    {promo.description && (
                      <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                        {promo.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--separator)] flex items-center justify-between gap-2 mt-4">
                    <div>
                      {inCart ? (
                        <p className="text-xs font-bold text-[var(--danger)] font-mono num-tabular">
                          Total: -{formatRupiah(totalDiscount)}
                        </p>
                      ) : (
                        <span className="text-[11px] text-[var(--muted)]">
                          {promo.minOrder ? `Min. ${formatRupiah(promo.minOrder)}` : 'Tanpa min. order'}
                        </span>
                      )}
                    </div>

                    <div>
                      {inCart ? (
                        <div className="flex items-center gap-1 bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] p-1 rounded-xl">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="outline"
                            onPress={() => onUpdateQty(inCart.productId, inCart.qty - 1)}
                            aria-label={`Kurangi kupon ${promo.name}`}
                            className="min-w-[40px] min-h-[40px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <span className="text-xs font-bold px-2 min-w-[24px] text-center num-tabular">
                            {inCart.qty}
                          </span>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="outline"
                            onPress={() => onUpdateQty(inCart.productId, inCart.qty + 1)}
                            aria-label={`Tambah kupon ${promo.name}`}
                            className="min-w-[40px] min-h-[40px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          onPress={() => onAddToCart(promoProduct)}
                          className="px-3.5 py-2 rounded-xl font-bold text-xs min-h-[44px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pilih</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : filteredProducts.length === 0 ? (
          <FadeContent>
            <Card
              variant="default"
              className="rounded-2xl p-10 text-center border border-[var(--border)] space-y-2 gap-2 items-center shadow-none"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--surface-secondary)] text-[var(--muted)] flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[var(--foreground)]">Tidak ada produk ditemukan</p>
              <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
                Coba kata kunci lain atau beralih ke kategori Semua Minuman.
              </p>
            </Card>
          </FadeContent>
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
          <Card
            variant="default"
            className="mt-6 rounded-2xl p-4 sm:p-5 border border-[var(--border)] space-y-3.5 gap-0 text-[var(--foreground)] transition-colors shadow-none"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/25 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[var(--foreground)]">Daftar Promo</h4>
                    <span className="text-[11px] font-semibold text-[var(--danger)]">· Diskon Kasir</span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Pilih potongan promo langsung untuk transaksi keranjang</p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onPress={() => setSelectedCategory('Daftar Promo')}
                className="text-xs font-bold text-[var(--accent)] bg-[var(--surface-secondary)] px-3.5 py-2 rounded-xl border border-[var(--border)] min-h-[44px] self-start sm:self-auto"
              >
                <span>Lihat Semua Promo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
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
                  <Card
                    key={p.id}
                    id={`promo-card-bottom-${p.code.replace(/[^a-zA-Z0-9]/g, '-')}`}
                    variant="secondary"
                    className={`p-3.5 rounded-xl gap-0 border transition-colors flex flex-col justify-between shadow-none ${
                      inCart
                        ? 'bg-[var(--accent-soft)]/50 border-[var(--accent)] ring-1 ring-[var(--accent)]'
                        : 'bg-[var(--surface-secondary)] border-[var(--border)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              inCart
                                ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                                : 'bg-[var(--surface)] text-[var(--accent)] border border-[var(--border)]'
                            }`}
                          >
                            %
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs sm:text-sm font-bold text-[var(--foreground)] truncate">{p.name}</h5>
                            <p className="text-[11px] font-mono text-[var(--muted)] truncate">SKU: {p.code}</p>
                          </div>
                        </div>
                        <Chip size="sm" variant="soft" color="danger" className="text-[11px] font-bold rounded-md font-mono shrink-0">
                          <Chip.Label>
                            {p.type === 'PERCENT' ? `-${p.value}%` : `-${formatRupiah(p.value)}/pcs`}
                          </Chip.Label>
                        </Chip>
                      </div>

                      <p className="text-xs text-[var(--muted)] mb-3">
                        {p.description || `Potongan ${formatRupiah(p.value)}/pcs`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--separator)]">
                      <div>
                        {inCart ? (
                          <p className="text-xs font-bold text-[var(--danger)] font-mono num-tabular">
                            Total: -{formatRupiah(totalDiscount)}
                          </p>
                        ) : (
                          <span className="text-[11px] text-[var(--muted)]">
                            {p.minOrder ? `Min. ${formatRupiah(p.minOrder)}` : 'Tanpa min. belanja'}
                          </span>
                        )}
                      </div>

                      <div>
                        {inCart ? (
                          <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] p-1 rounded-xl">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              onPress={() => onUpdateQty(inCart.productId, inCart.qty - 1)}
                              aria-label={`Kurangi kupon ${p.name}`}
                              className="min-w-[40px] min-h-[40px] rounded-lg text-[var(--foreground)]"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <span className="text-xs font-bold px-1.5 min-w-[20px] text-center font-mono num-tabular">
                              {inCart.qty}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              onPress={() => onUpdateQty(inCart.productId, inCart.qty + 1)}
                              aria-label={`Tambah kupon ${p.name}`}
                              className="min-w-[40px] min-h-[40px] rounded-lg text-[var(--foreground)]"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            onPress={() => onAddToCart(promoProduct)}
                            className="text-xs font-bold px-3.5 py-2 rounded-xl min-h-[44px]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Pilih</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        )}
      </section>

      {/* 5. SATU PINTU MASUK KERANJANG: BAR MELAYANG DI ATAS BOTTOM NAVIGATION */}
      {cart.length > 0 && (
        <aside
          aria-label="Keranjang Belanja"
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px)+8px)] md:bottom-6 left-3 right-3 max-w-lg mx-auto z-30 no-print"
        >
          <LiquidSurface
            borderRadius={16}
            material="regular"
            className="text-[var(--foreground)] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 shadow-xl"
          >
            <button
              type="button"
              onClick={() => setIsCartSheetOpen(true)}
              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 pl-1 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-bold relative shrink-0">
                <ShoppingBag className="w-4 h-4" />
                <span
                  key={totalQty}
                  className="animate-cart-pop absolute -top-1.5 -right-1.5 bg-[var(--danger)] text-[var(--danger-foreground)] text-[10px] font-bold min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center ring-2 ring-[var(--surface)] num-tabular"
                >
                  {totalQty}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[11px] text-[var(--muted)] font-semibold truncate">
                    {totalQty} Item · Total
                  </p>
                  {isRedPriceMode && (
                    <Chip
                      size="sm"
                      variant="primary"
                      color="warning"
                      className="text-[9px] font-bold rounded uppercase shrink-0"
                    >
                      <Chip.Label>Reseller</Chip.Label>
                    </Chip>
                  )}
                </div>
                <p className="text-sm sm:text-base font-extrabold truncate leading-tight num-tabular">
                  {formatRupiah(finalTotal)}
                </p>
              </div>
            </button>

            <Button
              id="btn-open-floating-cart"
              variant="primary"
              onPress={() => setIsCartSheetOpen(true)}
              className="px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shrink-0 min-h-[44px]"
            >
              <span>Lihat · Bayar</span>
              <ChevronUp className="w-4 h-4" />
            </Button>
          </LiquidSurface>
        </aside>
      )}

      {/* 6. SHEET KERANJANG: 92dvh TETAP, TIGA ZONA (ATAS TETAP, TENGAH SCROLL, BAWAH MENEMPEL) */}
      <Drawer.Backdrop
        isOpen={isCartSheetOpen}
        onOpenChange={(open) => {
          if (!open) setIsCartSheetOpen(false);
        }}
        variant="opaque"
        shouldCloseOnInteractOutside={(el) => !el.closest('[data-toast-overlay="true"]')}
      >
          <Drawer.Content placement="bottom">
            <Drawer.Dialog
              aria-label="Keranjang Kasir"
              className="relative p-0 gap-0 w-full max-w-lg mx-auto bg-[var(--overlay)] text-[var(--overlay-foreground)] rounded-t-3xl sm:rounded-2xl border-t sm:border border-[var(--border)] shadow-2xl h-[92dvh] max-h-[92dvh] sm:h-auto sm:max-h-[90dvh] flex flex-col overflow-hidden"
            >
              {/* ZONA 1 (ATAS TETAP): Handle + Judul + Jumlah Item + Kosongkan + Tutup + Segmen Umum | Reseller */}
              <Drawer.Header className="px-4 sm:px-5 pt-2.5 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] shrink-0 space-y-2.5 gap-0">
                <Drawer.Handle className="py-0 pb-0.5 sm:hidden" />

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] shrink-0">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <Drawer.Heading className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--foreground)] truncate">
                        Keranjang ({totalQty} item)
                      </Drawer.Heading>
                      <p className="text-[11px] text-[var(--muted)] truncate">
                        {isRedPriceMode ? 'Harga Merah Reseller aktif' : 'Harga standar kasir'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {cart.length > 0 && (
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => setShowClearCartConfirm(true)}
                        className="min-h-[44px] px-3 rounded-xl text-xs font-bold"
                      >
                        Kosongkan
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      size="sm"
                      variant="outline"
                      onPress={() => setIsCartSheetOpen(false)}
                      aria-label="Tutup keranjang"
                      className="min-w-[44px] min-h-[44px] -mr-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Tempat 2 (selalu kelihatan di atas sheet keranjang): Segmen Umum | Reseller */}
                <div
                  role="group"
                  aria-label="Mode Harga Keranjang"
                  id="cart-price-mode-segment"
                  className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                >
                  <Button
                    fullWidth
                    size="sm"
                    variant="ghost"
                    onPress={() => onToggleRedPriceMode?.(false)}
                    aria-pressed={!isRedPriceMode}
                    className={`relative min-h-[40px] px-3 rounded-lg text-xs font-bold ${
                      !isRedPriceMode
                        ? 'text-[var(--accent-foreground)]'
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {!isRedPriceMode && (
                      <AnimatedTabPill
                        layoutId="pos-cart-price-mode-pill"
                        className="absolute inset-0 rounded-lg bg-[var(--accent)] pointer-events-none"
                      />
                    )}
                    <span className="relative z-10">Umum (Harga Biasa)</span>
                  </Button>
                  <Button
                    fullWidth
                    size="sm"
                    variant="ghost"
                    onPress={() => onToggleRedPriceMode?.(true)}
                    aria-pressed={isRedPriceMode}
                    className={`relative min-h-[40px] px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
                      isRedPriceMode
                        ? 'text-[var(--warning-foreground)]'
                        : 'text-[var(--muted)] hover:bg-[var(--warning-soft)] hover:text-amber-700 dark:hover:text-[var(--warning)]'
                    }`}
                  >
                    {isRedPriceMode && (
                      <AnimatedTabPill
                        layoutId="pos-cart-price-mode-pill"
                        className="absolute inset-0 rounded-lg bg-[var(--warning)] pointer-events-none"
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1.5">
                      <span>Reseller</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isRedPriceMode
                            ? 'bg-black/15 text-[var(--warning-foreground)]'
                            : 'bg-[var(--warning-soft)] text-amber-800 dark:text-[var(--warning)]'
                        }`}
                      >
                        Merah
                      </span>
                    </span>
                  </Button>
                </div>
              </Drawer.Header>

              {/* ZONA 2 (TENGAH — SATU-SATUNYA AREA SCROLL): Daftar Item + Opsi Lainnya */}
              <Drawer.Body className="!mt-0 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3.5 space-y-3 text-[var(--foreground)]">
                {cart.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--surface-secondary)] text-[var(--muted)] flex items-center justify-center mx-auto">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-[var(--foreground)]">Keranjang kosong</p>
                    <p className="text-xs text-[var(--muted)]">
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
                  <div className="p-2.5 bg-[var(--warning-soft)] border border-[var(--warning)]/50 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-[var(--warning)]">
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                        <span>Catatan Google Sheets:</span>
                      </span>
                      <span className="font-mono font-bold num-tabular">{formatRupiah(sheetsRegularTotal)}</span>
                    </div>
                    <p className="text-[10px] text-amber-800/90 dark:text-[var(--warning)]/90 leading-snug">
                      LOG_PENJUALAN tetap mencatat harga biasa secara otomatis.
                    </p>
                  </div>
                )}

                {/* Bagian Lipat "Opsi lainnya" (Collapsed secara default) */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] overflow-hidden">
                  <button
                    type="button"
                    id="btn-toggle-cart-more-options"
                    aria-expanded={isMoreOptionsOpen}
                    onClick={() => setIsMoreOptionsOpen((prev) => !prev)}
                    className="w-full min-h-[48px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[var(--surface-tertiary)] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-[var(--foreground)] block">
                        Opsi lainnya
                      </span>
                      <span className="text-[11px] text-[var(--muted)] truncate block">
                        {moreOptionsSummary || 'Pelanggan/catatan, diskon, ongkir, tanggal, ekspor'}
                      </span>
                    </div>
                    {isMoreOptionsOpen ? (
                      <ChevronUp className="w-4 h-4 text-[var(--muted)] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--muted)] shrink-0" />
                    )}
                  </button>

                  {isMoreOptionsOpen && (
                    <div className="px-3.5 pb-4 pt-3 border-t border-[var(--border)] space-y-4 bg-[var(--surface)]">
                      {/* Tanggal Transaksi */}
                      <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <CalendarDays className="w-4 h-4 text-[var(--accent)] shrink-0" />
                            <span className="text-xs font-bold truncate">Tanggal Nota</span>
                          </div>
                          {txDate !== todayYmd && (
                            <Button
                              size="sm"
                              variant="primary"
                              onPress={() => setTxDate(todayYmd)}
                              className="min-h-[32px] text-[11px] font-bold px-2.5 py-1 rounded-lg"
                            >
                              Hari Ini
                            </Button>
                          )}
                        </div>
                        <Input
                          fullWidth
                          type="date"
                          aria-label="Pilih tanggal transaksi"
                          value={txDate}
                          onChange={(e) => {
                            if (e.target.value) setTxDate(e.target.value);
                          }}
                          className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--foreground)] min-h-[44px]"
                        />
                        <div className="text-[11px] truncate">
                          {txDate === todayYmd ? (
                            <span className="text-emerald-700 dark:text-[var(--success)] font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <LiveClockLabel />
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-[var(--warning)] font-semibold flex items-center gap-1.5" title={timeExplanation}>
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
                          className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5"
                        >
                          Pelanggan / Meja / Catatan
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none z-10" />
                          <Input
                            fullWidth
                            type="text"
                            id="customer-name-input"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Contoh: Mas Budi / Meja 03 / Tanpa es"
                            className="pl-9 pr-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)] min-h-[44px]"
                          />
                        </div>
                      </div>

                      {/* Diskon / Promo */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="discount-input"
                            className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5"
                          >
                            <Gift className="w-3.5 h-3.5 text-[var(--accent)]" />
                            <span>Diskon / Promo</span>
                          </label>
                          <Button
                            size="sm"
                            variant="primary"
                            onPress={() => setIsPromoModalOpen(true)}
                            className="min-h-[36px] text-[11px] font-bold px-3 py-1 rounded-lg"
                          >
                            <Gift className="w-3 h-3" />
                            <span>Pilih Promo</span>
                          </Button>
                        </div>

                        {promoCode && discount > 0 && (
                          <div className="p-2.5 bg-[var(--accent-soft)] border border-[var(--accent)]/35 rounded-xl flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Chip size="sm" variant="primary" color="accent" className="font-mono text-[10px] font-bold rounded-md shrink-0">
                                <Chip.Label>{promoCode}</Chip.Label>
                              </Chip>
                              <span className="font-semibold truncate text-[var(--foreground)]">{promoName || 'Promo Aktif'}</span>
                            </div>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              onPress={() => {
                                setDiscount(0);
                                setPromoCode?.('');
                                setPromoName?.('');
                              }}
                              aria-label="Hapus promo"
                              className="min-w-[36px] min-h-[36px] text-[var(--muted)] hover:text-[var(--danger)] shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}

                        <div className="relative">
                          <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none z-10" />
                          <Input
                            fullWidth
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
                            className="pl-9 pr-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-mono text-[var(--foreground)] min-h-[44px]"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {[
                            { code: 'PROMO-5K', name: 'Diskon Rp 5.000', val: 5000 },
                            { code: 'PROMO-10K', name: 'Diskon Rp 10.000', val: 10000 },
                            { code: 'PROMO-20K', name: 'Diskon Rp 20.000', val: 20000 },
                          ].map((pre) => {
                            const active = discount === pre.val && promoCode === pre.code;
                            return (
                              <Button
                                key={pre.code}
                                size="sm"
                                variant={active ? 'primary' : 'outline'}
                                onPress={() => {
                                  setDiscount(pre.val);
                                  setPromoCode?.(pre.code);
                                  setPromoName?.(pre.name);
                                }}
                                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[11px] font-mono num-tabular ${
                                  active
                                    ? 'font-bold'
                                    : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)]'
                                }`}
                              >
                                -{formatRupiah(pre.val)}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Ongkos Kirim */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="shipping-fee-input"
                            className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5 text-[var(--accent)]" />
                            <span>Ongkos Kirim (LAIN-LAIN)</span>
                          </label>
                          {shippingFee > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => setShippingFee(0)}
                              className="text-[11px] text-[var(--danger)] font-semibold min-h-[32px] px-2"
                            >
                              Hapus Ongkir
                            </Button>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--muted)] font-mono pointer-events-none z-10">
                            Rp
                          </span>
                          <Input
                            fullWidth
                            type="text"
                            inputMode="numeric"
                            id="shipping-fee-input"
                            value={shippingFee === 0 ? '' : shippingFee.toLocaleString('id-ID')}
                            onChange={(e) =>
                              setShippingFee(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))
                            }
                            placeholder="0"
                            className="pl-9 pr-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-mono text-[var(--foreground)] min-h-[44px]"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[0, 5000, 10000, 15000, 20000].map((fee) => {
                            const active = shippingFee === fee;
                            return (
                              <Button
                                key={fee}
                                size="sm"
                                variant={active ? 'primary' : 'outline'}
                                onPress={() => setShippingFee(fee)}
                                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium num-tabular ${
                                  active
                                    ? 'font-bold'
                                    : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)]'
                                }`}
                              >
                                {fee === 0 ? 'Gratis' : formatRupiah(fee)}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tombol Ekspor / Bagikan Draf */}
                      <div className="pt-2 space-y-2">
                        <Separator />
                        <p className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider pt-1">
                          Draf Pesanan
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            fullWidth
                            size="sm"
                            variant="outline"
                            onPress={handlePrintCart}
                            isDisabled={cart.length === 0}
                            className="min-h-[44px] px-2 rounded-xl bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)] font-bold text-xs"
                          >
                            <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
                            <span>Print</span>
                          </Button>
                          <Button
                            fullWidth
                            size="sm"
                            variant="outline"
                            onPress={handleShareCartWA}
                            isDisabled={cart.length === 0}
                            className="min-h-[44px] px-2 rounded-xl bg-[var(--success-soft)] border-[var(--success)]/35 text-emerald-700 dark:text-[var(--success)] font-bold text-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WA Teks</span>
                          </Button>
                          <Button
                            fullWidth
                            size="sm"
                            variant="outline"
                            onPress={handleDownloadCartOrder}
                            isDisabled={cart.length === 0}
                            className="min-h-[44px] px-2 rounded-xl bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)] font-bold text-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Simpan</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Drawer.Body>

              {/* ZONA 3 (BAWAH MENEMPEL, TIDAK IKUT SCROLL): Ringkasan Total, Metode Bayar (Tunai/Transfer/QRIS), Uang Diterima + Kembalian, 1 Tombol Bayar Besar */}
              <Drawer.Footer className="!mt-0 block px-4 sm:px-5 pt-3 pb-safe border-t border-[var(--border)] bg-[var(--surface-secondary)] shrink-0 space-y-2.5">
                {/* Total Summary */}
                <div className="space-y-1">
                  {(effectiveDiscount > 0 || shippingFee > 0) && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)] flex-wrap">
                      <span className="num-tabular">Subtotal: {formatRupiah(subtotal)}</span>
                      <div className="flex items-center gap-2">
                        {effectiveDiscount > 0 && (
                          <span className="text-[var(--danger)] font-bold num-tabular">
                            Diskon -{formatRupiah(effectiveDiscount)}
                          </span>
                        )}
                        {shippingFee > 0 && (
                          <span className="text-emerald-700 dark:text-[var(--success)] font-bold num-tabular">
                            Ongkir +{formatRupiah(shippingFee)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-[var(--foreground)]">
                      Total Bayar
                    </span>
                    <span className="text-lg sm:text-xl font-black text-[var(--accent)] font-mono num-tabular">
                      {formatRupiah(finalTotal)}
                    </span>
                  </div>
                </div>

                {/* 3 Segmen Besar Metode Bayar: Tunai / Transfer / QRIS */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    id="btn-pay-cash"
                    fullWidth
                    variant={paymentMethod === 'CASH' ? 'primary' : 'outline'}
                    onPress={() => setPaymentMethod('CASH')}
                    className={`min-h-[48px] px-2 py-2 rounded-xl text-xs font-bold border ${
                      paymentMethod === 'CASH'
                        ? 'border-transparent'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
                    }`}
                  >
                    <Banknote className="w-4 h-4 shrink-0" />
                    <span>Tunai</span>
                  </Button>

                  <Button
                    id="btn-pay-transfer"
                    fullWidth
                    variant={paymentMethod === 'TRANSFER' ? 'primary' : 'outline'}
                    onPress={() => setPaymentMethod('TRANSFER')}
                    className={`min-h-[48px] px-2 py-2 rounded-xl text-xs font-bold border ${
                      paymentMethod === 'TRANSFER'
                        ? 'border-transparent'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>Transfer</span>
                  </Button>

                  <Button
                    id="btn-pay-qris"
                    fullWidth
                    variant={paymentMethod === 'QRIS' ? 'primary' : 'outline'}
                    onPress={() => setPaymentMethod('QRIS')}
                    className={`min-h-[48px] px-2 py-2 rounded-xl text-xs font-bold border ${
                      paymentMethod === 'QRIS'
                        ? 'border-transparent'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
                    }`}
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>QRIS</span>
                  </Button>
                </div>

                {/* Input Uang Diterima + Tombol Cepat + Kembalian Besar untuk Tunai */}
                {paymentMethod === 'CASH' && (
                  <div className="space-y-2 bg-[var(--surface)] p-3 rounded-2xl border border-[var(--border)]">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="cash-received-input"
                        className="text-xs font-bold text-[var(--foreground)] shrink-0"
                      >
                        Uang Diterima
                      </label>
                      <div className="relative flex-1 max-w-[180px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-[var(--muted)] pointer-events-none z-10">
                          Rp
                        </span>
                        <Input
                          fullWidth
                          id="cash-received-input"
                          type="text"
                          inputMode="numeric"
                          value={cashReceived === 0 ? '' : cashReceived.toLocaleString('id-ID')}
                          onChange={(e) => {
                            const numeric = Number(e.target.value.replace(/\D/g, '')) || 0;
                            setCashReceived(numeric);
                          }}
                          placeholder="0"
                          className="pl-9 pr-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-right text-sm font-mono font-extrabold text-[var(--foreground)] num-tabular min-h-[44px]"
                        />
                      </div>
                    </div>

                    {/* Quick Cash Buttons: Uang Pas, 50rb, 100rb */}
                    <div className="flex flex-wrap gap-2">
                      {quickCashOptions.map((opt) => {
                        const active = cashReceived === opt.amount;
                        return (
                          <Button
                            key={opt.amount}
                            size="sm"
                            variant={active ? 'primary' : 'outline'}
                            onPress={() => setCashReceived(opt.amount)}
                            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold num-tabular flex-1 min-w-[78px] ${
                              active
                                ? ''
                                : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)]'
                            }`}
                          >
                            {opt.label}
                          </Button>
                        );
                      })}
                    </div>

                    {/* Kembalian Besar (Hijau bila cukup, Merah "Kurang Rp X" bila kurang) */}
                    {cashReceived > 0 && (
                      <div
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                          cashReceived >= finalTotal
                            ? 'bg-[var(--success-soft)] border-[var(--success)]/40 text-emerald-700 dark:text-[var(--success)]'
                            : 'bg-[var(--danger-soft)] border-[var(--danger)]/40 text-[var(--danger)]'
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
                  <Button
                    fullWidth
                    size="lg"
                    variant="primary"
                    onPress={handleCheckoutAndClose}
                    isDisabled={cart.length === 0 || isCashShort || isSubmitting}
                    id="btn-process-checkout"
                    className="min-h-[52px] py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base tracking-wide"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 fill-current opacity-85" />
                        <span>Bayar · {formatRupiah(finalTotal)}</span>
                      </>
                    )}
                  </Button>
                  {disabledCheckoutReason && (
                    <p className="text-[11px] font-semibold text-center text-[var(--danger)] flex items-center justify-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{disabledCheckoutReason}</span>
                    </p>
                  )}
                </div>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>

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
