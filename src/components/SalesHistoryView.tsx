import React, { useState, useMemo, useEffect } from 'react';
import { Button, Card, Chip, Input, Modal } from '@heroui/react';
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
      <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-[var(--border)] shadow-none flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Chip size="sm" variant="soft" color="accent" className="border border-[var(--border)] text-[10px] font-extrabold uppercase tracking-wider">
              <Chip.Label>Laporan Keuangan &amp; Business Intelligence</Chip.Label>
            </Chip>
            <span className="text-[var(--muted)] text-xs font-medium">• ORTUKILL POS</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-extrabold text-[var(--foreground)] tracking-tight mt-1.5">
            Pusat Keputusan Bisnis &amp; Laporan Keuangan
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Evaluasi ringkas kinerja omzet, cuan bersih penjualan, stok kritis, dan buku kas.
          </p>
        </div>

        {/* Quick Section Anchor Jump Links */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
          <a
            href="#sec-report-wa"
            className="px-3 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-[var(--foreground)] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-[var(--border)] min-h-[44px]"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-[var(--success)]" />
            <span>Report WA</span>
          </a>
          <a
            href="#sec-arus-kas-bersih"
            className="px-3 py-2 rounded-xl bg-[var(--success-soft)] hover:opacity-90 text-emerald-700 dark:text-[var(--success)] transition-opacity whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-[var(--success)]/35 min-h-[44px]"
          >
            <CircleDollarSign className="w-3.5 h-3.5 text-emerald-700 dark:text-[var(--success)]" />
            <span>Arus Kas Bersih</span>
          </a>
          <a
            href="#sec-kinerja"
            className="px-3 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-[var(--foreground)] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-[var(--border)] min-h-[44px]"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Kinerja &amp; Target</span>
          </a>
          <a
            href="#sec-produk-restok"
            className="px-3 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-[var(--foreground)] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-[var(--border)] min-h-[44px]"
          >
            <Boxes className="w-3.5 h-3.5 text-amber-700 dark:text-[var(--warning)]" />
            <span>Produk &amp; Restock</span>
          </a>
          <a
            href="#sec-tren"
            className="px-3 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-[var(--foreground)] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-[var(--border)] min-h-[44px]"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Grafik Tren</span>
          </a>
          <a
            href="#sec-riwayat-nota"
            className="px-3 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-[var(--foreground)] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-[var(--border)] min-h-[44px]"
          >
            <Receipt className="w-3.5 h-3.5 text-[var(--muted)]" />
            <span>Riwayat Nota</span>
          </a>
          <a
            href="#sec-arus-kas"
            className="px-3 py-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer flex items-center gap-1.5 border border-[var(--accent)]/30 min-h-[44px]"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Buku Kas</span>
          </a>
        </div>
      </Card>

      {/* Global Month & Time Filter Toolbar */}
      <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 border border-[var(--border)] shadow-none flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)] bg-[var(--surface-secondary)] px-3 py-2 rounded-xl border border-[var(--border)] min-h-[44px]">
            <Calendar className="w-4 h-4 text-[var(--accent)]" />
            <span>Filter Periode Analisis:</span>
          </div>

          {/* Quick Target Grain (Harian, Mingguan, Bulanan) */}
          <div className="flex items-center bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--border)]">
            <Button
              size="sm"
              variant={targetGrain === 'HARIAN' ? 'primary' : 'ghost'}
              onPress={() => setTargetGrain('HARIAN')}
              className={`rounded-lg text-xs font-bold min-h-[38px] px-3 ${
                targetGrain === 'HARIAN' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Harian
            </Button>
            <Button
              size="sm"
              variant={targetGrain === 'MINGGUAN' ? 'primary' : 'ghost'}
              onPress={() => setTargetGrain('MINGGUAN')}
              className={`rounded-lg text-xs font-bold min-h-[38px] px-3 ${
                targetGrain === 'MINGGUAN' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Mingguan
            </Button>
            <Button
              size="sm"
              variant={targetGrain === 'BULANAN' ? 'primary' : 'ghost'}
              onPress={() => setTargetGrain('BULANAN')}
              className={`rounded-lg text-xs font-bold min-h-[38px] px-3 ${
                targetGrain === 'BULANAN' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Bulanan
            </Button>
          </div>

          <div className="h-4 w-px bg-[var(--separator)] mx-1 hidden sm:block" />

          {/* Quick Month Filter Buttons */}
          <Button
            size="sm"
            variant={selectedMonth === 'ALL' ? 'primary' : 'secondary'}
            onPress={() => {
              setSelectedMonth('ALL');
              setTargetGrain('BULANAN');
            }}
            className="rounded-full text-xs font-bold min-h-[44px] px-4"
          >
            Semua Bulan
          </Button>

          {(() => {
            const now = new Date();
            const curStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            return (
              <Button
                size="sm"
                variant={selectedMonth === curStr ? 'primary' : 'secondary'}
                onPress={() => {
                  setSelectedMonth(curStr);
                  setTargetGrain('BULANAN');
                }}
                className="rounded-full text-xs font-bold min-h-[44px] px-4"
              >
                Bulan Ini ({formatMonthLabel(curStr)})
              </Button>
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
              aria-label="Pilih bulan analisis"
              className="appearance-none bg-[var(--surface-secondary)] text-[var(--foreground)] text-xs font-bold pl-3.5 pr-8 py-2 rounded-full border border-[var(--border)] hover:border-[var(--accent)] focus:outline-none focus:border-[var(--accent)] cursor-pointer min-h-[44px] [color-scheme:light] dark:[color-scheme:dark]"
            >
              <option value="ALL" className="bg-[var(--surface)] text-[var(--foreground)]">Pilih Bulan Lain...</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym} className="bg-[var(--surface)] text-[var(--foreground)]">
                  {formatMonthLabel(ym)} ({ym})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Active Month Indicator */}
        {selectedMonth !== 'ALL' && (
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <Chip size="sm" variant="soft" color="accent" className="border border-[var(--border)] font-bold">
              <Chip.Label>
                Periode Aktif: <strong>{formatMonthLabel(selectedMonth)}</strong>
              </Chip.Label>
            </Chip>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setSelectedMonth('ALL')}
              className="text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] underline min-h-[44px]"
            >
              Reset
            </Button>
          </div>
        )}
      </Card>

      {/* ========================================================= */}
      {/* 1. REPORT HARIAN WHATSAPP (Sesuai Aturan Mutlak)          */}
      {/* ========================================================= */}
      <section id="sec-report-wa">
        <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[var(--border)] shadow-none gap-4">
          {/* Header Kartu: Judul di kiri & Pilihan Tanggal di sebelah kanan judul */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 pb-4 border-b border-[var(--separator)]">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] flex items-center justify-center flex-shrink-0 border border-[var(--success)]/35">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                    Report Harian (Teks &amp; WA)
                  </h3>
                  <Chip size="sm" variant="soft" color="success" className="border border-[var(--success)]/35 text-[10px] font-bold">
                    <Chip.Label>Formula Sheets</Chip.Label>
                  </Chip>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Format teks rekap botol, omset, dan cuan siap kirim ke WhatsApp / Catatan.
                </p>
              </div>
            </div>

            {/* Pilihan Tanggal di Sebelah Judul Kartu & Tombol Aksi */}
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              {/* Navigasi Cepat Tanggal: <, Picker, > */}
              <div className="flex items-center bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl p-1 gap-1 min-h-[44px]">
                <Button
                  type="button"
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={() => handleShiftReportDate(-1)}
                  aria-label="Hari Sebelumnya"
                  className="min-w-[40px] min-h-[40px] rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] text-xs font-bold"
                >
                  ◀
                </Button>

                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={selectedReportDate}
                    onChange={(e) => e.target.value && setSelectedReportDate(e.target.value)}
                    aria-label="Pilih tanggal report"
                    className="bg-transparent text-xs font-bold text-[var(--foreground)] px-2 py-1 focus:outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>

                <Button
                  type="button"
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={() => handleShiftReportDate(1)}
                  aria-label="Hari Berikutnya"
                  className="min-w-[40px] min-h-[40px] rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] text-xs font-bold"
                >
                  ▶
                </Button>
              </div>

              {/* Tombol Cepat: Hari Ini */}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onPress={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, '0');
                  const d = String(now.getDate()).padStart(2, '0');
                  setSelectedReportDate(`${y}-${m}-${d}`);
                }}
                className="px-3 rounded-xl text-xs font-bold min-h-[44px] border border-[var(--border)]"
              >
                Hari Ini
              </Button>

              {/* Tombol Text (Toggle Tampilkan / Sembunyikan Teks) */}
              <Button
                type="button"
                size="sm"
                variant={showReportText ? 'primary' : 'outline'}
                onPress={() => setShowReportText((prev) => !prev)}
                aria-label="Tampilkan atau sembunyikan preview teks report"
                className="px-3.5 rounded-xl text-xs font-bold min-h-[44px]"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{showReportText ? 'Tutup Teks' : 'Lihat Teks'}</span>
              </Button>

              {/* Tombol Copy Text */}
              <Button
                type="button"
                size="sm"
                variant="primary"
                onPress={handleCopyReportText}
                aria-label="Salin isi teks report ke clipboard"
                className={`px-4 rounded-xl text-xs font-bold min-h-[44px] ${
                  isCopiedReport ? 'bg-[var(--success)] text-[var(--success-foreground)]' : ''
                }`}
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
              </Button>

              {/* Tombol Kirim WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(dailyReportData.fullReportText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--success)] hover:opacity-90 text-[var(--success-foreground)] transition-opacity cursor-pointer min-h-[44px]"
                aria-label="Kirim langsung teks report ke WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* 3 Metric Summary: QTY BTL, OMSET, CUAN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <Card className="bg-[var(--surface-secondary)] p-3.5 gap-1 rounded-2xl border border-[var(--border)] shadow-none">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                QTY BTL (Total Botol Fisik)
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] mt-0.5 tabular-nums font-mono">
                {dailyReportData.totalBtl} <span className="text-xs font-bold text-[var(--muted)]">Btl</span>
              </p>
            </Card>

            <Card className="bg-[var(--surface-secondary)] p-3.5 gap-1 rounded-2xl border border-[var(--border)] shadow-none">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                OMSET
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] mt-0.5 tabular-nums font-mono">
                Rp {new Intl.NumberFormat('en-US').format(Math.round(dailyReportData.totalOmset))}
              </p>
            </Card>

            <Card className="bg-[var(--success-soft)] p-3.5 gap-1 rounded-2xl border border-[var(--success)]/35 shadow-none">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-[var(--success)]">
                CUAN (Margin Kotor)
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-[var(--success)] mt-0.5 tabular-nums font-mono">
                Rp {new Intl.NumberFormat('en-US').format(Math.round(dailyReportData.totalMargin))}
              </p>
            </Card>
          </div>

          {/* Text Preview Box */}
          {showReportText && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)] px-1">
                <span className="font-semibold flex items-center gap-1.5 text-[var(--foreground)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                  Format teks siap kirim ({dailyReportData.formattedDateHeader}):
                </span>
                <span className="text-[11px] font-mono text-[var(--muted)] tabular-nums">
                  {dailyReportData.itemCount} jenis produk • {dailyReportData.trxCount} nota
                </span>
              </div>

              <div className="relative group">
                <pre className="w-full p-4 pr-14 bg-[var(--background)] text-[var(--foreground)] rounded-2xl text-xs sm:text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre select-all border border-[var(--border)] max-h-72">
                  {dailyReportData.fullReportText}
                </pre>

                <Button
                  type="button"
                  isIconOnly
                  size="sm"
                  variant="outline"
                  onPress={handleCopyReportText}
                  aria-label="Salin Teks"
                  className="absolute top-3 right-3 bg-[var(--surface)] text-[var(--foreground)] rounded-xl border border-[var(--border)] min-h-[44px] min-w-[44px] shadow-xs"
                >
                  {isCopiedReport ? <Check className="w-4 h-4 text-emerald-700 dark:text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* ========================================================= */}
      {/* DIV BARU KHUSUS: ARUS KAS BERSIH (4 CARD RINGKAS)         */}
      {/* OMZET − RESTOCK − PENGELUARAN = ARUS KAS BERSIH           */}
      {/* ========================================================= */}
      <section id="sec-arus-kas-bersih">
        <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[var(--border)] shadow-none gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--separator)]">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] flex items-center justify-center font-bold border border-[var(--success)]/35 flex-shrink-0">
                <CircleDollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                    Arus Kas Bersih (Net Cash Flow)
                  </h3>
                  <Chip size="sm" variant="soft" color="default" className="border border-[var(--border)] text-[10px] font-bold uppercase">
                    <Chip.Label>OMZET − RESTOCK − PENGELUARAN = ARUS KAS BERSIH</Chip.Label>
                  </Chip>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Likuiditas kas masuk riil dikurangi belanja restok barang dan biaya operasional pada periode terpilih.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Chip size="sm" variant="soft" color="accent" className="border border-[var(--border)] font-mono font-bold">
                <Chip.Label>
                  Periode: <strong>{cashFlowMetrics.periodLabel}</strong>
                </Chip.Label>
              </Chip>
            </div>
          </div>

          {/* 4 Cards Ringkas: OMZET − RESTOCK − PENGELUARAN = ARUS KAS BERSIH */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* CARD 1: OMZET */}
            <Card className="bg-[var(--surface-secondary)] rounded-2xl p-4 gap-3 border border-[var(--border)] shadow-none justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  Omzet
                </span>
                <Chip size="sm" variant="soft" color="accent" className="border border-[var(--border)] text-[10px] font-bold">
                  <Chip.Label>Total Penjualan</Chip.Label>
                </Chip>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
                  {formatRupiah(cashFlowMetrics.omzet)}
                </p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5 tabular-nums">
                  {cashFlowMetrics.notaCount} transaksi kasir tercatat
                </p>
              </div>
            </Card>

            {/* CARD 2: RESTOCK */}
            <Card className="bg-[var(--surface-secondary)] rounded-2xl p-4 gap-3 border border-[var(--border)] shadow-none justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  Restock
                </span>
                <Chip size="sm" variant="soft" color="accent" className="border border-[var(--border)] text-[10px] font-bold">
                  <Chip.Label>− Pembelian Stok</Chip.Label>
                </Chip>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
                  {formatRupiah(cashFlowMetrics.restock)}
                </p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5 tabular-nums">
                  {cashFlowMetrics.restockCount} pengadaan stok barang
                </p>
              </div>
            </Card>

            {/* CARD 3: PENGELUARAN */}
            <Card className="bg-[var(--surface-secondary)] rounded-2xl p-4 gap-3 border border-[var(--border)] shadow-none justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                  Pengeluaran
                </span>
                <Chip size="sm" variant="soft" color="warning" className="border border-[var(--warning)]/35 text-[10px] font-bold">
                  <Chip.Label>− Beban Operasional</Chip.Label>
                </Chip>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
                  {formatRupiah(cashFlowMetrics.operasional)}
                </p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5 tabular-nums">
                  {cashFlowMetrics.operasionalCount} biaya selain restock
                </p>
              </div>
            </Card>

            {/* CARD 4: ARUS KAS BERSIH */}
            <Card className={`rounded-2xl p-4 gap-3 border shadow-none justify-between ${
              cashFlowMetrics.netCashFlow >= 0
                ? 'bg-[var(--success-soft)] border-[var(--success)]/35 text-emerald-700 dark:text-[var(--success)]'
                : 'bg-[var(--danger-soft)] border-[var(--danger)]/35 text-red-700 dark:text-[var(--danger)]'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-[var(--foreground)]">
                  <span className={`w-2 h-2 rounded-full ${cashFlowMetrics.netCashFlow >= 0 ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
                  Arus Kas Bersih
                </span>
                <Chip
                  size="sm"
                  variant="soft"
                  color={cashFlowMetrics.netCashFlow >= 0 ? 'success' : 'danger'}
                  className="bg-[var(--surface)] border border-[var(--border)] text-[10px] font-bold"
                >
                  <Chip.Label>{cashFlowMetrics.netCashFlow >= 0 ? 'Surplus (+)' : 'Defisit (−)'}</Chip.Label>
                </Chip>
              </div>
              <div>
                <p className={`text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums font-mono ${
                  cashFlowMetrics.netCashFlow >= 0 ? 'text-emerald-700 dark:text-[var(--success)]' : 'text-red-700 dark:text-[var(--danger)]'
                }`}>
                  {cashFlowMetrics.netCashFlow >= 0 ? '+' : ''}{formatRupiah(cashFlowMetrics.netCashFlow)}
                </p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5 font-medium">
                  Omzet − Restock − Pengeluaran
                </p>
              </div>
            </Card>
          </div>
        </Card>
      </section>

      {/* ========================================================= */}
      {/* 2. RINGKASAN KINERJA USAHA & PERBANDINGAN PERIODE (MoM)   */}
      {/* ========================================================= */}
      <section id="sec-kinerja" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 flex items-center justify-center font-bold flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                Ringkasan Kinerja Usaha
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Metrik inti &amp; perbandingan adil dengan periode setara (tgl 1 s/d {activeMonthInfo.N})
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onPress={() => setIsEditingTarget(true)}
            className="text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] px-3.5 rounded-xl border border-[var(--accent)]/30 min-h-[44px] w-full sm:w-auto"
          >
            <Target className="w-3.5 h-3.5" />
            <span className="tabular-nums font-mono">Target: {formatRupiah(salesTarget.targetAmount || 50000000)}</span>
          </Button>
        </div>

        {/* 5 Kartu Metrik Utama */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* KPI 1: Omzet Penjualan */}
          <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
            <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
              <span className="uppercase tracking-wider">Omzet Penjualan</span>
              <Chip
                size="sm"
                variant="soft"
                color={kpiStats.deltaOmset >= 0 ? 'success' : 'danger'}
                className="text-[10px] font-bold tabular-nums"
              >
                {kpiStats.deltaOmset >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <Chip.Label>{kpiStats.deltaOmset >= 0 ? `+${kpiStats.deltaOmset}%` : `${kpiStats.deltaOmset}%`}</Chip.Label>
              </Chip>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
                {formatRupiah(kpiStats.omset)}
              </p>
              <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate tabular-nums" title={`Lalu (1..${kpiStats.N}): ${formatRupiah(kpiStats.prevOmset_N)}`}>
                vs Bln Lalu (1..{kpiStats.N}): {formatRupiah(kpiStats.prevOmset_N)}
              </p>
            </div>
          </Card>

          {/* KPI 2: Cuan (Margin Kotor) */}
          <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
            <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
              <span className="uppercase tracking-wider text-emerald-700 dark:text-[var(--success)]">Margin Kotor (Cuan)</span>
              <Chip
                size="sm"
                variant="soft"
                color={kpiStats.deltaCuan >= 0 ? 'success' : 'danger'}
                className="text-[10px] font-bold tabular-nums"
              >
                {kpiStats.deltaCuan >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <Chip.Label>{kpiStats.deltaCuan >= 0 ? `+${kpiStats.deltaCuan}%` : `${kpiStats.deltaCuan}%`}</Chip.Label>
              </Chip>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-[var(--success)] tracking-tight tabular-nums font-mono">
                {formatRupiah(kpiStats.cuan)}
              </p>
              <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate tabular-nums" title={`Lalu (1..${kpiStats.N}): ${formatRupiah(kpiStats.prevCuan_N)}`}>
                vs Bln Lalu: {formatRupiah(kpiStats.prevCuan_N)}
              </p>
            </div>
          </Card>

          {/* KPI 3: Persentase Margin Keuntungan */}
          <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
            <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
              <span className="uppercase tracking-wider">Margin Profit %</span>
              <Chip
                size="sm"
                variant="soft"
                color={kpiStats.deltaMargin >= 0 ? 'success' : 'danger'}
                className="text-[10px] font-bold tabular-nums"
              >
                {kpiStats.deltaMargin >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <Chip.Label>{kpiStats.deltaMargin >= 0 ? `+${kpiStats.deltaMargin}%` : `${kpiStats.deltaMargin}%`}</Chip.Label>
              </Chip>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
                {kpiStats.marginPct}%
              </p>
              <p className="text-[10px] text-[var(--muted)] mt-0.5">
                Rasio Laba Kotor Penjualan
              </p>
            </div>
          </Card>

          {/* KPI 4: Total Nota Penjualan */}
          <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
            <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
              <span className="uppercase tracking-wider">Total Nota</span>
              <Chip
                size="sm"
                variant="soft"
                color={kpiStats.deltaNota >= 0 ? 'success' : 'danger'}
                className="text-[10px] font-bold tabular-nums"
              >
                {kpiStats.deltaNota >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <Chip.Label>{kpiStats.deltaNota >= 0 ? `+${kpiStats.deltaNota}%` : `${kpiStats.deltaNota}%`}</Chip.Label>
              </Chip>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
                {kpiStats.nota} <span className="text-xs font-bold text-[var(--muted)]">Nota</span>
              </p>
              <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate tabular-nums">
                vs Bln Lalu: {kpiStats.prevNota_N} Nota
              </p>
            </div>
          </Card>

          {/* KPI 5: Botol Fisik Terjual */}
          <Card className="col-span-2 lg:col-span-1 bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
            <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
              <span className="uppercase tracking-wider">Botol Terjual</span>
              <Chip
                size="sm"
                variant="soft"
                color={kpiStats.deltaBotol >= 0 ? 'success' : 'danger'}
                className="text-[10px] font-bold tabular-nums"
              >
                {kpiStats.deltaBotol >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <Chip.Label>{kpiStats.deltaBotol >= 0 ? `+${kpiStats.deltaBotol}%` : `${kpiStats.deltaBotol}%`}</Chip.Label>
              </Chip>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight tabular-nums font-mono">
                {kpiStats.botol} <span className="text-xs font-bold text-[var(--muted)]">Btl</span>
              </p>
              <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate">
                Exclude promo &amp; diskon
              </p>
            </div>
          </Card>
        </div>

        {/* Target Progress Card */}
        <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-3 border border-[var(--border)] shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Target className="w-4 h-4 text-[var(--accent)]" />
                <h4 className="text-sm font-bold text-[var(--foreground)]">
                  Perkembangan Target Omzet ({targetProgress.grainLabel})
                </h4>
                <Chip size="sm" variant="soft" color="default" className="border border-[var(--border)] text-[10px] font-bold">
                  <Chip.Label>Hari ke-{targetProgress.effectiveDay}</Chip.Label>
                </Chip>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {targetProgress.statusSentence}
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs text-[var(--muted)] font-medium">Tercapai / Target:</p>
              <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)] tabular-nums font-mono">
                {formatRupiah(targetProgress.achieved)} <span className="text-xs text-[var(--muted)] font-bold">/ {formatRupiah(targetProgress.target)}</span>
              </p>
            </div>
          </div>

          {/* Progress Bar with Ideal Pace Marker */}
          <div className="space-y-1.5 pt-1">
            <div className="relative w-full h-3.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden border border-[var(--border)]">
              <div
                className="h-full bg-[var(--accent)] transition-[width] duration-500 rounded-full"
                style={{ width: `${Math.min(100, targetProgress.percent)}%` }}
              />
              {/* Ideal Pace Marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-[var(--foreground)]/75 z-10"
                style={{ left: `${targetProgress.idealPacePercent}%` }}
                title={`Pace ideal hari ke-${targetProgress.effectiveDay}: ${targetProgress.idealPacePercent}%`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
              <span className="font-extrabold text-[var(--foreground)] tabular-nums">{targetProgress.percent}% Tercapai</span>
              <span className="tabular-nums">Pace Ideal: {targetProgress.idealPacePercent}%</span>
              <span>Sisa Target: <strong className="text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(targetProgress.remaining)}</strong></span>
            </div>
          </div>
        </Card>
      </section>

      {/* ========================================================= */}
      {/* 3. ANALISIS PRODUK & REKOMENDASI RESTOCK                  */}
      {/* ========================================================= */}
      <section id="sec-produk-restok" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border border-[var(--warning)]/35 flex items-center justify-center font-bold flex-shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                Analisis Produk &amp; Rekomendasi Restock
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Peringatan stok habis/kritis dengan estimasi modal dan identifikasi produk macet
              </p>
            </div>
          </div>

          {/* Metric Selector for Top Products: QTY | CUAN | OMSET */}
          <div className="flex items-center bg-[var(--surface)] p-1 rounded-full border border-[var(--border)] self-start sm:self-auto overflow-x-auto max-w-full no-scrollbar gap-1">
            <span className="text-[10px] font-bold text-[var(--muted)] px-2.5 uppercase whitespace-nowrap">Urutkan:</span>
            <Button
              size="sm"
              variant={productRankingMetric === 'QTY' ? 'primary' : 'ghost'}
              onPress={() => setProductRankingMetric('QTY')}
              className={`rounded-full text-xs font-bold whitespace-nowrap min-h-[38px] px-3 ${
                productRankingMetric === 'QTY' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Terlaris (Botol)
            </Button>
            <Button
              size="sm"
              variant={productRankingMetric === 'CUAN' ? 'primary' : 'ghost'}
              onPress={() => setProductRankingMetric('CUAN')}
              className={`rounded-full text-xs font-bold whitespace-nowrap min-h-[38px] px-3 ${
                productRankingMetric === 'CUAN' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Cuan Tertinggi
            </Button>
            <Button
              size="sm"
              variant={productRankingMetric === 'OMSET' ? 'primary' : 'ghost'}
              onPress={() => setProductRankingMetric('OMSET')}
              className={`rounded-full text-xs font-bold whitespace-nowrap min-h-[38px] px-3 ${
                productRankingMetric === 'OMSET' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Omzet
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sub-Card 1: Top 8 Produk Terlaris & Margin % */}
          <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-3.5 border border-[var(--border)] shadow-none">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--separator)]">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-600 dark:text-[var(--warning)]" />
                <h4 className="text-sm font-bold text-[var(--foreground)]">
                  Top Produk Berkontribusi ({productRankingMetric === 'QTY' ? 'Volume Botol' : productRankingMetric === 'CUAN' ? 'Cuan Tertinggi' : 'Omzet Tertinggi'})
                </h4>
              </div>
              <span className="text-[10px] font-bold text-[var(--muted)] whitespace-nowrap">Exclude Promo 5rb</span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--muted)]">
                Belum ada data penjualan produk pada periode ini.
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p) => (
                  <div key={p.sku || p.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${
                          p.rank === 1 ? 'bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)]' : p.rank === 2 ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--surface-secondary)] text-[var(--muted)]'
                        }`}>
                          {p.rank}
                        </span>
                        <span className="font-bold text-[var(--foreground)] truncate">{p.name}</span>
                        <span className="text-[10px] text-[var(--muted)] font-mono hidden sm:inline">({p.category})</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-right">
                        <span className="font-bold text-[var(--foreground)] tabular-nums">{p.qty} Btl</span>
                        <span className="text-emerald-700 dark:text-[var(--success)] font-extrabold text-[11px] tabular-nums font-mono">+{formatRupiah(p.margin)}</span>
                        <span className="bg-[var(--surface-secondary)] text-[var(--foreground)] px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums border border-[var(--border)]">
                          {p.marginPct}%
                        </span>
                      </div>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full h-1.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-[width]"
                        style={{ width: `${p.percentOfTop}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Sub-Card 2: Rekomendasi Restock Kritis & Dead Stock */}
          <div className="space-y-4">
            {/* Urgent Restock Box */}
            <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-3 border border-[var(--border)] shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--separator)]">
                <div className="flex items-center gap-2 text-red-700 dark:text-[var(--danger)]">
                  <AlertCircle className="w-4 h-4" />
                  <h4 className="text-sm font-bold text-[var(--foreground)]">
                    Rekomendasi Restock Kritis ({inventoryIntelligence.totalCriticalCount} Produk)
                  </h4>
                </div>
                {inventoryIntelligence.totalCriticalRestockCost > 0 && (
                  <Chip size="sm" variant="soft" color="danger" className="border border-[var(--danger)]/35 text-[11px] font-bold tabular-nums font-mono">
                    <Chip.Label>Est. Modal: {formatRupiah(inventoryIntelligence.totalCriticalRestockCost)}</Chip.Label>
                  </Chip>
                )}
              </div>

              {inventoryIntelligence.criticalList.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--muted)] flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-[var(--success)]" />
                  <span>Stok aman, tidak ada produk dengan stok kritis saat ini.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {inventoryIntelligence.criticalList.map((item) => (
                    <div
                      key={item.product.id || item.product.sku}
                      className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Chip
                            size="sm"
                            variant="soft"
                            color={item.isZeroStock ? 'danger' : 'warning'}
                            className="border border-[var(--border)] text-[10px] font-extrabold"
                          >
                            <Chip.Label>{item.isZeroStock ? 'Habis (0)' : `Sisa ${item.currentStock}`}</Chip.Label>
                          </Chip>
                          <span className="font-bold text-[var(--foreground)] truncate">{item.product.name}</span>
                        </div>
                        <p className="text-[10px] text-[var(--muted)] mt-1">
                          Terjual: <strong className="text-[var(--foreground)]">{item.soldQty} btl</strong> di periode ini • Sarana Order: <strong className="text-[var(--foreground)]">{item.qtyToOrder} btl</strong>
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {item.unitCost > 0 ? (
                          <>
                            <p className="text-[10px] text-[var(--muted)]">Modal Butuh:</p>
                            <p className="font-extrabold text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(item.estimatedCost)}</p>
                          </>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] italic">Harga beli kosong</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Slow Moving / Dead Stock Alert */}
            <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-3 border border-[var(--border)] shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--separator)]">
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Clock className="w-4 h-4 text-[var(--accent)]" />
                  <h4 className="text-sm font-bold text-[var(--foreground)]">
                    Produk Macet / 0 Penjualan ({inventoryIntelligence.totalSlowCount} Produk)
                  </h4>
                </div>
                {inventoryIntelligence.totalTiedDeadCapital > 0 && (
                  <Chip size="sm" variant="soft" color="default" className="border border-[var(--border)] text-[11px] font-bold tabular-nums font-mono">
                    <Chip.Label>Modal Tertahan: {formatRupiah(inventoryIntelligence.totalTiedDeadCapital)}</Chip.Label>
                  </Chip>
                )}
              </div>

              {inventoryIntelligence.slowMovingList.length === 0 ? (
                <div className="py-4 text-center text-xs text-[var(--muted)]">
                  Semua stok produk bergerak aktif pada periode ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {inventoryIntelligence.slowMovingList.map((item) => (
                    <div key={item.product.id || item.product.sku} className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]">
                      <p className="font-bold text-[var(--foreground)] truncate">{item.product.name}</p>
                      <div className="flex items-center justify-between text-[11px] text-[var(--muted)] mt-1">
                        <span>Stok: <strong className="text-[var(--foreground)]">{item.currentStock} btl</strong></span>
                        <span className="font-mono font-bold text-[var(--foreground)] tabular-nums">{formatRupiah(item.tiedCapital)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. GRAFIK TREN PENJUALAN & INSIGHT OPERASIONAL           */}
      {/* ========================================================= */}
      <section id="sec-tren" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 flex items-center justify-center font-bold flex-shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                Tren Penjualan Harian &amp; Insight Operasional
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Visualisasi dinamika omzet harian terhadap margin kotor dan ritme toko
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Chart: Bar Omzet + Line Cuan */}
          <Card className="lg:col-span-2 bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-3 border border-[var(--border)] shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--foreground)]">
                  <span className="w-3 h-3 rounded-xs bg-[var(--accent)]" />
                  Omzet Penjualan
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-[var(--success)]">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  Margin Cuan
                </span>
              </div>
              <span className="text-[11px] font-mono text-[var(--muted)]">
                {selectedMonth !== 'ALL' ? formatMonthLabel(selectedMonth) : '14 Hari Terakhir'}
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#27272e' : '#e4e4e7'} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: isDarkMode ? '#a1a1aa' : '#64748b' }} stroke={isDarkMode ? '#32323c' : '#cbd5e1'} />
                  <YAxis tickFormatter={formatAxisRbJt} tick={{ fontSize: 10, fill: isDarkMode ? '#a1a1aa' : '#64748b' }} stroke={isDarkMode ? '#32323c' : '#cbd5e1'} />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      formatRupiah(Number(value) || 0),
                      name === 'omset' ? 'Omzet' : 'Cuan'
                    ]}
                    labelFormatter={(label) => `Tanggal: ${label}`}
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1e1e24' : '#ffffff',
                      borderRadius: '12px',
                      border: isDarkMode ? '1px solid #32323c' : '1px solid #e4e4e7',
                      color: isDarkMode ? '#fafafa' : '#18181b',
                      fontSize: '11px',
                      boxShadow: isDarkMode ? '0 8px 24px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Bar dataKey="omset" fill={isDarkMode ? '#e6499e' : '#c82d85'} radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Line type="monotone" dataKey="margin" stroke="#10B981" strokeWidth={2.5} dot={{ r: 2.5, fill: '#10B981' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Operational Insights Card: Hari Terbaik, Jam Teramai, Metode Bayar */}
          <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-4 border border-[var(--border)] shadow-none justify-between">
            <div>
              <h4 className="text-sm font-bold text-[var(--foreground)] pb-2.5 border-b border-[var(--separator)] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-[var(--warning)]" />
                <span>Ritme Toko &amp; Pembayaran</span>
              </h4>

              <div className="space-y-3 mt-3 text-xs">
                <div className="bg-[var(--surface-secondary)] p-3 rounded-2xl border border-[var(--border)] flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[var(--muted)]">Hari Omzet Terbaik</p>
                    <p className="text-sm font-extrabold text-[var(--foreground)] mt-0.5">{operationalInsights.bestDayFormatted}</p>
                  </div>
                  <p className="text-xs font-extrabold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono">{formatRupiah(operationalInsights.bestDayOmset)}</p>
                </div>

                <div className="bg-[var(--surface-secondary)] p-3 rounded-2xl border border-[var(--border)] flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[var(--muted)]">Jam Paling Ramai</p>
                    <p className="text-sm font-extrabold text-[var(--foreground)] mt-0.5">{operationalInsights.peakHourFormatted}</p>
                  </div>
                  <Chip size="sm" variant="soft" color="accent" className="border border-[var(--border)] text-[10px] font-bold tabular-nums">
                    <Chip.Label>{operationalInsights.peakHourCount} Transaksi</Chip.Label>
                  </Chip>
                </div>
              </div>
            </div>

            {/* Metode Bayar Breakdown */}
            <div className="space-y-2 pt-2.5 border-t border-[var(--separator)]">
              <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Distribusi Pembayaran</p>
              <div className="space-y-2">
                {operationalInsights.paymentList.map((pm) => (
                  <div key={pm.method} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-[var(--foreground)]">
                      <span>{pm.method}</span>
                      <span className="tabular-nums font-mono">{formatRupiah(pm.total)} <span className="text-[var(--muted)] font-normal">({pm.percent}%)</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pm.method === 'CASH' ? 'bg-[var(--warning)]' : pm.method === 'QRIS' ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'
                        }`}
                        style={{ width: `${pm.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. RIWAYAT NOTA & EKSPOR (Ringkas & Collapsible)         */}
      {/* ========================================================= */}
      <section id="sec-riwayat-nota">
        <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-4 border border-[var(--border)] shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--separator)]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold border border-[var(--accent)]/30 flex-shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                    Riwayat Nota &amp; Log Penjualan
                  </h3>
                  <span className="text-xs text-[var(--muted)] font-mono tabular-nums">
                    ({filteredLogItems.length} baris)
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Audit transaksi kasir, cetak ulang nota, atau ekspor ke file spreadsheet CSV.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="secondary"
                onPress={handleExportCSV}
                aria-label="Unduh data penjualan format CSV"
                className="px-3 rounded-xl text-xs font-bold min-h-[44px] border border-[var(--border)]"
              >
                <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Ekspor CSV</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={() => setIsLogCollapsed((prev) => !prev)}
                className="px-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] text-xs font-bold min-h-[44px]"
              >
                {isLogCollapsed ? 'Tampilkan Tabel' : 'Sembunyikan Tabel'}
              </Button>
            </div>
          </div>

          {!isLogCollapsed && (
            <div className="space-y-3">
              {/* Filter controls bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                  <Input
                    type="text"
                    fullWidth
                    variant="secondary"
                    placeholder="Cari SKU, Nama Produk, Nota ID, Pelanggan..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs font-medium text-[var(--foreground)] min-h-[44px]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Metode bayar filter */}
                  <select
                    value={logPaymentFilter}
                    onChange={(e) => setLogPaymentFilter(e.target.value)}
                    aria-label="Filter metode pembayaran"
                    className="bg-[var(--surface-secondary)] text-[var(--foreground)] text-xs font-bold px-3 py-2 rounded-xl border border-[var(--border)] cursor-pointer min-h-[44px] focus:outline-none focus:border-[var(--accent)] [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="ALL" className="bg-[var(--surface)] text-[var(--foreground)]">Semua Pembayaran</option>
                    <option value="CASH" className="bg-[var(--surface)] text-[var(--foreground)]">CASH</option>
                    <option value="QRIS" className="bg-[var(--surface)] text-[var(--foreground)]">QRIS</option>
                    <option value="TRANSFER" className="bg-[var(--surface)] text-[var(--foreground)]">TRANSFER</option>
                  </select>

                  {/* View Mode toggle (Group by date vs flat) */}
                  <div className="flex items-center bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--border)] gap-1">
                    <Button
                      size="sm"
                      variant={logViewMode === 'BY_DATE' ? 'primary' : 'ghost'}
                      onPress={() => setLogViewMode('BY_DATE')}
                      className={`px-3 rounded-lg text-xs font-bold min-h-[38px] ${
                        logViewMode === 'BY_DATE' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      Per Tanggal
                    </Button>
                    <Button
                      size="sm"
                      variant={logViewMode === 'FLAT_LOG' ? 'primary' : 'ghost'}
                      onPress={() => setLogViewMode('FLAT_LOG')}
                      className={`px-3 rounded-lg text-xs font-bold min-h-[38px] ${
                        logViewMode === 'FLAT_LOG' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      Semua Baris
                    </Button>
                  </div>
                </div>
              </div>

              {/* Table Content */}
              {filteredLogItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--muted)] border border-dashed border-[var(--border)] rounded-2xl bg-[var(--surface-secondary)]">
                  Tidak ada data transaksi yang cocok dengan filter.
                </div>
              ) : logViewMode === 'BY_DATE' ? (
                <div className="space-y-3">
                  {visibleDateGroups.map(({ group, visibleItems }) => {
                    const isExpanded = expandedDates[group.dateKey] !== false; // Default expanded
                    return (
                      <Card key={group.dateKey} className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface)] p-0 gap-0 shadow-none">
                        <div
                          onClick={() => toggleDateExpand(group.dateKey)}
                          className="bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs text-[var(--foreground)]">{group.dateDisplay}</span>
                            <Chip size="sm" variant="soft" color="default" className="bg-[var(--surface)] border border-[var(--border)] text-[10px] font-bold tabular-nums">
                              <Chip.Label>{group.items.length} item • {group.totalQty} btl</Chip.Label>
                            </Chip>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 text-xs">
                            <div>
                              <span className="text-[var(--muted)] text-[10px] mr-1">Omzet:</span>
                              <span className="font-extrabold text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(group.totalOmset)}</span>
                            </div>
                            <div>
                              <span className="text-[var(--muted)] text-[10px] mr-1">Cuan:</span>
                              <span className="font-bold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono">+{formatRupiah(group.totalMargin)}</span>
                            </div>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--muted)]" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <>
                            {/* Mobile Card List (<640px) */}
                            <div className="sm:hidden divide-y divide-[var(--separator)] border-t border-[var(--border)]">
                              {visibleItems.map((it) => (
                                <div key={it.id} className="p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                                        <span className="font-bold text-[var(--accent)]">{it.trxId}</span>
                                        <span className="text-[var(--muted)]">•</span>
                                        <span className="text-[var(--muted)]">{it.timeStr || it.dateStr}</span>
                                      </div>
                                      <p className="font-bold text-xs text-[var(--foreground)] mt-0.5 break-words">
                                        {it.name}
                                      </p>
                                      <p className="text-[10px] text-[var(--muted)] font-mono truncate">
                                        {it.sku}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        type="button"
                                        isIconOnly
                                        size="sm"
                                        variant="outline"
                                        onPress={() => onViewReceipt(it.rawReceipt)}
                                        aria-label={`Lihat nota ${it.trxId}`}
                                        className="min-w-[44px] min-h-[44px] rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] bg-[var(--surface-secondary)] border-[var(--border)]"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      {(onDeleteTransaction || onVoidTransaction) && (
                                        <Button
                                          type="button"
                                          isIconOnly
                                          size="sm"
                                          variant="outline"
                                          onPress={() => setDeletingTrx(it.rawReceipt)}
                                          aria-label={`Hapus transaksi ${it.trxId}`}
                                          className="min-w-[44px] min-h-[44px] rounded-xl text-red-700 dark:text-[var(--danger)] bg-[var(--danger-soft)] border-[var(--danger)]/35"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-[var(--separator)]">
                                    <span className="text-[var(--muted)] font-mono tabular-nums">
                                      <strong className="text-[var(--foreground)]">{it.qty}×</strong> {formatRupiah(it.price)}
                                    </span>
                                    <div className="text-right font-mono tabular-nums">
                                      <span className="font-extrabold text-[var(--foreground)]">{formatRupiah(it.total)}</span>
                                      <span className="block text-[10px] font-bold text-emerald-700 dark:text-[var(--success)]">+{formatRupiah(it.margin)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Desktop Table (>=640px) */}
                            <div className="hidden sm:block overflow-x-auto border-t border-[var(--border)]">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-[var(--border)] text-[var(--muted)] font-bold uppercase text-[10px] bg-[var(--surface-secondary)]">
                                    <th className="py-2.5 px-3">Waktu / Nota ID</th>
                                    <th className="py-2.5 px-3">Produk</th>
                                    <th className="py-2.5 px-3 text-center">Qty</th>
                                    <th className="py-2.5 px-3 text-right">Harga</th>
                                    <th className="py-2.5 px-3 text-right">Total</th>
                                    <th className="py-2.5 px-3 text-right">Cuan</th>
                                    <th className="py-2.5 px-3 text-center">Aksi</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--separator)]">
                                  {visibleItems.map((it) => (
                                    <tr key={it.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                                      <td className="py-2.5 px-3 font-mono text-[var(--muted)] whitespace-nowrap">
                                        {it.timeStr || it.dateStr}
                                        <span className="block text-[10px] font-bold text-[var(--accent)]">{it.trxId}</span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <p className="font-bold text-[var(--foreground)]">{it.name}</p>
                                        <p className="text-[10px] text-[var(--muted)] font-mono">{it.sku}</p>
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <span className="font-bold bg-[var(--surface-secondary)] px-2 py-0.5 rounded-full text-[var(--foreground)] border border-[var(--border)] tabular-nums">
                                          {it.qty}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-medium text-[var(--muted)] tabular-nums font-mono whitespace-nowrap">
                                        {formatRupiah(it.price)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-extrabold text-[var(--foreground)] tabular-nums font-mono whitespace-nowrap">
                                        {formatRupiah(it.total)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono whitespace-nowrap">
                                        +{formatRupiah(it.margin)}
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <Button
                                            isIconOnly
                                            size="sm"
                                            variant="ghost"
                                            onPress={() => onViewReceipt(it.rawReceipt)}
                                            aria-label={`Lihat nota ${it.trxId}`}
                                            className="text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg min-h-[40px] min-w-[40px]"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </Button>
                                          {(onDeleteTransaction || onVoidTransaction) && (
                                            <Button
                                              isIconOnly
                                              size="sm"
                                              variant="ghost"
                                              onPress={() => setDeletingTrx(it.rawReceipt)}
                                              aria-label={`Hapus transaksi ${it.trxId}`}
                                              className="text-red-700 dark:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-lg min-h-[40px] min-w-[40px]"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
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
                      </Card>
                    );
                  })}
                  {filteredLogItems.length > displayedByDateCount && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 px-1">
                      <span className="text-xs text-[var(--muted)] font-medium tabular-nums">
                        Menampilkan {displayedByDateCount} dari {filteredLogItems.length} baris
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onPress={() => setLogVisibleCount((prev) => prev + 50)}
                        className="w-full sm:w-auto px-4 rounded-xl border border-[var(--border)] text-xs font-bold min-h-[44px]"
                      >
                        Muat Lagi (+50)
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Mobile Card List (<640px) */}
                  <div className="sm:hidden space-y-2.5">
                    {visibleFlatLogItems.map((it) => (
                      <Card key={it.id} className="border border-[var(--border)] rounded-2xl p-3 gap-2 bg-[var(--surface)] shadow-none">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                              <span className="font-mono text-[var(--muted)]">{it.dateTimeStr || it.dateStr}</span>
                              <Chip size="sm" variant="soft" color="default" className="border border-[var(--border)] text-[10px] font-bold">
                                <Chip.Label>{it.category}</Chip.Label>
                              </Chip>
                            </div>
                            <p className="font-bold text-xs text-[var(--foreground)] mt-1 break-words">{it.name}</p>
                            <p className="text-[10px] text-[var(--muted)] font-mono truncate">{it.sku} • {it.trxId}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              isIconOnly
                              size="sm"
                              variant="outline"
                              onPress={() => onViewReceipt(it.rawReceipt)}
                              aria-label={`Lihat nota ${it.trxId}`}
                              className="min-w-[44px] min-h-[44px] rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] bg-[var(--surface-secondary)] border-[var(--border)]"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(onDeleteTransaction || onVoidTransaction) && (
                              <Button
                                type="button"
                                isIconOnly
                                size="sm"
                                variant="outline"
                                onPress={() => setDeletingTrx(it.rawReceipt)}
                                aria-label={`Hapus transaksi ${it.trxId}`}
                                className="min-w-[44px] min-h-[44px] rounded-xl text-red-700 dark:text-[var(--danger)] bg-[var(--danger-soft)] border-[var(--danger)]/35"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-[var(--separator)]">
                          <span className="text-[var(--muted)] font-mono tabular-nums">
                            <strong className="text-[var(--foreground)]">{it.qty}×</strong> {formatRupiah(it.price)}
                          </span>
                          <div className="text-right font-mono tabular-nums">
                            <span className="font-extrabold text-[var(--foreground)]">{formatRupiah(it.total)}</span>
                            <span className="block text-[10px] font-bold text-emerald-700 dark:text-[var(--success)]">+{formatRupiah(it.margin)}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table (>=640px) */}
                  <div className="hidden sm:block border border-[var(--border)] rounded-2xl overflow-x-auto bg-[var(--surface)]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--muted)] font-bold uppercase text-[10px] bg-[var(--surface-secondary)]">
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
                      <tbody className="divide-y divide-[var(--separator)]">
                        {visibleFlatLogItems.map((it) => (
                          <tr key={it.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                            <td className="py-2.5 px-3 font-mono text-[var(--muted)] whitespace-nowrap">
                              {it.dateTimeStr || it.dateStr}
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-[var(--foreground)]">{it.name}</p>
                              <p className="text-[10px] text-[var(--muted)] font-mono">{it.sku}</p>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="bg-[var(--surface-secondary)] text-[var(--foreground)] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[var(--border)] whitespace-nowrap">
                                {it.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-bold bg-[var(--surface-secondary)] px-2 py-0.5 rounded-full text-[var(--foreground)] border border-[var(--border)] tabular-nums">
                                {it.qty}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-[var(--muted)] tabular-nums font-mono whitespace-nowrap">
                              {formatRupiah(it.price)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-[var(--foreground)] tabular-nums font-mono whitespace-nowrap">
                              {formatRupiah(it.total)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono whitespace-nowrap">
                              +{formatRupiah(it.margin)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  onPress={() => onViewReceipt(it.rawReceipt)}
                                  aria-label={`Lihat nota ${it.trxId}`}
                                  className="text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg min-h-[40px] min-w-[40px]"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {(onDeleteTransaction || onVoidTransaction) && (
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="ghost"
                                    onPress={() => setDeletingTrx(it.rawReceipt)}
                                    aria-label={`Hapus transaksi ${it.trxId}`}
                                    className="text-red-700 dark:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-lg min-h-[40px] min-w-[40px]"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
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
                      <span className="text-xs text-[var(--muted)] font-medium tabular-nums">
                        Menampilkan {visibleFlatLogItems.length} dari {filteredLogItems.length} baris
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onPress={() => setLogVisibleCount((prev) => prev + 50)}
                        className="w-full sm:w-auto px-4 rounded-xl border border-[var(--border)] text-xs font-bold min-h-[44px]"
                      >
                        Muat Lagi (+50)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* ========================================================= */}
      {/* 6. ARUS KAS / BUKU KAS (Finance Management View)         */}
      {/* ========================================================= */}
      <section id="sec-arus-kas" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border border-[var(--success)]/35 flex items-center justify-center font-bold flex-shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                Arus Kas &amp; Buku Kas Pengeluaran
              </h3>
              <p className="text-xs text-[var(--muted)]">
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
      <Modal isOpen={isEditingTarget} onOpenChange={(open) => { if (!open) setIsEditingTarget(false); }}>
        <Modal.Backdrop variant="opaque">
          <Modal.Container placement="auto" size="sm" className="p-0 sm:p-4">
            <Modal.Dialog className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] w-full flex flex-col">
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />
              <form onSubmit={handleTargetSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <Modal.Header className="px-5 pt-2.5 pb-3 border-b border-[var(--separator)] shrink-0 pr-14 flex-row items-center gap-2">
                  <Target className="w-5 h-5 text-[var(--accent)] shrink-0" />
                  <Modal.Heading className="font-bold text-[var(--foreground)] text-sm">
                    Setel Target Omzet Bulanan
                  </Modal.Heading>
                  <Modal.CloseTrigger
                    aria-label="Tutup modal target"
                    className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                  />
                </Modal.Header>

                <Modal.Body className="!mt-0 flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
                  <label className="block text-xs font-bold text-[var(--muted)] mb-1.5">
                    Target Omzet (Rupiah):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--muted)] z-10 pointer-events-none">Rp</span>
                    <Input
                      type="number"
                      fullWidth
                      variant="secondary"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-extrabold text-[var(--foreground)] tabular-nums font-mono min-h-[44px]"
                      placeholder="Contoh: 50000000"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-[var(--muted)] mt-1.5 tabular-nums font-mono">
                    Format: {formatRupiah(Number(targetInput) || 0)}
                  </p>
                </Modal.Body>

                <Modal.Footer className="!mt-0 px-5 py-3 border-t border-[var(--separator)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onPress={() => setIsEditingTarget(false)}
                    className="flex-1 rounded-xl text-xs font-bold min-h-[44px] bg-[var(--surface)]"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1 rounded-xl text-xs font-bold min-h-[44px]"
                  >
                    Simpan Target
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Modal Konfirmasi Hapus Transaksi & Hapus Baris di Google Sheets */}
      <Modal isOpen={Boolean(deletingTrx)} onOpenChange={(open) => { if (!open) setDeletingTrx(null); }}>
        <Modal.Backdrop variant="opaque">
          <Modal.Container placement="auto" size="md" className="p-0 sm:p-4">
            <Modal.Dialog className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] w-full flex flex-col">
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />
              {deletingTrx && (
                <>
                  <Modal.Header className="px-5 pt-2.5 pb-3 border-b border-[var(--separator)] shrink-0 pr-14 flex-row items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-[var(--danger-soft)] border border-[var(--danger)]/35 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5 text-red-700 dark:text-[var(--danger)]" />
                    </div>
                    <div className="min-w-0">
                      <Modal.Heading className="font-extrabold text-[var(--foreground)] text-sm truncate">
                        Hapus Transaksi &amp; Hapus di Sheets
                      </Modal.Heading>
                      <p className="text-[11px] text-[var(--muted)] font-mono truncate">ID: {deletingTrx.id}</p>
                    </div>
                    <Modal.CloseTrigger
                      aria-label="Tutup modal hapus transaksi"
                      className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                    />
                  </Modal.Header>

                  <Modal.Body className="!mt-0 flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5">
                    <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/35 p-3.5 rounded-2xl text-xs text-[var(--foreground)] space-y-1.5">
                      <p className="font-bold flex items-center gap-1.5 text-red-700 dark:text-[var(--danger)]">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Peringatan Penghapusan Permanen:</span>
                      </p>
                      <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                        Tindakan ini akan <strong className="text-[var(--foreground)]">menghapus baris transaksi #{deletingTrx.id} dari sheet LOG_PENJUALAN</strong> di Google Spreadsheet secara permanen dan menghapusnya dari riwayat penjualan aplikasi.
                      </p>
                    </div>

                    <div className="bg-[var(--surface-secondary)] p-3 rounded-2xl text-xs space-y-1.5 border border-[var(--border)]">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Tanggal:</span>
                        <span className="font-semibold text-[var(--foreground)]">{deletingTrx.transactionDate || deletingTrx.date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Total Belanja:</span>
                        <span className="font-bold text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(deletingTrx.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Pelanggan:</span>
                        <span className="text-[var(--foreground)] font-medium">{deletingTrx.customerName || 'Umum'}</span>
                      </div>
                    </div>
                  </Modal.Body>

                  <Modal.Footer className="!mt-0 px-5 py-3 border-t border-[var(--separator)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onPress={() => setDeletingTrx(null)}
                      className="flex-1 rounded-xl text-xs font-bold min-h-[44px] bg-[var(--surface)]"
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onPress={() => {
                        const targetId = deletingTrx.id;
                        setDeletingTrx(null);
                        if (onDeleteTransaction) {
                          onDeleteTransaction(targetId);
                        } else if (onVoidTransaction) {
                          onVoidTransaction(targetId, 'Dihapus dari Riwayat Penjualan');
                        }
                      }}
                      className="flex-1 rounded-xl text-xs font-bold min-h-[44px]"
                    >
                      Ya, Hapus Permanen
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
};
