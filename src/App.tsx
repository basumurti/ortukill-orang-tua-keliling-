import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Header, SyncHealthStatus } from './components/Header';
import { PosRegisterView } from './components/PosRegisterView';
import { BottomNavigation } from './components/BottomNavigation';
import { ChunkErrorBoundary, ViewLoadingFallback, ModalLoadingFallback } from './components/ChunkErrorBoundary';
import {
  AppMotionProvider,
  AnimatedToastContainer,
  ViewFadeTransition,
} from './components/ui/motion/MotionPrimitives';
import { LiquidSurface } from './components/ui/glass/LiquidSurface';
import { 
  Product, 
  CartItem, 
  PaymentMethod, 
  TransactionReceipt, 
  DailySummary, 
  ShiftRecord, 
  BrandConfig,
  FinanceRecord,
  SalesTarget,
  LastUpdateInfo
} from './types';
import { StorageService, formatRupiah } from './services/storageService';
import { GasApiService } from './services/gasApiService';
import { CheckCircle2, AlertCircle, Info, Sparkles, WifiOff, RefreshCw, X } from 'lucide-react';

function createLazyComponent<P extends object>(
  loader: () => Promise<{ default: React.ComponentType<P> }>
) {
  let LazyComp = React.lazy(loader);
  const Wrapper: React.FC<P> = (props) => <LazyComp {...props} />;
  return {
    Component: Wrapper,
    preload: () => loader().catch(() => undefined),
    reset: () => {
      LazyComp = React.lazy(loader);
    },
  };
}

const LazyTodayTransactionsView = createLazyComponent(() =>
  import('./components/TodayTransactionsView').then((m) => ({ default: m.TodayTransactionsView }))
);
const LazySalesHistoryView = createLazyComponent(() =>
  import('./components/SalesHistoryView').then((m) => ({ default: m.SalesHistoryView }))
);
const LazyStockManagementView = createLazyComponent(() =>
  import('./components/StockManagementView').then((m) => ({ default: m.StockManagementView }))
);
const LazyShiftClosingView = createLazyComponent(() =>
  import('./components/ShiftClosingView').then((m) => ({ default: m.ShiftClosingView }))
);
const LazyGasIntegrationView = createLazyComponent(() =>
  import('./components/GasIntegrationView').then((m) => ({ default: m.GasIntegrationView }))
);
const LazyFinanceManagementView = createLazyComponent(() =>
  import('./components/FinanceManagementView').then((m) => ({ default: m.FinanceManagementView }))
);
const LazyReceiptModal = createLazyComponent(() =>
  import('./components/ReceiptModal').then((m) => ({ default: m.ReceiptModal }))
);
const LazyAiCopilotModal = createLazyComponent(() =>
  import('./components/AiCopilotModal').then((m) => ({ default: m.AiCopilotModal }))
);

