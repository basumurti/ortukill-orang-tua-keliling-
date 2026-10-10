import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PosRegisterView } from './components/PosRegisterView';
import { TodayTransactionsView } from './components/TodayTransactionsView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { StockManagementView } from './components/StockManagementView';
import { ShiftClosingView } from './components/ShiftClosingView';
import { GasIntegrationView } from './components/GasIntegrationView';
import { ReceiptModal } from './components/ReceiptModal';
import { BottomNavigation } from './components/BottomNavigation';
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
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas'>('pos');

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
  const [isRedPriceMode, setIsRedPriceMode] = useState<boolean>(false);

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

  // Google Sheets Synchronization State
  const [isConnectedGas, setIsConnectedGas] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Load state from StorageService
  const refreshAllData = () => {
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
    try {
      const res = await GasApiService.fetchAndSyncAll();
      if (res.success) {
        setIsConnectedGas(true);
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSynced(timeStr);
        refreshAllData();
        if (!silent) {
          const pCount = res.products?.length || 0;
          const tCount = res.todayTransactions?.length || 0;
          showToast(`Berhasil sinkron! Memuat ${pCount} produk & ${tCount} transaksi hari ini dari Spreadsheet.`, 'success');
        }
      } else {
        if (!silent) {
          showToast(res.message || 'Gagal tersambung ke Google Spreadsheet.', 'error');
        }
      }
    } catch (err: any) {
      if (!silent) {
        showToast('Koneksi Google Sheets gagal: ' + err.message, 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshAllData();
    // Check if saved Web App URL exists and perform initial silent sync
    const initGas = async () => {
      try {
        await GasApiService.getStatus();
      } catch {
        // ignore
      }
      const saved = GasApiService.getSavedWebAppUrl();
      if (saved) {
        setIsConnectedGas(true);
        handleSyncSpreadsheet(true);
      }
    };
    initGas();
  }, []);

  // Toggle Mode Harga Jual Merah (Make Up Price Reseller)
  const handleToggleRedPriceMode = (enabled: boolean) => {
    setIsRedPriceMode(enabled);

    // Update seluruh barang yang saat ini sudah ada di keranjang
    setCart((prevCart) =>
      prevCart.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
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
      enabled ? 'info' : 'info'
    );
  };

  // Cart operations
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;

    const regularPrice = product.price;
    const redPrice = (product.redPrice && product.redPrice > 0) ? product.redPrice : regularPrice;
    const effectivePrice = isRedPriceMode ? redPrice : regularPrice;

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev; // Cannot exceed available stock
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                qty: item.qty + 1,
                subtotal: (item.qty + 1) * item.price,
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
            cost: product.cost,
            qty: 1,
            subtotal: effectivePrice,
            total: effectivePrice,
            margin: effectivePrice - product.cost,
            isRedPrice: isRedPriceMode,
          },
        ];
      }
    });
  };

  const handleUpdateItemPrice = (productId: string, newPrice: number) => {
    const validPrice = Math.max(0, newPrice);
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
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
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    const prod = products.find((p) => p.id === productId);
    if (prod && qty > prod.stock) {
      qty = prod.stock;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const itemSubtotal = qty * item.price;
          return {
            ...item,
            qty,
            subtotal: itemSubtotal,
            total: itemSubtotal,
            margin: qty * (item.price - item.cost),
          };
        }
        return item;
      })
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscount(0);
    setAppliedPromoCode('');
    setAppliedPromoName('');
    setShippingFee(0);
    setCashReceived(0);
    setCustomerName('');
  };

  // Checkout process
  const handleProcessCheckout = () => {
    if (cart.length === 0) return;

    const subtotal = cart.reduce((sum, i) => sum + i.subtotal, 0);
    const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
    const totalMargin = cart.reduce((sum, i) => sum + i.margin, 0) - discount;
    const finalTotal = Math.max(0, subtotal - discount + shippingFee);

    if (paymentMethod === 'CASH' && cashReceived < finalTotal) {
      return;
    }

    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const dateFormatted = `${d}/${m}/${y}`;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeFormatted = `${hours}:${minutes}:${seconds}`;

    const newReceipt: TransactionReceipt = {
      id: StorageService.generateTransactionId(),
      date: dateFormatted,
      transactionDate: `${dateFormatted} ${timeFormatted}`,
      websiteTime: timeFormatted,
      createdAt: now.getTime(),
      customerName: customerName.trim() || undefined,
      paymentMethod,
      promoCode: appliedPromoCode || undefined,
      promoName: appliedPromoName || undefined,
      isResellerMode: isRedPriceMode,
      items: cart.map((item) => {
        const itemTotal = item.subtotal || (item.qty * item.price);
        const regularPrice = item.regularPrice || item.originalPrice || item.price;
        return {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          price: item.price,
          regularPrice: regularPrice,
          cost: item.cost,
          subtotal: itemTotal,
          total: itemTotal,
          margin: item.margin,
          isRedPrice: item.isRedPrice,
        };
      }),
      subtotal,
      discount,
      shippingFee: shippingFee > 0 ? shippingFee : undefined,
      total: finalTotal,
      margin: Math.max(0, totalMargin),
      totalQty,
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
  const handleViewReceipt = (receipt: TransactionReceipt) => {
    setActiveReceipt(receipt);
    setIsReceiptOpen(true);
  };

  // Void Transaction & Delete from Google Sheets
  const handleVoidTransaction = (id: string, reason: string) => {
    StorageService.voidTransaction(id, reason);
    refreshAllData();

    GasApiService.pushVoidTransaction(id, reason)
      .then((res) => {
        if (res.success) {
          const detail = res.totalDeleted ? ` (${res.totalDeleted} baris dihapus di Sheets)` : '';
          showToast(`✓ Struk #${id} di-VOID${detail}`, 'success');
          // Sinkronisasi ulang data terbaru dari Google Sheets
          GasApiService.fetchAndSyncAll()
            .then(() => refreshAllData())
            .catch(() => {});
        } else {
          showToast(`Transaksi #${id} di-VOID lokal. (${res.message || 'Sheets offline'})`, 'info');
        }
      })
      .catch((err) => {
        console.warn(err);
        showToast(`Transaksi #${id} di-VOID lokal`, 'info');
      });
  };

  // Delete Transaction permanently & Delete from Google Sheets
  const handleDeleteTransaction = (id: string) => {
    StorageService.deleteTransaction(id, true);
    refreshAllData();

    GasApiService.deleteTransactionFromGas(id)
      .then((res) => {
        if (res.success) {
          const detail = res.totalDeleted ? ` (${res.totalDeleted} baris dihapus di Sheets)` : '';
          showToast(`✓ Struk #${id} berhasil dihapus permanen${detail}`, 'success');
          // Sinkronisasi ulang data terbaru dari Google Sheets
          GasApiService.fetchAndSyncAll()
            .then(() => refreshAllData())
            .catch(() => {});
        } else {
          showToast(`Struk #${id} dihapus dari riwayat lokal`, 'info');
        }
      })
      .catch((err) => {
        console.warn(err);
        showToast(`Struk #${id} dihapus dari riwayat lokal`, 'info');
      });
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

  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    StorageService.addProduct(newProd);
    refreshAllData();
    showToast(`Produk ${newProd.name} ditambahkan lokal`, 'info');
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    StorageService.updateProduct(updatedProd);
    refreshAllData();
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

  return (
    <div className="min-h-screen bg-[#F8F6F3] text-stone-900 flex flex-col font-sans selection:bg-[#FF5E36] selection:text-white pb-20 md:pb-6">
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
        lastSynced={lastSynced}
        lastUpdateInfo={lastUpdateInfo}
        onSyncData={() => handleSyncSpreadsheet(false)}
        onResetData={handleResetData}
      />

      {/* Floating Status Toast */}
      {toast && (
        <div className="fixed bottom-24 right-4 sm:bottom-12 sm:right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
              : toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-900'
              : 'bg-white/95 border-stone-200 text-stone-900'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-[#FF5E36] flex-shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 px-3 sm:px-6 py-4 max-w-7xl mx-auto w-full">
        {activeTab === 'pos' && (
          <PosRegisterView
            products={products}
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
            onClearCart={handleClearCart}
            onProcessCheckout={handleProcessCheckout}
            brand={brand}
            todayOmset={todaySummary.totalOmset}
            todayMargin={todaySummary.totalMargin}
            todayCount={todaySummary.totalTransactions}
            isConnectedGas={isConnectedGas}
            onNavigateTab={setActiveTab}
            isRedPriceMode={isRedPriceMode}
            onToggleRedPriceMode={handleToggleRedPriceMode}
          />
        )}

        {activeTab === 'today' && (
          <TodayTransactionsView
            summary={todaySummary}
            transactions={todayTransactions}
            onViewReceipt={handleViewReceipt}
            onVoidTransaction={handleVoidTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onRefresh={refreshAllData}
            onSyncSpreadsheet={() => handleSyncSpreadsheet(false)}
            isSyncing={isSyncing}
          />
        )}

        {activeTab === 'history' && (
          <SalesHistoryView
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
          />
        )}

        {activeTab === 'stock' && (
          <StockManagementView
            products={products}
            onUpdateStock={handleUpdateStock}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onSyncSpreadsheet={() => handleSyncSpreadsheet(false)}
            isSyncing={isSyncing}
            showToast={showToast}
          />
        )}

        {activeTab === 'shift' && (
          <ShiftClosingView
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
        )}

        {activeTab === 'gas' && (
          <GasIntegrationView 
            onSyncComplete={() => {
              setIsConnectedGas(true);
              const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              setLastSynced(timeStr);
              refreshAllData();
            }}
          />
        )}
      </main>

      {/* Modern Compact Footer */}
      <footer className="py-3 px-4 sm:px-6 border-t border-stone-200/60 bg-transparent text-[11px] text-stone-500 select-none no-print hidden md:flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnectedGas ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="font-medium">
            {isConnectedGas ? 'Status: Terhubung ke Google Spreadsheet' : 'Status: Mode Offline (Belum Tersinkron)'}
          </span>
        </div>
        <div className="font-medium">
          ORTUKILL KEDIRI POS • Mobile-First Edition
        </div>
        <div>
          Bantuan: <span className="font-semibold text-stone-700">{brand.PHONE}</span>
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
      />

      {/* Thermal Receipt Modal */}
      <ReceiptModal
        receipt={activeReceipt}
        brand={brand}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        onVoidTransaction={handleVoidTransaction}
        onDeleteTransaction={handleDeleteTransaction}
      />
    </div>
  );
}
