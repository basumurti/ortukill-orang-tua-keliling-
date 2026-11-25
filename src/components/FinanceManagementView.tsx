import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Fuel, 
  Truck, 
  Gift, 
  ShoppingBag, 
  Building2, 
  MoreHorizontal, 
  Calendar, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  RefreshCw,
  FileSpreadsheet,
  Check,
  CreditCard,
  Banknote,
  SendHorizontal,
  Package
} from 'lucide-react';
import { FinanceRecord, FinanceType, FinanceCategory } from '../types';
import { formatRupiah, getFormattedNow } from '../services/storageService';
import { GasApiService } from '../services/gasApiService';
import { AppConfirmDialog } from './AppConfirmDialog';

interface FinanceManagementViewProps {
  financeRecords: FinanceRecord[];
  onAddRecord: (record: Omit<FinanceRecord, 'id' | 'dateYmd' | 'dateTimeStr'>) => Promise<void> | void;
  onDeleteRecord: (id: string, rowNumber?: number) => Promise<void> | void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const FinanceManagementView: React.FC<FinanceManagementViewProps> = ({
  financeRecords,
  onAddRecord,
  onDeleteRecord,
  onSyncSpreadsheet,
  isSyncing = false,
  showToast: externalShowToast,
}) => {
  const [type, setType] = useState<FinanceType>('EXPENSE');
  const [category, setCategory] = useState<FinanceCategory | string>('PENGELUARAN_LAIN');
  
  // Kolom Sheet LAIN-LAIN: Tanggal (A), Keterangan (B), Harga (C), Jumlah (D), Total (E), Dibayar dengan (F)
  const todayFormatted = getFormattedNow().date; // DD/MM/YYYY
  const [entryDate, setEntryDate] = useState<string>(todayFormatted);
  const [description, setDescription] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [cashier, setCashier] = useState<string>('Kasir Utama');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(50);

  useEffect(() => {
    setVisibleCount(50);
  }, [searchQuery, filterType, filterPaymentMethod, filterCategory]);
  
  // Syncing & UI feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPullingSheet, setIsPullingSheet] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<FinanceRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, toastType: 'success' | 'error' | 'info' = 'info') => {
    if (externalShowToast) {
      externalShowToast(message, toastType);
      return;
    }
    setToast({ message, type: toastType });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Payment method options from screenshot Column H (BCA, CASH, GOPAY, JAGO)
  const paymentMethodOptions = [
    { value: 'BCA', label: 'BCA', bg: 'bg-[#2563EB] dark:bg-[#9333EA] text-white', activeRing: 'ring-[#2563EB] dark:ring-[#A855F7]', badge: 'bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border-blue-200 dark:border-purple-500/40' },
    { value: 'CASH', label: 'CASH', bg: 'bg-emerald-600 text-white font-bold', activeRing: 'ring-emerald-600 dark:ring-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/35' },
    { value: 'GOPAY', label: 'GOPAY', bg: 'bg-[#2563EB] dark:bg-[#9333EA] text-white', activeRing: 'ring-[#2563EB] dark:ring-[#A855F7]', badge: 'bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border-blue-200 dark:border-purple-500/40' },
    { value: 'JAGO', label: 'JAGO', bg: 'bg-amber-500 text-white font-bold', activeRing: 'ring-amber-500', badge: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/35' },
    { value: 'QRIS', label: 'QRIS', bg: 'bg-[#2563EB] dark:bg-[#9333EA] text-white', activeRing: 'ring-[#2563EB] dark:ring-[#A855F7]', badge: 'bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border-blue-200 dark:border-purple-500/40' },
  ];

  const categoryOptions = type === 'EXPENSE' ? [
    { value: 'RESTOK_BARANG', label: 'Restok Barang', icon: Package, color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15' },
    { value: 'PENGELUARAN_LAIN', label: 'Pengeluaran Lain-Lain', icon: MoreHorizontal, color: 'text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-[#24242B]' },
    { value: 'BENSIN', label: 'Bensin Motor / Kendaraan', icon: Fuel, color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15' },
    { value: 'OPERASIONAL', label: 'Operasional & Perlengkapan', icon: Building2, color: 'text-[#2563EB] dark:text-[#C084FC] bg-blue-50 dark:bg-purple-500/15' },
    { value: 'PEMBELIAN_STOK', label: 'Pembelian Stok / Kulakan', icon: ShoppingBag, color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15' },
  ] : [
    { value: 'ONGKIR', label: 'Ongkir Pengiriman (+)', icon: Truck, color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15' },
    { value: 'TIPS', label: 'Tips & Bonus (+)', icon: Gift, color: 'text-[#2563EB] dark:text-[#C084FC] bg-blue-50 dark:bg-purple-500/15' },
    { value: 'MODAL_LAIN', label: 'Modal / Pemasukan Lain (+)', icon: Wallet, color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15' },
  ];

  const handleTypeChange = (newType: FinanceType) => {
    setType(newType);
    if (newType === 'EXPENSE') {
      setCategory('PENGELUARAN_LAIN');
    } else {
      setCategory('ONGKIR');
    }
  };

  // Calculated total for form
  const parsedPrice = Math.abs(parseFloat(unitPrice) || 0);
  const parsedQty = Math.max(1, parseInt(qty, 10) || 1);
  const calculatedTotal = parsedPrice * parsedQty;

  const handleQuickAmount = (val: number) => {
    const cur = parseFloat(unitPrice) || 0;
    setUnitPrice(String(cur + val));
  };

  // Submit Handler: Write to Local AND Sheet LAIN-LAIN
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (calculatedTotal <= 0) {
      const msg = 'Masukkan harga/nominal yang valid (lebih dari 0).';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }
    if (!description.trim()) {
      const msg = 'Masukkan keterangan/catatan pengeluaran.';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }

    const matchedCat = categoryOptions.find((c) => c.value === category);
    const categoryLabel = matchedCat ? matchedCat.label : category;

    setIsSubmitting(true);
    try {
      await onAddRecord({
        date: entryDate.trim() || todayFormatted,
        type,
        category,
        categoryLabel,
        unitPrice: parsedPrice,
        qty: parsedQty,
        amount: calculatedTotal,
        description: description.trim(),
        paymentMethod: paymentMethod.toUpperCase(),
        cashier,
      });

      // Reset form
      setDescription('');
      setUnitPrice('');
      setQty('1');
      showToast(`Transaksi "${description.trim()}" (${formatRupiah(calculatedTotal)}) berhasil disimpan!`, 'success');
    } catch (err: any) {
      showToast('Gagal menyimpan transaksi: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pull data directly from Google Sheet LAIN-LAIN
  const handlePullFromSheet = async () => {
    setIsPullingSheet(true);
    try {
      if (onSyncSpreadsheet) {
        await onSyncSpreadsheet();
      } else {
        const res = await GasApiService.fetchPengeluaranLain();
        if (res.success) {
          const count = res.list?.length || 0;
          showToast(`Berhasil menarik ${count} baris dari Sheet LAIN-LAIN!`, 'success');
        } else {
          showToast(res.message || 'Gagal mengambil data dari Google Sheets.', 'error');
        }
      }
    } catch (err: any) {
      showToast('Koneksi ke Sheet LAIN-LAIN gagal: ' + err.message, 'error');
    } finally {
      setIsPullingSheet(false);
    }
  };

  // Calculations
  const totalIncome = financeRecords
    .filter((f) => f.type === 'INCOME')
    .reduce((sum, f) => sum + f.amount, 0);

  const totalExpense = financeRecords
    .filter((f) => f.type === 'EXPENSE')
    .reduce((sum, f) => sum + f.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Breakdown by payment method for expenses
  const expenseByMethod = financeRecords
    .filter((f) => f.type === 'EXPENSE')
    .reduce((acc, f) => {
      const pm = (f.paymentMethod || 'CASH').toUpperCase();
      acc[pm] = (acc[pm] || 0) + f.amount;
      return acc;
    }, {} as Record<string, number>);

  // Count records with sync status
  const syncedCount = financeRecords.filter((f) => f.syncStatus === 'SYNCED' || f.rowNumber).length;

  // Filtering list
  const filteredRecords = useMemo(() => {
    return financeRecords.filter((rec) => {
      if (filterType !== 'ALL' && rec.type !== filterType) return false;
      if (filterCategory !== 'ALL' && rec.category !== filterCategory) return false;
      if (filterPaymentMethod !== 'ALL') {
        const pm = (rec.paymentMethod || 'CASH').toUpperCase();
        if (pm !== filterPaymentMethod) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pm = (rec.paymentMethod || '').toLowerCase();
        return (
          rec.description.toLowerCase().includes(q) ||
          rec.categoryLabel.toLowerCase().includes(q) ||
          (rec.cashier && rec.cashier.toLowerCase().includes(q)) ||
          pm.includes(q) ||
          (rec.date && rec.date.includes(q))
        );
      }
      return true;
    });
  }, [financeRecords, filterType, filterCategory, filterPaymentMethod, searchQuery]);

  const visibleRecords = useMemo(() => {
    return filteredRecords.slice(0, visibleCount);
  }, [filteredRecords, visibleCount]);

  return (
    <div className="space-y-4 sm:space-y-5 pb-16 text-[#0F172A] dark:text-[#F4F4F6]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-16 sm:top-20 right-4 left-4 sm:left-auto z-50 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2.5 border ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-[#1B1B20] text-emerald-900 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/40'
              : toast.type === 'error'
              ? 'bg-red-50 dark:bg-[#1B1B20] text-red-900 dark:text-red-400 border-red-200 dark:border-red-500/40'
              : 'bg-blue-50 dark:bg-[#1B1B20] text-blue-900 dark:text-[#C084FC] border-blue-200 dark:border-purple-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header Banner - Google Sheet LAIN-LAIN Sync */}
      <div className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/40 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" />
                Sheet LAIN-LAIN
              </span>
              <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Read & Write Google Sheets
              </span>
              <span className="text-slate-500 dark:text-zinc-400 text-xs font-mono">
                ORTUKILL_KEDIRI • Kolom A-F
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight flex items-center gap-2 text-[#0F172A] dark:text-[#F4F4F6]">
              Buku Kas & Pengeluaran Lain-Lain
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
              Formulir dan riwayat ini terhubung langsung ke spreadsheet <strong className="text-[#0F172A] dark:text-[#F4F4F6]">ORTUKILL_KEDIRI</strong> tab <strong className="text-[#0F172A] dark:text-[#F4F4F6]">LAIN-LAIN</strong> (Tanggal, Keterangan, Harga, Jumlah, Total, Dibayar dengan). Setiap pengeluaran yang dicatat otomatis tersimpan ke baris spreadsheet!
            </p>
          </div>

          {/* Sync Action & Summary Stats Widget */}
          <div className="flex flex-col gap-2.5 w-full lg:w-auto lg:min-w-[270px]">
            {/* Sync Button */}
            <button
              type="button"
              onClick={handlePullFromSheet}
              disabled={isPullingSheet || isSyncing}
              className="w-full bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-[#0F172A] dark:text-[#F4F4F6] px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <RefreshCw className={`w-4 h-4 text-[#2563EB] dark:text-[#C084FC] ${isPullingSheet || isSyncing ? 'animate-spin' : ''}`} />
              <span>{isPullingSheet || isSyncing ? 'Menghubungkan ke Sheet...' : 'Tarik Data dari Sheet LAIN-LAIN'}</span>
            </button>

            {/* Quick Balance Preview */}
            <div className="bg-slate-50 dark:bg-[#24242B] rounded-xl p-3 border border-slate-200 dark:border-[#343440]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Saldo Arus Kas:</span>
                <span className={`text-sm font-extrabold tabular-nums font-mono ${netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatRupiah(netBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 mt-1.5 border-t border-slate-200 dark:border-[#343440]">
                <span className="text-slate-500 dark:text-zinc-400">Total Pengeluaran:</span>
                <span className="font-bold text-red-600 dark:text-red-400 tabular-nums font-mono">-{formatRupiah(totalExpense)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 pt-1">
                <span>Tersinkron Sheet:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums font-mono">{syncedCount} baris</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Form Input (Left) + List & Stats (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Column: Form Input matching Sheet LAIN-LAIN (Kolom A-F) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1B1B20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2B2B33]">
            <div>
              <h3 className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] flex items-center gap-2 text-sm sm:text-base">
                <Receipt className="w-5 h-5 text-[#2563EB] dark:text-[#C084FC]" />
                <span>Catat ke Sheet LAIN-LAIN</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Otomatis mengisi Kolom A s/d F di spreadsheet
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 px-2 py-0.5 rounded-full shrink-0">
              Live Write
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Toggle Switch Type: Pengeluaran (Sheet LAIN-LAIN) vs Pemasukan */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-[#24242B] p-1 rounded-xl border border-slate-200 dark:border-[#343440]">
              <button
                type="button"
                onClick={() => handleTypeChange('EXPENSE')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-xs transition-colors cursor-pointer min-h-[44px] ${
                  type === 'EXPENSE'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-white/70 dark:hover:bg-[#2E2E37]'
                }`}
              >
                <MinusCircle className="w-4 h-4 shrink-0" />
                <span>Pengeluaran (Sheet)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('INCOME')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-xs transition-colors cursor-pointer min-h-[44px] ${
                  type === 'INCOME'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-white/70 dark:hover:bg-[#2E2E37]'
                }`}
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>Pemasukan (+)</span>
              </button>
            </div>

            {/* Kolom A: Tanggal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                  Tanggal Transaksi (Kolom A)
                </span>
                <button
                  type="button"
                  onClick={() => setEntryDate(todayFormatted)}
                  className="text-[10px] font-bold text-[#2563EB] dark:text-[#C084FC] hover:underline cursor-pointer"
                >
                  Hari Ini
                </button>
              </label>
              <input
                type="text"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                placeholder="DD/MM/YYYY (contoh: 24/09/2026)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#343440] text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] bg-slate-50 dark:bg-[#24242B] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                required
              />
            </div>

            {/* Kolom B: Keterangan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Keterangan / Keperluan (Kolom B)
              </label>
              <textarea
                rows={2}
                placeholder={
                  type === 'EXPENSE'
                    ? 'Contoh: Beli bensin motor delivery, Plastik packing, Konsumsi karyawan...'
                    : 'Contoh: Ongkir COD pelanggan, Tips konsumen...'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#343440] text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] bg-slate-50 dark:bg-[#24242B] focus:bg-white dark:focus:bg-[#1B1B20] font-medium"
                required
              />
            </div>

            {/* Kolom C & D: Harga Satuan & Jumlah */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Kolom C: Harga Satuan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between gap-1">
                  <span>Harga Satuan (Kolom C)</span>
                  {type === 'EXPENSE' && (
                    <span className="text-[9px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 px-1.5 py-0.5 rounded">
                      Minus (-)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-zinc-500 text-xs">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#343440] text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] bg-slate-50 dark:bg-[#24242B] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px] tabular-nums font-mono"
                    required
                  />
                </div>
              </div>

              {/* Kolom D: Jumlah (Qty) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Jumlah / Qty (Kolom D)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#343440] text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] bg-slate-50 dark:bg-[#24242B] focus:bg-white dark:focus:bg-[#1B1B20] text-center min-h-[44px] tabular-nums font-mono"
                  required
                />
              </div>
            </div>

            {/* Quick Price Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mr-0.5">+ Cepat:</span>
              {[5000, 10000, 20000, 50000, 100000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="text-[11px] font-bold bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] border border-slate-200 dark:border-[#343440] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  +{val / 1000}k
                </button>
              ))}
            </div>

            {/* Kolom E: Total (Live preview) */}
            <div className="bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                  Total (Kolom E = C × D)
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 block truncate">
                  {formatRupiah(parsedPrice)} × {parsedQty} unit {type === 'EXPENSE' && '• Minus (-)'}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-base font-extrabold tabular-nums font-mono ${type === 'EXPENSE' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {type === 'EXPENSE' ? '-' : '+'}{formatRupiah(calculatedTotal)}
                </span>
                <span className={`block text-[9px] font-bold ${type === 'EXPENSE' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {type === 'EXPENSE' ? 'Tercatat Minus di Sheet' : 'Tercatat Positif di Sheet'}
                </span>
              </div>
            </div>

            {/* Kolom F: Dibayar dengan (BCA, CASH, GOPAY, JAGO) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Dibayar dengan (Kolom F)</span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">Dropdown H4:H7</span>
              </label>

              <div className="grid grid-cols-4 gap-1.5">
                {paymentMethodOptions.slice(0, 4).map((pm) => {
                  const isSelected = paymentMethod === pm.value;
                  return (
                    <button
                      key={pm.value}
                      type="button"
                      onClick={() => setPaymentMethod(pm.value)}
                      className={`py-2.5 px-1 rounded-xl text-xs font-bold transition-colors cursor-pointer border text-center min-h-[42px] ${
                        isSelected
                          ? `${pm.bg} ring-2 ${pm.activeRing} border-transparent`
                          : 'bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-[#343440]'
                      }`}
                    >
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kategori Pengeluaran */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Kategori Operasional
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {categoryOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = category === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCategory(opt.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors cursor-pointer min-h-[42px] ${
                        isSelected
                          ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white border-[#2563EB] dark:border-[#A855F7]'
                          : 'bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border-slate-200 dark:border-[#343440] text-slate-700 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-[11px] font-bold truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pencatat / Kasir */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Kasir / Pencatat
              </label>
              <input
                type="text"
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#343440] text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] bg-slate-50 dark:bg-[#24242B] focus:bg-white dark:focus:bg-[#1B1B20] font-medium focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
              />
            </div>

            {/* Inline Form Error */}
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-xl font-extrabold text-xs sm:text-sm text-white transition-colors active:scale-[0.97] cursor-pointer flex items-center justify-center gap-2 ${
                type === 'EXPENSE'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              } disabled:opacity-50 min-h-[48px]`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Google Sheets...</span>
                </>
              ) : (
                <>
                  <SendHorizontal className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    Simpan & Tulis ke LAIN-LAIN ({formatRupiah(calculatedTotal)})
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Breakdown Cards & Records Table */}
        <div className="lg:col-span-7 space-y-4">
          {/* Payment Method Breakdown Widget (BCA, CASH, GOPAY, JAGO) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#2B2B33] rounded-2xl p-3">
              <span className="text-[10px] font-extrabold text-[#2563EB] dark:text-[#C084FC] uppercase tracking-wider block">
                BCA
              </span>
              <p className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5 tabular-nums font-mono">
                {formatRupiah(expenseByMethod['BCA'] || 0)}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Pengeluaran Bank</span>
            </div>

            <div className="bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#2B2B33] rounded-2xl p-3">
              <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                CASH (Tunai)
              </span>
              <p className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5 tabular-nums font-mono">
                {formatRupiah(expenseByMethod['CASH'] || 0)}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Uang Kasir</span>
            </div>

            <div className="bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#2B2B33] rounded-2xl p-3">
              <span className="text-[10px] font-extrabold text-[#2563EB] dark:text-[#C084FC] uppercase tracking-wider block">
                GOPAY
              </span>
              <p className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5 tabular-nums font-mono">
                {formatRupiah(expenseByMethod['GOPAY'] || 0)}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">E-Wallet</span>
            </div>

            <div className="bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#2B2B33] rounded-2xl p-3">
              <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                JAGO
              </span>
              <p className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5 tabular-nums font-mono">
                {formatRupiah(expenseByMethod['JAGO'] || 0)}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Bank Digital</span>
            </div>
          </div>

          {/* Records Table Card */}
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2B2B33]">
              <div>
                <h3 className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] text-sm sm:text-base flex items-center gap-2 flex-wrap">
                  <span>Data Sheet LAIN-LAIN</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] px-2.5 py-0.5 rounded-full">
                    {filteredRecords.length} transaksi
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Mencerminkan baris data di spreadsheet Google Sheets
                </p>
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#24242B] p-1 rounded-xl border border-slate-200 dark:border-[#343440] self-start sm:self-auto max-w-full overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer whitespace-nowrap min-h-[38px] ${
                    filterType === 'ALL' ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white' : 'text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6]'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('EXPENSE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer whitespace-nowrap min-h-[38px] ${
                    filterType === 'EXPENSE' ? 'bg-red-600 text-white' : 'text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6]'
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('INCOME')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer whitespace-nowrap min-h-[38px] ${
                    filterType === 'INCOME' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6]'
                  }`}
                >
                  Pemasukan
                </button>
              </div>
            </div>

            {/* Search and Payment Filter Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari keterangan, kasir, tanggal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[#343440] text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] bg-slate-50 dark:bg-[#24242B] focus:bg-white dark:focus:bg-[#1B1B20] font-medium min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex gap-2">
                {/* Payment Filter Selector */}
                <select
                  value={filterPaymentMethod}
                  onChange={(e) => setFilterPaymentMethod(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#343440] text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-[#24242B] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] cursor-pointer"
                >
                  <option value="ALL">Semua Bayar</option>
                  <option value="BCA">BCA</option>
                  <option value="CASH">CASH</option>
                  <option value="GOPAY">GOPAY</option>
                  <option value="JAGO">JAGO</option>
                </select>

                {/* Category Filter Selector */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#343440] text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-[#24242B] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] cursor-pointer"
                >
                  <option value="ALL">Semua Kategori</option>
                  <option value="RESTOK_BARANG">Restok Barang</option>
                  <option value="PENGELUARAN_LAIN">Pengeluaran Lain-Lain</option>
                  <option value="BENSIN">Bensin</option>
                  <option value="OPERASIONAL">Operasional</option>
                  <option value="PEMBELIAN_STOK">Pembelian Stok</option>
                  <option value="ONGKIR">Ongkir</option>
                  <option value="TIPS">Tips</option>
                  <option value="MODAL_LAIN">Modal Lain</option>
                </select>
              </div>
            </div>

            {/* Records List / Table */}
            {filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-zinc-500 space-y-2">
                <FileSpreadsheet className="w-10 h-10 mx-auto stroke-[1.5] text-slate-300 dark:text-zinc-600" />
                <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6]">Belum ada data di sheet LAIN-LAIN</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Gunakan tombol "Tarik Data dari Sheet LAIN-LAIN" di atas untuk memuat data spreadsheet yang ada, atau isi form untuk menambah baru.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-0.5">
                {visibleRecords.map((rec) => {
                  const isExpense = rec.type === 'EXPENSE';
                  const pm = (rec.paymentMethod || 'CASH').toUpperCase();
                  const matchedPm = paymentMethodOptions.find((p) => p.value === pm);

                  return (
                    <div
                      key={rec.id}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-[#343440] bg-slate-50/70 dark:bg-[#24242B] hover:bg-slate-50 dark:hover:bg-[#2E2E37] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Row Indicator / Icon */}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-extrabold border ${
                              isExpense
                                ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/35'
                                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/35'
                            }`}
                          >
                            {rec.rowNumber ? `#${rec.rowNumber}` : (isExpense ? 'OUT' : 'IN')}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Kolom A: Tanggal */}
                              <span className="text-[11px] font-bold text-[#0F172A] dark:text-[#F4F4F6] bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                                {rec.date}
                              </span>

                              {/* Kolom F: Dibayar dengan */}
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                  matchedPm ? matchedPm.badge : 'bg-white dark:bg-[#1B1B20] text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-[#343440]'
                                }`}
                              >
                                {pm}
                              </span>

                              {/* Status Sync Badge */}
                              {rec.syncStatus === 'SYNCED' || rec.rowNumber ? (
                                <span className="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Sheet LAIN-LAIN
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35 px-1.5 py-0.5 rounded-md">
                                  Lokal
                                </span>
                              )}
                            </div>

                            {/* Kolom B: Keterangan */}
                            <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] mt-1.5 break-words">
                              {rec.description}
                            </p>

                            {/* Breakdown Kolom C & D: Harga x Jumlah */}
                            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                              <span>
                                Harga: <strong className="text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(rec.unitPrice || rec.amount)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Qty: <strong className="text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{rec.qty || 1}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Oleh: <span className="text-slate-600 dark:text-zinc-300">{rec.cashier || 'Kasir'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Kolom E: Total & Delete Action */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p
                              className={`text-xs sm:text-base font-extrabold tracking-tight tabular-nums font-mono ${
                                isExpense ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {isExpense ? '-' : '+'}{formatRupiah(rec.amount)}
                            </p>
                            <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 block">
                              Kolom E
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteRecord(rec);
                            }}
                            className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 border border-red-200 dark:border-red-500/35 rounded-xl transition-colors active:scale-[0.97] cursor-pointer flex items-center justify-center flex-shrink-0 min-h-[44px] min-w-[44px]"
                            title="Hapus dari Sheet & Lokal"
                            aria-label={`Hapus ${rec.description}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredRecords.length > visibleRecords.length && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                      Menampilkan {visibleRecords.length} dari {filteredRecords.length} baris
                    </span>
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 50)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer min-h-[44px]"
                    >
                      Muat Lagi (+50)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* App Confirm Dialog: Hapus Catatan Keuangan */}
      <AppConfirmDialog
        isOpen={Boolean(pendingDeleteRecord)}
        title="Hapus Catatan Keuangan"
        description={
          pendingDeleteRecord ? (
            <div className="space-y-2">
              <p>
                {pendingDeleteRecord.rowNumber
                  ? `Hapus catatan "${pendingDeleteRecord.description}" dari sheet LAIN-LAIN (Baris ${pendingDeleteRecord.rowNumber}) dan daftar lokal?`
                  : `Hapus catatan keuangan "${pendingDeleteRecord.description}"?`}
              </p>
              <div className="bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl p-2.5 text-xs flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-zinc-400">{pendingDeleteRecord.date} • {pendingDeleteRecord.paymentMethod}</span>
                <span className="font-extrabold font-mono tabular-nums text-red-600 dark:text-red-400">
                  {pendingDeleteRecord.type === 'EXPENSE' ? '-' : '+'}{formatRupiah(pendingDeleteRecord.amount)}
                </span>
              </div>
            </div>
          ) : null
        }
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
        onCancel={() => setPendingDeleteRecord(null)}
        onConfirm={() => {
          if (!pendingDeleteRecord) return;
          const target = pendingDeleteRecord;
          setPendingDeleteRecord(null);
          onDeleteRecord(target.id, target.rowNumber);
        }}
      />
    </div>
  );
};