export default function App() {
  // Theme (Light / Dark Grey + Neon Purple)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ortukill_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const rootEl = document.documentElement;
    rootEl.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      rootEl.classList.add('dark');
      try {
        localStorage.setItem('ortukill_theme', 'dark');
      } catch {
        // ignore
      }
    } else {
      rootEl.classList.remove('dark');
      try {
        localStorage.setItem('ortukill_theme', 'light');
      } catch {
        // ignore
      }
    }
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDarkMode ? '#1B1B20' : '#F6F7F9');
    }
  }, [isDarkMode]);

  // Navigation
  const [activeTab, setActiveTab] = useState<'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas' | 'finance'>('pos');

  // Brand config
  const [brand] = useState<BrandConfig>(StorageService.getBrandConfig());

  // Products
  const [products, setProducts] = useState<Product[]>([]);

  // Cart & POS form state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>('');
  const [appliedPromoName, setAppliedPromoName] = useState<string>('');
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [isRedPriceMode, setIsRedPriceMode] = useState<boolean>(true);

  // Transactions & Summaries
  const [transactions, setTransactions] = useState<TransactionReceipt[]>([]);
  const [todayTransactions, setTodayTransactions] = useState<TransactionReceipt[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailySummary>({
    date: new Date().toLocaleDateString('id-ID'),
    totalOmset: 0,
    totalMargin: 0,
    totalTransactions: 0,
    totalQty: 0,
    avgBasketSize: 0,
    paymentBreakdown: {
      CASH: { count: 0, total: 0 },
      TRANSFER: { count: 0, total: 0 },
      QRIS: { count: 0, total: 0 },
    },
  });

  // Shifts
  const [currentShift, setCurrentShift] = useState<ShiftRecord>(StorageService.getCurrentShift());
  const [shiftHistory, setShiftHistory] = useState<ShiftRecord[]>([]);

  // Finances & Target
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [salesTarget, setSalesTarget] = useState<SalesTarget>(StorageService.getSalesTarget());
  const [lastUpdateInfo, setLastUpdateInfo] = useState<LastUpdateInfo>(StorageService.getLastUpdateInfo());

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<TransactionReceipt | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // AI Copilot Modal
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);

  // Handle actions executed by AI Copilot (Add stock, create receipt, expense, void)
  const handleExecuteAiAction = (action: { type: string; payload: any; result: any }) => {
    if (action.type === 'CREATE_SALE_RECEIPT' && action.payload?.receipt) {
      const receipt = action.payload.receipt;
      StorageService.saveTransaction(receipt);
      refreshAllData();
      setActiveReceipt(receipt);
      setIsReceiptOpen(true);
      showToast(`✓ Struk #${receipt.id} dibuat oleh AI Copilot!`, 'success');
    } else if (action.type === 'ADD_STOCK' && action.payload) {
      const p = action.payload;
      const prods = StorageService.getProducts();
      const target = prods.find((prod) => prod.id === p.productId || prod.sku === p.sku);
      if (target) {
        target.stock = p.newStock;
        target.totalAsset = target.stock * (target.cost || 0);
        StorageService.saveProducts(prods, 'POS', `Restock AI: ${p.name} (+${p.addedQty})`);
      }
      refreshAllData();
      showToast(`✓ Stok ${p.name} ditambah +${p.addedQty} botol!`, 'success');
    } else if (action.type === 'RECORD_EXPENSE' && action.payload?.record) {
      StorageService.saveFinanceRecord(action.payload.record);
      refreshAllData();
      showToast(`✓ Pengeluaran "${action.payload.record.description}" dicatat!`, 'success');
    } else if (action.type === 'VOID_RECEIPT' && action.payload?.transactionId) {
      handleVoidTransaction(action.payload.transactionId, action.payload.reason || 'Dibatalkan AI Copilot');
    }
  };
  const [isConnectedGas, setIsConnectedGas] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    action?: { label: string; onAction: () => void };
  } | null>(null);
  const [chunkRetryNonce, setChunkRetryNonce] = useState(0);

  const initialSyncPromiseRef = useRef<Promise<void> | null>(null);
  const initialSyncSettledRef = useRef<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);
  const toastIdRef = useRef<number>(0);
  const isRedPriceModeRef = useRef<boolean>(isRedPriceMode);
  isRedPriceModeRef.current = isRedPriceMode;
  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'info' = 'info',
      duration: number = 4000,
      action?: { label: string; onAction: () => void }
    ) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      const nextId = ++toastIdRef.current;
      setToast({ id: nextId, message, type, action });
      toastTimerRef.current = window.setTimeout(() => {
        setToast((prev) => (prev?.id === nextId ? null : prev));
        toastTimerRef.current = null;
      }, duration);
    },
    []
  );

  // Sinkronkan harga item di keranjang jika katalog baru saja ter-update dari Sheets
  const syncCartWithProducts = (latestProducts: Product[], useRedMode: boolean) => {
    if (!latestProducts || latestProducts.length === 0) return;
    const byId = new Map(latestProducts.map((p) => [p.id, p]));
    const bySku = new Map(latestProducts.map((p) => [p.sku, p]));

    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      let changed = false;
      const nextCart = prevCart.map((item) => {
        const isPromo = item.price < 0 || String(item.sku || '').toUpperCase().includes('PROMO');
        if (isPromo) return item;
        const fresh = byId.get(item.productId) || bySku.get(item.sku);
        if (!fresh) return item;

        const regularPrice = fresh.price;
        const redPrice = fresh.redPrice && fresh.redPrice > 0 ? fresh.redPrice : regularPrice;
        const nextPrice = useRedMode ? redPrice : regularPrice;
        const nextCost = fresh.cost || 0;

        if (
          item.price === nextPrice &&
          item.regularPrice === regularPrice &&
          item.redPrice === redPrice &&
          item.cost === nextCost
        ) {
          return item;
        }
        changed = true;
        const nextSubtotal = item.qty * nextPrice;
        return {
          ...item,
          price: nextPrice,
          regularPrice,
          redPrice,
          cost: nextCost,
          subtotal: nextSubtotal,
          total: nextSubtotal,
          margin: item.qty * (nextPrice - nextCost),
          isRedPrice: useRedMode,
        };
      });
      return changed ? nextCart : prevCart;
    });
  };

  // Load state from StorageService
  const refreshAllData = () => {
    StorageService.purgeAllVoidedTransactions();
    const prods = StorageService.getProducts();
    const allTrx = StorageService.getTransactions();
    const todayTrx = StorageService.getTodayTransactions();
    const summary = StorageService.getDailySummary();
    const curShift = StorageService.getCurrentShift();
    const shifts = StorageService.getShiftHistory();
    const finances = StorageService.getFinanceRecords();
    const target = StorageService.getSalesTarget();
    const updateInfo = StorageService.getLastUpdateInfo();

    setProducts(prods);
    setTransactions(allTrx);
    setTodayTransactions(todayTrx);
    setTodaySummary(summary);
    setCurrentShift(curShift);
    setShiftHistory(shifts);
    setFinanceRecords(finances);
    setSalesTarget(target);
    setLastUpdateInfo(updateInfo);
    syncCartWithProducts(prods, isRedPriceModeRef.current);
  };

  // Live Sync with Google Sheets
  const handleSyncSpreadsheet = async (silent = false) => {
    const url = GasApiService.getSavedWebAppUrl();
    if (!url) {
      if (!silent) {
        setActiveTab('gas');
        showToast('Silakan masukkan dan simpan URL Web App Google Apps Script terlebih dahulu.', 'info');
      }
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await GasApiService.fetchAndSyncAll();
      if (res.success) {
        setIsConnectedGas(true);
        setSyncError(null);
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSynced(timeStr);
        refreshAllData();
        if (!silent) {
          const pCount = res.products?.length || 0;
          const tCount = res.todayTransactions?.length || 0;
          showToast(`Berhasil sinkron! Memuat ${pCount} produk & ${tCount} transaksi hari ini dari Spreadsheet.`, 'success');
        }
      } else {
        setSyncError(res.message || 'Gagal tersambung ke Google Spreadsheet.');
        if (!silent) {
          showToast(res.message || 'Gagal tersambung ke Google Spreadsheet.', 'error');
        }
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Koneksi Google Sheets gagal.');
      if (!silent) {
        showToast('Koneksi Google Sheets gagal: ' + err.message, 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const runInitialSync = (): Promise<void> => {
    if (initialSyncPromiseRef.current) return initialSyncPromiseRef.current;
    const p = (async () => {
      try {
        await GasApiService.getStatus();
      } catch {
        // ignore
      }
      const saved = GasApiService.getSavedWebAppUrl();
      if (saved) {
        setIsConnectedGas(true);
        await handleSyncSpreadsheet(true);
      }
    })().finally(() => {
      initialSyncSettledRef.current = true;
    });
    initialSyncPromiseRef.current = p;
    return p;
  };

  useEffect(() => {
    refreshAllData();

    // Tunda sync awal Sheets tepat sampai setelah first paint selesai (bukan idle lama)
    let cancelled = false;
    let paintTimer: number | undefined;
    const rafId = window.requestAnimationFrame(() => {
      paintTimer = window.setTimeout(() => {
        if (!cancelled) {
          void runInitialSync();
        }
      }, 0);
    });

    // Preload chunk Struk, Laporan, & Stok saat browser idle agar transisi & cetak struk instan
    let idleTimer: number | undefined;
    let idleCallbackId: number | undefined;
    const runIdlePreloads = () => {
      if (cancelled) return;
      void LazyReceiptModal.preload();
      void LazySalesHistoryView.preload();
      void LazyStockManagementView.preload();
    };

    if (typeof (window as any).requestIdleCallback === 'function') {
      idleCallbackId = (window as any).requestIdleCallback(runIdlePreloads, { timeout: 2500 });
    } else {
      idleTimer = window.setTimeout(runIdlePreloads, 1200);
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      if (paintTimer !== undefined) window.clearTimeout(paintTimer);
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      if (idleCallbackId !== undefined && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleCallbackId);
      }
    };
  }, []);

  // Pastikan chunk Struk sudah siap sejak item pertama masuk ke keranjang
  useEffect(() => {
    if (cart.length > 0) {
      void LazyReceiptModal.preload();
    }
  }, [cart.length]);

  // Toggle Mode Harga Jual Merah (Make Up Price Reseller)
  const handleToggleRedPriceMode = useCallback((enabled: boolean) => {
    setIsRedPriceMode(enabled);

    // Update seluruh barang yang saat ini sudah ada di keranjang
    setCart((prevCart) =>
      prevCart.map((item) => {
        const isPromoItem = item.price < 0 || String(item.sku || '').toUpperCase().includes('PROMO');
        if (isPromoItem) {
          return item; // Item promo tidak diubah oleh mode reseller
        }
        const prod = productsRef.current.find((p) => p.id === item.productId || p.sku === item.sku);
        const regularPrice = item.regularPrice || (prod ? prod.price : item.price);
        const redPrice = (prod && prod.redPrice && prod.redPrice > 0) ? prod.redPrice : regularPrice;
        const targetPrice = enabled ? redPrice : regularPrice;
        const itemSubtotal = item.qty * targetPrice;

        return {
          ...item,
          price: targetPrice,
          regularPrice,
          redPrice,
          isRedPrice: enabled,
          subtotal: itemSubtotal,
          total: itemSubtotal,
          margin: item.qty * (targetPrice - item.cost),
        };
      })
    );

    showToast(
      enabled
        ? '🏷️ Mode Reseller Aktif: Menggunakan Harga Jual Merah. Penulisan ke Google Sheets tetap dengan harga biasa.'
        : 'Mode Biasa: Kembali ke Harga Jual Standar.',
      'info'
    );
  }, []);

  // Cart operations (referensi stabil via useCallback untuk React.memo product cards)
  const handleAddToCart = useCallback((product: Product) => {
    const isPromo = product.category === 'Daftar Promo' || product.price < 0 || String(product.sku || '').toUpperCase().includes('PROMO');
    if (!isPromo && product.stock <= 0) return;

    const redMode = isRedPriceModeRef.current;
    const regularPrice = product.price;
    const redPrice = (!isPromo && product.redPrice && product.redPrice > 0) ? product.redPrice : regularPrice;
    const effectivePrice = (redMode && !isPromo) ? redPrice : regularPrice;

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id || item.sku === product.sku);
      if (existing) {
        if (!isPromo && existing.qty >= product.stock) return prev; // Cannot exceed available stock
        return prev.map((item) =>
          (item.productId === product.id || item.sku === product.sku)
            ? {
                ...item,
                qty: item.qty + 1,
                subtotal: (item.qty + 1) * item.price,
                total: (item.qty + 1) * item.price,
                margin: (item.qty + 1) * (item.price - item.cost),
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            price: effectivePrice,
            originalPrice: regularPrice,
            regularPrice: regularPrice,
            redPrice: redPrice,
            cost: product.cost || 0,
            qty: 1,
            subtotal: effectivePrice,
            total: effectivePrice,
            margin: effectivePrice - (product.cost || 0),
            isRedPrice: redMode && !isPromo,
          },
        ];
      }
    });
  }, []);

  const handleUpdateItemPrice = useCallback((productId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId || item.sku === productId) {
          const validPrice = item.price < 0 ? -Math.abs(newPrice) : Math.max(0, newPrice);
          const itemSubtotal = item.qty * validPrice;
          return {
            ...item,
            price: validPrice,
            subtotal: itemSubtotal,
            total: itemSubtotal,
            margin: item.qty * (validPrice - item.cost),
          };
        }
        return item;
      })
    );
  }, []);

  const handleRemoveFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId && item.sku !== productId));
  }, []);

  const handleRestoreCartItem = useCallback((itemToRestore: CartItem, index?: number) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.productId === itemToRestore.productId || i.sku === itemToRestore.sku
      );
      if (existingIdx !== -1) {
        return prev.map((item, idx) => {
          if (idx !== existingIdx) return item;
          const nextQty = item.qty + itemToRestore.qty;
          const nextSubtotal = nextQty * item.price;
          return {
            ...item,
            qty: nextQty,
            subtotal: nextSubtotal,
            total: nextSubtotal,
            margin: nextQty * (item.price - (item.cost || 0)),
          };
        });
      }
      const next = [...prev];
      if (typeof index === 'number' && index >= 0 && index <= next.length) {
        next.splice(index, 0, itemToRestore);
      } else {
        next.push(itemToRestore);
      }
      return next;
    });
  }, []);

  const handleUpdateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    const prod = productsRef.current.find((p) => p.id === productId || p.sku === productId);
    const isPromo = prod?.category === 'Daftar Promo' || String(prod?.sku || '').toUpperCase().includes('PROMO') || productId.startsWith('promo-');
    if (prod && !isPromo && qty > prod.stock && prod.stock > 0) {
      qty = prod.stock;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId || item.sku === productId) {
          const itemSubtotal = qty * item.price;
          return {
            ...item,
            qty,
            subtotal: itemSubtotal,
            total: itemSubtotal,
            margin: qty * (item.price - (item.cost || 0)),
          };
        }
        return item;
      })
    );
  }, [handleRemoveFromCart]);

  const handleClearCart = useCallback(() => {
    setCart([]);
    setDiscount(0);
    setAppliedPromoCode('');
    setAppliedPromoName('');
    setShippingFee(0);
    setCashReceived(0);
    setCustomerName('');
  }, []);

  // Checkout process (Mendukung custom date & time dari date picker keranjang)
  const handleProcessCheckout = async (customDateOption?: { dateStr: string; timeStr: string; dateTimeStr: string; dateYmd?: string }) => {
    if (cart.length === 0) return;

    // Pastikan sinkronisasi awal produk/harga dari Google Sheets sudah selesai sebelum checkout
    if (!initialSyncSettledRef.current) {
      showToast('Memastikan harga & stok terbaru dari Google Sheets...', 'info', 2500);
      await Promise.race([
        runInitialSync(),
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);
    }

    // Revalidasi harga item keranjang dengan katalog terbaru pasca-sync
    const latestProducts = StorageService.getProducts();
    const latestById = new Map(latestProducts.map((p) => [p.id, p]));
    const latestBySku = new Map(latestProducts.map((p) => [p.sku, p]));

    const checkoutCart: CartItem[] = cart.map((item) => {
      const isPromo = item.price < 0 || String(item.sku || '').toUpperCase().includes('PROMO');
      if (isPromo) return item;
      const fresh = latestById.get(item.productId) || latestBySku.get(item.sku);
      if (!fresh) return item;
      const regularPrice = fresh.price;
      const redPrice = fresh.redPrice && fresh.redPrice > 0 ? fresh.redPrice : regularPrice;
      const effectivePrice = isRedPriceMode ? redPrice : regularPrice;
      const cost = fresh.cost || 0;
      // Hormati harga jika sudah diubah manual kasir, atau ikuti katalog jika masih sesuai katalog lama
      const matchesPreviousCatalog =
        item.price === (item.isRedPrice ? (item.redPrice || item.regularPrice) : item.regularPrice);
      const finalUnitPrice = matchesPreviousCatalog ? effectivePrice : item.price;
      const itemTotal = item.qty * finalUnitPrice;
      return {
        ...item,
        price: finalUnitPrice,
        regularPrice,
        redPrice,
        cost,
        subtotal: itemTotal,
        total: itemTotal,
        margin: item.qty * (finalUnitPrice - cost),
      };
    });

    const regularItems = checkoutCart.filter((i) => i.price >= 0 && !String(i.sku || '').toUpperCase().includes('PROMO'));
    const promoItems = checkoutCart.filter((i) => i.price < 0 || String(i.sku || '').toUpperCase().includes('PROMO'));

    const grossSubtotal = regularItems.reduce((sum, i) => sum + i.subtotal, 0);
    const promoDiscountsTotal = Math.abs(promoItems.reduce((sum, i) => sum + i.subtotal, 0));
    const combinedDiscount = discount + promoDiscountsTotal;
    const finalTotal = Math.max(0, (grossSubtotal > 0 ? grossSubtotal : checkoutCart.reduce((sum, i) => sum + i.subtotal, 0)) - combinedDiscount + shippingFee);
    const totalBottleQty = regularItems.reduce((sum, i) => sum + i.qty, 0);
    const totalMargin = regularItems.reduce((sum, i) => sum + i.margin, 0) - combinedDiscount;

    if (paymentMethod === 'CASH' && cashReceived < finalTotal) {
      showToast(`Pembayaran tunai kurang dari total terbaru (${formatRupiah(finalTotal)})`, 'error');
      return;
    }

    const now = new Date();
    let dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    let timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    let dateTimeFormatted = `${dateFormatted} ${timeFormatted}`;
    let epochTime = now.getTime();

    if (customDateOption) {
      if (customDateOption.dateStr) dateFormatted = customDateOption.dateStr;
      if (customDateOption.timeStr) timeFormatted = customDateOption.timeStr;
      if (customDateOption.dateTimeStr) dateTimeFormatted = customDateOption.dateTimeStr;
      if (customDateOption.dateYmd && customDateOption.timeStr) {
        const [y, m, d] = customDateOption.dateYmd.split('-').map(Number);
        const [hh, mm, ss] = customDateOption.timeStr.split(':').map(Number);
        const parsedEpoch = new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0).getTime();
        if (!isNaN(parsedEpoch)) {
          epochTime = parsedEpoch;
        }
      }
    }

    const ymdCompact = customDateOption?.dateYmd
      ? customDateOption.dateYmd.replace(/-/g, '')
      : `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeCompact = timeFormatted.replace(/[^0-9]/g, '');
    const random = Math.floor(100 + Math.random() * 900);
    const generatedId = `TRX-${ymdCompact}-${timeCompact}-${random}`;

    const promoCodeFinal = appliedPromoCode || (promoItems.length > 0 ? promoItems.map((p) => p.sku).join(', ') : undefined);
    const promoNameFinal = appliedPromoName || (promoItems.length > 0 ? promoItems.map((p) => `${p.name} (x${p.qty})`).join(', ') : undefined);

    const newReceipt: TransactionReceipt = {
      id: generatedId,
      date: dateFormatted,
      transactionDate: dateTimeFormatted,
      websiteTime: timeFormatted,
      createdAt: epochTime,
      customerName: customerName.trim() || undefined,
      paymentMethod,
      promoCode: promoCodeFinal,
      promoName: promoNameFinal,
      isResellerMode: isRedPriceMode,
      items: checkoutCart.map((item) => {
        const itemTotal = item.subtotal || (item.qty * item.price);
        const regularPrice = item.regularPrice || item.originalPrice || item.price;
        return {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          price: item.price,
          regularPrice: regularPrice,
          cost: item.cost || 0,
          subtotal: itemTotal,
          total: itemTotal,
          margin: item.margin,
          isRedPrice: item.isRedPrice,
        };
      }),
      subtotal: grossSubtotal > 0 ? grossSubtotal : checkoutCart.reduce((sum, i) => sum + i.subtotal, 0),
      discount: combinedDiscount,
      shippingFee: shippingFee > 0 ? shippingFee : undefined,
      total: finalTotal,
      margin: Math.max(0, totalMargin),
      totalQty: totalBottleQty > 0 ? totalBottleQty : checkoutCart.reduce((sum, i) => sum + i.qty, 0),
      cashReceived: paymentMethod === 'CASH' ? cashReceived : undefined,
      cashChange: paymentMethod === 'CASH' ? Math.max(0, cashReceived - finalTotal) : undefined,
      cashier: currentShift.cashierName || 'Kasir',
      status: 'COMPLETED',
    };

    // 1. Save locally immediately for snappy user experience
    StorageService.saveTransaction(newReceipt);

    // 2. Update shift cash sales if cash
    if (paymentMethod === 'CASH') {
      StorageService.updateShiftCashSales(finalTotal);
    }

    // Refresh UI
    refreshAllData();

    // Show receipt modal
    setActiveReceipt(newReceipt);
    setIsReceiptOpen(true);

    // Reset checkout form
    handleClearCart();

    // 3. Asynchronously push to Google Spreadsheet (Produk ke LOG_PENJUALAN, Ongkir ke LAIN-LAIN)
    GasApiService.pushTransaction(newReceipt)
      .then((res) => {
        if (res.success) {
          const ongkirNotice = newReceipt.shippingFee && newReceipt.shippingFee > 0
            ? ' & Ongkir masuk ke sheet LAIN-LAIN'
            : '';
          showToast(`✓ Transaksi ${newReceipt.id} tercatat di LOG_PENJUALAN${ongkirNotice}`, 'success');
          // Refresh data keuangan agar baris ongkir langsung sinkron di UI
          if (newReceipt.shippingFee && newReceipt.shippingFee > 0) {
            refreshAllData();
          }
        } else {
          showToast(`⚠️ Transaksi disimpan di kasir, namun gagal ke Sheets: ${res.message || 'Error'}`, 'error');
        }
      })
      .catch((err) => {
        console.warn('Background push to Google Sheets failed:', err);
        showToast(`⚠️ Transaksi disimpan di kasir, gagal ke Sheets: ${err?.message || 'Error'}`, 'error');
      });
  };

  // View Receipt Modal
  const handleViewReceipt = useCallback((receipt: TransactionReceipt) => {
    setActiveReceipt(receipt);
    setIsReceiptOpen(true);
  }, []);

  // Void Transaction & Delete from Google Sheets (Mirroring basumurti/ortukill-pos Code.gs v3.5)
  const handleVoidTransaction = async (id: string, reason: string) => {
    // 1. Optimistic removal seketika di kasir (kembalikan stok & hapus dari tampilan)
    StorageService.voidTransaction(id, reason);
    const cleanId = String(id || '').trim().toUpperCase();
    const bareId = cleanId.replace(/^#/, '').replace(/^VOIDED-/, '');
    const isSame = (tId: string) => {
      const c = String(tId || '').trim().toUpperCase();
      const b = c.replace(/^#/, '').replace(/^VOIDED-/, '');
      return c === cleanId || b === bareId;
    };
    setTransactions((prev) => prev.filter((t) => !isSame(t.id)));
    setTodayTransactions((prev) => prev.filter((t) => !isSame(t.id)));
    refreshAllData();

    showToast(`Menghapus transaksi #${id} di Google Sheet…`, 'info', 2500);

    let res;
    try {
      res = await GasApiService.pushVoidTransaction(id, reason);
    } catch (err) {
      console.warn(err);
      res = { success: false, deletedRows: 0, reachable: false, message: 'Gagal menghubungi server.' };
    }

    const deleted = res?.deletedRows || 0;
    const isAlreadyGone = res?.alreadyDeletedOnSheet ||
      String(res?.message || '').toLowerCase().includes('tidak ditemukan') ||
      String(res?.message || '').toLowerCase().includes('sudah terhapus');

    if ((res?.success && deleted > 0) || isAlreadyGone) {
      refreshAllData();
      if (deleted > 0) {
        showToast(`✓ Struk #${id} berhasil di-void & terhapus dari Google Sheet (${deleted} baris LOG_PENJUALAN).`, 'success', 6000);
      } else {
        showToast(`✓ Struk #${id} sudah tidak ada di Google Sheet dan telah dibersihkan dari kasir.`, 'success', 6000);
      }
      return;
    }

    if (!res?.reachable) {
      showToast(
        `✓ Struk #${id} berhasil dibatalkan & dibersihkan dari kasir (Google Sheet offline).`,
        'info',
        6000
      );
      return;
    }

    // Sheet menjawab tapi ada kendala (misal baris dilindungi)
    showToast(
      `⚠️ Transaksi dibatalkan di kasir, namun di Google Sheet: ${res?.message || 'Transaksi tidak terhapus.'}`,
      'error',
      9000
    );
  };

  // Delete Transaction permanently & Delete from Google Sheets (Code.gs v3.5)
  const handleDeleteTransaction = async (id: string) => {
    // 1. Optimistic removal seketika di kasir
    StorageService.deleteTransaction(id, false);
    const cleanId = String(id || '').trim().toUpperCase();
    const bareId = cleanId.replace(/^#/, '').replace(/^VOIDED-/, '');
    const isSame = (tId: string) => {
      const c = String(tId || '').trim().toUpperCase();
      const b = c.replace(/^#/, '').replace(/^VOIDED-/, '');
      return c === cleanId || b === bareId;
    };
    setTransactions((prev) => prev.filter((t) => !isSame(t.id)));
    setTodayTransactions((prev) => prev.filter((t) => !isSame(t.id)));
    refreshAllData();

    showToast(`Menghapus struk #${id} permanen di Google Sheet…`, 'info', 2500);

    let res: any;
    try {
      res = await GasApiService.deleteTransactionFromGas(id);
    } catch (err) {
      console.warn(err);
      res = { success: false, deletedRows: 0, reachable: false, message: 'Gagal menghubungi server.' };
    }

    const deleted = res?.deletedRows || 0;
    const isAlreadyGone = res?.alreadyDeletedOnSheet ||
      String(res?.message || '').toLowerCase().includes('tidak ditemukan') ||
      String(res?.message || '').toLowerCase().includes('sudah terhapus');

    if ((res?.success && deleted > 0) || isAlreadyGone || !res?.reachable) {
      refreshAllData();
      if (deleted > 0) {
        showToast(`✓ Struk #${id} berhasil dihapus permanen (${deleted} baris di Google Sheets)`, 'success', 6000);
      } else if (isAlreadyGone) {
        showToast(`✓ Struk #${id} sudah tidak ada di Google Sheets dan telah dihapus dari kasir`, 'success', 6000);
      } else {
        showToast(`✓ Struk #${id} berhasil dihapus dari kasir (Google Sheet offline)`, 'info', 6000);
      }
      return;
    }

    showToast(
      `⚠️ Transaksi dihapus di kasir, namun di Google Sheet: ${res?.message || 'Error'}`,
      'error',
      9000
    );
  };

  // Product & Stock Management
  const handleUpdateStock = (productId: string, newStock: number) => {
    StorageService.updateProductStock(productId, newStock);
    refreshAllData();

    GasApiService.pushStockUpdate(productId, newStock)
      .then((res) => {
        if (res.success) {
          showToast(`✓ Stok diperbarui di Google Sheets`, 'success');
        }
      })
      .catch((err) => console.warn(err));
  };

  const handleAddProduct = async (newProd: Omit<Product, 'id'>) => {
    try {
      const res = await GasApiService.addProduct(newProd);
      if (res && res.success) {
        StorageService.addProduct(newProd);
        StorageService.addStockAuditLog({
          sku: newProd.sku,
          productName: newProd.name,
          action: 'TAMBAH_PRODUK',
          details: `Tambah produk baru (Harga: Rp ${newProd.price.toLocaleString('id-ID')}, HPP: Rp ${newProd.cost.toLocaleString('id-ID')}, Stok Awal: ${newProd.stock})`,
          newValue: newProd.stock,
          source: 'GOOGLE_SHEETS',
          operator: 'Admin',
        });
        refreshAllData();
        showToast(res.message || `✓ Produk ${newProd.name} berhasil ditambahkan ke Google Sheets!`, 'success');
        handleSyncSpreadsheet(true);
      } else {
        showToast(`⚠️ Gagal menambah produk ke Google Sheets: ${res?.message || 'Error'}`, 'error', 6000);
      }
    } catch (err: any) {
      showToast(`⚠️ Gagal koneksi saat menambah produk: ${err?.message || 'Error'}`, 'error', 6000);
    }
  };

  const handleUpdateProduct = async (updatedProd: Product) => {
    try {
      const res = await GasApiService.updateProduct(updatedProd);
      if (res && res.success) {
        StorageService.updateProduct(updatedProd);
        StorageService.addStockAuditLog({
          sku: updatedProd.sku,
          productName: updatedProd.name,
          action: 'EDIT_PRODUK',
          details: `Ubah info produk (Harga: Rp ${updatedProd.price.toLocaleString('id-ID')}, HPP: Rp ${updatedProd.cost.toLocaleString('id-ID')})`,
          source: 'GOOGLE_SHEETS',
          operator: 'Admin',
        });
        refreshAllData();
        showToast(res.message || `✓ Info produk ${updatedProd.name} diperbarui di Google Sheets!`, 'success');
        handleSyncSpreadsheet(true);
      } else {
        showToast(`⚠️ Gagal memperbarui produk: ${res?.message || 'Error'}`, 'error', 6000);
      }
    } catch (err: any) {
      showToast(`⚠️ Gagal koneksi saat memperbarui produk: ${err?.message || 'Error'}`, 'error', 6000);
    }
  };

  // Shift Management
  const handleAddExpense = (description: string, amount: number) => {
    StorageService.addShiftExpense(description, amount);
    refreshAllData();
  };

  const handleCloseShift = (actualCash: number, notes: string) => {
    StorageService.closeCurrentShift(actualCash, notes);
    refreshAllData();
  };

  const handleStartNewShift = (startingCash: number, cashierName: string) => {
    StorageService.startNewShift(startingCash, cashierName);
    refreshAllData();
  };

  // Finances & Target Handlers
  const handleAddFinanceRecord = async (rec: Omit<FinanceRecord, 'id' | 'dateYmd' | 'dateTimeStr'>) => {
    // 1. Simpan lokal agar langsung tampil di UI
    const updatedList = StorageService.saveFinanceRecord(rec);
    const savedRec = updatedList[0];
    refreshAllData();

    // 2. Tulis langsung ke sheet LAIN-LAIN di Google Sheets (Pengeluaran akan menjadi minus di sheet)
    try {
      const isExpense = rec.type === 'EXPENSE';
      const res = await GasApiService.pushPengeluaranLain({
        date: rec.date,
        description: rec.description,
        unitPrice: rec.unitPrice,
        qty: rec.qty,
        amount: rec.amount,
        paymentMethod: rec.paymentMethod,
        type: rec.type,
        category: rec.category,
        categoryLabel: rec.categoryLabel,
        cashier: rec.cashier,
      });

      if (res.success) {
        if (res.rowNumber && savedRec) {
          StorageService.saveFinanceRecord({
            ...savedRec,
            rowNumber: res.rowNumber,
            syncStatus: 'SYNCED',
          });
          refreshAllData();
        }
        showToast(`${isExpense ? 'Pengeluaran (Minus)' : 'Pemasukan'} tersimpan ke Sheet LAIN-LAIN baris ${res.rowNumber || 'baru'}!`, 'success');
      } else {
        showToast(`Tersimpan lokal. ${res.message || ''}`, 'info');
      }
    } catch (err: any) {
      showToast('Tersimpan lokal (Google Sheets offline)', 'info');
    }
  };

  const handleDeleteFinanceRecord = async (id: string, rowNumber?: number) => {
    StorageService.deleteFinanceRecord(id);
    refreshAllData();

    if (rowNumber) {
      try {
        const res = await GasApiService.deletePengeluaranLain(rowNumber);
        if (res.success) {
          showToast(`Baris ${rowNumber} di sheet LAIN-LAIN berhasil dihapus`, 'success');
        }
      } catch (err) {
        // ignore
      }
    }
  };

  const handleSaveSalesTarget = (targetAmount: number, month?: string) => {
    StorageService.saveSalesTarget(targetAmount, month);
    refreshAllData();
    showToast(`Target penjualan disetel ke ${formatRupiah(targetAmount)}`, 'success');
  };

  // Reset / Bersihkan data lokal ke kondisi bersih (tanpa data demo)
  const handleResetData = () => {
    StorageService.resetToInitialData();
    handleClearCart();
    refreshAllData();
    showToast('Data transaksi kasir dibersihkan. Memori disetel berdasarkan pembaruan terakhir.', 'info');
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const syncStatus: SyncHealthStatus = !isOnline
    ? 'offline'
    : isSyncing
    ? 'syncing'
    : syncError
    ? 'error'
    : isConnectedGas
    ? 'connected'
    : 'error';

  return (
    <AppMotionProvider>
      <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] flex flex-col font-sans selection:bg-[var(--accent)] selection:text-[var(--accent-foreground)] pb-20 md:pb-0 transition-colors duration-200">
        {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        brand={brand}
        todayCount={todaySummary.totalTransactions}
        todayOmset={todaySummary.totalOmset}
        todayMargin={todaySummary.totalMargin}
        isConnectedGas={isConnectedGas}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        lastSynced={lastSynced}
        lastUpdateInfo={lastUpdateInfo}
        onSyncData={() => handleSyncSpreadsheet(false)}
        onResetData={handleResetData}
        onOpenAiCopilot={() => setIsAiCopilotOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      />

      {/* Lightweight Non-Intrusive Offline / Sync Error Status Banner */}
      {!isOnline ? (
        <div
          role="status"
          className="bg-[var(--warning-soft)] border-b border-[var(--warning)]/35 px-3 sm:px-6 py-2 no-print"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 text-xs font-semibold text-amber-900 dark:text-[var(--warning)]">
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff className="w-4 h-4 text-amber-700 dark:text-[var(--warning)] shrink-0" />
              <span className="truncate">Mode offline — data tersimpan aman di perangkat</span>
            </div>
          </div>
        </div>
      ) : syncError ? (
        <div
          role="status"
          className="bg-[var(--danger-soft)] border-b border-[var(--danger)]/35 px-3 sm:px-6 py-2 no-print"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 text-xs font-semibold text-red-900 dark:text-[var(--danger)]">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />
              <span className="truncate">Sinkronisasi Sheets gagal</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSyncSpreadsheet(false)}
                disabled={isSyncing}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-[var(--danger)] hover:opacity-90 text-[var(--danger-foreground)] text-xs font-bold flex items-center gap-1.5 active:scale-[0.97] transition-transform cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Coba lagi</span>
              </button>
              <button
                type="button"
                onClick={() => setSyncError(null)}
                aria-label="Tutup peringatan sinkronisasi"
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/15 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Floating Status Toast (Supports Undo action, positioned cleanly above overlays) */}
      <AnimatedToastContainer
        toastKey={toast ? toast.id : null}
        className="fixed top-16 left-3 right-3 sm:top-auto sm:left-auto sm:bottom-8 sm:right-6 z-[100050] pointer-events-none flex justify-center sm:justify-end"
      >
        {toast && (
          <div data-toast-overlay="true" className="w-full sm:w-auto sm:max-w-md pointer-events-auto">
            <LiquidSurface
              role="status"
              borderRadius={16}
              material="thin"
              className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold w-full ${
                toast.type === 'success'
                  ? 'border-[var(--success)]/45 text-emerald-700 dark:text-[var(--success)]'
                  : toast.type === 'error'
                  ? 'border-[var(--danger)]/45 text-[var(--danger)]'
                  : 'border-[var(--accent)]/35 text-[var(--foreground)]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[var(--success)] shrink-0" />}
                {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />}
                {toast.type === 'info' && <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />}
                <span className="break-words">{toast.message}</span>
              </div>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    const act = toast.action;
                    setToast(null);
                    act?.onAction();
                  }}
                  className="min-h-[36px] px-3 py-1 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 font-bold text-xs shrink-0 active:scale-[0.97] transition-transform cursor-pointer"
                >
                  {toast.action.label}
                </button>
              )}
            </LiquidSurface>
          </div>
        )}
      </AnimatedToastContainer>

      {/* Main Content Body */}
      <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto w-full">
        <ViewFadeTransition viewKey={activeTab}>
        {activeTab === 'pos' && (
          <PosRegisterView
            products={products}
            transactions={transactions}
            cart={cart}
            customerName={customerName}
            setCustomerName={setCustomerName}
            discount={discount}
            setDiscount={setDiscount}
            promoCode={appliedPromoCode}
            setPromoCode={setAppliedPromoCode}
            promoName={appliedPromoName}
            setPromoName={setAppliedPromoName}
            shippingFee={shippingFee}
            setShippingFee={setShippingFee}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            cashReceived={cashReceived}
            setCashReceived={setCashReceived}
            onAddToCart={handleAddToCart}
            onUpdateQty={handleUpdateQty}
            onUpdateItemPrice={handleUpdateItemPrice}
            onRemoveFromCart={handleRemoveFromCart}
            onRestoreCartItem={handleRestoreCartItem}
            onClearCart={handleClearCart}
            onProcessCheckout={handleProcessCheckout}
            onShowToast={showToast}
            brand={brand}
            todayOmset={todaySummary.totalOmset}
            todayMargin={todaySummary.totalMargin}
            todayCount={todaySummary.totalTransactions}
            todayFilteredBottleQty={todaySummary.filteredBottleQty}
            isConnectedGas={isConnectedGas}
            onNavigateTab={setActiveTab}
            isRedPriceMode={isRedPriceMode}
            onToggleRedPriceMode={handleToggleRedPriceMode}
          />
        )}

        {activeTab === 'today' && (
          <ChunkErrorBoundary
            resetKey={`today-${chunkRetryNonce}`}
            title="Gagal memuat Transaksi Hari Ini"
            onRetry={() => {
              LazyTodayTransactionsView.reset();
              setChunkRetryNonce((n) => n + 1);
            }}
          >
            <Suspense fallback={<ViewLoadingFallback label="Memuat transaksi hari ini..." />}>
              <LazyTodayTransactionsView.Component
                summary={todaySummary}
                transactions={todayTransactions}
                allTransactions={transactions}
                onViewReceipt={handleViewReceipt}
                onVoidTransaction={handleVoidTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onRefresh={refreshAllData}
                onSyncSpreadsheet={() => handleSyncSpreadsheet(false)}
                isSyncing={isSyncing}
              />
            </Suspense>
          </ChunkErrorBoundary>
        )}

        {activeTab === 'history' && (
          <ChunkErrorBoundary
            resetKey={`history-${chunkRetryNonce}`}
            title="Gagal memuat Laporan & Grafik"
            onRetry={() => {
              LazySalesHistoryView.reset();
              setChunkRetryNonce((n) => n + 1);
            }}
          >
            <Suspense fallback={<ViewLoadingFallback label="Memuat Laporan & Grafik..." />}>
              <LazySalesHistoryView.Component
                transactions={transactions}
                products={products}
                financeRecords={financeRecords}
                salesTarget={salesTarget}
                onViewReceipt={handleViewReceipt}
                onVoidTransaction={handleVoidTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onAddFinanceRecord={handleAddFinanceRecord}
                onDeleteFinanceRecord={handleDeleteFinanceRecord}
                onSaveSalesTarget={handleSaveSalesTarget}
                onSyncSpreadsheet={() => handleSyncSpreadsheet(false)}
                isSyncing={isSyncing}
                showToast={showToast}
                isDarkMode={isDarkMode}
              />
            </Suspense>
          </ChunkErrorBoundary>
        )}

        {activeTab === 'finance' && (
          <ChunkErrorBoundary
            resetKey={`finance-${chunkRetryNonce}`}
            title="Gagal memuat Catatan Keuangan"
            onRetry={() => {
              LazyFinanceManagementView.reset();
              setChunkRetryNonce((n) => n + 1);
            }}
          >
            <Suspense fallback={<ViewLoadingFallback label="Memuat catatan keuangan..." />}>
              <LazyFinanceManagementView.Component
                financeRecords={financeRecords}
                onAddRecord={handleAddFinanceRecord}
                onDeleteRecord={handleDeleteFinanceRecord}
                onSyncSpreadsheet={() => handleSyncSpreadsheet(false)}
                isSyncing={isSyncing}
                showToast={showToast}
              />
            </Suspense>
          </ChunkErrorBoundary>
        )}

        {activeTab === 'stock' && (
          <ChunkErrorBoundary
            resetKey={`stock-${chunkRetryNonce}`}
            title="Gagal memuat Manajemen Stok"
            onRetry={() => {
              LazyStockManagementView.reset();
              setChunkRetryNonce((n) => n + 1);
            }}
          >
            <Suspense fallback={<ViewLoadingFallback label="Memuat manajemen stok..." />}>
              <LazyStockManagementView.Component
                products={products}
                onUpdateStock={handleUpdateStock}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onSyncSpreadsheet={() => handleSyncSpreadsheet(false)}
                isSyncing={isSyncing}
                showToast={showToast}
              />
            </Suspense>
          </ChunkErrorBoundary>
        )}

        {activeTab === 'shift' && (
          <ChunkErrorBoundary
            resetKey={`shift-${chunkRetryNonce}`}
            title="Gagal memuat Tutup Shift"
            onRetry={() => {
              LazyShiftClosingView.reset();
              setChunkRetryNonce((n) => n + 1);
            }}
          >
            <Suspense fallback={<ViewLoadingFallback label="Memuat data shift..." />}>
              <LazyShiftClosingView.Component
                currentShift={currentShift}
                shiftHistory={shiftHistory}
                todayCashSales={todaySummary.paymentBreakdown.CASH.total}
                todayQrisSales={todaySummary.paymentBreakdown.QRIS.total}
                todayTransferSales={todaySummary.paymentBreakdown.TRANSFER.total}
                brand={brand}
                onAddExpense={handleAddExpense}
                onCloseShift={handleCloseShift}
                onStartNewShift={handleStartNewShift}
              />
            </Suspense>
          </ChunkErrorBoundary>
        )}

        {activeTab === 'gas' && (
          <ChunkErrorBoundary
            resetKey={`gas-${chunkRetryNonce}`}
            title="Gagal memuat Integrasi Google Sheets"
            onRetry={() => {
              LazyGasIntegrationView.reset();
              setChunkRetryNonce((n) => n + 1);
            }}
          >
            <Suspense fallback={<ViewLoadingFallback label="Memuat integrasi Google Sheets..." />}>
              <LazyGasIntegrationView.Component
                onSyncComplete={() => {
                  setIsConnectedGas(true);
                  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  setLastSynced(timeStr);
                  refreshAllData();
                }}
              />
            </Suspense>
          </ChunkErrorBoundary>
        )}
        </ViewFadeTransition>
      </main>

      {/* Clean Desktop Footer */}
      <footer className="py-3 px-4 sm:px-6 border-t border-[var(--border)] bg-[var(--surface)] text-[11px] text-[var(--muted)] select-none no-print hidden md:flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnectedGas ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
          <span className="font-medium">
            {isConnectedGas ? 'Terhubung ke Google Spreadsheet' : 'Mode Offline (Data Lokal)'}
          </span>
        </div>
        <div className="font-semibold text-[var(--foreground)]">
          ORTUKILL KEDIRI POS
        </div>
        <div>
          Bantuan: <span className="font-semibold text-[var(--foreground)]">{brand.PHONE}</span>
        </div>
      </footer>

      {/* Mobile-First Bottom Navigation Bar */}
      <BottomNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        todayCount={todaySummary.totalTransactions}
        cartCount={cartCount}
        isConnectedGas={isConnectedGas}
        onResetData={handleResetData}
        onOpenAiCopilot={() => {
          void LazyAiCopilotModal.preload();
          setIsAiCopilotOpen(true);
        }}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      />

      {/* Desktop Floating AI Copilot Button (Mobile uses Header button so it never overlaps cart bar) */}
      <div className="hidden md:block fixed bottom-6 right-6 z-40 no-print">
        <LiquidSurface borderRadius={999} material="regular" className="rounded-full">
          <button
            onClick={() => {
              void LazyAiCopilotModal.preload();
              setIsAiCopilotOpen(true);
            }}
            onMouseEnter={() => { void LazyAiCopilotModal.preload(); }}
            type="button"
            aria-label="Buka AI Copilot Kasir"
            title="AI Copilot Kasir (Otomasi Suara & Teks)"
            className="flex items-center gap-2 px-4 py-3 rounded-full text-[var(--foreground)] font-bold text-xs transition-transform hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
            <span>AI Copilot</span>
          </button>
        </LiquidSurface>
      </div>

      {/* Thermal Receipt Modal */}
      {isReceiptOpen && activeReceipt && (
        <ChunkErrorBoundary
          resetKey={`receipt-${chunkRetryNonce}`}
          compact
          title="Gagal memuat Struk"
          onRetry={() => {
            LazyReceiptModal.reset();
            setChunkRetryNonce((n) => n + 1);
          }}
        >
          <Suspense fallback={<ModalLoadingFallback label="Menyiapkan struk..." />}>
            <LazyReceiptModal.Component
              receipt={activeReceipt}
              brand={brand}
              isOpen={isReceiptOpen}
              onClose={() => setIsReceiptOpen(false)}
              onNewTransaction={() => {
                handleClearCart();
                setIsReceiptOpen(false);
                setActiveTab('pos');
              }}
              onVoidTransaction={handleVoidTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onShowToast={showToast}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {/* AI Copilot Kasir Modal (Voice & Text Automated Assistant) */}
      {isAiCopilotOpen && (
        <ChunkErrorBoundary
          resetKey={`copilot-${chunkRetryNonce}`}
          compact
          title="Gagal memuat AI Copilot"
          onRetry={() => {
            LazyAiCopilotModal.reset();
            setChunkRetryNonce((n) => n + 1);
          }}
        >
          <Suspense fallback={<ModalLoadingFallback label="Membuka AI Copilot..." />}>
            <LazyAiCopilotModal.Component
              isOpen={isAiCopilotOpen}
              onClose={() => setIsAiCopilotOpen(false)}
              products={products}
              todayTransactions={todayTransactions}
              cashierName={currentShift.cashierName || 'Kasir'}
              brand={brand}
              onExecuteAction={handleExecuteAiAction}
              onViewReceipt={handleViewReceipt}
              onShowToast={showToast}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}
      </div>
    </AppMotionProvider>
  );
}
