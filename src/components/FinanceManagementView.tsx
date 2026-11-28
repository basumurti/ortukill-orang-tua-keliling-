import React, { useState, useMemo, useEffect } from 'react';
import { Button, Card, Chip, Input, TextArea } from '@heroui/react';
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
import { AnimatedTabPill } from './ui/motion/MotionPrimitives';
import { LiquidSurface } from './ui/glass/LiquidSurface';

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
    { value: 'BCA', label: 'BCA', bg: 'bg-[var(--accent)] text-[var(--accent-foreground)]', activeRing: 'ring-[var(--accent)]', badge: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30' },
    { value: 'CASH', label: 'CASH', bg: 'bg-[var(--success)] text-[var(--success-foreground)] font-bold', activeRing: 'ring-[var(--success)]', badge: 'bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border-[var(--success)]/35' },
    { value: 'GOPAY', label: 'GOPAY', bg: 'bg-[var(--accent)] text-[var(--accent-foreground)]', activeRing: 'ring-[var(--accent)]', badge: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30' },
    { value: 'JAGO', label: 'JAGO', bg: 'bg-[var(--warning)] text-[var(--warning-foreground)] font-bold', activeRing: 'ring-[var(--warning)]', badge: 'bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border-[var(--warning)]/35' },
    { value: 'QRIS', label: 'QRIS', bg: 'bg-[var(--accent)] text-[var(--accent-foreground)]', activeRing: 'ring-[var(--accent)]', badge: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30' },
  ];

  const categoryOptions = type === 'EXPENSE' ? [
    { value: 'RESTOK_BARANG', label: 'Restok Barang', icon: Package, color: 'text-amber-700 dark:text-[var(--warning)] bg-[var(--warning-soft)]' },
    { value: 'PENGELUARAN_LAIN', label: 'Pengeluaran Lain-Lain', icon: MoreHorizontal, color: 'text-[var(--muted)] bg-[var(--surface-secondary)]' },
    { value: 'BENSIN', label: 'Bensin Motor / Kendaraan', icon: Fuel, color: 'text-amber-700 dark:text-[var(--warning)] bg-[var(--warning-soft)]' },
    { value: 'OPERASIONAL', label: 'Operasional & Perlengkapan', icon: Building2, color: 'text-[var(--accent)] bg-[var(--accent-soft)]' },
    { value: 'PEMBELIAN_STOK', label: 'Pembelian Stok / Kulakan', icon: ShoppingBag, color: 'text-amber-700 dark:text-[var(--warning)] bg-[var(--warning-soft)]' },
  ] : [
    { value: 'ONGKIR', label: 'Ongkir Pengiriman (+)', icon: Truck, color: 'text-emerald-700 dark:text-[var(--success)] bg-[var(--success-soft)]' },
    { value: 'TIPS', label: 'Tips & Bonus (+)', icon: Gift, color: 'text-[var(--accent)] bg-[var(--accent-soft)]' },
    { value: 'MODAL_LAIN', label: 'Modal / Pemasukan Lain (+)', icon: Wallet, color: 'text-emerald-700 dark:text-[var(--success)] bg-[var(--success-soft)]' },
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
    <div className="space-y-4 sm:space-y-5 pb-16 text-[var(--foreground)]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 sm:top-20 right-4 left-4 sm:left-auto z-[100050] pointer-events-none">
          <LiquidSurface
            borderRadius={16}
            material="thin"
            className={`px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2.5 pointer-events-auto ${
              toast.type === 'success'
                ? 'text-emerald-700 dark:text-[var(--success)] border-[var(--success)]/40'
                : toast.type === 'error'
                ? 'text-red-700 dark:text-[var(--danger)] border-[var(--danger)]/40'
                : 'text-[var(--accent)] border-[var(--accent)]/40'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-[var(--success)] flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-700 dark:text-[var(--danger)] flex-shrink-0" />
            )}
            <span className="text-xs font-bold">{toast.message}</span>
          </LiquidSurface>
        </div>
      )}

      {/* Header Banner - Google Sheet LAIN-LAIN Sync */}
      <Card className="bg-[var(--surface)] text-[var(--foreground)] rounded-2xl p-4 sm:p-5 border border-[var(--border)] shadow-none relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip size="sm" variant="soft" color="accent" className="border border-[var(--border)] text-[10px] font-extrabold uppercase tracking-wider">
                <FileSpreadsheet className="w-3 h-3" />
                <Chip.Label>Sheet LAIN-LAIN</Chip.Label>
              </Chip>
              <Chip size="sm" variant="soft" color="success" className="border border-[var(--success)]/35 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                <Chip.Label>Read &amp; Write Google Sheets</Chip.Label>
              </Chip>
              <span className="text-[var(--muted)] text-xs font-mono">
                ORTUKILL_KEDIRI • Kolom A-F
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight flex items-center gap-2 text-[var(--foreground)]">
              Buku Kas &amp; Pengeluaran Lain-Lain
            </h2>

            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              Formulir dan riwayat ini terhubung langsung ke spreadsheet <strong className="text-[var(--foreground)]">ORTUKILL_KEDIRI</strong> tab <strong className="text-[var(--foreground)]">LAIN-LAIN</strong> (Tanggal, Keterangan, Harga, Jumlah, Total, Dibayar dengan). Setiap pengeluaran yang dicatat otomatis tersimpan ke baris spreadsheet!
            </p>
          </div>

          {/* Sync Action & Summary Stats Widget */}
          <div className="flex flex-col gap-2.5 w-full lg:w-auto lg:min-w-[270px]">
            {/* Sync Button */}
            <Button
              type="button"
              variant="secondary"
              onPress={handlePullFromSheet}
              isDisabled={isPullingSheet || isSyncing}
              className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] px-4 rounded-xl font-bold text-xs min-h-[44px]"
            >
              <RefreshCw className={`w-4 h-4 text-[var(--accent)] ${isPullingSheet || isSyncing ? 'animate-spin' : ''}`} />
              <span>{isPullingSheet || isSyncing ? 'Menghubungkan ke Sheet...' : 'Tarik Data dari Sheet LAIN-LAIN'}</span>
            </Button>

            {/* Quick Balance Preview */}
            <div className="bg-[var(--surface-secondary)] rounded-xl p-3 border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--muted)] font-medium">Saldo Arus Kas:</span>
                <span className={`text-sm font-extrabold tabular-nums font-mono ${netBalance >= 0 ? 'text-emerald-700 dark:text-[var(--success)]' : 'text-red-700 dark:text-[var(--danger)]'}`}>
                  {formatRupiah(netBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 mt-1.5 border-t border-[var(--separator)]">
                <span className="text-[var(--muted)]">Total Pengeluaran:</span>
                <span className="font-bold text-red-700 dark:text-[var(--danger)] tabular-nums font-mono">-{formatRupiah(totalExpense)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-1">
                <span>Tersinkron Sheet:</span>
                <span className="font-bold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono">{syncedCount} baris</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content Grid: Form Input (Left) + List & Stats (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Column: Form Input matching Sheet LAIN-LAIN (Kolom A-F) */}
        <Card className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-4 sm:p-5 gap-4 border border-[var(--border)] shadow-none">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--separator)]">
            <div>
              <h3 className="font-extrabold text-[var(--foreground)] flex items-center gap-2 text-sm sm:text-base">
                <Receipt className="w-5 h-5 text-[var(--accent)]" />
                <span>Catat ke Sheet LAIN-LAIN</span>
              </h3>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                Otomatis mengisi Kolom A s/d F di spreadsheet
              </p>
            </div>
            <Chip size="sm" variant="soft" color="success" className="text-[10px] font-bold border border-[var(--success)]/35 shrink-0">
              <Chip.Label>Live Write</Chip.Label>
            </Chip>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Toggle Switch Type: Pengeluaran (Sheet LAIN-LAIN) vs Pemasukan */}
            <div className="grid grid-cols-2 gap-1.5 bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--border)]">
              <Button
                type="button"
                fullWidth
                size="sm"
                variant="ghost"
                onPress={() => handleTypeChange('EXPENSE')}
                className={`relative rounded-lg font-bold text-xs min-h-[44px] ${
                  type === 'EXPENSE' ? 'text-[var(--danger-foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {type === 'EXPENSE' && (
                  <AnimatedTabPill
                    layoutId="finance-type-pill"
                    className="absolute inset-0 rounded-lg bg-[var(--danger)] pointer-events-none"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <MinusCircle className="w-4 h-4 shrink-0" />
                  <span>Pengeluaran (Sheet)</span>
                </span>
              </Button>

              <Button
                type="button"
                fullWidth
                size="sm"
                variant="ghost"
                onPress={() => handleTypeChange('INCOME')}
                className={`relative rounded-lg font-bold text-xs min-h-[44px] ${
                  type === 'INCOME'
                    ? 'text-[var(--success-foreground)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {type === 'INCOME' && (
                  <AnimatedTabPill
                    layoutId="finance-type-pill"
                    className="absolute inset-0 rounded-lg bg-[var(--success)] pointer-events-none"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span>Pemasukan (+)</span>
                </span>
              </Button>
            </div>

            {/* Kolom A: Tanggal */}
            <div>
              <label className="text-xs font-bold text-[var(--muted)] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[var(--muted)]" />
                  Tanggal Transaksi (Kolom A)
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onPress={() => setEntryDate(todayFormatted)}
                  className="text-[10px] font-bold text-[var(--accent)] hover:underline h-auto py-0.5 px-1.5"
                >
                  Hari Ini
                </Button>
              </label>
              <Input
                type="text"
                fullWidth
                variant="secondary"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                placeholder="DD/MM/YYYY (contoh: 24/09/2026)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-xs sm:text-sm font-semibold text-[var(--foreground)] bg-[var(--surface-secondary)] min-h-[44px]"
                required
              />
            </div>

            {/* Kolom B: Keterangan */}
            <div>
              <label className="block text-xs font-bold text-[var(--muted)] mb-1.5">
                Keterangan / Keperluan (Kolom B)
              </label>
              <TextArea
                rows={2}
                fullWidth
                variant="secondary"
                placeholder={
                  type === 'EXPENSE'
                    ? 'Contoh: Beli bensin motor delivery, Plastik packing, Konsumsi karyawan...'
                    : 'Contoh: Ongkir COD pelanggan, Tips konsumen...'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-xs sm:text-sm text-[var(--foreground)] bg-[var(--surface-secondary)] font-medium"
                required
              />
            </div>

            {/* Kolom C & D: Harga Satuan & Jumlah */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Kolom C: Harga Satuan */}
              <div>
                <label className="text-xs font-bold text-[var(--muted)] mb-1.5 flex items-center justify-between gap-1">
                  <span>Harga Satuan (Kolom C)</span>
                  {type === 'EXPENSE' && (
                    <Chip size="sm" variant="soft" color="danger" className="text-[9px] font-bold border border-[var(--danger)]/35">
                      <Chip.Label>Minus (-)</Chip.Label>
                    </Chip>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[var(--muted)] text-xs z-10 pointer-events-none">
                    Rp
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    fullWidth
                    variant="secondary"
                    placeholder="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] text-sm font-extrabold text-[var(--foreground)] bg-[var(--surface-secondary)] min-h-[44px] tabular-nums font-mono"
                    required
                  />
                </div>
              </div>

              {/* Kolom D: Jumlah (Qty) */}
              <div>
                <label className="block text-xs font-bold text-[var(--muted)] mb-1.5">
                  Jumlah / Qty (Kolom D)
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  fullWidth
                  variant="secondary"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-extrabold text-[var(--foreground)] bg-[var(--surface-secondary)] text-center min-h-[44px] tabular-nums font-mono"
                  required
                />
              </div>
            </div>

            {/* Quick Price Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-[var(--muted)] mr-0.5">+ Cepat:</span>
              {[5000, 10000, 20000, 50000, 100000].map((val) => (
                <Button
                  key={val}
                  type="button"
                  size="sm"
                  variant="outline"
                  onPress={() => handleQuickAmount(val)}
                  className="text-[11px] font-bold bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border)] px-2.5 rounded-lg min-h-[36px]"
                >
                  +{val / 1000}k
                </Button>
              ))}
            </div>

            {/* Kolom E: Total (Live preview) */}
            <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-[var(--foreground)] uppercase tracking-wider block">
                  Total (Kolom E = C × D)
                </span>
                <span className="text-[10px] text-[var(--muted)] block truncate">
                  {formatRupiah(parsedPrice)} × {parsedQty} unit {type === 'EXPENSE' && '• Minus (-)'}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-base font-extrabold tabular-nums font-mono ${type === 'EXPENSE' ? 'text-red-700 dark:text-[var(--danger)]' : 'text-emerald-700 dark:text-[var(--success)]'}`}>
                  {type === 'EXPENSE' ? '-' : '+'}{formatRupiah(calculatedTotal)}
                </span>
                <span className={`block text-[9px] font-bold ${type === 'EXPENSE' ? 'text-red-700 dark:text-[var(--danger)]' : 'text-emerald-700 dark:text-[var(--success)]'}`}>
                  {type === 'EXPENSE' ? 'Tercatat Minus di Sheet' : 'Tercatat Positif di Sheet'}
                </span>
              </div>
            </div>

            {/* Kolom F: Dibayar dengan (BCA, CASH, GOPAY, JAGO) */}
            <div>
              <label className="text-xs font-bold text-[var(--muted)] mb-1.5 flex items-center justify-between">
                <span>Dibayar dengan (Kolom F)</span>
                <span className="text-[10px] font-mono text-[var(--muted)]">Dropdown H4:H7</span>
              </label>

              <div className="grid grid-cols-4 gap-1.5">
                {paymentMethodOptions.slice(0, 4).map((pm) => {
                  const isSelected = paymentMethod === pm.value;
                  return (
                    <Button
                      key={pm.value}
                      type="button"
                      fullWidth
                      size="sm"
                      variant={isSelected ? 'primary' : 'outline'}
                      onPress={() => setPaymentMethod(pm.value)}
                      className={`px-2 rounded-xl text-xs font-bold min-h-[44px] border ${
                        isSelected
                          ? `${pm.bg} ring-2 ${pm.activeRing} border-transparent`
                          : 'bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)]'
                      }`}
                    >
                      {pm.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Kategori Pengeluaran */}
            <div>
              <label className="block text-xs font-bold text-[var(--muted)] mb-1.5">
                Kategori Operasional
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {categoryOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = category === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      fullWidth
                      size="sm"
                      variant={isSelected ? 'primary' : 'outline'}
                      onPress={() => setCategory(opt.value)}
                      className={`justify-start gap-2 px-2.5 rounded-xl border min-h-[44px] ${
                        isSelected
                          ? 'border-transparent'
                          : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-[11px] font-bold truncate">{opt.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Pencatat / Kasir */}
            <div>
              <label className="block text-xs font-bold text-[var(--muted)] mb-1">
                Kasir / Pencatat
              </label>
              <Input
                type="text"
                fullWidth
                variant="secondary"
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-xs sm:text-sm text-[var(--foreground)] bg-[var(--surface-secondary)] font-medium min-h-[44px]"
              />
            </div>

            {/* Inline Form Error */}
            {formError && (
              <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/35 text-xs font-semibold text-red-700 dark:text-[var(--danger)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              variant={type === 'EXPENSE' ? 'danger' : 'primary'}
              isDisabled={isSubmitting}
              className={`rounded-xl font-extrabold text-xs sm:text-sm min-h-[48px] ${
                type === 'INCOME' ? 'bg-[var(--success)] text-[var(--success-foreground)]' : ''
              }`}
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
                    Simpan &amp; Tulis ke LAIN-LAIN ({formatRupiah(calculatedTotal)})
                  </span>
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Right Column: Breakdown Cards & Records Table */}
        <div className="lg:col-span-7 space-y-4">
          {/* Payment Method Breakdown Widget (BCA, CASH, GOPAY, JAGO) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 gap-0.5 shadow-none">
              <span className="text-[10px] font-extrabold text-[var(--accent)] uppercase tracking-wider block">
                BCA
              </span>
              <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)] mt-0.5 tabular-nums font-mono">
                {formatRupiah(expenseByMethod['BCA'] || 0)}
              </p>
              <span className="text-[10px] text-[var(--muted)] font-medium">Pengeluaran Bank</span>
            </Card>

            <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 gap-0.5 shadow-none">
              <span className="text-[10px] font-extrabold text-emerald-700 dark:text-[var(--success)] uppercase tracking-wider block">
                CASH (Tunai)
              </span>
              <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)] mt-0.5 tabular-nums font-mono">
                {formatRupiah(expenseByMethod['CASH'] || 0)}
              </p>
              <span className="text-[10px] text-[var(--muted)] font-medium">Uang Kasir</span>
            </Card>

            <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 gap-0.5 shadow-none">
              <span className="text-[10px] font-extrabold text-[var(--accent)] uppercase tracking-wider block">
                GOPAY
              </span>
              <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)] mt-0.5 tabular-nums font-mono">
                {formatRupiah(expenseByMethod['GOPAY'] || 0)}
              </p>
              <span className="text-[10px] text-[var(--muted)] font-medium">E-Wallet</span>
            </Card>

            <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 gap-0.5 shadow-none">
              <span className="text-[10px] font-extrabold text-amber-700 dark:text-[var(--warning)] uppercase tracking-wider block">
                JAGO
              </span>
              <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)] mt-0.5 tabular-nums font-mono">
                {formatRupiah(expenseByMethod['JAGO'] || 0)}
              </p>
              <span className="text-[10px] text-[var(--muted)] font-medium">Bank Digital</span>
            </Card>
          </div>

          {/* Records Table Card */}
          <Card className="bg-[var(--surface)] rounded-2xl p-4 sm:p-5 gap-4 border border-[var(--border)] shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--separator)]">
              <div>
                <h3 className="font-extrabold text-[var(--foreground)] text-sm sm:text-base flex items-center gap-2 flex-wrap">
                  <span>Data Sheet LAIN-LAIN</span>
                  <Chip size="sm" variant="soft" color="default" className="border border-[var(--border)] text-xs font-semibold">
                    <Chip.Label>{filteredRecords.length} transaksi</Chip.Label>
                  </Chip>
                </h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Mencerminkan baris data di spreadsheet Google Sheets
                </p>
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--border)] self-start sm:self-auto max-w-full overflow-x-auto no-scrollbar">
                <Button
                  type="button"
                  size="sm"
                  variant={filterType === 'ALL' ? 'primary' : 'ghost'}
                  onPress={() => setFilterType('ALL')}
                  className={`px-3 rounded-lg text-xs font-bold whitespace-nowrap min-h-[38px] ${
                    filterType === 'ALL' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Semua
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filterType === 'EXPENSE' ? 'danger' : 'ghost'}
                  onPress={() => setFilterType('EXPENSE')}
                  className={`px-3 rounded-lg text-xs font-bold whitespace-nowrap min-h-[38px] ${
                    filterType === 'EXPENSE' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Pengeluaran
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filterType === 'INCOME' ? 'primary' : 'ghost'}
                  onPress={() => setFilterType('INCOME')}
                  className={`px-3 rounded-lg text-xs font-bold whitespace-nowrap min-h-[38px] ${
                    filterType === 'INCOME'
                      ? 'bg-[var(--success)] text-[var(--success-foreground)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Pemasukan
                </Button>
              </div>
            </div>

            {/* Search and Payment Filter Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none" />
                <Input
                  type="text"
                  fullWidth
                  variant="secondary"
                  placeholder="Cari keterangan, kasir, tanggal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border)] text-xs sm:text-sm text-[var(--foreground)] bg-[var(--surface-secondary)] font-medium min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex gap-2">
                {/* Payment Filter Selector */}
                <select
                  value={filterPaymentMethod}
                  onChange={(e) => setFilterPaymentMethod(e.target.value)}
                  aria-label="Filter metode pembayaran buku kas"
                  className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--foreground)] bg-[var(--surface-secondary)] focus:outline-none focus:border-[var(--accent)] min-h-[44px] cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
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
                  aria-label="Filter kategori operasional"
                  className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--foreground)] bg-[var(--surface-secondary)] focus:outline-none focus:border-[var(--accent)] min-h-[44px] cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
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
              <div className="py-12 text-center text-[var(--muted)] space-y-2">
                <FileSpreadsheet className="w-10 h-10 mx-auto stroke-[1.5] text-[var(--muted)] opacity-50" />
                <p className="text-xs font-semibold text-[var(--foreground)]">Belum ada data di sheet LAIN-LAIN</p>
                <p className="text-[11px] text-[var(--muted)] max-w-sm mx-auto">
                  Gunakan tombol &quot;Tarik Data dari Sheet LAIN-LAIN&quot; di atas untuk memuat data spreadsheet yang ada, atau isi form untuk menambah baru.
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
                      className="p-3 sm:p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Row Indicator / Icon */}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-extrabold border ${
                              isExpense
                                ? 'bg-[var(--danger-soft)] text-red-700 dark:text-[var(--danger)] border-[var(--danger)]/35'
                                : 'bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border-[var(--success)]/35'
                            }`}
                          >
                            {rec.rowNumber ? `#${rec.rowNumber}` : (isExpense ? 'OUT' : 'IN')}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Kolom A: Tanggal */}
                              <span className="text-[11px] font-bold text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[var(--muted)]" />
                                {rec.date}
                              </span>

                              {/* Kolom F: Dibayar dengan */}
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                  matchedPm ? matchedPm.badge : 'bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)]'
                                }`}
                              >
                                {pm}
                              </span>

                              {/* Status Sync Badge */}
                              {rec.syncStatus === 'SYNCED' || rec.rowNumber ? (
                                <span className="text-[9px] font-bold bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border border-[var(--success)]/35 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Sheet LAIN-LAIN
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border border-[var(--warning)]/35 px-1.5 py-0.5 rounded-md">
                                  Lokal
                                </span>
                              )}
                            </div>

                            {/* Kolom B: Keterangan */}
                            <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] mt-1.5 break-words">
                              {rec.description}
                            </p>

                            {/* Breakdown Kolom C & D: Harga x Jumlah */}
                            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-[var(--muted)]">
                              <span>
                                Harga: <strong className="text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(rec.unitPrice || rec.amount)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Qty: <strong className="text-[var(--foreground)] tabular-nums font-mono">{rec.qty || 1}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Oleh: <span className="text-[var(--foreground)]">{rec.cashier || 'Kasir'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Kolom E: Total & Delete Action */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p
                              className={`text-xs sm:text-base font-extrabold tracking-tight tabular-nums font-mono ${
                                isExpense ? 'text-red-700 dark:text-[var(--danger)]' : 'text-emerald-700 dark:text-[var(--success)]'
                              }`}
                            >
                              {isExpense ? '-' : '+'}{formatRupiah(rec.amount)}
                            </p>
                            <span className="text-[10px] font-medium text-[var(--muted)] block">
                              Kolom E
                            </span>
                          </div>

                          <Button
                            type="button"
                            isIconOnly
                            size="sm"
                            variant="outline"
                            onPress={() => setPendingDeleteRecord(rec)}
                            aria-label={`Hapus ${rec.description}`}
                            className="text-red-700 dark:text-[var(--danger)] bg-[var(--danger-soft)] border-[var(--danger)]/35 rounded-xl flex-shrink-0 min-h-[44px] min-w-[44px]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredRecords.length > visibleRecords.length && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
                    <span className="text-xs text-[var(--muted)] font-medium tabular-nums">
                      Menampilkan {visibleRecords.length} dari {filteredRecords.length} baris
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onPress={() => setVisibleCount((prev) => prev + 50)}
                      className="w-full sm:w-auto px-4 rounded-xl border border-[var(--border)] text-xs font-bold min-h-[44px]"
                    >
                      Muat Lagi (+50)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
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
              <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl p-2.5 text-xs flex items-center justify-between gap-2">
                <span className="text-[var(--muted)]">{pendingDeleteRecord.date} • {pendingDeleteRecord.paymentMethod}</span>
                <span className="font-extrabold font-mono tabular-nums text-red-700 dark:text-[var(--danger)]">
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
