import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Package, 
  Download, 
  Search, 
  Eye, 
  Trophy, 
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Clock,
  BarChart3,
  Wallet,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Flame,
  Award,
  Trash2,
  X,
  Filter,
  Copy,
  Check,
  FileText,
  MessageSquare,
  AlertTriangle,
  Boxes,
  ShoppingBag,
  ArrowRight,
  CreditCard,
  Banknote,
  SendHorizontal,
  CircleDollarSign
} from 'lucide-react';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { TransactionReceipt, Product, FinanceRecord, SalesTarget } from '../types';
import { formatRupiah, normalizeDateToYmd, classifyProduct, StorageService } from '../services/storageService';
import { FinanceManagementView } from './FinanceManagementView';
import { useOverlayHistory } from '../utils/useOverlayHistory';

interface SalesHistoryViewProps {
  transactions: TransactionReceipt[];
  products: Product[];
  financeRecords: FinanceRecord[];
  salesTarget: SalesTarget;
  onViewReceipt: (receipt: TransactionReceipt) => void;
  onVoidTransaction?: (id: string, reason: string) => void;
  onDeleteTransaction?: (id: string) => void;
  onAddFinanceRecord: (record: Omit<FinanceRecord, 'id' | 'dateYmd' | 'dateTimeStr'>) => Promise<void> | void;
  onDeleteFinanceRecord: (id: string, rowNumber?: number) => Promise<void> | void;
  onSaveSalesTarget: (targetAmount: number, month?: string) => void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
  showToast?: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  isDarkMode?: boolean;
}

interface FlattenedSaleItem {
  id: string;
  trxId: string;
  dateStr: string;
  dateYmd: string;
  dateTimeStr: string;
  timeStr: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  qty: number;
  total: number;
  margin: number;
  customer: string;
  paymentMethod: string;
  status: string;
  rawReceipt: TransactionReceipt;
}

interface DateSalesGroup {
  dateKey: string;
  dateDisplay: string;
  dateYmd: string;
  totalOmset: number;
  totalHPP: number;
  totalMargin: number;
  totalQty: number;
  itemCount: number;
  paymentMethods: Record<string, number>;
  items: FlattenedSaleItem[];
  rawReceipt?: TransactionReceipt;
}

