import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Package, 
  Download, 
  Search, 
  Eye, 
  Trophy, 
  FileSpreadsheet,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Clock,
  BarChart3,
  PieChart,
  Wallet,
  Receipt,
  PlusCircle,
  MinusCircle,
  Fuel,
  Truck,
  Gift,
  Building2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Flame,
  Award,
  CircleDollarSign,
  Trash2,
  Ban,
  X,
  Filter,
  Copy,
  Check,
  FileText,
  MessageSquare,
  Share2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { TransactionReceipt, Product, FinanceRecord, SalesTarget } from '../types';
import { formatRupiah, isDateToday, normalizeDateToYmd, classifyProduct } from '../services/storageService';
import { FinanceManagementView } from './FinanceManagementView';
import { AnalyticsDashboard } from './AnalyticsDashboard';

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
}) => {
  // Main Tab Navigation inside Laporan
  const [activeSubTab, setActiveSubTab] = useState<'ANALYTICS' | 'FINANCE_KAS' | 'SALES_LOG'>('ANALYTICS');

  // Deleting modal state
  const [deletingTrx, setDeletingTrx] = useState<TransactionReceipt | null>(null);

  // Sales log filters & Month filter state
  const [viewMode, setViewMode] = useState<'BY_DATE' | 'FLAT_LOG'>('BY_DATE');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL'); // 'ALL' or 'YYYY-MM'
  const [targetGrain, setTargetGrain] = useState<'HARIAN' | 'MINGGUAN' | 'BULANAN'>('BULANAN');
  const [dayOffset, setDayOffset] = useState<number>(1); // Default offset +1 day (maju 1 hari untuk progress hari ini)
  const [timeFilter, setTimeFilter] = useState<'TODAY' | '7DAYS' | '30DAYS' | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Daily Report WhatsApp Card State (Sesuai formula Google Sheets)
  const [selectedReportDate, setSelectedReportDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [showReportText, setShowReportText] = useState<boolean>(true);
  const [isCopiedReport, setIsCopiedReport] = useState<boolean>(false);

  // Target Editing State
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(salesTarget.targetAmount || 50000000));

  // Keyboard shortcut: Esc to close modal or cancel target edit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingTrx) setDeletingTrx(null);
        if (isEditingTarget) setIsEditingTarget(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletingTrx, isEditingTarget]);

  // Available unique YYYY-MM months derived from transactions & current month
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

  // Handle target submit with validation
  const handleTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = parseFloat(String(targetInput).replace(/[^0-9]/g, ''));
    if (isNaN(cleanNum) || cleanNum <= 0) {
      showToast?.('Mohon masukkan nominal target yang valid (lebih dari 0).', 'error');
      return;
    }
    onSaveSalesTarget(cleanNum, selectedMonth !== 'ALL' ? selectedMonth : undefined);
    setIsEditingTarget(false);
    showToast?.(`✓ Target penjualan disimpan: ${formatRupiah(cleanNum)}`, 'success');
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedMonth('ALL');
    setTimeFilter('ALL');
    setCategoryFilter('ALL');
    setPaymentFilter('ALL');
    setSearchQuery('');
    showToast?.('Semua filter periode dan pencarian telah direset.', 'info');
  };

  // Navigasi tanggal report harian
  const handleShiftReportDate = (deltaDays: number) => {
    const [y, m, d] = selectedReportDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const nextYmd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    setSelectedReportDate(nextYmd);
  };

  // Logika Generator Report Harian sesuai formula Google Sheets LET(...)
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
        // Total botol fisik
        if (qty > 0 && !upperName.startsWith('PROMO:') && !upperName.startsWith('DISKON:')) {
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

    // Format angka ribuan #,##0
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

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const expandAllDates = (allKeys: string[]) => {
    const next: Record<string, boolean> = {};
    allKeys.forEach((k) => { next[k] = true; });
    setExpandedDates(next);
  };

  const collapseAllDates = (allKeys: string[]) => {
    const next: Record<string, boolean> = {};
    allKeys.forEach((k) => { next[k] = false; });
    setExpandedDates(next);
  };

  // Flatten items for analysis and logging
  const allFlattenedItems = useMemo(() => {
    const list: FlattenedSaleItem[] = [];

    transactions.forEach((t) => {
      const rawId = String(t.id || '').trim();
      if (rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-')) {
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

  // Available unique categories derived from transactions & products
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    allFlattenedItems.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [products, allFlattenedItems]);

  // Monthly stats and MoM Growth Calculations based on selectedMonth or current month
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const currentMonthKey = selectedMonth !== 'ALL'
      ? selectedMonth
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Calculate previous month key
    const [cYear, cMonth] = currentMonthKey.split('-').map(Number);
    const prevMonthDate = new Date(cYear, cMonth - 2, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    let curOmset = 0;
    let curMargin = 0;
    let curTrxCount = 0;

    let prevOmset = 0;
    let prevMargin = 0;
    let prevTrxCount = 0;

    transactions.forEach((t) => {
      const dateYmd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!dateYmd) return;
      const monthKey = dateYmd.slice(0, 7); // YYYY-MM

      if (monthKey === currentMonthKey) {
        curOmset += Number(t.subtotal || t.total || 0);
        curMargin += Number(t.margin || 0);
        curTrxCount += 1;
      } else if (monthKey === prevMonthKey) {
        prevOmset += Number(t.subtotal || t.total || 0);
        prevMargin += Number(t.margin || 0);
        prevTrxCount += 1;
      }
    });

    const calcGrowth = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };

    return {
      currentMonthKey,
      prevMonthKey,
      curOmset,
      curMargin,
      curTrxCount,
      prevOmset,
      prevMargin,
      prevTrxCount,
      omsetGrowth: calcGrowth(curOmset, prevOmset),
      marginGrowth: calcGrowth(curMargin, prevMargin),
      trxGrowth: calcGrowth(curTrxCount, prevTrxCount),
    };
  }, [transactions, selectedMonth]);

  // Today's total sales
  const todayYmd = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);
  const todayOmset = useMemo(() => {
    return transactions
      .filter((t) => {
        const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
        return ymd === todayYmd;
      })
      .reduce((sum, t) => sum + Number(t.subtotal || t.total || 0), 0);
  }, [transactions, todayYmd]);

  // Week's total sales (last 7 days)
  const weekOmset = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((t) => {
        const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
        if (!ymd) return false;
        const tDate = new Date(ymd);
        const diffDays = (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      })
      .reduce((sum, t) => sum + Number(t.subtotal || t.total || 0), 0);
  }, [transactions]);

  // Target Progress Calculations supporting Harian, Mingguan, Bulanan & +1 Day Advance Offset
  const targetProgress = useMemo(() => {
    const baseMonthlyTarget = salesTarget.targetAmount || 50000000;
    const [year, month] = monthlyComparison.currentMonthKey.split('-').map(Number);
    const now = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month;
    const rawCurrentDay = isCurrentMonth ? now.getDate() : daysInMonth;
    
    // Effective day count advancing +dayOffset (e.g., +1 for progress ditujukan buat hari ini)
    const effectiveDay = Math.min(daysInMonth, Math.max(1, rawCurrentDay + dayOffset));
    // Remaining days in month includes today in active progress count
    const daysRemaining = isCurrentMonth ? Math.max(1, daysInMonth - rawCurrentDay + 1) : 1;

    let target = baseMonthlyTarget;
    let achieved = monthlyComparison.curOmset;
    let grainTitle = 'Target Omzet Bulanan';
    let grainSubtitle = `Bulan ini (Hari ke-${effectiveDay} dari ${daysInMonth} Hari)`;

    if (targetGrain === 'HARIAN') {
      target = Math.round(baseMonthlyTarget / daysInMonth);
      achieved = todayOmset;
      grainTitle = 'Target Omzet Harian';
      grainSubtitle = `Progress Hari Ini (${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}${dayOffset !== 0 ? ` • Target Maju +${dayOffset} Hari` : ''})`;
    } else if (targetGrain === 'MINGGUAN') {
      target = Math.round((baseMonthlyTarget / daysInMonth) * 7);
      achieved = weekOmset;
      grainTitle = 'Target Omzet Mingguan';
      grainSubtitle = `Minggu Ini (7 Hari Terakhir${dayOffset !== 0 ? ` • Progress Maju +${dayOffset} Hari` : ''})`;
    } else {
      // BULANAN
      target = baseMonthlyTarget;
      achieved = monthlyComparison.curOmset;
      grainTitle = 'Target Omzet Bulanan';
      grainSubtitle = `Hari ke-${effectiveDay} dari ${daysInMonth} Hari (${new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}${dayOffset !== 0 ? ` • Progress Maju +${dayOffset} Hari` : ''})`;
    }

    const percent = Math.min(100, Math.round((achieved / target) * 100));
    const remaining = Math.max(0, target - achieved);

    const remainingMonthlyOmset = Math.max(0, baseMonthlyTarget - monthlyComparison.curOmset);
    const requiredDailyRate = daysRemaining > 0 && remainingMonthlyOmset > 0 
      ? Math.ceil(remainingMonthlyOmset / daysRemaining) 
      : 0;

    const currentDailyAvg = rawCurrentDay > 0 ? Math.round(monthlyComparison.curOmset / rawCurrentDay) : 0;
    const expectedPace = Math.round((baseMonthlyTarget / daysInMonth) * effectiveDay);

    return {
      baseMonthlyTarget,
      target,
      achieved,
      percent,
      remaining,
      daysInMonth,
      currentDay: rawCurrentDay,
      effectiveDay,
      daysRemaining,
      requiredDailyRate,
      currentDailyAvg,
      expectedPace,
      grainTitle,
      grainSubtitle,
      isCurrentMonth,
    };
  }, [salesTarget, monthlyComparison, targetGrain, dayOffset, todayOmset, weekOmset]);

  // Top Products Ranking
  const topProducts = useMemo(() => {
    const map = new Map<string, { sku: string; name: string; category: string; qty: number; revenue: number; margin: number }>();

    allFlattenedItems.forEach((it) => {
      if (selectedMonth !== 'ALL' && (!it.dateYmd || !it.dateYmd.startsWith(selectedMonth))) return;

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

    const list = Array.from(map.values()).sort((a, b) => b.qty - a.qty);
    const maxQty = list.length > 0 ? list[0].qty : 1;

    return list.slice(0, 8).map((p, idx) => ({
      ...p,
      rank: idx + 1,
      percentOfTop: Math.round((p.qty / maxQty) * 100),
    }));
  }, [allFlattenedItems, selectedMonth]);

  // Chart Trend Data (Grouped by Date for Recharts)
  const chartTrendData = useMemo(() => {
    const map = new Map<string, { dateYmd: string; dateLabel: string; omset: number; margin: number; financeIncome: number; financeExpense: number }>();

    if (selectedMonth !== 'ALL') {
      // Seed all days in the selected month (1..daysInMonth)
      const [year, month] = selectedMonth.split('-').map(Number);
      const totalDays = new Date(year, month, 0).getDate();
      for (let day = 1; day <= totalDays; day++) {
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        const ymd = `${year}-${monthStr}-${dayStr}`;
        const label = `${dayStr}/${monthStr}`;
        map.set(ymd, { dateYmd: ymd, dateLabel: label, omset: 0, margin: 0, financeIncome: 0, financeExpense: 0 });
      }
    } else {
      // Seed last 14 days
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        map.set(ymd, { dateYmd: ymd, dateLabel: label, omset: 0, margin: 0, financeIncome: 0, financeExpense: 0 });
      }
    }

    transactions.forEach((t) => {
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!ymd) return;

      if (selectedMonth !== 'ALL' && !ymd.startsWith(selectedMonth)) return;

      const existing = map.get(ymd);
      if (existing) {
        existing.omset += Number(t.subtotal || t.total || 0);
        existing.margin += Number(t.margin || 0);
      } else if (selectedMonth === 'ALL') {
        const dParts = ymd.split('-');
        const label = `${dParts[2]}/${dParts[1]}`;
        map.set(ymd, {
          dateYmd: ymd,
          dateLabel: label,
          omset: Number(t.subtotal || t.total || 0),
          margin: Number(t.margin || 0),
          financeIncome: 0,
          financeExpense: 0,
        });
      }
    });

    financeRecords.forEach((f) => {
      const ymd = f.dateYmd || normalizeDateToYmd(f.date || '');
      if (!ymd) return;

      if (selectedMonth !== 'ALL' && !ymd.startsWith(selectedMonth)) return;

      const existing = map.get(ymd);
      if (existing) {
        if (f.type === 'INCOME') {
          existing.financeIncome += f.amount;
        } else {
          existing.financeExpense += f.amount;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));
  }, [transactions, financeRecords, selectedMonth]);

  // Net Cash Flow Aggregations
  const totalSalesOmset = useMemo(() => {
    return transactions
      .filter((t) => {
        if (selectedMonth === 'ALL') return true;
        const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
        return ymd ? ymd.startsWith(selectedMonth) : true;
      })
      .reduce((sum, t) => sum + Number(t.subtotal || t.total || 0), 0);
  }, [transactions, selectedMonth]);

  const totalSalesMargin = useMemo(() => {
    return transactions
      .filter((t) => {
        if (selectedMonth === 'ALL') return true;
        const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
        return ymd ? ymd.startsWith(selectedMonth) : true;
      })
      .reduce((sum, t) => sum + Number(t.margin || 0), 0);
  }, [transactions, selectedMonth]);

  const totalFinanceIncome = useMemo(() => {
    return financeRecords
      .filter((f) => {
        if (f.type !== 'INCOME') return false;
        if (selectedMonth === 'ALL') return true;
        const ymd = f.dateYmd || normalizeDateToYmd(f.date || '');
        return ymd ? ymd.startsWith(selectedMonth) : true;
      })
      .reduce((sum, f) => sum + f.amount, 0);
  }, [financeRecords, selectedMonth]);

  const totalFinanceExpense = useMemo(() => {
    return financeRecords
      .filter((f) => {
        if (f.type !== 'EXPENSE') return false;
        if (selectedMonth === 'ALL') return true;
        const ymd = f.dateYmd || normalizeDateToYmd(f.date || '');
        return ymd ? ymd.startsWith(selectedMonth) : true;
      })
      .reduce((sum, f) => sum + f.amount, 0);
  }, [financeRecords, selectedMonth]);

  const totalUangMasuk = totalSalesOmset + totalFinanceIncome;
  const totalUangKeluar = totalFinanceExpense;
  const netCashFlow = totalUangMasuk - totalUangKeluar;

  // Filtered Items for Sales Log View
  const filteredItems = useMemo(() => {
    const now = new Date();
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return allFlattenedItems.filter((item) => {
      if (selectedMonth !== 'ALL') {
        if (!item.dateYmd || !item.dateYmd.startsWith(selectedMonth)) return false;
      }

      if (timeFilter === 'TODAY') {
        if (item.dateYmd !== todayYmd) return false;
      } else if (timeFilter === '7DAYS') {
        const itemDate = new Date(item.dateYmd);
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (timeFilter === '30DAYS') {
        const itemDate = new Date(item.dateYmd);
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (paymentFilter !== 'ALL' && item.paymentMethod !== paymentFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.customer.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.trxId.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allFlattenedItems, timeFilter, categoryFilter, paymentFilter, searchQuery, selectedMonth]);

  // Group items by date for BY_DATE view
  const dateGroups = useMemo(() => {
    const map = new Map<string, DateSalesGroup>();

    filteredItems.forEach((item) => {
      const key = item.dateStr || 'Lainnya';
      const dateYmd = item.dateYmd;

      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          dateDisplay: key,
          dateYmd,
          totalOmset: 0,
          totalHPP: 0,
          totalMargin: 0,
          totalQty: 0,
          itemCount: 0,
          paymentMethods: {},
          items: [],
          rawReceipt: item.rawReceipt,
        });
      }

      const group = map.get(key)!;
      group.totalOmset += item.total;
      group.totalHPP += (item.cost * item.qty);
      group.totalMargin += item.margin;
      group.totalQty += item.qty;
      group.itemCount += 1;
      group.items.push(item);

      const pm = item.paymentMethod || 'CASH';
      group.paymentMethods[pm] = (group.paymentMethods[pm] || 0) + item.total;
    });

    return Array.from(map.values()).sort((a, b) => b.dateYmd.localeCompare(a.dateYmd));
  }, [filteredItems]);

  // CSV Export
  const exportToCSV = () => {
    const headers = ['ID Transaksi', 'Tanggal', 'Jam', 'SKU', 'Nama Produk', 'Kategori', 'Harga Jual', 'HPP Cost', 'Qty', 'Total Omset', 'Margin Profit', 'Pelanggan', 'Metode Bayar'];
    const rows = filteredItems.map((it) => [
      it.trxId,
      it.dateStr,
      it.timeStr,
      `"${it.sku}"`,
      `"${it.name}"`,
      `"${it.category}"`,
      it.price,
      it.cost,
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
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Top Navigation & Sub-Tab Selector */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#1E232D] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Laporan Keuangan & Analytics
            </span>
            <span className="text-stone-400 text-xs font-medium">• ORTUKILL POS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mt-1">
            {activeSubTab === 'ANALYTICS' && 'Grafik Performance & Target Penjualan'}
            {activeSubTab === 'FINANCE_KAS' && 'Buku Kas Non-Penjualan'}
            {activeSubTab === 'SALES_LOG' && 'Riwayat & Log Nota Penjualan'}
          </h2>
        </div>

        {/* Sub-tab Switcher Buttons */}
        <div className="flex items-center gap-1.5 bg-stone-100/90 p-1.5 rounded-2xl border border-stone-200/60 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('ANALYTICS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'ANALYTICS'
                ? 'bg-[#FF5E36] text-white shadow-md'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Grafik & Target</span>
          </button>

          <button
            onClick={() => setActiveSubTab('FINANCE_KAS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'FINANCE_KAS'
                ? 'bg-[#FF5E36] text-white shadow-md'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Buku Kas / Pengeluaran</span>
          </button>

          <button
            onClick={() => setActiveSubTab('SALES_LOG')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'SALES_LOG'
                ? 'bg-[#FF5E36] text-white shadow-md'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Log Nota Detail</span>
          </button>
        </div>
      </div>

      {/* Global Month Filter Control Bar */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-stone-800 bg-stone-100 px-3 py-1.5 rounded-2xl border border-stone-200/60">
            <Calendar className="w-4 h-4 text-[#FF5E36]" />
            <span>Filter Periode:</span>
          </div>

          {/* Quick Grain Filter Pills (Harian, Mingguan, Bulanan) */}
          <div className="flex items-center bg-stone-100/90 p-1 rounded-2xl border border-stone-200/80">
            <button
              onClick={() => {
                setTimeFilter('TODAY');
                setTargetGrain('HARIAN');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'TODAY' && targetGrain === 'HARIAN'
                  ? 'bg-[#1E232D] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => {
                setTimeFilter('7DAYS');
                setTargetGrain('MINGGUAN');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeFilter === '7DAYS' && targetGrain === 'MINGGUAN'
                  ? 'bg-[#1E232D] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Mingguan
            </button>
            <button
              onClick={() => {
                setTimeFilter('30DAYS');
                setTargetGrain('BULANAN');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                (timeFilter === '30DAYS' || timeFilter === 'ALL') && targetGrain === 'BULANAN'
                  ? 'bg-[#1E232D] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Bulanan
            </button>
          </div>

          <div className="h-4 w-px bg-stone-200 mx-1 hidden sm:block" />

          {/* Quick Month Filter Buttons */}
          <button
            onClick={() => {
              setSelectedMonth('ALL');
              setTimeFilter('ALL');
            }}
            className={`px-3 py-1.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
              selectedMonth === 'ALL'
                ? 'bg-stone-200 text-stone-900'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80'
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
                className={`px-3 py-1.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                  selectedMonth === curStr
                    ? 'bg-[#FF5E36] text-white shadow-xs'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80'
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
              className="appearance-none bg-stone-50 text-stone-800 text-xs font-extrabold pl-3.5 pr-8 py-1.5 rounded-2xl border border-stone-200 hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/30 cursor-pointer min-h-[36px]"
            >
              <option value="ALL">Pilih Bulan Lain...</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthLabel(ym)} ({ym})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Active Month Indicator */}
        {selectedMonth !== 'ALL' && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-extrabold bg-[#FFF2ED] text-[#FF5E36] px-3 py-1 rounded-2xl border border-[#FF5E36]/30 flex items-center gap-1.5">
              <span>Periode: <strong>{formatMonthLabel(selectedMonth)}</strong></span>
            </span>
            <button
              onClick={() => setSelectedMonth('ALL')}
              className="text-[11px] font-bold text-stone-500 hover:text-stone-900 underline cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* KARTU REPORT HARIAN (TEKS & SALIN REPORT WA) SESUAI FORMULA GOOGLE SHEETS */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-stone-200/90 space-y-4">
        {/* Header Kartu: Judul di kiri & Pilihan Tanggal di sebelah kanan judul */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 shadow-xs border border-emerald-100">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  Report Harian (Teks & WA)
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  Formula Sheets
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Format teks rekap botol, omset, dan cuan siap kirim ke WhatsApp / Catatan.
              </p>
            </div>
          </div>

          {/* Pilihan Tanggal di Sebelah Judul Kartu & Tombol Aksi */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Navigasi Cepat Tanggal: <, Picker, > */}
            <div className="flex items-center bg-stone-50 border border-stone-200 rounded-2xl p-1 gap-1">
              <button
                type="button"
                onClick={() => handleShiftReportDate(-1)}
                className="w-7 h-7 flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/70 transition-colors cursor-pointer text-xs font-bold"
                title="Hari Sebelumnya"
              >
                ◀
              </button>

              <div className="relative flex items-center">
                <input
                  type="date"
                  value={selectedReportDate}
                  onChange={(e) => e.target.value && setSelectedReportDate(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-stone-800 px-2 py-1 focus:outline-none cursor-pointer"
                  title="Pilih tanggal report"
                />
              </div>

              <button
                type="button"
                onClick={() => handleShiftReportDate(1)}
                className="w-7 h-7 flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/70 transition-colors cursor-pointer text-xs font-bold"
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
              className="px-2.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all cursor-pointer min-h-[38px]"
            >
              Hari Ini
            </button>

            {/* Tombol Text (Toggle Tampilkan / Sembunyikan Teks) */}
            <button
              type="button"
              onClick={() => setShowReportText((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer min-h-[38px] ${
                showReportText
                  ? 'bg-stone-800 text-white border-stone-800 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
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
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer min-h-[38px] ${
                isCopiedReport
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#FF5E36] hover:bg-[#F24E24] text-white active:scale-95'
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-xs transition-all cursor-pointer min-h-[38px]"
              title="Kirim langsung teks report ke WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </div>
        </div>

        {/* 3 Metric Summary: QTY BTL, OMSET, CUAN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              QTY BTL (Total Botol)
            </p>
            <p className="text-lg sm:text-xl font-black text-stone-900 mt-0.5">
              {dailyReportData.totalBtl} <span className="text-xs font-bold text-stone-500">Btl</span>
            </p>
          </div>

          <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              OMSET
            </p>
            <p className="text-lg sm:text-xl font-black text-stone-900 mt-0.5">
              Rp {new Intl.NumberFormat('en-US').format(Math.round(dailyReportData.totalOmset))}
            </p>
          </div>

          <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              CUAN (Margin Profit)
            </p>
            <p className="text-lg sm:text-xl font-black text-emerald-800 mt-0.5">
              Rp {new Intl.NumberFormat('en-US').format(Math.round(dailyReportData.totalMargin))}
            </p>
          </div>
        </div>

        {/* Text Preview Box jika showReportText aktif */}
        {showReportText && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs text-stone-500 px-1">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Format teks siap kirim ({dailyReportData.formattedDateHeader}):
              </span>
              <span className="text-[11px] font-mono text-stone-400">
                {dailyReportData.itemCount} jenis produk • {dailyReportData.trxCount} nota
              </span>
            </div>

            <div className="relative group">
              <pre className="w-full p-4 bg-stone-900 text-stone-100 rounded-2xl text-xs sm:text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre select-all shadow-inner border border-stone-800 max-h-72">
                {dailyReportData.fullReportText}
              </pre>

              <button
                type="button"
                onClick={handleCopyReportText}
                className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl backdrop-blur-xs transition-all cursor-pointer opacity-90 hover:opacity-100"
                title="Salin Teks"
              >
                {isCopiedReport ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUB TAB 1: ANALYTICS & GRAPH DASHBOARD */}
      {activeSubTab === 'ANALYTICS' && (
        <AnalyticsDashboard
          transactions={transactions}
          financeRecords={financeRecords}
          salesTarget={salesTarget}
          selectedMonth={selectedMonth}
          targetGrain={targetGrain}
          onSaveSalesTarget={onSaveSalesTarget}
          showToast={showToast}
          onGoToKas={() => setActiveSubTab('FINANCE_KAS')}
        />
      )}

      {/* SUB TAB 2: CATATAN KEUANGAN NON-PENJUALAN */}
      {activeSubTab === 'FINANCE_KAS' && (
        <FinanceManagementView
          financeRecords={financeRecords}
          onAddRecord={onAddFinanceRecord}
          onDeleteRecord={onDeleteFinanceRecord}
          onSyncSpreadsheet={onSyncSpreadsheet}
          isSyncing={isSyncing}
        />
      )}

      {/* SUB TAB 3: LOG NOTA PENJUALAN DETAIL */}
      {activeSubTab === 'SALES_LOG' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-stone-200/80 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari SKU, Nama Produk, Nota ID, atau Pelanggan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5E36] bg-stone-50/50"
                />
              </div>

              {/* View mode toggle & Export */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200/60">
                  <button
                    onClick={() => setViewMode('BY_DATE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'BY_DATE' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                    }`}
                  >
                    Group per Tanggal
                  </button>
                  <button
                    onClick={() => setViewMode('FLAT_LOG')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'FLAT_LOG' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                    }`}
                  >
                    Flat Log Item
                  </button>
                </div>

                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
              <span className="text-stone-400 text-[11px] mr-1">Filter Periode:</span>
              {(['ALL', 'TODAY', '7DAYS', '30DAYS'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFilter(tf)}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                    timeFilter === tf
                      ? 'bg-[#1E232D] text-white border-transparent'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {tf === 'ALL' && 'Semua Waktu'}
                  {tf === 'TODAY' && 'Hari Ini'}
                  {tf === '7DAYS' && '7 Hari Terakhir'}
                  {tf === '30DAYS' && '30 Hari Terakhir'}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped by Date View */}
          {viewMode === 'BY_DATE' ? (
            <div className="space-y-4">
              {dateGroups.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center text-stone-400">
                  <Receipt className="w-12 h-12 mx-auto stroke-[1.5] text-stone-300" />
                  <p className="text-sm font-bold text-stone-700 mt-2">Tidak ada data penjualan sesuai filter</p>
                </div>
              ) : (
                dateGroups.map((group) => {
                  const isExpanded = expandedDates[group.dateKey] !== false; // expanded by default
                  return (
                    <div
                      key={group.dateKey}
                      className="bg-white rounded-3xl shadow-xs border border-stone-200/80 overflow-hidden"
                    >
                      {/* Date Group Header */}
                      <div
                        onClick={() => toggleDateExpand(group.dateKey)}
                        className="p-4 sm:p-5 bg-stone-50/80 hover:bg-stone-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors border-b border-stone-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#FF5E36] text-white flex items-center justify-center font-bold">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-base font-black text-stone-900">
                              {group.dateDisplay}
                            </h4>
                            <p className="text-xs text-stone-500 font-medium">
                              {group.items.length} item terjual • {group.totalQty} Pcs total
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="text-right">
                            <p className="text-base font-black text-stone-900">
                              {formatRupiah(group.totalOmset)}
                            </p>
                            <p className="text-xs font-bold text-emerald-700">
                              Margin: +{formatRupiah(group.totalMargin)}
                            </p>
                          </div>

                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-stone-500 shadow-xs">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Items Table inside Date Group */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 space-y-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                                  <th className="pb-2">Waktu / Nota ID</th>
                                  <th className="pb-2">SKU & Nama Produk</th>
                                  <th className="pb-2 text-center">Harga Jual</th>
                                  <th className="pb-2 text-center">Qty</th>
                                  <th className="pb-2 text-right">Total Omset</th>
                                  <th className="pb-2 text-right">Margin Profit</th>
                                  <th className="pb-2 text-center">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {group.items.map((it) => (
                                  <tr key={it.id} className="hover:bg-stone-50/60 transition-colors">
                                    <td className="py-2.5 font-mono text-stone-600">
                                      {it.timeStr || it.dateStr}
                                      <span className="block text-[10px] text-stone-400">{it.trxId}</span>
                                    </td>
                                    <td className="py-2.5">
                                      <p className="font-bold text-stone-900">{it.name}</p>
                                      <p className="text-[10px] text-stone-400 font-mono">{it.sku}</p>
                                    </td>
                                    <td className="py-2.5 text-center font-medium">
                                      {formatRupiah(it.price)}
                                    </td>
                                    <td className="py-2.5 text-center">
                                      <span className="font-bold bg-stone-100 px-2 py-0.5 rounded-full text-stone-800">
                                        {it.qty}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-right font-black text-stone-900">
                                      {formatRupiah(it.total)}
                                    </td>
                                    <td className="py-2.5 text-right font-bold text-emerald-700">
                                      +{formatRupiah(it.margin)}
                                    </td>
                                    <td className="py-2.5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => onViewReceipt(it.rawReceipt)}
                                          className="p-1.5 text-stone-400 hover:text-[#FF5E36] hover:bg-[#FFF2ED] rounded-xl transition-all cursor-pointer"
                                          title="Lihat Nota"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        {(onDeleteTransaction || onVoidTransaction) && (
                                          <button
                                            onClick={() => setDeletingTrx(it.rawReceipt)}
                                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                            title="Hapus Transaksi & Hapus Baris di Google Sheets"
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
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Flat Log Item View */
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                      <th className="pb-3">Tanggal & Waktu</th>
                      <th className="pb-3">SKU & Nama Produk</th>
                      <th className="pb-3">Kategori</th>
                      <th className="pb-3 text-center">Harga Jual</th>
                      <th className="pb-3 text-center">Qty</th>
                      <th className="pb-3 text-right">Total Omset</th>
                      <th className="pb-3 text-right">Margin Profit</th>
                      <th className="pb-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredItems.map((it) => (
                      <tr key={it.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 font-mono text-stone-600">
                          {it.dateTimeStr || it.dateStr}
                        </td>
                        <td className="py-3">
                          <p className="font-bold text-stone-900">{it.name}</p>
                          <p className="text-[10px] text-stone-400 font-mono">{it.sku}</p>
                        </td>
                        <td className="py-3">
                          <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {it.category}
                          </span>
                        </td>
                        <td className="py-3 text-center font-medium">
                          {formatRupiah(it.price)}
                        </td>
                        <td className="py-3 text-center">
                          <span className="font-bold bg-stone-100 px-2 py-0.5 rounded-full text-stone-800">
                            {it.qty}
                          </span>
                        </td>
                        <td className="py-3 text-right font-black text-stone-900">
                          {formatRupiah(it.total)}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-700">
                          +{formatRupiah(it.margin)}
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onViewReceipt(it.rawReceipt)}
                              className="p-1.5 text-stone-400 hover:text-[#FF5E36] hover:bg-[#FFF2ED] rounded-xl transition-all cursor-pointer"
                              title="Lihat Nota"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {(onDeleteTransaction || onVoidTransaction) && (
                              <button
                                onClick={() => setDeletingTrx(it.rawReceipt)}
                                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                title="Hapus Transaksi & Hapus Baris di Google Sheets"
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
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Transaksi & Hapus Baris di Google Sheets */}
      {deletingTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm">Hapus Transaksi & Hapus di Sheets</h3>
                  <p className="text-[11px] text-stone-400 font-mono">ID: {deletingTrx.id}</p>
                </div>
              </div>
              <button
                onClick={() => setDeletingTrx(null)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50/70 border border-rose-100 p-3.5 rounded-2xl text-xs text-rose-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Peringatan Penghapusan Permanen:</span>
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Tindakan ini akan <strong>menghapus baris transaksi #{deletingTrx.id} dari sheet LOG_PENJUALAN</strong> di Google Spreadsheet secara permanen dan menghapusnya dari riwayat penjualan aplikasi.
              </p>
            </div>

            <div className="bg-stone-50 p-3 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Tanggal:</span>
                <span className="font-semibold text-stone-800">{deletingTrx.transactionDate || deletingTrx.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total Belanja:</span>
                <span className="font-bold text-stone-900">{formatRupiah(deletingTrx.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Pelanggan:</span>
                <span className="text-stone-800">{deletingTrx.customerName || 'Umum'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTrx(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50 cursor-pointer min-h-[44px]"
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
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer min-h-[44px]"
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
