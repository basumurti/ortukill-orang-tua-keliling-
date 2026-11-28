import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button, Card, Chip, Input, Modal, TextArea } from '@heroui/react';
import { 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  Package, 
  Search, 
  Download, 
  Ban, 
  Eye, 
  RefreshCw, 
  Calendar,
  Clock,
  CreditCard,
  Banknote,
  QrCode,
  AlertTriangle,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { TransactionReceipt, DailySummary, PaymentMethod } from '../types';
import { formatRupiah, isPromoItem, isEligibleBottleItem, normalizeDateToYmd } from '../services/storageService';
import { useOverlayHistory } from '../utils/useOverlayHistory';
import { AnimatedTabPill } from './ui/motion/MotionPrimitives';
import { SmartCountUp, FadeContent } from './ui/animated/ReactBitsPrimitives';

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
    <div className="space-y-4 max-w-7xl mx-auto pb-24 text-[var(--foreground)]">
      {/* Top Header Card dengan Filter Hari */}
      <Card className="bg-[var(--surface)] rounded-2xl p-4 sm:p-5 gap-3.5 border border-[var(--border)] shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                  Riwayat Nota &amp; Log Penjualan
                </h2>
                <Chip size="sm" variant="soft" color="success" className="font-bold border border-[var(--success)]/30">
                  <Chip.Label className="text-emerald-700 dark:text-[var(--success)]">{formatYmdToSlash(selectedDateYmd)}</Chip.Label>
                </Chip>
                {isToday && (
                  <Chip size="sm" variant="soft" color="accent" className="font-bold border border-[var(--accent)]/25">
                    <Chip.Label>Hari Ini</Chip.Label>
                  </Chip>
                )}
                {isYesterday && (
                  <Chip size="sm" variant="soft" color="default" className="font-bold border border-[var(--border)]">
                    <Chip.Label>Kemarin</Chip.Label>
                  </Chip>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Audit nota kasir, cetak ulang struk &amp; log penjualan • Total {dayTransactions.length} transaksi pada {formatYmdToIndo(selectedDateYmd)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onPress={onSyncSpreadsheet ? onSyncSpreadsheet : onRefresh}
              isDisabled={isSyncing}
              className="flex-1 sm:flex-none rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] text-xs font-semibold min-h-[44px] px-3.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent)] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkron...' : 'Segarkan'}</span>
            </Button>
            <Button
              variant="primary"
              onPress={handleExportCSV}
              className="flex-1 sm:flex-none rounded-xl text-xs font-bold min-h-[44px] px-3.5"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.25]" />
              <span>Ekspor CSV</span>
            </Button>
          </div>
        </div>

        {/* Filter Hari (Memfilter semua kartu & daftar transaksi di bawahnya) */}
        <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mr-1">
              Filter Hari:
            </span>

            {/* Tombol Hari Sebelumnya */}
            <Button
              variant="outline"
              isIconOnly
              onPress={handlePrevDay}
              aria-label="Lihat Hari Sebelumnya"
              className="w-10 h-10 rounded-xl bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Quick Pill: Hari Ini */}
            <Button
              variant={isToday ? 'primary' : 'outline'}
              size="sm"
              onPress={() => setSelectedDateYmd(todayYmd)}
              className={`rounded-full text-xs font-bold min-h-[38px] px-3.5 ${
                isToday ? '' : 'bg-[var(--surface-secondary)] text-[var(--muted)] border-[var(--border)]'
              }`}
            >
              Hari Ini
            </Button>

            {/* Quick Pill: Kemarin */}
            <Button
              variant={isYesterday ? 'primary' : 'outline'}
              size="sm"
              onPress={() => setSelectedDateYmd(yesterdayYmd)}
              className={`rounded-full text-xs font-bold min-h-[38px] px-3.5 ${
                isYesterday ? '' : 'bg-[var(--surface-secondary)] text-[var(--muted)] border-[var(--border)]'
              }`}
            >
              Kemarin
            </Button>

            {/* Date Picker Input */}
            <div className="flex items-center bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] rounded-full px-3 py-1.5 border border-[var(--border)] transition-colors min-h-[38px]">
              <Calendar className="w-3.5 h-3.5 text-[var(--muted)] mr-1.5 pointer-events-none" />
              <input
                type="date"
                value={selectedDateYmd}
                max={todayYmd}
                onChange={(e) => {
                  if (e.target.value) setSelectedDateYmd(e.target.value);
                }}
                className="bg-transparent text-xs font-bold text-[var(--foreground)] focus:outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                title="Pilih tanggal hari yang ingin dilihat"
              />
            </div>

            {/* Tombol Hari Berikutnya */}
            <Button
              variant="outline"
              isIconOnly
              onPress={handleNextDay}
              isDisabled={selectedDateYmd >= todayYmd}
              aria-label="Lihat Hari Berikutnya"
              className="w-10 h-10 rounded-xl bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)]"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-[11px] font-semibold text-[var(--muted)]">
            Menampilkan: <strong className="text-[var(--foreground)]">{formatYmdToIndo(selectedDateYmd)}</strong> ({dayTransactions.length} nota)
          </div>
        </div>
      </Card>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Omset */}
        <Card className="bg-[var(--surface)] rounded-2xl p-3.5 sm:p-4 gap-2 border border-[var(--border)] shadow-none">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Omset
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
              <SmartCountUp value={daySummary.totalOmset} formatter={formatRupiah} />
            </h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 tabular-nums">
              {daySummary.totalTransactions} transaksi
            </p>
          </div>
        </Card>

        {/* Card 2: Margin */}
        <Card className="bg-[var(--surface)] rounded-2xl p-3.5 sm:p-4 gap-2 border border-[var(--border)] shadow-none">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Estimasi Laba
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-extrabold text-emerald-700 dark:text-[var(--success)] tracking-tight tabular-nums font-mono">
              <SmartCountUp value={daySummary.totalMargin} formatter={formatRupiah} />
            </h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 tabular-nums">
              Margin {marginPercentage}%
            </p>
          </div>
        </Card>

        {/* Card 3: Nota */}
        <Card className="bg-[var(--surface)] rounded-2xl p-3.5 sm:p-4 gap-2 border border-[var(--border)] shadow-none">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Jumlah Nota
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
              <SmartCountUp value={daySummary.totalTransactions} formatter={(v) => String(Math.round(v))} />
            </h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate tabular-nums">
              Rata2: {formatRupiah(daySummary.avgBasketSize)}
            </p>
          </div>
        </Card>

        {/* Card 4: Volume Terjual (Excl. Promo) */}
        <Card className="bg-[var(--surface)] rounded-2xl p-3.5 sm:p-4 gap-2 border border-[var(--border)] shadow-none">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] leading-tight">
              Volume (Excl. Promo)
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <h3 className="text-base sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
                <SmartCountUp value={daySummary.totalQty} formatter={(v) => `${Math.round(v)} Botol`} />
              </h3>
              <span
                className="text-[10px] font-bold text-amber-700 dark:text-[var(--warning)] bg-[var(--warning-soft)] border border-[var(--warning)]/35 px-1.5 py-0.5 rounded-md tabular-nums"
                title="Total botol kecuali bir, promo, dan harga minuman di bawah 30rb"
              >
                {daySummary.filteredBottleQty ?? 0} Non-Bir/≥30k
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 tabular-nums">
              Excl. bir, promo &amp; &lt;30rb: <strong className="text-amber-700 dark:text-[var(--warning)]">{daySummary.filteredBottleQty ?? 0} btl</strong>
            </p>
          </div>
        </Card>
      </div>

      {/* Payment Method Breakdown */}
      <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2.5 border border-[var(--border)] shadow-none">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Rincian Metode Pembayaran
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--warning-soft)] border border-[var(--warning)]/35 text-amber-700 dark:text-[var(--warning)] flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--foreground)]">TUNAI</p>
                <p className="text-[10px] text-[var(--muted)] tabular-nums">{daySummary.paymentBreakdown.CASH.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(daySummary.paymentBreakdown.CASH.total)}</p>
          </div>

          <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--success-soft)] border border-[var(--success)]/35 text-emerald-700 dark:text-[var(--success)] flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--foreground)]">QRIS</p>
                <p className="text-[10px] text-[var(--muted)] tabular-nums">{daySummary.paymentBreakdown.QRIS.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono">{formatRupiah(daySummary.paymentBreakdown.QRIS.total)}</p>
          </div>

          <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--foreground)]">TRANSFER</p>
                <p className="text-[10px] text-[var(--muted)] tabular-nums">{daySummary.paymentBreakdown.TRANSFER.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-[var(--accent)] tabular-nums font-mono">{formatRupiah(daySummary.paymentBreakdown.TRANSFER.total)}</p>
          </div>
        </div>
      </Card>

      {/* Filter & Search */}
      <Card className="bg-[var(--surface)] rounded-2xl p-3.5 gap-2.5 border border-[var(--border)] shadow-none">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none z-10" />
          <Input
            type="text"
            id="input-search-today"
            fullWidth
            variant="secondary"
            placeholder="Cari no. struk, pelanggan, atau nama produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)] min-h-[44px]"
          />
        </div>

        {/* Filter Chips (single horizontal scroll row on mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 text-xs">
          {(['ALL', 'CASH', 'QRIS', 'TRANSFER'] as const).map((method) => {
            const isSelected = selectedPayment === method;
            return (
              <Button
                key={method}
                size="sm"
                variant="outline"
                onPress={() => setSelectedPayment(method)}
                className={`relative rounded-full font-bold min-h-[38px] px-3.5 whitespace-nowrap shrink-0 overflow-hidden ${
                  isSelected
                    ? 'border-[var(--accent)] text-[var(--accent-foreground)]'
                    : 'bg-[var(--surface-secondary)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)]'
                }`}
              >
                {isSelected && (
                  <AnimatedTabPill
                    layoutId="today-payment-filter-pill"
                    className="absolute inset-0 rounded-full bg-[var(--accent)] pointer-events-none"
                  />
                )}
                <span className="relative z-10">{method === 'ALL' ? 'Semua Metode' : method}</span>
              </Button>
            );
          })}

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filter status nota"
            className="bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border)] px-3 py-1.5 rounded-full font-medium text-xs focus:outline-none focus:border-[var(--accent)] cursor-pointer min-h-[38px] shrink-0"
          >
            <option value="ALL">Semua Status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="VOIDED">Dibatalkan</option>
          </select>
        </div>
      </Card>

      {/* Transactions List */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Daftar Nota Penjualan ({filtered.length})
          </h3>
          <span className="text-[11px] text-[var(--muted)]">Terbaru di atas</span>
        </div>

        {filtered.length === 0 ? (
          <FadeContent>
            <Card className="bg-[var(--surface)] rounded-2xl p-10 text-center border border-[var(--border)] shadow-none items-center gap-2">
              <Receipt className="w-10 h-10 mx-auto text-[var(--muted)] opacity-50" />
              <p className="text-sm font-bold text-[var(--foreground)]">Tidak ada transaksi ditemukan</p>
              <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
                Transaksi yang baru diselesaikan di kasir akan langsung muncul di sini.
              </p>
            </Card>
          </FadeContent>
        ) : (
          <>
            {/* MOBILE VIEW (<640px): Card List Touch-Friendly */}
            <div className="space-y-3 sm:hidden">
              {visibleTransactions.map((t) => {
                const isVoided = t.status === 'VOIDED';
                return (
                  <Card
                    key={t.id}
                    className={`rounded-2xl p-4 gap-3 border shadow-none ${
                      isVoided
                        ? 'border-[var(--danger)]/35 bg-[var(--danger-soft)] opacity-85'
                        : 'bg-[var(--surface)] border-[var(--border)]'
                    }`}
                  >
                    {/* Top row: ID, Time, Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-[var(--accent)] truncate">
                          #{t.id}
                        </span>
                        <span className="text-[var(--muted)]">•</span>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--foreground)] font-mono font-bold">
                          <Clock className="w-3 h-3 text-[var(--accent)]" />
                          <span>{getPureWebsiteTime(t)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Chip
                          size="sm"
                          variant="soft"
                          color={
                            t.paymentMethod === 'CASH'
                              ? 'warning'
                              : t.paymentMethod === 'QRIS'
                              ? 'success'
                              : 'accent'
                          }
                          className="font-bold border border-[var(--border)]"
                        >
                          <Chip.Label>{t.paymentMethod}</Chip.Label>
                        </Chip>
                        {isVoided && (
                          <Chip size="sm" variant="soft" color="danger" className="font-bold border border-[var(--danger)]/35">
                            <Chip.Label>VOID</Chip.Label>
                          </Chip>
                        )}
                      </div>
                    </div>

                    {/* Customer & Items */}
                    <div>
                      <p className="text-xs font-bold text-[var(--foreground)]">
                        {t.customerName ? `Pelanggan: ${t.customerName}` : 'Pelanggan Umum'}
                      </p>
                      <div className="text-xs text-[var(--muted)] mt-1.5 space-y-1">
                        {t.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between gap-2 text-[var(--muted)]">
                            <span className="truncate">• {item.name}</span>
                            <span className="font-mono font-semibold flex-shrink-0 text-[var(--foreground)] tabular-nums">
                              {item.qty}x @{formatRupiah(item.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial summary */}
                    <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-emerald-700 dark:text-[var(--success)] font-bold tabular-nums font-mono">
                          Laba: +{formatRupiah(t.margin)}
                        </p>
                        <p className="text-sm font-extrabold text-[var(--foreground)] tabular-nums font-mono">
                          Total: {formatRupiah(t.total)}
                        </p>
                      </div>

                      {/* Action buttons (min 44px touch) */}
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => onViewReceipt(t)}
                          className="px-3 rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] text-xs font-bold min-h-[44px]"
                        >
                          <Eye className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>Struk</span>
                        </Button>
                        {!isVoided && (
                          <Button
                            variant="ghost"
                            isIconOnly
                            onPress={() => setVoidingTrx(t)}
                            aria-label="Batalkan Transaksi (VOID) & Hapus di Sheet"
                            className="rounded-xl text-amber-700 dark:text-[var(--warning)] hover:bg-[var(--warning-soft)] min-h-[44px] min-w-[44px]"
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                        {onDeleteTransaction && (
                          <Button
                            variant="ghost"
                            isIconOnly
                            onPress={() => setDeletingTrx(t)}
                            aria-label="Hapus Transaksi & Hapus Baris di Google Sheets"
                            className="rounded-xl text-[var(--danger)] hover:bg-[var(--danger-soft)] min-h-[44px] min-w-[44px]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* TABLET/DESKTOP VIEW (>=640px): Full Table */}
            <Card className="hidden sm:block bg-[var(--surface)] rounded-2xl p-0 gap-0 border border-[var(--border)] shadow-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-secondary)] text-[var(--muted)] uppercase text-[10px] tracking-wider border-b border-[var(--border)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold text-[var(--foreground)]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
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
                  <tbody className="divide-y divide-[var(--separator)]">
                    {visibleTransactions.map((t) => {
                      const isVoided = t.status === 'VOIDED';
                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-[var(--surface-secondary)]/80 transition-colors ${
                            isVoided ? 'opacity-65 bg-[var(--danger-soft)]' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            <span className="text-xs bg-[var(--surface-secondary)] px-2.5 py-1 rounded-lg text-[var(--foreground)] border border-[var(--border)] font-bold tracking-tight tabular-nums">
                              {getPureWebsiteTime(t)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[var(--accent)] whitespace-nowrap">
                            {t.id}
                          </td>
                          <td className="py-3.5 px-4 text-[var(--foreground)] font-medium">
                            {t.customerName || <span className="text-[var(--muted)] italic">Umum</span>}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate text-[var(--muted)]" title={t.items.map(i => `${i.name} (${i.qty}x)`).join(', ')}>
                            {t.items.map((i, idx) => (
                              <span key={idx} className="mr-1">
                                {i.name} <strong className="text-[var(--foreground)]">({i.qty}x)</strong>
                                {idx < t.items.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <Chip size="sm" variant="soft" color="default" className="font-bold border border-[var(--border)]">
                              <Chip.Label>{t.paymentMethod}</Chip.Label>
                            </Chip>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[var(--foreground)] whitespace-nowrap tabular-nums">
                            {formatRupiah(t.total)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700 dark:text-[var(--success)] whitespace-nowrap tabular-nums">
                            +{formatRupiah(t.margin)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isVoided ? (
                              <Chip size="sm" variant="soft" color="danger" className="font-bold border border-[var(--danger)]/35">
                                <Chip.Label>DIBATALKAN</Chip.Label>
                              </Chip>
                            ) : (
                              <Chip size="sm" variant="soft" color="success" className="font-bold border border-[var(--success)]/35">
                                <Chip.Label className="text-emerald-700 dark:text-[var(--success)]">SELESAI</Chip.Label>
                              </Chip>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onPress={() => onViewReceipt(t)}
                                className="px-2.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] font-semibold text-xs min-h-[34px]"
                              >
                                Struk
                              </Button>
                              {!isVoided && (
                                <Button
                                  variant="ghost"
                                  isIconOnly
                                  size="sm"
                                  onPress={() => setVoidingTrx(t)}
                                  aria-label="Void & Hapus di Sheet"
                                  className="rounded-lg text-amber-700 dark:text-[var(--warning)] hover:bg-[var(--warning-soft)]"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {onDeleteTransaction && (
                                <Button
                                  variant="ghost"
                                  isIconOnly
                                  size="sm"
                                  onPress={() => setDeletingTrx(t)}
                                  aria-label="Hapus Transaksi & Hapus Baris di Google Sheets"
                                  className="rounded-lg text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {sortedTransactions.length > visibleTransactions.length && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 px-1">
                <span className="text-xs text-[var(--muted)] font-medium tabular-nums">
                  Menampilkan {visibleTransactions.length} dari {sortedTransactions.length} nota
                </span>
                <Button
                  variant="outline"
                  onPress={() => setVisibleCount((prev) => prev + 50)}
                  className="w-full sm:w-auto px-4 rounded-xl bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] text-xs font-bold min-h-[44px]"
                >
                  Muat Lagi (+50)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Void Modal */}
      <Modal.Backdrop
        isOpen={Boolean(voidingTrx)}
        onOpenChange={(open) => {
          if (!open) setVoidingTrx(null);
        }}
        variant="opaque"
      >
          <Modal.Container placement="auto" size="md" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="Konfirmasi Void Nota"
              className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full flex flex-col"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />
              <Modal.Header className="px-4 sm:px-5 pt-2.5 sm:pt-4 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                <div className="flex items-center gap-2 text-[var(--danger)] min-w-0">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <Modal.Heading className="font-bold text-sm sm:text-base text-[var(--foreground)] truncate">
                    Batalkan Transaksi &amp; Hapus di Sheet
                  </Modal.Heading>
                </div>
                <Modal.CloseTrigger
                  aria-label="Tutup dialog void"
                  className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                />
              </Modal.Header>

              {voidingTrx && (
                <>
                  <Modal.Body className="!mt-0 flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5">
                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      Anda akan membatalkan transaksi <strong className="text-[var(--foreground)]">#{voidingTrx.id}</strong> sejumlah{' '}
                      <strong className="text-[var(--foreground)]">{formatRupiah(voidingTrx.total)}</strong>. Stok barang akan dikembalikan otomatis.
                    </p>

                    <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/35 text-[11px] text-[var(--foreground)] space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-[var(--danger)]">
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Hapus Otomatis di Google Sheets:</span>
                      </p>
                      <p className="text-[var(--danger)]/90 leading-relaxed">
                        Seluruh baris transaksi ini di <strong>LOG_PENJUALAN</strong> dan baris ongkir di <strong>LAIN-LAIN</strong> akan langsung dihapus permanen.
                      </p>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                        Alasan Pembatalan:
                      </label>
                      <TextArea
                        ref={voidReasonRef}
                        fullWidth
                        variant="secondary"
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        placeholder="Contoh: Salah input pesanan / Pelanggan ganti metode bayar"
                        rows={3}
                        className="w-full p-3 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)]"
                      />
                    </div>
                  </Modal.Body>

                  <Modal.Footer className="!mt-0 px-4 sm:px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onPress={() => setVoidingTrx(null)}
                      className="flex-1 min-h-[48px] rounded-xl bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] font-bold text-xs"
                    >
                      Batal
                    </Button>
                    <Button
                      variant="danger"
                      onPress={handleConfirmVoid}
                      className="flex-1 min-h-[48px] rounded-xl font-bold text-xs"
                    >
                      Hapus &amp; VOID
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

      {/* Delete Struk Permanen Modal */}
      <Modal.Backdrop
        isOpen={Boolean(deletingTrx)}
        onOpenChange={(open) => {
          if (!open) setDeletingTrx(null);
        }}
        variant="opaque"
      >
          <Modal.Container placement="auto" size="md" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="Hapus Struk Permanen"
              className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full flex flex-col"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />
              <Modal.Header className="px-4 sm:px-5 pt-2.5 sm:pt-4 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                <div className="flex items-center gap-2 text-[var(--danger)] min-w-0">
                  <Trash2 className="w-5 h-5 shrink-0" />
                  <Modal.Heading className="font-bold text-sm sm:text-base text-[var(--foreground)] truncate">
                    Hapus Struk Permanen
                  </Modal.Heading>
                </div>
                <Modal.CloseTrigger
                  aria-label="Tutup dialog hapus"
                  className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                />
              </Modal.Header>

              {deletingTrx && (
                <>
                  <Modal.Body className="!mt-0 p-4 sm:p-5 overflow-y-auto overscroll-contain">
                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      Yakin ingin menghapus struk transaksi <strong className="text-[var(--foreground)]">#{deletingTrx.id}</strong> ({formatRupiah(deletingTrx.total)}) secara permanen dari database lokal dan Google Sheets?
                    </p>
                  </Modal.Body>

                  <Modal.Footer className="!mt-0 px-4 sm:px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onPress={() => setDeletingTrx(null)}
                      className="flex-1 min-h-[48px] rounded-xl bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] font-bold text-xs"
                    >
                      Batal
                    </Button>
                    <Button
                      variant="danger"
                      onPress={() => {
                        if (onDeleteTransaction && deletingTrx) {
                          onDeleteTransaction(deletingTrx.id);
                          setDeletingTrx(null);
                        }
                      }}
                      className="flex-1 min-h-[48px] rounded-xl font-bold text-xs"
                    >
                      Ya, Hapus Permanen
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
    </div>
  );
};