// Helper: Format axis ribuan / jutaan
const formatAxisRbJt = (val: number): string => {
  if (Math.abs(val) >= 1000000) {
    const jt = val / 1000000;
    return `${jt % 1 === 0 ? jt : jt.toFixed(1)}jt`;
  }
  if (Math.abs(val) >= 1000) {
    return `${Math.round(val / 1000)}rb`;
  }
  return String(val);
};

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  transactions,
  products,
  financeRecords,
  salesTarget,
  onViewReceipt,
  onVoidTransaction,
  onDeleteTransaction,
  onAddFinanceRecord,
  onDeleteFinanceRecord,
  onSaveSalesTarget,
  onSyncSpreadsheet,
  isSyncing,
  showToast,
  isDarkMode = false,
}) => {
  // Global Month Filter State
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL'); // 'ALL' or 'YYYY-MM'
  const [targetGrain, setTargetGrain] = useState<'HARIAN' | 'MINGGUAN' | 'BULANAN'>('BULANAN');
  const [dayOffset, setDayOffset] = useState<number>(1); // Default +1 day progress

  // SECTION 1: Report Harian WhatsApp State
  const [selectedReportDate, setSelectedReportDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [showReportText, setShowReportText] = useState<boolean>(true);
  const [isCopiedReport, setIsCopiedReport] = useState<boolean>(false);

  // SECTION 2: Target Editing Modal State
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(salesTarget.targetAmount || 50000000));

  // SECTION 3: Product Ranking Metric Toggle (QTY vs CUAN vs OMSET)
  const [productRankingMetric, setProductRankingMetric] = useState<'QTY' | 'CUAN' | 'OMSET'>('QTY');

  // SECTION 5: Sales Log Filter & Collapse State
  const [isLogCollapsed, setIsLogCollapsed] = useState<boolean>(false);
  const [logViewMode, setLogViewMode] = useState<'BY_DATE' | 'FLAT_LOG'>('BY_DATE');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logPaymentFilter, setLogPaymentFilter] = useState<string>('ALL');
  const [logStatusFilter, setLogStatusFilter] = useState<'ALL' | 'COMPLETED' | 'VOIDED'>('ALL');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [logVisibleCount, setLogVisibleCount] = useState<number>(50);

  useEffect(() => {
    setLogVisibleCount(50);
  }, [selectedMonth, logViewMode, logSearchQuery, logPaymentFilter, logStatusFilter]);

  // Deleting Modal State
  const [deletingTrx, setDeletingTrx] = useState<TransactionReceipt | null>(null);

  useOverlayHistory(isEditingTarget, () => setIsEditingTarget(false), 'sales-target-modal');
  useOverlayHistory(Boolean(deletingTrx), () => setDeletingTrx(null), 'sales-delete-trx-modal');

  // Derived available unique YYYY-MM months
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthStr);

    transactions.forEach((t) => {
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (ymd && ymd.length >= 7) {
        monthsSet.add(ymd.slice(0, 7));
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  const formatMonthLabel = (ym: string) => {
    if (ym === 'ALL') return 'Semua Bulan';
    const parts = ym.split('-');
    if (parts.length < 2) return ym;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return ym;
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // Navigasi tanggal report harian
  const handleShiftReportDate = (deltaDays: number) => {
    const [y, m, d] = selectedReportDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const nextYmd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    setSelectedReportDate(nextYmd);
  };

  // Handle target edit submit
  const handleTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = parseFloat(String(targetInput).replace(/[^0-9]/g, ''));
    if (isNaN(cleanNum) || cleanNum <= 0) {
      showToast?.('Mohon masukkan nominal target yang valid (> 0).', 'error');
      return;
    }
    onSaveSalesTarget(cleanNum, selectedMonth !== 'ALL' ? selectedMonth : undefined);
    setIsEditingTarget(false);
    showToast?.(`✓ Target penjualan disimpan: ${formatRupiah(cleanNum)}`, 'success');
  };

  // ==========================================
  // SECTION 1: LOGIKA REPORT HARIAN WHATSAPP (Sesuai Formula Sheets)
  // ==========================================
  const dailyReportData = useMemo(() => {
    const targetYmd = selectedReportDate;
    const parts = targetYmd.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);

    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()] || 'Hari';
    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][parts[1] - 1] || String(parts[1]);
    const formattedDateHeader = `${namaHari}, ${String(parts[2]).padStart(2, '0')} ${namaBulan} ${parts[0]}`;

    // Filter transaksi untuk tanggal yang dipilih (abaikan VOIDED)
    const dayTrx = transactions.filter((t) => {
      const rawId = String(t.id || '').trim();
      if (rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-') || t.status === 'VOIDED') {
        return false;
      }
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      return ymd === targetYmd;
    });

    const productQtyMap = new Map<string, number>();
    let totalBtl = 0;
    let totalOmset = 0;
    let totalMargin = 0;

    dayTrx.forEach((t) => {
      totalOmset += Number(t.subtotal || t.total || 0);
      totalMargin += Number(t.margin || 0);

      (t.items || []).forEach((item) => {
        const rawName = String(item.name || item.sku || '').trim();
        const upperName = rawName.toUpperCase();

        // Formula rule: col_d <> "PROMO 5RB"
        if (upperName === 'PROMO 5RB' || upperName.includes('PROMO 5RB')) {
          return;
        }

        const qty = Number(item.qty) || 0;
        // Total botol fisik non-promo
        if (qty > 0 && !upperName.startsWith('PROMO:') && !upperName.startsWith('DISKON:') && (item.price === undefined || item.price >= 0)) {
          totalBtl += qty;
        }

        if (rawName) {
          productQtyMap.set(rawName, (productQtyMap.get(rawName) || 0) + qty);
        }
      });
    });

    // Baris teks: [Nama Produk] \t - [Qty]
    const barisTeks: string[] = [];
    productQtyMap.forEach((qty, name) => {
      barisTeks.push(`${name}\t- ${qty}`);
    });

    // Urutkan berdasarkan panjang karakter baris teks (LEN) menurun, persis formula SORT(baris_teks, LEN, FALSE)
    barisTeks.sort((a, b) => b.length - a.length);

    const daftar = barisTeks.length > 0 ? barisTeks.join('\n') : '(Tidak ada transaksi)';
    const fmtNumber = (num: number) => new Intl.NumberFormat('en-US').format(Math.round(num));

    const fullReportText = [
      'REPORT HARIAN',
      formattedDateHeader,
      '',
      '----------------------------------',
      '',
      daftar,
      '',
      '-------------------------------',
      '',
      `QTY BTL : ${totalBtl}`,
      `OMSET : ${fmtNumber(totalOmset)}`,
      `CUAN : ${fmtNumber(totalMargin)}`
    ].join('\n');

    return {
      targetYmd,
      formattedDateHeader,
      totalBtl,
      totalOmset,
      totalMargin,
      itemCount: barisTeks.length,
      trxCount: dayTrx.length,
      barisTeks,
      daftar,
      fullReportText,
    };
  }, [transactions, selectedReportDate]);

  const handleCopyReportText = async () => {
    try {
      await navigator.clipboard.writeText(dailyReportData.fullReportText);
      setIsCopiedReport(true);
      showToast?.('✓ Teks Report Harian berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setIsCopiedReport(false), 2000);
    } catch {
      try {
        const tArea = document.createElement('textarea');
        tArea.value = dailyReportData.fullReportText;
        document.body.appendChild(tArea);
        tArea.select();
        document.execCommand('copy');
        document.body.removeChild(tArea);
        setIsCopiedReport(true);
        showToast?.('✓ Teks Report Harian berhasil disalin ke clipboard!', 'success');
        setTimeout(() => setIsCopiedReport(false), 2000);
      } catch {
        showToast?.('Gagal menyalin teks report harian.', 'error');
      }
    }
  };

  // ==========================================
  // SECTION 2: RINGKASAN KINERJA USAHA (FINANCIAL & MoM)
  // ==========================================
  const activeMonthInfo = useMemo(() => {
    const now = new Date();
    const currentMonthKey = selectedMonth !== 'ALL'
      ? selectedMonth
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [cYear, cMonth] = currentMonthKey.split('-').map(Number);
    const prevMonthDate = new Date(cYear, cMonth - 2, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const daysInCurMonth = new Date(cYear, cMonth, 0).getDate();
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

    const isCurrentMonth = now.getFullYear() === cYear && (now.getMonth() + 1) === cMonth;
    // Rentang hari N untuk perbandingan adil (1..N)
    const N = isCurrentMonth ? Math.min(now.getDate(), daysInCurMonth) : daysInCurMonth;

    return {
      currentMonthKey,
      prevMonthKey,
      cYear,
      cMonth,
      daysInCurMonth,
      daysInPrevMonth,
      isCurrentMonth,
      N,
    };
  }, [selectedMonth]);

  // Strip KPI: Omzet, Cuan, Margin %, Nota, Botol & Delta vs Bulan Lalu (hari 1..N)
  const kpiStats = useMemo(() => {
    const { currentMonthKey, prevMonthKey, N } = activeMonthInfo;

    let curOmsetTotal = 0;
    let curCuanTotal = 0;
    let curNotaCount = 0;
    let curBotolTotal = 0;

    let curOmset_N = 0;
    let curCuan_N = 0;
    let curNota_N = 0;
    let curBotol_N = 0;

    let prevOmset_N = 0;
    let prevCuan_N = 0;
    let prevNota_N = 0;
    let prevBotol_N = 0;

    // Filter transaksi valid (bukan VOIDED)
    const validTrx = transactions.filter((t) => {
      const rawId = String(t.id || '').trim().toUpperCase();
      return !rawId.startsWith('VOIDED-') && !rawId.startsWith('#VOIDED-') && t.status !== 'VOIDED';
    });

    validTrx.forEach((t) => {
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!ymd || ymd.length < 10) return;
      const mKey = ymd.slice(0, 7);
      const dayNum = parseInt(ymd.slice(8, 10), 10);

      // Hitung botol fisik non-promo
      let trxBotol = 0;
      (t.items || []).forEach((it) => {
        const uName = String(it.name || '').toUpperCase();
        const uSku = String(it.sku || '').toUpperCase();
        const isPromo = 
          uName === 'PROMO 5RB' || 
          uName.includes('PROMO 5RB') || 
          uName.startsWith('PROMO:') || 
          uName.startsWith('DISKON:') ||
          uSku.includes('PROMO') ||
          (typeof it.price === 'number' && it.price < 0);
        if (!isPromo && it.qty > 0) {
          trxBotol += Number(it.qty) || 0;
        }
      });

      const omset = Number(t.subtotal || t.total || 0);
      const cuan = Number(t.margin || 0);

      if (selectedMonth === 'ALL' || mKey === currentMonthKey) {
        curOmsetTotal += omset;
        curCuanTotal += cuan;
        curNotaCount += 1;
        curBotolTotal += trxBotol;

        if (dayNum <= N) {
          curOmset_N += omset;
          curCuan_N += cuan;
          curNota_N += 1;
          curBotol_N += trxBotol;
        }
      }

      if (mKey === prevMonthKey && dayNum <= N) {
        prevOmset_N += omset;
        prevCuan_N += cuan;
        prevNota_N += 1;
        prevBotol_N += trxBotol;
      }
    });

    const calcDelta = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };

    const curMarginPct = curOmsetTotal > 0 ? Math.round((curCuanTotal / curOmsetTotal) * 100) : 0;
    const prevMarginPct_N = prevOmset_N > 0 ? Math.round((prevCuan_N / prevOmset_N) * 100) : 0;
    const deltaMarginPoints = curMarginPct - prevMarginPct_N;

    return {
      omset: curOmsetTotal,
      cuan: curCuanTotal,
      marginPct: curMarginPct,
      nota: curNotaCount,
      botol: curBotolTotal,
      N,
      deltaOmset: calcDelta(curOmset_N, prevOmset_N),
      deltaCuan: calcDelta(curCuan_N, prevCuan_N),
      deltaMargin: deltaMarginPoints,
      deltaNota: calcDelta(curNota_N, prevNota_N),
      deltaBotol: calcDelta(curBotol_N, prevBotol_N),
      prevOmset_N,
      prevCuan_N,
      prevNota_N,
      prevBotol_N,
    };
  }, [transactions, activeMonthInfo, selectedMonth]);

  // ==========================================
  // ARUS KAS BERSIH (OMZET − RESTOCK − PENGELUARAN = ARUS KAS BERSIH)
  // Periode tanggal sama, tanpa double counting, bersumber dari data aktual
  // ==========================================
  const cashFlowMetrics = useMemo(() => {
    const { currentMonthKey } = activeMonthInfo;
    const isAll = selectedMonth === 'ALL';

    // 1. OMZET (total penjualan periode terpilih, abaikan VOIDED)
    let omzet = 0;
    let notaCount = 0;
    transactions.forEach((t) => {
      const rawId = String(t.id || '').trim().toUpperCase();
      if (rawId.startsWith('VOIDED-') || rawId.startsWith('#VOIDED-') || t.status === 'VOIDED') return;
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!ymd) return;
      if (!isAll && !ymd.startsWith(currentMonthKey)) return;

      omzet += Number(t.subtotal || t.total || 0);
      notaCount += 1;
    });

    // 2. RESTOCK (total pembelian barang untuk mengisi stok)
    let restock = 0;
    let restockCount = 0;
    const recordedRestockKeys = new Set<string>();

    // A. Ambil dari riwayat barang masuk di sub menu Stock (LOG_BARANG_MASUK)
    try {
      const stockInList = StorageService.getBarangMasukList();
      stockInList.forEach((bm) => {
        const rawStatus = String((bm as { status?: string }).status || '').toUpperCase();
        if (rawStatus === 'VOIDED') return;
        const rawName = String(bm.name || '').toUpperCase();
        if (rawName.startsWith('[VOID]') || rawName.startsWith('VOIDED')) return;

        const ymd = normalizeDateToYmd(bm.date || '');
        if (!ymd) return;
        if (!isAll && !ymd.startsWith(currentMonthKey)) return;

        const cost = Number(bm.totalCost) || (Number(bm.qty) * Number(bm.cost)) || 0;
        if (cost > 0) {
          restock += cost;
          restockCount += 1;
          if (bm.id) recordedRestockKeys.add(String(bm.id).toUpperCase());
          recordedRestockKeys.add(`${ymd}_${cost}`);
        }
      });
    } catch (e) {
      console.warn('Gagal memuat catatan barang masuk:', e);
    }

    // B. Ambil dari financeRecords (Buku Kas / sheet LAIN-LAIN)
    let operasional = 0;
    let operasionalCount = 0;

    financeRecords.forEach((f) => {
      const recordStatus = String((f as { status?: string }).status || '').toUpperCase();
      if (recordStatus === 'VOIDED') return;
      const descRaw = String(f.description || '').toUpperCase();
      if (descRaw.startsWith('VOIDED') || descRaw.startsWith('[VOID]')) return;

      const ymd = f.dateYmd || normalizeDateToYmd(f.date || '');
      if (!ymd) return;
      if (!isAll && !ymd.startsWith(currentMonthKey)) return;

      const amt = Number(f.amount) || 0;
      if (amt <= 0) return;

      if (f.type === 'EXPENSE') {
        const cat = String(f.category || '').toUpperCase();
        const catLabel = String(f.categoryLabel || '').toUpperCase();

        const isRestok = 
          cat === 'RESTOK_BARANG' || 
          cat === 'PEMBELIAN_STOK' || 
          catLabel.includes('RESTOK') || 
          catLabel.includes('KULAKAN') ||
          descRaw.includes('RESTOK') || 
          descRaw.includes('KULAKAN') || 
          descRaw.includes('BELANJA STOK');

        if (isRestok) {
          // Cegah double counting jika sudah terdata di barang masuk
          const fId = String(f.id || '').toUpperCase();
          const matchKey = `${ymd}_${amt}`;
          if (!recordedRestockKeys.has(fId) && !recordedRestockKeys.has(matchKey)) {
            restock += amt;
            restockCount += 1;
            recordedRestockKeys.add(fId);
            recordedRestockKeys.add(matchKey);
          }
        } else {
          operasional += amt;
          operasionalCount += 1;
        }
      }
    });

    const netCashFlow = omzet - restock - operasional;

    return {
      omzet,
      notaCount,
      restock,
      restockCount,
      operasional,
      operasionalCount,
      netCashFlow,
      periodLabel: isAll ? 'Semua Bulan' : formatMonthLabel(currentMonthKey),
    };
  }, [transactions, financeRecords, selectedMonth, activeMonthInfo]);

  // Target Omzet Progress
  const targetProgress = useMemo(() => {
    const { daysInCurMonth, isCurrentMonth } = activeMonthInfo;
    const now = new Date();
    const baseMonthlyTarget = salesTarget.targetAmount || 50000000;
    const currentDay = isCurrentMonth ? now.getDate() : daysInCurMonth;
    const effectiveDay = Math.min(daysInCurMonth, Math.max(1, currentDay + dayOffset));
    const daysRemaining = isCurrentMonth ? Math.max(1, daysInCurMonth - currentDay + 1) : 1;

    // Omset hari ini & minggu ini (7 hari terakhir)
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let todayOmset = 0;
    let weekOmset = 0;

    transactions.forEach((t) => {
      if (t.status === 'VOIDED') return;
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!ymd) return;
      const omset = Number(t.subtotal || t.total || 0);
      if (ymd === todayStr) {
        todayOmset += omset;
      }
      const tDate = new Date(ymd);
      const diffDays = (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
      if (diffDays >= 0 && diffDays <= 7) {
        weekOmset += omset;
      }
    });

    let target = baseMonthlyTarget;
    let achieved = kpiStats.omset;
    let grainLabel = 'Bulanan';

    if (targetGrain === 'HARIAN') {
      target = Math.round(baseMonthlyTarget / daysInCurMonth);
      achieved = todayOmset;
      grainLabel = 'Harian';
    } else if (targetGrain === 'MINGGUAN') {
      target = Math.round((baseMonthlyTarget / daysInCurMonth) * 7);
      achieved = weekOmset;
      grainLabel = 'Mingguan';
    } else {
      target = baseMonthlyTarget;
      achieved = kpiStats.omset;
      grainLabel = 'Bulanan';
    }

    const percent = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
    const remaining = Math.max(0, target - achieved);

    // Pace ideal untuk hari berjalan
    const idealPace = Math.round((baseMonthlyTarget / daysInCurMonth) * effectiveDay);
    const idealPacePercent = Math.min(100, Math.round((effectiveDay / daysInCurMonth) * 100));

    const remainingMonthlyOmset = Math.max(0, baseMonthlyTarget - kpiStats.omset);
    const requiredDailyRate = daysRemaining > 0 && remainingMonthlyOmset > 0 
      ? Math.ceil(remainingMonthlyOmset / daysRemaining) 
      : 0;

    let statusSentence = '';
    if (kpiStats.omset >= baseMonthlyTarget) {
      statusSentence = '🎉 Target omzet bulan ini sudah 100% tercapai! Pertahankan momentum penjualan.';
    } else if (kpiStats.omset >= idealPace) {
      statusSentence = `⚡ Performa di atas pace ideal! Butuh rata-rata ${formatRupiah(requiredDailyRate)}/hari untuk menuntaskan sisa target.`;
    } else {
      statusSentence = `⚠️ Sedikit di bawah pace ideal — butuh konsistensi ${formatRupiah(requiredDailyRate)}/hari selama ${daysRemaining} hari ke depan.`;
    }

    return {
      baseMonthlyTarget,
      target,
      achieved,
      percent,
      remaining,
      idealPace,
      idealPacePercent,
      grainLabel,
      effectiveDay,
      daysRemaining,
      requiredDailyRate,
      statusSentence,
    };
  }, [activeMonthInfo, salesTarget, kpiStats.omset, targetGrain, dayOffset, transactions]);

  // ==========================================
  // SECTION 3: ANALISIS PRODUK & REKOMENDASI RESTOCK
  // ==========================================
  // Flattened valid items
  const allFlattenedItems = useMemo(() => {
    const list: FlattenedSaleItem[] = [];

    transactions.forEach((t) => {
      const rawId = String(t.id || '').trim();
      if (rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-') || t.status === 'VOIDED') {
        return;
      }
      const dateStr = t.date || (t.transactionDate ? t.transactionDate.split(' ')[0] : 'Lainnya');
      const dateYmd = normalizeDateToYmd(t.date || t.transactionDate || '') || dateStr;
      const dateTimeStr = t.transactionDate || dateStr;
      const timeStr = dateTimeStr.includes(' ') ? dateTimeStr.split(' ')[1] : '';

      (t.items || []).forEach((item, idx) => {
        const rawSku = item.sku || t.id;
        const rawName = isNaN(Number(item.sku)) ? item.name : item.sku || item.name;
        const price = !isNaN(Number(item.name)) && Number(item.name) > 0 ? Number(item.name) : Number(item.price) || 0;
        const qty = !isNaN(Number(item.category)) && Number(item.category) > 0 ? Number(item.category) : Number(item.qty) || 1;
        const total = Number(item.total) || (price * qty);
        const cost = Number(item.cost) || 0;
        const margin = Number(item.margin) || (total - (cost * qty));
        const category = item.category && isNaN(Number(item.category)) 
          ? item.category 
          : classifyProduct(rawSku, rawName);

        list.push({
          id: `${t.id}-${idx}`,
          trxId: t.id,
          dateStr,
          dateYmd,
          dateTimeStr,
          timeStr,
          sku: rawSku,
          name: rawName,
          category,
          price,
          cost,
          qty,
          total,
          margin,
          customer: t.customerName || 'Pelanggan Umum',
          paymentMethod: t.paymentMethod || 'CASH',
          status: t.status || 'COMPLETED',
          rawReceipt: t,
        });
      });
    });

    return list;
  }, [transactions]);

  // Top Products Ranking
  const topProducts = useMemo(() => {
    const { currentMonthKey } = activeMonthInfo;
    const map = new Map<string, { sku: string; name: string; category: string; qty: number; revenue: number; margin: number }>();

    allFlattenedItems.forEach((it) => {
      if (selectedMonth !== 'ALL' && it.dateYmd && !it.dateYmd.startsWith(currentMonthKey)) return;

      const uName = String(it.name || '').toUpperCase();
      const uSku = String(it.sku || '').toUpperCase();

      // Abaikan promo dan diskon
      if (
        uName === 'PROMO 5RB' ||
        uName.includes('PROMO 5RB') ||
        uName.startsWith('PROMO:') ||
        uName.startsWith('DISKON:') ||
        uSku.includes('PROMO') ||
        it.price < 0
      ) {
        return;
      }

      const key = it.sku || it.name;
      const existing = map.get(key) || {
        sku: it.sku,
        name: it.name,
        category: it.category,
        qty: 0,
        revenue: 0,
        margin: 0,
      };

      existing.qty += it.qty;
      existing.revenue += it.total;
      existing.margin += it.margin;
      map.set(key, existing);
    });

    const list = Array.from(map.values());

    if (productRankingMetric === 'OMSET') {
      list.sort((a, b) => b.revenue - a.revenue);
    } else if (productRankingMetric === 'CUAN') {
      list.sort((a, b) => b.margin - a.margin);
    } else {
      list.sort((a, b) => b.qty - a.qty);
    }

    const top8 = list.slice(0, 8);
    const maxValue = top8.length > 0 
      ? (productRankingMetric === 'OMSET' ? top8[0].revenue : productRankingMetric === 'CUAN' ? top8[0].margin : top8[0].qty)
      : 1;

    return top8.map((p, idx) => {
      const curVal = productRankingMetric === 'OMSET' ? p.revenue : productRankingMetric === 'CUAN' ? p.margin : p.qty;
      const marginPct = p.revenue > 0 ? Math.round((p.margin / p.revenue) * 100) : 0;
      return {
        ...p,
        rank: idx + 1,
        marginPct,
        percentOfTop: maxValue > 0 ? Math.min(100, Math.round((curVal / maxValue) * 100)) : 0,
      };
    });
  }, [allFlattenedItems, activeMonthInfo, selectedMonth, productRankingMetric]);

  // Inventory & Restock Intelligence based strictly on real product & sales data
  const inventoryIntelligence = useMemo(() => {
    // Map velocity: total sold units per product in the active period
    const velocityMap = new Map<string, number>();
    allFlattenedItems.forEach((it) => {
      if (selectedMonth !== 'ALL' && it.dateYmd && !it.dateYmd.startsWith(activeMonthInfo.currentMonthKey)) return;
      const key = it.sku || it.name;
      velocityMap.set(key, (velocityMap.get(key) || 0) + it.qty);
    });

    // 1. Critical & Low Stock Products needing restock
    const criticalList: {
      product: Product;
      currentStock: number;
      soldQty: number;
      targetRestockQty: number;
      qtyToOrder: number;
      unitCost: number;
      estimatedCost: number;
      isZeroStock: boolean;
    }[] = [];

    // 2. Slow-Moving / Dead Stock: stock > 0 but sold = 0 in period
    const slowMovingList: {
      product: Product;
      currentStock: number;
      tiedCapital: number;
    }[] = [];

    let totalCriticalRestockCost = 0;
    let totalTiedDeadCapital = 0;

    products.forEach((p) => {
      const isPromo = p.category === 'Daftar Promo' || String(p.sku || '').toUpperCase().includes('PROMO') || p.price < 0;
      if (isPromo) return;

      const currentStock = Number(p.stock) || 0;
      const soldQty = velocityMap.get(p.sku) || velocityMap.get(p.name) || 0;
      const unitCost = Number(p.cost) || 0;
      const threshold = p.minStockAlert !== undefined && p.minStockAlert > 0 ? p.minStockAlert : 3;

      if (currentStock <= threshold) {
        // Suggested restock target: buffer of 12 or 1.5x sales velocity, minimal 6
        const targetRestockQty = Math.max(12, Math.round(soldQty * 1.5) || 6);
        const qtyToOrder = Math.max(1, targetRestockQty - currentStock);
        const estimatedCost = qtyToOrder * unitCost;

        if (unitCost > 0) {
          totalCriticalRestockCost += estimatedCost;
        }

        criticalList.push({
          product: p,
          currentStock,
          soldQty,
          targetRestockQty,
          qtyToOrder,
          unitCost,
          estimatedCost,
          isZeroStock: currentStock === 0,
        });
      } else if (soldQty === 0 && currentStock > 0) {
        const tiedCapital = currentStock * unitCost;
        totalTiedDeadCapital += tiedCapital;

        slowMovingList.push({
          product: p,
          currentStock,
          tiedCapital,
        });
      }
    });

    // Sort critical: zero stock first, then by sales velocity descending
    criticalList.sort((a, b) => {
      if (a.isZeroStock !== b.isZeroStock) return a.isZeroStock ? -1 : 1;
      return b.soldQty - a.soldQty;
    });

    // Sort slow-moving: highest tied capital first
    slowMovingList.sort((a, b) => b.tiedCapital - a.tiedCapital);

    return {
      criticalList: criticalList.slice(0, 6),
      totalCriticalCount: criticalList.length,
      totalCriticalRestockCost,
      slowMovingList: slowMovingList.slice(0, 6),
      totalSlowCount: slowMovingList.length,
      totalTiedDeadCapital,
    };
  }, [products, allFlattenedItems, selectedMonth, activeMonthInfo]);

  // ==========================================
  // SECTION 4: GRAFIK TREN PENJUALAN & INSIGHT
  // ==========================================
  const chartTrendData = useMemo(() => {
    const { cYear, cMonth, daysInCurMonth, currentMonthKey } = activeMonthInfo;
    const dataMap = new Map<string, { day: number; dateYmd: string; dateLabel: string; omset: number; margin: number }>();

    if (selectedMonth !== 'ALL') {
      for (let day = 1; day <= daysInCurMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(cMonth).padStart(2, '0');
        const ymd = `${cYear}-${monthStr}-${dayStr}`;
        dataMap.set(ymd, {
          day,
          dateYmd: ymd,
          dateLabel: `${dayStr}/${monthStr}`,
          omset: 0,
          margin: 0,
        });
      }
    } else {
      // Last 14 days
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        dataMap.set(ymd, {
          day: 14 - i,
          dateYmd: ymd,
          dateLabel: label,
          omset: 0,
          margin: 0,
        });
      }
    }

    transactions.forEach((t) => {
      if (t.status === 'VOIDED') return;
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!ymd) return;

      if (selectedMonth !== 'ALL' && !ymd.startsWith(currentMonthKey)) return;

      const item = dataMap.get(ymd);
      if (item) {
        item.omset += Number(t.subtotal || t.total || 0);
        item.margin += Number(t.margin || 0);
      } else if (selectedMonth === 'ALL') {
        const dParts = ymd.split('-');
        const label = `${dParts[2]}/${dParts[1]}`;
        dataMap.set(ymd, {
          day: parseInt(dParts[2], 10) || 1,
          dateYmd: ymd,
          dateLabel: label,
          omset: Number(t.subtotal || t.total || 0),
          margin: Number(t.margin || 0),
        });
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));
  }, [transactions, activeMonthInfo, selectedMonth]);

  // Insights: Hari terbaik, jam teramai, metode bayar
  const operationalInsights = useMemo(() => {
    const { currentMonthKey } = activeMonthInfo;
    const dayMap = new Map<string, { omset: number; margin: number; count: number }>();
    const hourMap = new Map<number, { omset: number; count: number }>();
    const paymentMap: Record<string, { total: number; count: number }> = {
      CASH: { total: 0, count: 0 },
      QRIS: { total: 0, count: 0 },
      TRANSFER: { total: 0, count: 0 },
    };

    transactions.forEach((t) => {
      if (t.status === 'VOIDED') return;
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!ymd) return;
      if (selectedMonth !== 'ALL' && !ymd.startsWith(currentMonthKey)) return;

      const omset = Number(t.subtotal || t.total || 0);
      const cuan = Number(t.margin || 0);

      // Hari
      const dayData = dayMap.get(ymd) || { omset: 0, margin: 0, count: 0 };
      dayData.omset += omset;
      dayData.margin += cuan;
      dayData.count += 1;
      dayMap.set(ymd, dayData);

      // Jam
      const dateTimeStr = t.transactionDate || '';
      if (dateTimeStr.includes(' ')) {
        const timePart = dateTimeStr.split(' ')[1];
        const hh = parseInt(timePart.split(':')[0], 10);
        if (!isNaN(hh) && hh >= 0 && hh <= 23) {
          const hData = hourMap.get(hh) || { omset: 0, count: 0 };
          hData.omset += omset;
          hData.count += 1;
          hourMap.set(hh, hData);
        }
      }

      // Metode bayar
      const pm = (t.paymentMethod || 'CASH').toUpperCase();
      if (!paymentMap[pm]) {
        paymentMap[pm] = { total: 0, count: 0 };
      }
      paymentMap[pm].total += omset;
      paymentMap[pm].count += 1;
    });

    let bestDayYmd = '';
    let bestDayOmset = 0;
    dayMap.forEach((val, ymd) => {
      if (val.omset > bestDayOmset) {
        bestDayOmset = val.omset;
        bestDayYmd = ymd;
      }
    });

    let bestDayFormatted = '-';
    if (bestDayYmd) {
      const [y, m, d] = bestDayYmd.split('-').map(Number);
      const dObj = new Date(y, m - 1, d);
      bestDayFormatted = dObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
    }

    let peakHour = -1;
    let peakHourCount = 0;
    hourMap.forEach((val, hh) => {
      if (val.count > peakHourCount) {
        peakHourCount = val.count;
        peakHour = hh;
      }
    });

    const peakHourFormatted = peakHour >= 0 
      ? `${String(peakHour).padStart(2, '0')}:00 - ${String(peakHour + 1).padStart(2, '0')}:00`
      : 'Belum terdata';

    const totalPaymentOmset = Object.values(paymentMap).reduce((acc, curr) => acc + curr.total, 0);
    const paymentList = Object.entries(paymentMap).map(([method, data]) => {
      const pct = totalPaymentOmset > 0 ? Math.round((data.total / totalPaymentOmset) * 100) : 0;
      return {
        method,
        total: data.total,
        count: data.count,
        percent: pct,
      };
    }).sort((a, b) => b.total - a.total);

    return {
      bestDayFormatted,
      bestDayOmset,
      peakHourFormatted,
      peakHourCount,
      paymentList,
    };
  }, [transactions, activeMonthInfo, selectedMonth]);

  // ==========================================
  // SECTION 5: RIWAYAT NOTA & LOG PENJUALAN
  // ==========================================
  const filteredLogItems = useMemo(() => {
    return allFlattenedItems.filter((item) => {
      if (selectedMonth !== 'ALL' && item.dateYmd && !item.dateYmd.startsWith(selectedMonth)) {
        return false;
      }

      if (logStatusFilter === 'COMPLETED' && item.status === 'VOIDED') return false;
      if (logStatusFilter === 'VOIDED' && item.status !== 'VOIDED') return false;

      if (logPaymentFilter !== 'ALL' && item.paymentMethod.toUpperCase() !== logPaymentFilter) {
        return false;
      }

      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchTrxId = item.trxId.toLowerCase().includes(q);
        const matchCustomer = item.customer.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchTrxId && !matchCustomer) return false;
      }

      return true;
    });
  }, [allFlattenedItems, selectedMonth, logStatusFilter, logPaymentFilter, logSearchQuery]);

  // Date groups for log view
  const dateGroups = useMemo(() => {
    const groupsMap = new Map<string, DateSalesGroup>();

    filteredLogItems.forEach((item) => {
      const dateKey = item.dateYmd || item.dateStr;
      let existing = groupsMap.get(dateKey);

      if (!existing) {
        let displayStr = item.dateStr;
        if (item.dateYmd && item.dateYmd.length >= 10) {
          const [y, m, d] = item.dateYmd.split('-').map(Number);
          const dt = new Date(y, m - 1, d);
          displayStr = dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }

        existing = {
          dateKey,
          dateDisplay: displayStr,
          dateYmd: item.dateYmd,
          totalOmset: 0,
          totalHPP: 0,
          totalMargin: 0,
          totalQty: 0,
          itemCount: 0,
          paymentMethods: {},
          items: [],
          rawReceipt: item.rawReceipt,
        };
        groupsMap.set(dateKey, existing);
      }

      existing.totalOmset += item.total;
      existing.totalHPP += (item.cost * item.qty);
      existing.totalMargin += item.margin;
      existing.totalQty += item.qty;
      existing.itemCount += 1;

      const pm = item.paymentMethod || 'CASH';
      existing.paymentMethods[pm] = (existing.paymentMethods[pm] || 0) + item.total;
      existing.items.push(item);
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredLogItems]);

  const visibleFlatLogItems = useMemo(() => {
    return filteredLogItems.slice(0, logVisibleCount);
  }, [filteredLogItems, logVisibleCount]);

  const visibleDateGroups = useMemo(() => {
    let remaining = logVisibleCount;
    const result: { group: DateSalesGroup; visibleItems: FlattenedSaleItem[] }[] = [];
    for (const group of dateGroups) {
      if (remaining <= 0) break;
      const slice = group.items.slice(0, remaining);
      result.push({ group, visibleItems: slice });
      remaining -= slice.length;
    }
    return result;
  }, [dateGroups, logVisibleCount]);

  const displayedByDateCount = useMemo(() => {
    return visibleDateGroups.reduce((sum, entry) => sum + entry.visibleItems.length, 0);
  }, [visibleDateGroups]);

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const handleExportCSV = () => {
    if (filteredLogItems.length === 0) {
      showToast?.('Tidak ada data nota untuk diekspor.', 'error');
      return;
    }

    const headers = ['Nota_ID', 'Tanggal_Waktu', 'SKU', 'Nama_Produk', 'Kategori', 'Harga_Jual', 'Qty', 'Total_Omset', 'Margin_Cuan', 'Pelanggan', 'Metode_Bayar'];
    const rows = filteredLogItems.map((it) => [
      `"${it.trxId}"`,
      `"${it.dateTimeStr || it.dateStr}"`,
      `"${it.sku}"`,
      `"${it.name.replace(/"/g, '""')}"`,
      `"${it.category}"`,
      it.price,
      it.qty,
      it.total,
      it.margin,
      `"${it.customer}"`,
      it.paymentMethod,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Penjualan_ORTUKILL_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Top Header & Executive Navigation Anchors */}
      <div className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Laporan Keuangan &amp; Business Intelligence
            </span>
            <span className="text-slate-500 dark:text-zinc-400 text-xs font-medium">• ORTUKILL POS</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight mt-1.5">
            Pusat Keputusan Bisnis &amp; Laporan Keuangan
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Evaluasi ringkas kinerja omzet, cuan bersih penjualan, stok kritis, dan buku kas.
          </p>
        </div>

        {/* Quick Section Anchor Jump Links */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
          <a
            href="#sec-report-wa"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-[#343440] min-h-[38px]"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Report WA</span>
          </a>
          <a
            href="#sec-arus-kas-bersih"
            className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-500/35 min-h-[38px]"
          >
            <CircleDollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Arus Kas Bersih</span>
          </a>
          <a
            href="#sec-kinerja"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-[#343440] min-h-[38px]"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
            <span>Kinerja &amp; Target</span>
          </a>
          <a
            href="#sec-produk-restok"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-[#343440] min-h-[38px]"
          >
            <Boxes className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Produk &amp; Restock</span>
          </a>
          <a
            href="#sec-tren"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-[#343440] min-h-[38px]"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
            <span>Grafik Tren</span>
          </a>
          <a
            href="#sec-riwayat-nota"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-[#343440] min-h-[38px]"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
            <span>Riwayat Nota</span>
          </a>
          <a
            href="#sec-arus-kas"
            className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] hover:bg-blue-100 dark:hover:bg-purple-500/25 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-blue-200 dark:border-purple-500/35 min-h-[38px]"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Buku Kas</span>
          </a>
        </div>
      </div>

      {/* Global Month & Time Filter Toolbar */}
      <div className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 border border-slate-200 dark:border-[#2B2B33] flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] bg-slate-50 dark:bg-[#24242B] px-3 py-2 rounded-xl border border-slate-200 dark:border-[#343440]">
            <Calendar className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC]" />
            <span>Filter Periode Analisis:</span>
          </div>

          {/* Quick Target Grain (Harian, Mingguan, Bulanan) */}
          <div className="flex items-center bg-slate-100 dark:bg-[#24242B] p-1 rounded-xl border border-slate-200 dark:border-[#343440]">
            <button
              onClick={() => setTargetGrain('HARIAN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                targetGrain === 'HARIAN'
                  ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => setTargetGrain('MINGGUAN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                targetGrain === 'MINGGUAN'
                  ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Mingguan
            </button>
            <button
              onClick={() => setTargetGrain('BULANAN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                targetGrain === 'BULANAN'
                  ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Bulanan
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-[#343440] mx-1 hidden sm:block" />

          {/* Quick Month Filter Buttons */}
          <button
            onClick={() => {
              setSelectedMonth('ALL');
              setTargetGrain('BULANAN');
            }}
            className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              selectedMonth === 'ALL'
                ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#2E2E37]'
            }`}
          >
            Semua Bulan
          </button>

          {(() => {
            const now = new Date();
            const curStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            return (
              <button
                onClick={() => {
                  setSelectedMonth(curStr);
                  setTargetGrain('BULANAN');
                }}
                className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  selectedMonth === curStr
                    ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#2E2E37]'
                }`}
              >
                Bulan Ini ({formatMonthLabel(curStr)})
              </button>
            );
          })()}

          {/* Dropdown for specific month selection */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setTargetGrain('BULANAN');
              }}
              className="appearance-none bg-slate-50 dark:bg-[#24242B] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold pl-3.5 pr-8 py-2 rounded-full border border-slate-200 dark:border-[#343440] hover:border-[#2563EB] dark:hover:border-[#A855F7] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] cursor-pointer min-h-[38px] [color-scheme:light] dark:[color-scheme:dark]"
            >
              <option value="ALL" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">Pilih Bulan Lain...</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym} className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">
                  {formatMonthLabel(ym)} ({ym})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Active Month Indicator */}
        {selectedMonth !== 'ALL' && (
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <span className="text-xs font-bold bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] px-3 py-1 rounded-full border border-blue-200 dark:border-purple-500/35 flex items-center gap-1.5">
              <span>Periode Aktif: <strong>{formatMonthLabel(selectedMonth)}</strong></span>
            </span>
            <button
              onClick={() => setSelectedMonth('ALL')}
              className="text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white underline cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. REPORT HARIAN WHATSAPP (Sesuai Aturan Mutlak)          */}
      {/* ========================================================= */}
      <section id="sec-report-wa" className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-[#2B2B33] space-y-4 transition-colors">
        {/* Header Kartu: Judul di kiri & Pilihan Tanggal di sebelah kanan judul */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 pb-4 border-b border-slate-200 dark:border-[#2B2B33]">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-200 dark:border-emerald-500/35">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight">
                  Report Harian (Teks &amp; WA)
                </h3>
                <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/35">
                  Formula Sheets
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Format teks rekap botol, omset, dan cuan siap kirim ke WhatsApp / Catatan.
              </p>
            </div>
          </div>

          {/* Pilihan Tanggal di Sebelah Judul Kartu & Tombol Aksi */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* Navigasi Cepat Tanggal: <, Picker, > */}
            <div className="flex items-center bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl p-1 gap-1 min-h-[44px]">
              <button
                type="button"
                onClick={() => handleShiftReportDate(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-white hover:bg-white dark:hover:bg-[#2E2E37] transition-colors cursor-pointer text-xs font-bold"
                title="Hari Sebelumnya"
              >
                ◀
              </button>

              <div className="relative flex items-center">
                <input
                  type="date"
                  value={selectedReportDate}
                  onChange={(e) => e.target.value && setSelectedReportDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] px-2 py-1 focus:outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  title="Pilih tanggal report"
                />
              </div>

              <button
                type="button"
                onClick={() => handleShiftReportDate(1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-white hover:bg-white dark:hover:bg-[#2E2E37] transition-colors cursor-pointer text-xs font-bold"
                title="Hari Berikutnya"
              >
                ▶
              </button>
            </div>

            {/* Tombol Cepat: Hari Ini */}
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                setSelectedReportDate(`${y}-${m}-${d}`);
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#24242B] hover:bg-slate-200 dark:hover:bg-[#2E2E37] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors cursor-pointer min-h-[44px] border border-slate-200 dark:border-[#343440]"
            >
              Hari Ini
            </button>

            {/* Tombol Text (Toggle Tampilkan / Sembunyikan Teks) */}
            <button
              type="button"
              onClick={() => setShowReportText((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer min-h-[44px] ${
                showReportText
                  ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white border-[#0F172A] dark:border-[#A855F7]'
                  : 'bg-slate-50 dark:bg-[#24242B] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white border-slate-200 dark:border-[#343440] hover:bg-slate-100 dark:hover:bg-[#2E2E37]'
              }`}
              title="Tampilkan / Sembunyikan preview teks report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showReportText ? 'Tutup Teks' : 'Lihat Teks'}</span>
            </button>

            {/* Tombol Copy Text */}
            <button
              type="button"
              onClick={handleCopyReportText}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[44px] ${
                isCopiedReport
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white'
              }`}
              title="Salin isi teks report ke clipboard"
            >
              {isCopiedReport ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin Teks</span>
                </>
              )}
            </button>

            {/* Tombol Kirim WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(dailyReportData.fullReportText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer min-h-[44px]"
              title="Kirim langsung teks report ke WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        {/* 3 Metric Summary: QTY BTL, OMSET, CUAN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-slate-50 dark:bg-[#24242B] p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              QTY BTL (Total Botol Fisik)
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5 tabular-nums font-mono">
              {dailyReportData.totalBtl} <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Btl</span>
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#24242B] p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              OMSET
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5 tabular-nums font-mono">
              Rp {new Intl.NumberFormat('en-US').format(Math.round(dailyReportData.totalOmset))}
            </p>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-500/15 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-500/35">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              CUAN (Margin Kotor)
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums font-mono">
              Rp {new Intl.NumberFormat('en-US').format(Math.round(dailyReportData.totalMargin))}
            </p>
          </div>
        </div>

        {/* Text Preview Box */}
        {showReportText && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-300 px-1">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Format teks siap kirim ({dailyReportData.formattedDateHeader}):
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 tabular-nums">
                {dailyReportData.itemCount} jenis produk • {dailyReportData.trxCount} nota
              </span>
            </div>

            <div className="relative group">
              <pre className="w-full p-4 pr-14 bg-slate-50 dark:bg-[#121215] text-[#0F172A] dark:text-[#F4F4F6] rounded-2xl text-xs sm:text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre select-all border border-slate-200 dark:border-[#343440] max-h-72">
                {dailyReportData.fullReportText}
              </pre>

              <button
                type="button"
                onClick={handleCopyReportText}
                className="absolute top-3 right-3 bg-white dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 p-2 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-[#343440] min-h-[40px] min-w-[40px] flex items-center justify-center shadow-xs"
                title="Salin Teks"
              >
                {isCopiedReport ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* DIV BARU KHUSUS: ARUS KAS BERSIH (4 CARD RINGKAS)         */}
      {/* OMZET − RESTOCK − PENGELUARAN = ARUS KAS BERSIH           */}
      {/* ========================================================= */}
      <section id="sec-arus-kas-bersih" className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-[#2B2B33] space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33]">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-200 dark:border-emerald-500/35 flex-shrink-0">
              <CircleDollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight">
                  Arus Kas Bersih (Net Cash Flow)
                </h3>
                <span className="bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-[#343440]">
                  OMZET − RESTOCK − PENGELUARAN = ARUS KAS BERSIH
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Likuiditas kas masuk riil dikurangi belanja restok barang dan biaya operasional pada periode terpilih.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono font-bold bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] px-3 py-1 rounded-xl border border-blue-200 dark:border-purple-500/35 whitespace-nowrap">
              Periode: <strong>{cashFlowMetrics.periodLabel}</strong>
            </span>
          </div>
        </div>

        {/* 4 Cards Ringkas: OMZET − RESTOCK − PENGELUARAN = ARUS KAS BERSIH */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* CARD 1: OMZET */}
          <div className="bg-slate-50 dark:bg-[#24242B] rounded-2xl p-4 border border-slate-200 dark:border-[#343440] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#A855F7]" />
                Omzet
              </span>
              <span className="text-[10px] font-bold text-[#2563EB] dark:text-[#C084FC] bg-blue-50 dark:bg-purple-500/15 px-2 py-0.5 rounded-md border border-blue-200 dark:border-purple-500/35">
                Total Penjualan
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
                {formatRupiah(cashFlowMetrics.omzet)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                {cashFlowMetrics.notaCount} transaksi kasir tercatat
              </p>
            </div>
          </div>

          {/* CARD 2: RESTOCK */}
          <div className="bg-slate-50 dark:bg-[#24242B] rounded-2xl p-4 border border-slate-200 dark:border-[#343440] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#A855F7]" />
                Restock
              </span>
              <span className="text-[10px] font-bold text-[#2563EB] dark:text-[#C084FC] bg-blue-50 dark:bg-purple-500/15 px-2 py-0.5 rounded-md border border-blue-200 dark:border-purple-500/35">
                − Pembelian Stok
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
                {formatRupiah(cashFlowMetrics.restock)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                {cashFlowMetrics.restockCount} pengadaan stok barang
              </p>
            </div>
          </div>

          {/* CARD 3: PENGELUARAN */}
          <div className="bg-slate-50 dark:bg-[#24242B] rounded-2xl p-4 border border-slate-200 dark:border-[#343440] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                Pengeluaran
              </span>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/35">
                − Beban Operasional
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
                {formatRupiah(cashFlowMetrics.operasional)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                {cashFlowMetrics.operasionalCount} biaya selain restock
              </p>
            </div>
          </div>

          {/* CARD 4: ARUS KAS BERSIH */}
          <div className={`rounded-2xl p-4 border flex flex-col justify-between ${
            cashFlowMetrics.netCashFlow >= 0
              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-400'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#0F172A] dark:text-[#F4F4F6]">
                <span className={`w-2 h-2 rounded-full ${cashFlowMetrics.netCashFlow >= 0 ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-red-600 dark:bg-red-400'}`} />
                Arus Kas Bersih
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                cashFlowMetrics.netCashFlow >= 0
                  ? 'bg-white dark:bg-[#1B1B20] border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400'
                  : 'bg-white dark:bg-[#1B1B20] border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-400'
              }`}>
                {cashFlowMetrics.netCashFlow >= 0 ? 'Surplus (+)' : 'Defisit (−)'}
              </span>
            </div>
            <div className="mt-3">
              <p className={`text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums font-mono ${
                cashFlowMetrics.netCashFlow >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
              }`}>
                {cashFlowMetrics.netCashFlow >= 0 ? '+' : ''}{formatRupiah(cashFlowMetrics.netCashFlow)}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5 font-medium">
                Omzet − Restock − Pengeluaran
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. RINGKASAN KINERJA USAHA & PERBANDINGAN PERIODE (MoM)   */}
      {/* ========================================================= */}
      <section id="sec-kinerja" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35 flex items-center justify-center font-bold flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight">
                Ringkasan Kinerja Usaha
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Metrik inti &amp; perbandingan adil dengan periode setara (tgl 1 s/d {activeMonthInfo.N})
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditingTarget(true)}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#2563EB] dark:text-[#C084FC] hover:text-white dark:hover:text-white bg-blue-50 dark:bg-purple-500/15 hover:bg-[#2563EB] dark:hover:bg-[#9333EA] px-3.5 py-2 rounded-xl border border-blue-200 dark:border-purple-500/35 cursor-pointer transition-colors min-h-[44px] w-full sm:w-auto"
          >
            <Target className="w-3.5 h-3.5" />
            <span className="tabular-nums font-mono">Target: {formatRupiah(salesTarget.targetAmount || 50000000)}</span>
          </button>
        </div>

        {/* 5 Kartu Metrik Utama */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* KPI 1: Omzet Penjualan */}
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] flex flex-col justify-between transition-colors">
            <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-zinc-400 text-[11px] font-bold">
              <span className="uppercase tracking-wider">Omzet Penjualan</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 tabular-nums ${
                kpiStats.deltaOmset >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400'
              }`}>
                {kpiStats.deltaOmset >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpiStats.deltaOmset >= 0 ? `+${kpiStats.deltaOmset}%` : `${kpiStats.deltaOmset}%`}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
                {formatRupiah(kpiStats.omset)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate tabular-nums" title={`Lalu (1..${kpiStats.N}): ${formatRupiah(kpiStats.prevOmset_N)}`}>
                vs Bln Lalu (1..{kpiStats.N}): {formatRupiah(kpiStats.prevOmset_N)}
              </p>
            </div>
          </div>

          {/* KPI 2: Cuan (Margin Kotor) */}
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] flex flex-col justify-between transition-colors">
            <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-zinc-400 text-[11px] font-bold">
              <span className="uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Margin Kotor (Cuan)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 tabular-nums ${
                kpiStats.deltaCuan >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400'
              }`}>
                {kpiStats.deltaCuan >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpiStats.deltaCuan >= 0 ? `+${kpiStats.deltaCuan}%` : `${kpiStats.deltaCuan}%`}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums font-mono">
                {formatRupiah(kpiStats.cuan)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate tabular-nums" title={`Lalu (1..${kpiStats.N}): ${formatRupiah(kpiStats.prevCuan_N)}`}>
                vs Bln Lalu: {formatRupiah(kpiStats.prevCuan_N)}
              </p>
            </div>
          </div>

          {/* KPI 3: Persentase Margin Keuntungan */}
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] flex flex-col justify-between transition-colors">
            <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-zinc-400 text-[11px] font-bold">
              <span className="uppercase tracking-wider">Margin Profit %</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 tabular-nums ${
                kpiStats.deltaMargin >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400'
              }`}>
                {kpiStats.deltaMargin >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpiStats.deltaMargin >= 0 ? `+${kpiStats.deltaMargin}%` : `${kpiStats.deltaMargin}%`}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
                {kpiStats.marginPct}%
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Rasio Laba Kotor Penjualan
              </p>
            </div>
          </div>

          {/* KPI 4: Total Nota Penjualan */}
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] flex flex-col justify-between transition-colors">
            <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-zinc-400 text-[11px] font-bold">
              <span className="uppercase tracking-wider">Total Nota</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 tabular-nums ${
                kpiStats.deltaNota >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400'
              }`}>
                {kpiStats.deltaNota >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpiStats.deltaNota >= 0 ? `+${kpiStats.deltaNota}%` : `${kpiStats.deltaNota}%`}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
                {kpiStats.nota} <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Nota</span>
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate tabular-nums">
                vs Bln Lalu: {kpiStats.prevNota_N} Nota
              </p>
            </div>
          </div>

          {/* KPI 5: Botol Fisik Terjual */}
          <div className="col-span-2 lg:col-span-1 bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] flex flex-col justify-between transition-colors">
            <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-zinc-400 text-[11px] font-bold">
              <span className="uppercase tracking-wider">Botol Terjual</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 tabular-nums ${
                kpiStats.deltaBotol >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400'
              }`}>
                {kpiStats.deltaBotol >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpiStats.deltaBotol >= 0 ? `+${kpiStats.deltaBotol}%` : `${kpiStats.deltaBotol}%`}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight tabular-nums font-mono">
                {kpiStats.botol} <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Btl</span>
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                Exclude promo &amp; diskon
              </p>
            </div>
          </div>
        </div>

        {/* Target Progress Card */}
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-3 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Target className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC]" />
                <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">
                  Perkembangan Target Omzet ({targetProgress.grainLabel})
                </h4>
                <span className="bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 dark:border-[#343440]">
                  Hari ke-{targetProgress.effectiveDay}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">
                {targetProgress.statusSentence}
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Tercapai / Target:</p>
              <p className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">
                {formatRupiah(targetProgress.achieved)} <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">/ {formatRupiah(targetProgress.target)}</span>
              </p>
            </div>
          </div>

          {/* Progress Bar with Ideal Pace Marker */}
          <div className="space-y-1.5 pt-1">
            <div className="relative w-full h-3.5 bg-slate-100 dark:bg-[#24242B] rounded-full overflow-hidden border border-slate-200 dark:border-[#343440]">
              <div
                className="h-full bg-[#2563EB] dark:bg-[#A855F7] transition-[width] duration-500 rounded-full"
                style={{ width: `${Math.min(100, targetProgress.percent)}%` }}
              />
              {/* Ideal Pace Marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-[#0F172A]/70 dark:bg-white/80 z-10"
                style={{ left: `${targetProgress.idealPacePercent}%` }}
                title={`Pace ideal hari ke-${targetProgress.effectiveDay}: ${targetProgress.idealPacePercent}%`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-zinc-300">
              <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums">{targetProgress.percent}% Tercapai</span>
              <span className="text-slate-500 dark:text-zinc-400 tabular-nums">Pace Ideal: {targetProgress.idealPacePercent}%</span>
              <span>Sisa Target: <strong className="text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(targetProgress.remaining)}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. ANALISIS PRODUK & REKOMENDASI RESTOCK                  */}
      {/* ========================================================= */}
      <section id="sec-produk-restok" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35 flex items-center justify-center font-bold flex-shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight">
                Analisis Produk &amp; Rekomendasi Restock
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Peringatan stok habis/kritis dengan estimasi modal dan identifikasi produk macet
              </p>
            </div>
          </div>

          {/* Metric Selector for Top Products: QTY | CUAN | OMSET */}
          <div className="flex items-center bg-white dark:bg-[#1B1B20] p-1 rounded-full border border-slate-200 dark:border-[#343440] self-start sm:self-auto overflow-x-auto max-w-full no-scrollbar">
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 px-2.5 uppercase whitespace-nowrap">Urutkan:</span>
            <button
              onClick={() => setProductRankingMetric('QTY')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                productRankingMetric === 'QTY' ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Terlaris (Botol)
            </button>
            <button
              onClick={() => setProductRankingMetric('CUAN')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                productRankingMetric === 'CUAN' ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Cuan Tertinggi
            </button>
            <button
              onClick={() => setProductRankingMetric('OMSET')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                productRankingMetric === 'OMSET' ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Omzet
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sub-Card 1: Top 8 Produk Terlaris & Margin % */}
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-3.5 transition-colors">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-[#2B2B33]">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">
                  Top Produk Berkontribusi ({productRankingMetric === 'QTY' ? 'Volume Botol' : productRankingMetric === 'CUAN' ? 'Cuan Tertinggi' : 'Omzet Tertinggi'})
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 whitespace-nowrap">Exclude Promo 5rb</span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                Belum ada data penjualan produk pada periode ini.
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p) => (
                  <div key={p.sku || p.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${
                          p.rank === 1 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' : p.rank === 2 ? 'bg-blue-100 dark:bg-purple-500/20 text-[#2563EB] dark:text-[#C084FC]' : 'bg-slate-100 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300'
                        }`}>
                          {p.rank}
                        </span>
                        <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono hidden sm:inline">({p.category})</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-right">
                        <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums">{p.qty} Btl</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] tabular-nums font-mono">+{formatRupiah(p.margin)}</span>
                        <span className="bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums border border-slate-200 dark:border-[#343440]">
                          {p.marginPct}%
                        </span>
                      </div>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-[#24242B] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2563EB] dark:bg-[#A855F7] rounded-full transition-[width]"
                        style={{ width: `${p.percentOfTop}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-Card 2: Rekomendasi Restock Kritis & Dead Stock */}
          <div className="space-y-4">
            {/* Urgent Restock Box */}
            <div className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-[#2B2B33]">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">
                    Rekomendasi Restock Kritis ({inventoryIntelligence.totalCriticalCount} Produk)
                  </h4>
                </div>
                {inventoryIntelligence.totalCriticalRestockCost > 0 && (
                  <span className="text-[11px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/15 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-500/35 tabular-nums font-mono">
                    Est. Modal: {formatRupiah(inventoryIntelligence.totalCriticalRestockCost)}
                  </span>
                )}
              </div>

              {inventoryIntelligence.criticalList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-600 dark:text-zinc-300 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Stok aman, tidak ada produk dengan stok kritis saat ini.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {inventoryIntelligence.criticalList.map((item) => (
                    <div
                      key={item.product.id || item.product.sku}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.isZeroStock ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35' : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
                          }`}>
                            {item.isZeroStock ? 'Habis (0)' : `Sisa ${item.currentStock}`}
                          </span>
                          <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">{item.product.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                          Terjual: <strong className="text-[#0F172A] dark:text-[#F4F4F6]">{item.soldQty} btl</strong> di periode ini • Sarana Order: <strong className="text-[#0F172A] dark:text-[#F4F4F6]">{item.qtyToOrder} btl</strong>
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {item.unitCost > 0 ? (
                          <>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400">Modal Butuh:</p>
                            <p className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(item.estimatedCost)}</p>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 italic">Harga beli kosong</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Slow Moving / Dead Stock Alert */}
            <div className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-[#2B2B33]">
                <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">
                  <Clock className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC]" />
                  <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">
                    Produk Macet / 0 Penjualan ({inventoryIntelligence.totalSlowCount} Produk)
                  </h4>
                </div>
                {inventoryIntelligence.totalTiedDeadCapital > 0 && (
                  <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-[#24242B] px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-[#343440] tabular-nums font-mono">
                    Modal Tertahan: {formatRupiah(inventoryIntelligence.totalTiedDeadCapital)}
                  </span>
                )}
              </div>

              {inventoryIntelligence.slowMovingList.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 dark:text-zinc-400">
                  Semua stok produk bergerak aktif pada periode ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {inventoryIntelligence.slowMovingList.map((item) => (
                    <div key={item.product.id || item.product.sku} className="p-3 rounded-xl bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440]">
                      <p className="font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">{item.product.name}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                        <span>Stok: <strong className="text-[#0F172A] dark:text-[#F4F4F6]">{item.currentStock} btl</strong></span>
                        <span className="font-mono font-bold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums">{formatRupiah(item.tiedCapital)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. GRAFIK TREN PENJUALAN & INSIGHT OPERASIONAL           */}
      {/* ========================================================= */}
      <section id="sec-tren" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35 flex items-center justify-center font-bold flex-shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight">
                Tren Penjualan Harian &amp; Insight Operasional
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Visualisasi dinamika omzet harian terhadap margin kotor dan ritme toko
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Chart: Bar Omzet + Line Cuan */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F4F4F6]">
                  <span className="w-3 h-3 rounded-xs bg-[#2563EB] dark:bg-[#A855F7]" />
                  Omzet Penjualan
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  Margin Cuan
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                {selectedMonth !== 'ALL' ? formatMonthLabel(selectedMonth) : '14 Hari Terakhir'}
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#2B2B33' : '#E2E8F0'} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: isDarkMode ? '#A1A1AA' : '#64748B' }} stroke={isDarkMode ? '#343440' : '#CBD5E1'} />
                  <YAxis tickFormatter={formatAxisRbJt} tick={{ fontSize: 10, fill: isDarkMode ? '#A1A1AA' : '#64748B' }} stroke={isDarkMode ? '#343440' : '#CBD5E1'} />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      formatRupiah(Number(value) || 0),
                      name === 'omset' ? 'Omzet' : 'Cuan'
                    ]}
                    labelFormatter={(label) => `Tanggal: ${label}`}
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1B1B20' : '#FFFFFF',
                      borderRadius: '12px',
                      border: isDarkMode ? '1px solid #343440' : '1px solid #E2E8F0',
                      color: isDarkMode ? '#F4F4F6' : '#0F172A',
                      fontSize: '11px',
                      boxShadow: isDarkMode ? '0 8px 24px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Bar dataKey="omset" fill={isDarkMode ? '#A855F7' : '#2563EB'} radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Line type="monotone" dataKey="margin" stroke="#10B981" strokeWidth={2.5} dot={{ r: 2.5, fill: '#10B981' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operational Insights Card: Hari Terbaik, Jam Teramai, Metode Bayar */}
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] pb-2.5 border-b border-slate-200 dark:border-[#2B2B33] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Ritme Toko &amp; Pembayaran</span>
              </h4>

              <div className="space-y-3 mt-3 text-xs">
                <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-2xl border border-slate-200 dark:border-[#343440] flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400">Hari Omzet Terbaik</p>
                    <p className="text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5">{operationalInsights.bestDayFormatted}</p>
                  </div>
                  <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">{formatRupiah(operationalInsights.bestDayOmset)}</p>
                </div>

                <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-2xl border border-slate-200 dark:border-[#343440] flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400">Jam Paling Ramai</p>
                    <p className="text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-0.5">{operationalInsights.peakHourFormatted}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] px-2.5 py-1 rounded-full border border-blue-200 dark:border-purple-500/35 tabular-nums">
                    {operationalInsights.peakHourCount} Transaksi
                  </span>
                </div>
              </div>
            </div>

            {/* Metode Bayar Breakdown */}
            <div className="space-y-2 pt-2.5 border-t border-slate-200 dark:border-[#2B2B33]">
              <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 tracking-wider">Distribusi Pembayaran</p>
              <div className="space-y-2">
                {operationalInsights.paymentList.map((pm) => (
                  <div key={pm.method} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#0F172A] dark:text-[#F4F4F6]">
                      <span>{pm.method}</span>
                      <span className="tabular-nums font-mono">{formatRupiah(pm.total)} <span className="text-slate-500 dark:text-zinc-400 font-normal">({pm.percent}%)</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-[#121215] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pm.method === 'CASH' ? 'bg-amber-500' : pm.method === 'QRIS' ? 'bg-emerald-500' : 'bg-[#2563EB] dark:bg-[#A855F7]'
                        }`}
                        style={{ width: `${pm.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. RIWAYAT NOTA & EKSPOR (Ringkas & Collapsible)         */}
      {/* ========================================================= */}
      <section id="sec-riwayat-nota" className="bg-white dark:bg-[#1B1B20] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2B2B33]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] flex items-center justify-center font-bold border border-blue-200 dark:border-purple-500/35 flex-shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight">
                  Riwayat Nota &amp; Log Penjualan
                </h3>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                  ({filteredLogItems.length} baris)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Audit transaksi kasir, cetak ulang nota, atau ekspor ke file spreadsheet CSV.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors cursor-pointer min-h-[44px] border border-slate-200 dark:border-[#343440]"
              title="Unduh data penjualan format CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
              <span>Ekspor CSV</span>
            </button>

            <button
              onClick={() => setIsLogCollapsed((prev) => !prev)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#343440] bg-slate-50 dark:bg-[#24242B] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
            >
              {isLogCollapsed ? 'Tampilkan Tabel' : 'Sembunyikan Tabel'}
            </button>
          </div>
        </div>

        {!isLogCollapsed && (
          <div className="space-y-3">
            {/* Filter controls bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari SKU, Nama Produk, Nota ID, Pelanggan..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-medium text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-[#1B1B20] focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Metode bayar filter */}
                <select
                  value={logPaymentFilter}
                  onChange={(e) => setLogPaymentFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-[#24242B] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-[#343440] cursor-pointer min-h-[44px] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">Semua Pembayaran</option>
                  <option value="CASH" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">CASH</option>
                  <option value="QRIS" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">QRIS</option>
                  <option value="TRANSFER" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">TRANSFER</option>
                </select>

                {/* View Mode toggle (Group by date vs flat) */}
                <div className="flex items-center bg-slate-100 dark:bg-[#121215] p-1 rounded-xl border border-slate-200 dark:border-[#2B2B33]">
                  <button
                    onClick={() => setLogViewMode('BY_DATE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      logViewMode === 'BY_DATE' ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6]'
                    }`}
                  >
                    Per Tanggal
                  </button>
                  <button
                    onClick={() => setLogViewMode('FLAT_LOG')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      logViewMode === 'FLAT_LOG' ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6]'
                    }`}
                  >
                    Semua Baris
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            {filteredLogItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-zinc-400 border border-dashed border-slate-300 dark:border-[#343440] rounded-2xl bg-slate-50 dark:bg-[#24242B]">
                Tidak ada data transaksi yang cocok dengan filter.
              </div>
            ) : logViewMode === 'BY_DATE' ? (
              <div className="space-y-3">
                {visibleDateGroups.map(({ group, visibleItems }) => {
                  const isExpanded = expandedDates[group.dateKey] !== false; // Default expanded
                  return (
                    <div key={group.dateKey} className="border border-slate-200 dark:border-[#2B2B33] rounded-2xl overflow-hidden bg-white dark:bg-[#1B1B20]">
                      <div
                        onClick={() => toggleDateExpand(group.dateKey)}
                        className="bg-slate-50 hover:bg-slate-100/80 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-xs text-[#0F172A] dark:text-[#F4F4F6]">{group.dateDisplay}</span>
                          <span className="text-[10px] text-slate-600 dark:text-zinc-300 bg-white dark:bg-[#1B1B20] px-2 py-0.5 rounded-full font-bold border border-slate-200 dark:border-[#343440] tabular-nums">
                            {group.items.length} item • {group.totalQty} btl
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 text-xs">
                          <div>
                            <span className="text-slate-500 dark:text-zinc-400 text-[10px] mr-1">Omzet:</span>
                            <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(group.totalOmset)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-zinc-400 text-[10px] mr-1">Cuan:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">+{formatRupiah(group.totalMargin)}</span>
                          </div>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500 dark:text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-slate-500 dark:text-zinc-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <>
                          {/* Mobile Card List (<640px) */}
                          <div className="sm:hidden divide-y divide-slate-100 dark:divide-[#2B2B33] border-t border-slate-200 dark:border-[#2B2B33]">
                            {visibleItems.map((it) => (
                              <div key={it.id} className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                                      <span className="font-bold text-[#2563EB] dark:text-[#C084FC]">{it.trxId}</span>
                                      <span className="text-slate-400 dark:text-zinc-500">•</span>
                                      <span className="text-slate-500 dark:text-zinc-400">{it.timeStr || it.dateStr}</span>
                                    </div>
                                    <p className="font-bold text-xs text-[#0F172A] dark:text-[#F4F4F6] mt-0.5 break-words">
                                      {it.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                                      {it.sku}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => onViewReceipt(it.rawReceipt)}
                                      className="min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-center active:scale-[0.97] cursor-pointer transition-colors"
                                      title="Lihat Nota"
                                      aria-label={`Lihat nota ${it.trxId}`}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    {(onDeleteTransaction || onVoidTransaction) && (
                                      <button
                                        type="button"
                                        onClick={() => setDeletingTrx(it.rawReceipt)}
                                        className="min-w-[44px] min-h-[44px] rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 flex items-center justify-center active:scale-[0.97] cursor-pointer transition-colors"
                                        title="Hapus Transaksi di Google Sheets"
                                        aria-label={`Hapus transaksi ${it.trxId}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100 dark:border-[#2B2B33]">
                                  <span className="text-slate-600 dark:text-zinc-300 font-mono tabular-nums">
                                    <strong className="text-[#0F172A] dark:text-[#F4F4F6]">{it.qty}×</strong> {formatRupiah(it.price)}
                                  </span>
                                  <div className="text-right font-mono tabular-nums">
                                    <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6]">{formatRupiah(it.total)}</span>
                                    <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{formatRupiah(it.margin)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop Table (>=640px) */}
                          <div className="hidden sm:block overflow-x-auto border-t border-slate-200 dark:border-[#2B2B33]">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-[#2B2B33] text-slate-600 dark:text-zinc-400 font-bold uppercase text-[10px] bg-slate-50/70 dark:bg-[#24242B]/70">
                                  <th className="py-2.5 px-3">Waktu / Nota ID</th>
                                  <th className="py-2.5 px-3">Produk</th>
                                  <th className="py-2.5 px-3 text-center">Qty</th>
                                  <th className="py-2.5 px-3 text-right">Harga</th>
                                  <th className="py-2.5 px-3 text-right">Total</th>
                                  <th className="py-2.5 px-3 text-right">Cuan</th>
                                  <th className="py-2.5 px-3 text-center">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-[#2B2B33]">
                                {visibleItems.map((it) => (
                                  <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-[#24242B]/60 transition-colors">
                                    <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                      {it.timeStr || it.dateStr}
                                      <span className="block text-[10px] font-bold text-[#2563EB] dark:text-[#C084FC]">{it.trxId}</span>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <p className="font-bold text-[#0F172A] dark:text-[#F4F4F6]">{it.name}</p>
                                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">{it.sku}</p>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className="font-bold bg-slate-100 dark:bg-[#24242B] px-2 py-0.5 rounded-full text-[#0F172A] dark:text-[#F4F4F6] border border-slate-200 dark:border-[#343440] tabular-nums">
                                        {it.qty}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-medium text-slate-600 dark:text-zinc-300 tabular-nums font-mono whitespace-nowrap">
                                      {formatRupiah(it.price)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono whitespace-nowrap">
                                      {formatRupiah(it.total)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono whitespace-nowrap">
                                      +{formatRupiah(it.margin)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => onViewReceipt(it.rawReceipt)}
                                          className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-slate-100 dark:hover:bg-[#24242B] rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                                          title="Lihat Nota"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        {(onDeleteTransaction || onVoidTransaction) && (
                                          <button
                                            onClick={() => setDeletingTrx(it.rawReceipt)}
                                            className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                                            title="Hapus Transaksi di Google Sheets"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {filteredLogItems.length > displayedByDateCount && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 px-1">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                      Menampilkan {displayedByDateCount} dari {filteredLogItems.length} baris
                    </span>
                    <button
                      type="button"
                      onClick={() => setLogVisibleCount((prev) => prev + 50)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
                    >
                      Muat Lagi (+50)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Mobile Card List (<640px) */}
                <div className="sm:hidden space-y-2.5">
                  {visibleFlatLogItems.map((it) => (
                    <div key={it.id} className="border border-slate-200 dark:border-[#2B2B33] rounded-2xl p-3 bg-white dark:bg-[#1B1B20] space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            <span className="font-mono text-slate-500 dark:text-zinc-400">{it.dateTimeStr || it.dateStr}</span>
                            <span className="bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded-full font-bold border border-slate-200 dark:border-[#343440]">
                              {it.category}
                            </span>
                          </div>
                          <p className="font-bold text-xs text-[#0F172A] dark:text-[#F4F4F6] mt-1 break-words">{it.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono truncate">{it.sku} • {it.trxId}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onViewReceipt(it.rawReceipt)}
                            className="min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-center active:scale-[0.97] cursor-pointer transition-colors"
                            title="Lihat Nota"
                            aria-label={`Lihat nota ${it.trxId}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(onDeleteTransaction || onVoidTransaction) && (
                            <button
                              type="button"
                              onClick={() => setDeletingTrx(it.rawReceipt)}
                              className="min-w-[44px] min-h-[44px] rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 flex items-center justify-center active:scale-[0.97] cursor-pointer transition-colors"
                              title="Hapus Transaksi di Google Sheets"
                              aria-label={`Hapus transaksi ${it.trxId}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-slate-100 dark:border-[#2B2B33]">
                        <span className="text-slate-600 dark:text-zinc-300 font-mono tabular-nums">
                          <strong className="text-[#0F172A] dark:text-[#F4F4F6]">{it.qty}×</strong> {formatRupiah(it.price)}
                        </span>
                        <div className="text-right font-mono tabular-nums">
                          <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6]">{formatRupiah(it.total)}</span>
                          <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{formatRupiah(it.margin)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>=640px) */}
                <div className="hidden sm:block border border-slate-200 dark:border-[#2B2B33] rounded-2xl overflow-x-auto bg-white dark:bg-[#1B1B20]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#2B2B33] text-slate-600 dark:text-zinc-400 font-bold uppercase text-[10px] bg-slate-50 dark:bg-[#24242B]">
                        <th className="py-2.5 px-3">Tanggal &amp; Waktu</th>
                        <th className="py-2.5 px-3">Produk</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Harga</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Cuan</th>
                        <th className="py-2.5 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#2B2B33]">
                      {visibleFlatLogItems.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-[#24242B]/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                            {it.dateTimeStr || it.dateStr}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-[#0F172A] dark:text-[#F4F4F6]">{it.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">{it.sku}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 dark:border-[#343440] whitespace-nowrap">
                              {it.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold bg-slate-100 dark:bg-[#24242B] px-2 py-0.5 rounded-full text-[#0F172A] dark:text-[#F4F4F6] border border-slate-200 dark:border-[#343440] tabular-nums">
                              {it.qty}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-600 dark:text-zinc-300 tabular-nums font-mono whitespace-nowrap">
                            {formatRupiah(it.price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono whitespace-nowrap">
                            {formatRupiah(it.total)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono whitespace-nowrap">
                            +{formatRupiah(it.margin)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onViewReceipt(it.rawReceipt)}
                                className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-slate-100 dark:hover:bg-[#24242B] rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                                title="Lihat Nota"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {(onDeleteTransaction || onVoidTransaction) && (
                                <button
                                  onClick={() => setDeletingTrx(it.rawReceipt)}
                                  className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                                  title="Hapus Transaksi di Google Sheets"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredLogItems.length > visibleFlatLogItems.length && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 px-1">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                      Menampilkan {visibleFlatLogItems.length} dari {filteredLogItems.length} baris
                    </span>
                    <button
                      type="button"
                      onClick={() => setLogVisibleCount((prev) => prev + 50)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
                    >
                      Muat Lagi (+50)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* 6. ARUS KAS / BUKU KAS (Finance Management View)         */}
      {/* ========================================================= */}
      <section id="sec-arus-kas" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35 flex items-center justify-center font-bold flex-shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight">
                Arus Kas &amp; Buku Kas Pengeluaran
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Pencatatan kas masuk &amp; keluar non-penjualan yang tersinkronisasi dengan Google Sheets (Sheet LAIN-LAIN)
              </p>
            </div>
          </div>
        </div>

        {/* Embedded Full Finance Management View Component */}
        <FinanceManagementView
          financeRecords={financeRecords}
          onAddRecord={onAddFinanceRecord}
          onDeleteRecord={onDeleteFinanceRecord}
          onSyncSpreadsheet={onSyncSpreadsheet}
          isSyncing={isSyncing}
          showToast={showToast}
        />
      </section>

      {/* Modal Target Omzet Editing */}
      {isEditingTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div className="fixed inset-0" onClick={() => setIsEditingTarget(false)} aria-hidden="true" />
          <form
            onSubmit={handleTargetSubmit}
            className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-3xl max-w-sm w-full border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
          >
            <div className="px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#2563EB] dark:text-[#C084FC]">
                  <Target className="w-5 h-5" />
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F4F4F6] text-sm">Setel Target Omzet Bulanan</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(false)}
                  aria-label="Tutup modal target"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] flex items-center justify-center active:scale-[0.97] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1.5">
                Target Omzet (Rupiah):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-zinc-400">Rp</span>
                <input
                  type="number"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] tabular-nums font-mono min-h-[44px]"
                  placeholder="Contoh: 50000000"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5 tabular-nums font-mono">
                Format: {formatRupiah(Number(targetInput) || 0)}
              </p>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditingTarget(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-slate-700 dark:text-zinc-200 text-xs font-bold active:scale-[0.97] cursor-pointer min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] dark:shadow-[0_0_16px_rgba(168,85,247,0.3)] text-white text-xs font-bold active:scale-[0.97] cursor-pointer min-h-[44px]"
              >
                Simpan Target
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Transaksi & Hapus Baris di Google Sheets */}
      {deletingTrx && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div className="fixed inset-0" onClick={() => setDeletingTrx(null)} aria-hidden="true" />
          <div className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
            <div className="px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] text-sm truncate">Hapus Transaksi &amp; Hapus di Sheets</h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">ID: {deletingTrx.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingTrx(null)}
                  aria-label="Tutup modal hapus transaksi"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] flex items-center justify-center active:scale-[0.97] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5">
              <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 p-3.5 rounded-2xl text-xs text-[#0F172A] dark:text-[#F4F4F6] space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span>Peringatan Penghapusan Permanen:</span>
                </p>
                <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Tindakan ini akan <strong>menghapus baris transaksi #{deletingTrx.id} dari sheet LOG_PENJUALAN</strong> di Google Spreadsheet secara permanen dan menghapusnya dari riwayat penjualan aplikasi.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-2xl text-xs space-y-1.5 border border-slate-200 dark:border-[#343440]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Tanggal:</span>
                  <span className="font-semibold text-[#0F172A] dark:text-[#F4F4F6]">{deletingTrx.transactionDate || deletingTrx.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Total Belanja:</span>
                  <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(deletingTrx.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Pelanggan:</span>
                  <span className="text-[#0F172A] dark:text-[#F4F4F6] font-medium">{deletingTrx.customerName || 'Umum'}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingTrx(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-slate-700 dark:text-zinc-200 text-xs font-bold active:scale-[0.97] cursor-pointer min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = deletingTrx.id;
                  setDeletingTrx(null);
                  if (onDeleteTransaction) {
                    onDeleteTransaction(targetId);
                  } else if (onVoidTransaction) {
                    onVoidTransaction(targetId, 'Dihapus dari Riwayat Penjualan');
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold active:scale-[0.97] cursor-pointer min-h-[44px]"
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
