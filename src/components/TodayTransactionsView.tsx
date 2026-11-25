import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  Package, 
  Search, 
  Filter, 
  Download, 
  Ban, 
  Eye, 
  RefreshCw, 
  Calendar,
  Clock,
  CreditCard,
  Banknote,
  QrCode,
  X,
  AlertTriangle,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { TransactionReceipt, DailySummary, PaymentMethod } from '../types';
import { formatRupiah, isPromoItem, isEligibleBottleItem, normalizeDateToYmd } from '../services/storageService';
import { useOverlayHistory } from '../utils/useOverlayHistory';

interface TodayTransactionsViewProps {
  summary: DailySummary;
  transactions: TransactionReceipt[];
  allTransactions?: TransactionReceipt[];
  onViewReceipt: (receipt: TransactionReceipt) => void;
  onVoidTransaction: (id: string, reason: string) => void;
  onDeleteTransaction?: (id: string) => void;
  onRefresh: () => void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
}

// Helper mengambil jam input website asli tanpa distorsi Google Sheets
export function getPureWebsiteTime(t: TransactionReceipt): string {
  // 1. Jika ada websiteTime eksplisit
  if (t.websiteTime && t.websiteTime.trim()) {
    return t.websiteTime.trim().replace(/\./g, ':');
  }
  // 2. Jika transactionDate memiliki jam (dd/MM/yyyy HH:mm:ss atau HH:mm)
  if (t.transactionDate) {
    const str = t.transactionDate.trim();
    if (str.includes(' ')) {
      const timePart = str.split(' ')[1].trim().replace(/\./g, ':');
      if (timePart && timePart !== '00:00' && timePart !== '00:00:00') {
        return timePart;
      }
    } else if (str.includes(':')) {
      return str.replace(/\./g, ':');
    }
  }
  // 3. Ekstrak dari format ID transaksi jika mengandung waktu: TRX-YYYYMMDD-HHMMSS-XXX
  if (t.id) {
    const matchTimeInId = t.id.match(/TRX-\d{8}-(\d{2})(\d{2})(\d{2})/);
    if (matchTimeInId) {
      return `${matchTimeInId[1]}:${matchTimeInId[2]}:${matchTimeInId[3]}`;
    }
    const matchEpoch = t.id.match(/TRX-(\d{13})/);
    if (matchEpoch) {
      const date = new Date(Number(matchEpoch[1]));
      if (!isNaN(date.getTime())) {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
    }
  }
  // 4. Jika ada createdAt
  if (t.createdAt) {
    const date = new Date(t.createdAt);
    if (!isNaN(date.getTime())) {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
  }
  return '-';
}

// Helpers format tanggal lokal
export const getTodayYmd = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getYesterdayYmd = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getTransactionYmd = (t: TransactionReceipt): string => {
  if (t.dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(t.dateYmd)) return t.dateYmd;
  if (t.date) {
    const ymd = normalizeDateToYmd(t.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  }
  if (t.transactionDate) {
    const ymd = normalizeDateToYmd(t.transactionDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  }
  if (t.createdAt) {
    const d = new Date(t.createdAt);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return '';
};

export const formatYmdToIndo = (ymd: string): string => {
  if (!ymd || ymd.length < 10) return ymd;
  const [y, m, d] = ymd.split('-');
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][parseInt(m, 10) - 1] || m;
  return `${parseInt(d, 10)} ${bulan} ${y}`;
};

export const formatYmdToSlash = (ymd: string): string => {
  if (!ymd || ymd.length < 10) return ymd;
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
};

export const TodayTransactionsView: React.FC<TodayTransactionsViewProps> = ({
  summary,
  transactions,
  allTransactions,
  onViewReceipt,
  onVoidTransaction,
  onDeleteTransaction,
  onRefresh,
  onSyncSpreadsheet,
  isSyncing,
}) => {
  const todayYmd = useMemo(() => getTodayYmd(), []);
  const yesterdayYmd = useMemo(() => getYesterdayYmd(), []);
  const [selectedDateYmd, setSelectedDateYmd] = useState<string>(todayYmd);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(50);

  useEffect(() => {
    setVisibleCount(50);
  }, [selectedDateYmd, searchQuery, selectedPayment, selectedStatus]);

  // Void modal state
  const [voidingTrx, setVoidingTrx] = useState<TransactionReceipt | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const voidReasonRef = useRef<HTMLTextAreaElement>(null);

  // Delete modal state
  const [deletingTrx, setDeletingTrx] = useState<TransactionReceipt | null>(null);

  useOverlayHistory(!!voidingTrx, () => setVoidingTrx(null), 'today-void-modal');
  useOverlayHistory(!!deletingTrx, () => setDeletingTrx(null), 'today-delete-modal');

  useEffect(() => {
    if (voidingTrx) {
      const t = window.setTimeout(() => voidReasonRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [voidingTrx]);

  // Pool seluruh transaksi yang tersedia (prioritaskan allTransactions dari parent)
  const transactionPool = useMemo(() => {
    return (allTransactions && allTransactions.length > 0) ? allTransactions : transactions;
  }, [allTransactions, transactions]);

  // Filter transaksi HANYA untuk hari yang dipilih
  const dayTransactions = useMemo(() => {
    return transactionPool.filter((t) => {
      const rawId = String(t.id || '').trim();
      if (rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-')) {
        return false;
      }
      const tYmd = getTransactionYmd(t);
      return tYmd === selectedDateYmd;
    });
  }, [transactionPool, selectedDateYmd]);

  // Hitung ringkasan hari ini secara dinamis untuk hari yang dipilih
  // ATURAN MUTLAK: Volume Terjual (totalQty) WAJIB mengecualikan promo (isPromoItem)
  const daySummary = useMemo(() => {
    let totalOmset = 0;
    let totalMargin = 0;
    let totalQty = 0;
    let filteredBottleQty = 0;

    const paymentBreakdown: Record<PaymentMethod, { count: number; total: number }> = {
      CASH: { count: 0, total: 0 },
      TRANSFER: { count: 0, total: 0 },
      QRIS: { count: 0, total: 0 },
    };

    dayTransactions.forEach((t) => {
      if (t.status === 'VOIDED') return;

      totalOmset += Number(t.total) || 0;
      totalMargin += Number(t.margin) || 0;

      // Volume Terjual (Excl. Promo): hitung jumlah botol HANYA dari item yang BUKAN promo
      if (Array.isArray(t.items) && t.items.length > 0) {
        const nonPromoQty = t.items.reduce((sum, item) => {
          if (isPromoItem(item)) return sum;
          return sum + (Number(item.qty) || 0);
        }, 0);
        totalQty += nonPromoQty;

        t.items.forEach((item) => {
          if (isEligibleBottleItem(item)) {
            filteredBottleQty += Number(item.qty) || 0;
          }
        });
      } else {
        totalQty += Number(t.totalQty) || 0;
      }

      const method = (t.paymentMethod || 'CASH') as PaymentMethod;
      if (paymentBreakdown[method]) {
        paymentBreakdown[method].count += 1;
        paymentBreakdown[method].total += Number(t.total) || 0;
      }
    });

    const completedTrx = dayTransactions.filter((t) => t.status !== 'VOIDED');

    return {
      date: formatYmdToSlash(selectedDateYmd),
      totalTransactions: completedTrx.length,
      totalOmset,
      totalMargin,
      totalQty,
      filteredBottleQty,
      avgBasketSize: completedTrx.length > 0 ? Math.round(totalOmset / completedTrx.length) : 0,
      paymentBreakdown,
    };
  }, [dayTransactions, selectedDateYmd]);

  // Filter pencarian dan metode bayar di dalam dayTransactions
  const filtered = useMemo(() => {
    return dayTransactions.filter((t) => {
      if (selectedPayment !== 'ALL' && t.paymentMethod !== selectedPayment) return false;
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchId = t.id.toLowerCase().includes(q);
      const matchCustomer = (t.customerName || '').toLowerCase().includes(q);
      const matchItems = t.items.some((i) => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q));
      return matchId || matchCustomer || matchItems;
    });
  }, [dayTransactions, selectedPayment, selectedStatus, searchQuery]);

  // Urutkan transaksi hari terpilih secara ketat berdasarkan jam input website asli (terbaru di atas)
  const sortedTransactions = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
        return b.createdAt - a.createdAt;
      }
      const timeA = getPureWebsiteTime(a);
      const timeB = getPureWebsiteTime(b);
      if (timeA !== '-' && timeB !== '-' && timeA !== timeB) {
        return timeB.localeCompare(timeA);
      }
      return b.id.localeCompare(a.id);
    });
  }, [filtered]);

  const visibleTransactions = useMemo(() => {
    return sortedTransactions.slice(0, visibleCount);
  }, [sortedTransactions, visibleCount]);

  const handlePrevDay = () => {
    const [y, m, d] = selectedDateYmd.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    const prevY = date.getFullYear();
    const prevM = String(date.getMonth() + 1).padStart(2, '0');
    const prevD = String(date.getDate()).padStart(2, '0');
    setSelectedDateYmd(`${prevY}-${prevM}-${prevD}`);
  };

  const handleNextDay = () => {
    if (selectedDateYmd >= todayYmd) return;
    const [y, m, d] = selectedDateYmd.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    const nextD = String(date.getDate()).padStart(2, '0');
    setSelectedDateYmd(`${nextY}-${nextM}-${nextD}`);
  };

  const handleConfirmVoid = () => {
    if (!voidingTrx) return;
    onVoidTransaction(voidingTrx.id, voidReason);
    setVoidingTrx(null);
    setVoidReason('');
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) return;

    const headers = ['No_Transaksi', 'Waktu', 'Tanggal', 'Pelanggan', 'Metode_Bayar', 'Total_Belanja', 'Margin_Untung', 'Total_Qty', 'Status', 'Item_Terjual'];
    const rows = filtered.map((t) => {
      const nonPromoQty = Array.isArray(t.items) && t.items.length > 0
        ? t.items.filter((i) => !isPromoItem(i)).reduce((s, i) => s + (Number(i.qty) || 0), 0)
        : Number(t.totalQty) || 0;

      return [
        t.id,
        t.transactionDate,
        t.date,
        `"${t.customerName || '-'}"`,
        t.paymentMethod,
        t.total,
        t.margin,
        nonPromoQty,
        t.status,
        `"${t.items.map((i) => `${i.name} (${i.qty}x)`).join('; ')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ortukill_Transaksi_${selectedDateYmd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const marginPercentage = daySummary.totalOmset > 0 
    ? ((daySummary.totalMargin / daySummary.totalOmset) * 100).toFixed(1) 
    : '0';

  const isToday = selectedDateYmd === todayYmd;
  const isYesterday = selectedDateYmd === yesterdayYmd;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24 text-[#0F172A] dark:text-[#F4F4F6]">
      {/* Top Header Card dengan Filter Hari */}
      <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/40 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight">
                  Riwayat Nota & Log Penjualan
                </h2>
                <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-500/35">
                  {formatYmdToSlash(selectedDateYmd)}
                </span>
                {isToday && (
                  <span className="bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-200 dark:border-purple-500/40">
                    Hari Ini
                  </span>
                )}
                {isYesterday && (
                  <span className="bg-slate-100 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-200 dark:border-[#343440]">
                    Kemarin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Audit nota kasir, cetak ulang struk & log penjualan • Total {dayTransactions.length} transaksi pada {formatYmdToIndo(selectedDateYmd)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onSyncSpreadsheet ? onSyncSpreadsheet : onRefresh}
              disabled={isSyncing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-semibold transition-colors cursor-pointer min-h-[44px] border border-slate-200 dark:border-[#343440]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkron...' : 'Segarkan'}</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2563EB] dark:bg-[#9333EA] hover:bg-[#1D4ED8] dark:hover:bg-[#A855F7] text-white text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.25]" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Hari (Memfilter semua kartu & daftar transaksi di bawahnya) */}
        <div className="pt-3 border-t border-slate-200 dark:border-[#2B2B33] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mr-1">
              Filter Hari:
            </span>

            {/* Tombol Hari Sebelumnya */}
            <button
              type="button"
              onClick={handlePrevDay}
              title="Lihat Hari Sebelumnya"
              className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] flex items-center justify-center text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Quick Pill: Hari Ini */}
            <button
              type="button"
              onClick={() => setSelectedDateYmd(todayYmd)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer min-h-[36px] ${
                isToday
                  ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white'
                  : 'bg-slate-50 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440]'
              }`}
            >
              Hari Ini
            </button>

            {/* Quick Pill: Kemarin */}
            <button
              type="button"
              onClick={() => setSelectedDateYmd(yesterdayYmd)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer min-h-[36px] ${
                isYesterday
                  ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white'
                  : 'bg-slate-50 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440]'
              }`}
            >
              Kemarin
            </button>

            {/* Date Picker Input */}
            <div className="flex items-center bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] rounded-full px-3 py-1.5 border border-slate-200 dark:border-[#343440] transition-colors min-h-[36px]">
              <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 mr-1.5 pointer-events-none" />
              <input
                type="date"
                value={selectedDateYmd}
                max={todayYmd}
                onChange={(e) => {
                  if (e.target.value) setSelectedDateYmd(e.target.value);
                }}
                className="bg-transparent text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                title="Pilih tanggal hari yang ingin dilihat"
              />
            </div>

            {/* Tombol Hari Berikutnya */}
            <button
              type="button"
              onClick={handleNextDay}
              title="Lihat Hari Berikutnya"
              disabled={selectedDateYmd >= todayYmd}
              className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] disabled:opacity-30 flex items-center justify-center text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
            Menampilkan: <strong className="text-[#0F172A] dark:text-[#F4F4F6]">{formatYmdToIndo(selectedDateYmd)}</strong> ({dayTransactions.length} nota)
          </div>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Omset */}
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-[#2B2B33]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Omset
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
              {formatRupiah(daySummary.totalOmset)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
              {daySummary.totalTransactions} transaksi
            </p>
          </div>
        </div>

        {/* Card 2: Margin */}
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-[#2B2B33]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Estimasi Laba
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums font-mono">
              {formatRupiah(daySummary.totalMargin)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
              Margin {marginPercentage}%
            </p>
          </div>
        </div>

        {/* Card 3: Nota */}
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-[#2B2B33]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Jumlah Nota
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
              {daySummary.totalTransactions}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate tabular-nums">
              Rata2: {formatRupiah(daySummary.avgBasketSize)}
            </p>
          </div>
        </div>

        {/* Card 4: Volume Terjual (Excl. Promo) */}
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-[#2B2B33]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 leading-tight">
              Volume (Excl. Promo)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <h3 className="text-base sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
                {daySummary.totalQty} Botol
              </h3>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 px-1.5 py-0.5 rounded-md tabular-nums" title="Total botol kecuali bir, promo, dan harga minuman di bawah 30rb">
                {daySummary.filteredBottleQty ?? 0} Non-Bir/≥30k
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
              Excl. bir, promo & &lt;30rb: <strong className="text-amber-700 dark:text-amber-400">{daySummary.filteredBottleQty ?? 0} btl</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2.5">
          Rincian Metode Pembayaran
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6]">TUNAI</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 tabular-nums">{daySummary.paymentBreakdown.CASH.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(daySummary.paymentBreakdown.CASH.total)}</p>
          </div>

          <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6]">QRIS</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 tabular-nums">{daySummary.paymentBreakdown.QRIS.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">{formatRupiah(daySummary.paymentBreakdown.QRIS.total)}</p>
          </div>

          <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-purple-500/15 border border-blue-200 dark:border-purple-500/40 text-[#2563EB] dark:text-[#C084FC] flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6]">TRANSFER</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 tabular-nums">{daySummary.paymentBreakdown.TRANSFER.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-[#2563EB] dark:text-[#C084FC] tabular-nums font-mono">{formatRupiah(daySummary.paymentBreakdown.TRANSFER.total)}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-3.5 border border-slate-200 dark:border-[#2B2B33] space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none" />
          <input
            type="text"
            id="input-search-today"
            placeholder="Cari no. struk, pelanggan, atau nama produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
          />
        </div>

        {/* Filter Chips (single horizontal scroll row on mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 text-xs">
          {(['ALL', 'CASH', 'QRIS', 'TRANSFER'] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setSelectedPayment(method)}
              className={`px-3 py-1.5 rounded-full font-bold transition-colors active:scale-[0.97] cursor-pointer min-h-[38px] whitespace-nowrap shrink-0 ${
                selectedPayment === method
                  ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white'
                  : 'bg-slate-50 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440]'
              }`}
            >
              {method === 'ALL' ? 'Semua Metode' : method}
            </button>
          ))}

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filter status nota"
            className="bg-slate-50 dark:bg-[#24242B] text-[#0F172A] dark:text-[#F4F4F6] border border-slate-200 dark:border-[#343440] px-3 py-1.5 rounded-full font-medium text-xs focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] cursor-pointer min-h-[38px] shrink-0"
          >
            <option value="ALL">Semua Status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="VOIDED">Dibatalkan</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Daftar Nota Penjualan ({filtered.length})
          </h3>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">Terbaru di atas</span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-10 text-center border border-slate-200 dark:border-[#2B2B33] space-y-2">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">Tidak ada transaksi ditemukan</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
              Transaksi yang baru diselesaikan di kasir akan langsung muncul di sini.
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE VIEW (<640px): Card List Touch-Friendly */}
            <div className="space-y-3 sm:hidden">
              {visibleTransactions.map((t) => {
                const isVoided = t.status === 'VOIDED';
                return (
                  <div
                    key={t.id}
                    className={`bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border space-y-3 ${
                      isVoided ? 'border-red-200 dark:border-red-500/35 bg-red-50/40 dark:bg-red-500/10 opacity-80' : 'border-slate-200 dark:border-[#2B2B33]'
                    }`}
                  >
                    {/* Top row: ID, Time, Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-[#2563EB] dark:text-[#C084FC] truncate">
                          #{t.id}
                        </span>
                        <span className="text-slate-300 dark:text-zinc-600">•</span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-zinc-300 font-mono font-bold">
                          <Clock className="w-3 h-3 text-[#2563EB] dark:text-[#C084FC]" />
                          <span>{getPureWebsiteTime(t)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          t.paymentMethod === 'CASH'
                            ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/35'
                            : t.paymentMethod === 'QRIS'
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/35'
                            : 'bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border-blue-200 dark:border-purple-500/40'
                        }`}>
                          {t.paymentMethod}
                        </span>
                        {isVoided && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35">
                            VOID
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer & Items */}
                    <div>
                      <p className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6]">
                        {t.customerName ? `Pelanggan: ${t.customerName}` : 'Pelanggan Umum'}
                      </p>
                      <div className="text-xs text-slate-600 dark:text-zinc-300 mt-1.5 space-y-1">
                        {t.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between gap-2 text-slate-600 dark:text-zinc-300">
                            <span className="truncate">• {item.name}</span>
                            <span className="font-mono font-semibold flex-shrink-0 text-[#0F172A] dark:text-[#F4F4F6] tabular-nums">
                              {item.qty}x @{formatRupiah(item.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial summary */}
                    <div className="pt-2.5 border-t border-slate-200 dark:border-[#2B2B33] flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tabular-nums font-mono">Laba: +{formatRupiah(t.margin)}</p>
                        <p className="text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">
                          Total: {formatRupiah(t.total)}
                        </p>
                      </div>

                      {/* Action buttons (min 44px touch) */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onViewReceipt(t)}
                          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-[#0F172A] dark:text-[#F4F4F6] border border-slate-200 dark:border-[#343440] text-xs font-bold flex items-center gap-1 min-h-[44px] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
                          <span>Struk</span>
                        </button>
                        {!isVoided && (
                          <button
                            onClick={() => setVoidingTrx(t)}
                            className="px-2.5 py-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/15 border border-transparent hover:border-amber-200 dark:hover:border-amber-500/35 text-xs font-semibold flex items-center gap-1 min-h-[44px] cursor-pointer"
                            title="Batalkan Transaksi (VOID) & Hapus di Sheet"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        {onDeleteTransaction && (
                          <button
                            onClick={() => setDeletingTrx(t)}
                            className="px-2.5 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 border border-transparent hover:border-red-200 dark:hover:border-red-500/35 text-xs font-semibold flex items-center gap-1 min-h-[44px] cursor-pointer"
                            title="Hapus Transaksi & Hapus Baris di Google Sheets"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* TABLET/DESKTOP VIEW (>=640px): Full Table */}
            <div className="hidden sm:block bg-white dark:bg-[#1B1B20] rounded-2xl border border-slate-200 dark:border-[#2B2B33] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#24242B] text-slate-600 dark:text-zinc-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-[#343440] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold text-[#0F172A] dark:text-[#F4F4F6]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
                          <span>Jam Input</span>
                        </div>
                      </th>
                      <th className="py-3.5 px-4">No. Transaksi</th>
                      <th className="py-3.5 px-4">Pelanggan</th>
                      <th className="py-3.5 px-4">Item Minuman</th>
                      <th className="py-3.5 px-4 text-center">Metode</th>
                      <th className="py-3.5 px-4 text-right">Total Belanja</th>
                      <th className="py-3.5 px-4 text-right">Margin</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2B2B33]">
                    {visibleTransactions.map((t) => {
                      const isVoided = t.status === 'VOIDED';
                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-[#24242B]/70 transition-colors ${
                            isVoided ? 'opacity-60 bg-red-50/30 dark:bg-red-500/10' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            <span className="text-xs bg-slate-100 dark:bg-[#24242B] px-2.5 py-1 rounded-lg text-[#0F172A] dark:text-[#F4F4F6] border border-slate-200 dark:border-[#343440] font-bold tracking-tight tabular-nums">
                              {getPureWebsiteTime(t)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#2563EB] dark:text-[#C084FC] whitespace-nowrap">
                            {t.id}
                          </td>
                          <td className="py-3.5 px-4 text-[#0F172A] dark:text-[#F4F4F6] font-medium">
                            {t.customerName || <span className="text-slate-400 dark:text-zinc-500 italic">Umum</span>}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-zinc-300" title={t.items.map(i => `${i.name} (${i.qty}x)`).join(', ')}>
                            {t.items.map((i, idx) => (
                              <span key={idx} className="mr-1">
                                {i.name} <strong className="text-[#0F172A] dark:text-[#F4F4F6]">({i.qty}x)</strong>
                                {idx < t.items.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#24242B] text-[#0F172A] dark:text-[#F4F4F6] border border-slate-200 dark:border-[#343440]">
                              {t.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0F172A] dark:text-[#F4F4F6] whitespace-nowrap tabular-nums">
                            {formatRupiah(t.total)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                            +{formatRupiah(t.margin)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isVoided ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35">
                                DIBATALKAN
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35">
                                SELESAI
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onViewReceipt(t)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-[#0F172A] dark:text-[#F4F4F6] font-semibold text-xs transition-colors border border-slate-200 dark:border-[#343440] cursor-pointer"
                              >
                                Struk
                              </button>
                              {!isVoided && (
                                <button
                                  onClick={() => setVoidingTrx(t)}
                                  className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/15 transition-colors cursor-pointer"
                                  title="Void & Hapus di Sheet"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteTransaction && (
                                <button
                                  onClick={() => setDeletingTrx(t)}
                                  className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors cursor-pointer"
                                  title="Hapus Transaksi & Hapus Baris di Google Sheets"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {sortedTransactions.length > visibleTransactions.length && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 px-1">
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                  Menampilkan {visibleTransactions.length} dari {sortedTransactions.length} nota
                </span>
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 50)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
                >
                  Muat Lagi (+50)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Void Modal */}
      {voidingTrx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Void Nota"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div className="fixed inset-0" onClick={() => setVoidingTrx(null)} aria-hidden="true" />
          <div className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl w-full max-w-md border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 text-[#0F172A] dark:text-[#F4F4F6]">
            <div className="px-4 sm:px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 min-w-0">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F4F4F6] truncate">
                    Batalkan Transaksi & Hapus di Sheet
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setVoidingTrx(null)}
                  aria-label="Tutup dialog void"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-[#2E2E37] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5">
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Anda akan membatalkan transaksi <strong className="text-[#0F172A] dark:text-[#F4F4F6]">#{voidingTrx.id}</strong> sejumlah{' '}
                <strong className="text-[#0F172A] dark:text-[#F4F4F6]">{formatRupiah(voidingTrx.total)}</strong>. Stok barang akan dikembalikan otomatis.
              </p>

              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 text-[11px] text-[#0F172A] dark:text-[#F4F4F6] space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-red-700 dark:text-red-400">
                  <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                  <span>Hapus Otomatis di Google Sheets:</span>
                </p>
                <p className="text-red-700/80 dark:text-red-300/90 leading-relaxed">
                  Seluruh baris transaksi ini di <strong className="text-red-900 dark:text-red-200">LOG_PENJUALAN</strong> dan baris ongkir di <strong className="text-red-900 dark:text-red-200">LAIN-LAIN</strong> akan langsung dihapus permanen.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Alasan Pembatalan:
                </label>
                <textarea
                  ref={voidReasonRef}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Contoh: Salah input pesanan / Pelanggan ganti metode bayar"
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:bg-white dark:focus:bg-[#1B1B20]"
                />
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setVoidingTrx(null)}
                className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 font-bold text-xs active:scale-[0.97] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs active:scale-[0.97] cursor-pointer"
              >
                Hapus & VOID
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Struk Permanen Modal */}
      {deletingTrx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hapus Struk Permanen"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div className="fixed inset-0" onClick={() => setDeletingTrx(null)} aria-hidden="true" />
          <div className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl w-full max-w-md border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 text-[#0F172A] dark:text-[#F4F4F6]">
            <div className="px-4 sm:px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Trash2 className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F4F4F6]">Hapus Struk Permanen</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingTrx(null)}
                  aria-label="Tutup dialog hapus"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-[#2E2E37] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain">
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Yakin ingin menghapus struk transaksi <strong className="text-[#0F172A] dark:text-[#F4F4F6]">#{deletingTrx.id}</strong> ({formatRupiah(deletingTrx.total)}) secara permanen dari database lokal dan Google Sheets?
              </p>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingTrx(null)}
                className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 font-bold text-xs active:scale-[0.97] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteTransaction && deletingTrx) {
                    onDeleteTransaction(deletingTrx.id);
                    setDeletingTrx(null);
                  }
                }}
                className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs active:scale-[0.97] cursor-pointer"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
