import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  Edit3, 
  Trophy, 
  CircleDollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Check, 
  Flame, 
  Award,
  Wallet,
  Receipt,
  Package,
  Calendar,
  Sparkles,
  ArrowRight
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
import { TransactionReceipt, FinanceRecord, SalesTarget, BarangMasukRecord } from '../types';
import { formatRupiah, normalizeDateToYmd, classifyProduct, StorageService } from '../services/storageService';

export interface AnalyticsDashboardProps {
  transactions: TransactionReceipt[];
  financeRecords: FinanceRecord[];
  salesTarget: SalesTarget;
  selectedMonth: string; // 'ALL' or 'YYYY-MM'
  targetGrain: 'HARIAN' | 'MINGGUAN' | 'BULANAN';
  onSaveSalesTarget: (targetAmount: number, month?: string) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  onGoToKas: () => void;
  barangMasukRecords?: BarangMasukRecord[];
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
}

// Helper: Format tanggal lokal YYYY-MM-DD
const getLocalYmd = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper: Format sumbu Y dalam rb/jt
const formatYAxisRbJt = (val: number): string => {
  if (Math.abs(val) >= 1000000) {
    const jt = val / 1000000;
    return `${jt % 1 === 0 ? jt : jt.toFixed(1)}jt`;
  }
  if (Math.abs(val) >= 1000) {
    return `${Math.round(val / 1000)}rb`;
  }
  return String(val);
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  transactions,
  financeRecords,
  salesTarget,
  selectedMonth,
  targetGrain,
  onSaveSalesTarget,
  showToast,
  onGoToKas,
  barangMasukRecords,
}) => {
  // Ambil riwayat barang masuk dari sub menu stock (LOG_BARANG_MASUK)
  const stockInRecords = useMemo(() => {
    if (barangMasukRecords && barangMasukRecords.length > 0) {
      return barangMasukRecords;
    }
    return StorageService.getBarangMasukList();
  }, [barangMasukRecords]);

  // State lokal: dayOffset & state edit target
  const [dayOffset, setDayOffset] = useState<number>(1); // Default +1 hari
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [targetInput, setTargetInput] = useState<string>(String(salesTarget.targetAmount || 50000000));

  // State ranking produk: QTY | OMZET | CUAN
  const [productRankingMetric, setProductRankingMetric] = useState<'QTY' | 'OMZET' | 'CUAN'>('QTY');

  // Keyboard shortcut: Esc to cancel target editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditingTarget) {
        setIsEditingTarget(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingTarget]);

  // Handle submit edit target
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

  // Flattening item transaksi persis seperti allFlattenedItems (mengabaikan VOIDED)
  const flattenedItems = useMemo(() => {
    const list: FlattenedSaleItem[] = [];

    transactions.forEach((t) => {
      const rawId = String(t.id || '').trim();
      if (
        rawId.toUpperCase().startsWith('VOIDED-') || 
        rawId.toUpperCase().startsWith('#VOIDED-') || 
        t.status === 'VOIDED'
      ) {
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
        });
      });
    });

    return list;
  }, [transactions]);

  // Periode aktif bulan (YYYY-MM) dan bulan sebelumnya
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

    // Transaksi valid (bukan VOIDED)
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

      if (mKey === currentMonthKey) {
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
      } else if (mKey === prevMonthKey) {
        if (dayNum <= N) {
          prevOmset_N += omset;
          prevCuan_N += cuan;
          prevNota_N += 1;
          prevBotol_N += trxBotol;
        }
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
  }, [transactions, activeMonthInfo]);

  // Target Progress: 1 progress bar + garis pace ideal + status 1 kalimat + proyeksi akhir bulan
  const targetProgress = useMemo(() => {
    const { daysInCurMonth, isCurrentMonth, cYear, cMonth } = activeMonthInfo;
    const now = new Date();
    const baseMonthlyTarget = salesTarget.targetAmount || 50000000;
    const currentDay = isCurrentMonth ? now.getDate() : daysInCurMonth;
    const effectiveDay = Math.min(daysInCurMonth, Math.max(1, currentDay + dayOffset));
    const daysRemaining = isCurrentMonth ? Math.max(1, daysInCurMonth - currentDay + 1) : 1;

    // Omset hari ini & minggu ini (7 hari terakhir)
    const todayStr = getLocalYmd(now);
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
    const rawPercent = target > 0 ? Math.round((achieved / target) * 100) : 0;
    const remaining = Math.max(0, target - achieved);

    // Pace ideal untuk hari berjalan
    const idealPace = Math.round((baseMonthlyTarget / daysInCurMonth) * effectiveDay);
    const idealPacePercent = Math.min(100, Math.round((effectiveDay / daysInCurMonth) * 100));

    // Daily run rate & Proyeksi akhir bulan
    const dailyAverage = currentDay > 0 ? Math.round(kpiStats.omset / currentDay) : 0;
    const projectedMonthEnd = Math.round(dailyAverage * daysInCurMonth);
    const projectedPercent = baseMonthlyTarget > 0 ? Math.round((projectedMonthEnd / baseMonthlyTarget) * 100) : 0;

    const remainingMonthlyOmset = Math.max(0, baseMonthlyTarget - kpiStats.omset);
    const requiredDailyRate = daysRemaining > 0 && remainingMonthlyOmset > 0 
      ? Math.ceil(remainingMonthlyOmset / daysRemaining) 
      : 0;

    // Status satu kalimat
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
      rawPercent,
      remaining,
      idealPace,
      idealPacePercent,
      grainLabel,
      effectiveDay,
      currentDay,
      daysInCurMonth,
      daysRemaining,
      dailyAverage,
      projectedMonthEnd,
      projectedPercent,
      requiredDailyRate,
      statusSentence,
    };
  }, [activeMonthInfo, salesTarget, kpiStats.omset, targetGrain, dayOffset, transactions]);

  // ComposedChart Data: bar omzet + line cuan, hari kosong tetap tampil
  const chartTrendData = useMemo(() => {
    const { cYear, cMonth, daysInCurMonth, currentMonthKey } = activeMonthInfo;
    const dataMap = new Map<string, { day: number; dateYmd: string; dateLabel: string; omset: number; margin: number }>();

    // Seed semua hari 1..daysInCurMonth agar hari kosong tetap tampil
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

    transactions.forEach((t) => {
      if (t.status === 'VOIDED') return;
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!ymd || !ymd.startsWith(currentMonthKey)) return;

      const item = dataMap.get(ymd);
      if (item) {
        item.omset += Number(t.subtotal || t.total || 0);
        item.margin += Number(t.margin || 0);
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a.day - b.day);
  }, [transactions, activeMonthInfo]);

  // Insight 2 kolom: Hari terbaik, Jam teramai, Metode bayar %
  const insights = useMemo(() => {
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
      if (!ymd || !ymd.startsWith(currentMonthKey)) return;

      const omset = Number(t.subtotal || t.total || 0);
      const cuan = Number(t.margin || 0);

      // Agregasi hari
      const dayData = dayMap.get(ymd) || { omset: 0, margin: 0, count: 0 };
      dayData.omset += omset;
      dayData.margin += cuan;
      dayData.count += 1;
      dayMap.set(ymd, dayData);

      // Agregasi jam
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

      // Agregasi metode bayar
      const pm = (t.paymentMethod || 'CASH').toUpperCase();
      if (!paymentMap[pm]) {
        paymentMap[pm] = { total: 0, count: 0 };
      }
      paymentMap[pm].total += omset;
      paymentMap[pm].count += 1;
    });

    // Cari hari terbaik
    let bestDayYmd = '';
    let bestDayOmset = 0;
    let bestDayMargin = 0;
    dayMap.forEach((val, ymd) => {
      if (val.omset > bestDayOmset) {
        bestDayOmset = val.omset;
        bestDayMargin = val.margin;
        bestDayYmd = ymd;
      }
    });

    let bestDayFormatted = '-';
    if (bestDayYmd) {
      const [y, m, d] = bestDayYmd.split('-').map(Number);
      const dObj = new Date(y, m - 1, d);
      bestDayFormatted = dObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    // Cari jam teramai
    let peakHour = -1;
    let peakHourCount = 0;
    let peakHourOmset = 0;
    hourMap.forEach((val, hh) => {
      if (val.count > peakHourCount) {
        peakHourCount = val.count;
        peakHourOmset = val.omset;
        peakHour = hh;
      }
    });

    const peakHourFormatted = peakHour >= 0 
      ? `${String(peakHour).padStart(2, '0')}:00 - ${String(peakHour + 1).padStart(2, '0')}:00`
      : 'Belum terdata';

    // Persentase metode bayar
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
      bestDayMargin,
      peakHourFormatted,
      peakHourCount,
      peakHourOmset,
      paymentList,
    };
  }, [transactions, activeMonthInfo]);

  // Top 8 Produk: Toggle Qty | Omzet | Cuan, plus margin %
  // "PROMO 5RB"/"PROMO:"/"DISKON:" jangan masuk ranking.
  const topProducts = useMemo(() => {
    const { currentMonthKey } = activeMonthInfo;
    const map = new Map<string, { sku: string; name: string; category: string; qty: number; revenue: number; margin: number }>();

    flattenedItems.forEach((it) => {
      if (it.dateYmd && !it.dateYmd.startsWith(currentMonthKey)) return;

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

    // Sortir berdasarkan metrik terpilih
    if (productRankingMetric === 'OMZET') {
      list.sort((a, b) => b.revenue - a.revenue);
    } else if (productRankingMetric === 'CUAN') {
      list.sort((a, b) => b.margin - a.margin);
    } else {
      list.sort((a, b) => b.qty - a.qty);
    }

    const top8 = list.slice(0, 8);
    const maxValue = top8.length > 0 
      ? (productRankingMetric === 'OMZET' ? top8[0].revenue : productRankingMetric === 'CUAN' ? top8[0].margin : top8[0].qty)
      : 1;

    return top8.map((p, idx) => {
      const curVal = productRankingMetric === 'OMZET' ? p.revenue : productRankingMetric === 'CUAN' ? p.margin : p.qty;
      const marginPct = p.revenue > 0 ? Math.round((p.margin / p.revenue) * 100) : 0;
      return {
        ...p,
        rank: idx + 1,
        marginPct,
        percentOfTop: maxValue > 0 ? Math.min(100, Math.round((curVal / maxValue) * 100)) : 0,
      };
    });
  }, [flattenedItems, activeMonthInfo, productRankingMetric]);

  // Arus kas satu baris: Omzet + Pemasukan lain − Restok − Operasional = Bersih
  const cashFlowBar = useMemo(() => {
    const { currentMonthKey } = activeMonthInfo;
    const omzet = kpiStats.omset;

    let pemasukanLain = 0;
    let restokBarang = 0;
    let restokCount = 0;
    let operasional = 0;

    // 1. Ambil data restok dari history barang masuk di sub menu Stock (LOG_BARANG_MASUK)
    stockInRecords.forEach((bm) => {
      const rawStatus = String((bm as { status?: string }).status || '').toUpperCase();
      if (rawStatus === 'VOIDED') return;
      const rawName = String(bm.name || '').toUpperCase();
      if (rawName.startsWith('[VOID]') || rawName.startsWith('VOIDED')) return;

      const ymd = normalizeDateToYmd(bm.date || '');
      if (!ymd || !ymd.startsWith(currentMonthKey)) return;

      const cost = Number(bm.totalCost) || (Number(bm.qty) * Number(bm.cost)) || 0;
      restokBarang += cost;
      restokCount += 1;
    });

    // 2. Ambil dari financeRecords (Buku Kas / sheet LAIN-LAIN)
    financeRecords.forEach((f) => {
      // Abaikan jika record berstatus VOIDED
      const recordStatus = String((f as { status?: string }).status || '').toUpperCase();
      if (recordStatus === 'VOIDED') return;
      const descRaw = String(f.description || '').toUpperCase();
      if (descRaw.startsWith('VOIDED') || descRaw.startsWith('[VOID]')) return;

      const ymd = f.dateYmd || normalizeDateToYmd(f.date || '');
      if (!ymd || !ymd.startsWith(currentMonthKey)) return;

      const amt = Number(f.amount) || 0;

      if (f.type === 'INCOME') {
        pemasukanLain += amt;
      } else if (f.type === 'EXPENSE') {
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
          restokBarang += amt;
          restokCount += 1;
        } else {
          operasional += amt;
        }
      }
    });

    const bersih = omzet + pemasukanLain - restokBarang - operasional;

    return {
      omzet,
      pemasukanLain,
      restokBarang,
      restokCount,
      operasional,
      bersih,
    };
  }, [kpiStats.omset, financeRecords, stockInRecords, activeMonthInfo]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. STRIP KPI: Omzet, Cuan, Margin %, Nota, Botol & Delta vs Bulan Lalu (1..N) */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* KPI 1: Omzet */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold">
            <span className="uppercase tracking-wider">Omzet</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
              kpiStats.deltaOmset >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {kpiStats.deltaOmset >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {kpiStats.deltaOmset >= 0 ? `+${kpiStats.deltaOmset}%` : `${kpiStats.deltaOmset}%`}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
              {formatRupiah(kpiStats.omset)}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5 truncate" title={`Lalu (1..${kpiStats.N}): ${formatRupiah(kpiStats.prevOmset_N)}`}>
              vs Bln Lalu: {formatRupiah(kpiStats.prevOmset_N)} (tgl 1..{kpiStats.N})
            </p>
          </div>
        </div>

        {/* KPI 2: Cuan (Margin Profit) */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold">
            <span className="uppercase tracking-wider text-emerald-700">Cuan</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
              kpiStats.deltaCuan >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {kpiStats.deltaCuan >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {kpiStats.deltaCuan >= 0 ? `+${kpiStats.deltaCuan}%` : `${kpiStats.deltaCuan}%`}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-black text-emerald-600 tracking-tight">
              {formatRupiah(kpiStats.cuan)}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5 truncate" title={`Lalu (1..${kpiStats.N}): ${formatRupiah(kpiStats.prevCuan_N)}`}>
              vs Bln Lalu: {formatRupiah(kpiStats.prevCuan_N)}
            </p>
          </div>
        </div>

        {/* KPI 3: Margin % */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold">
            <span className="uppercase tracking-wider">Margin %</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
              kpiStats.deltaMargin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {kpiStats.deltaMargin >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {kpiStats.deltaMargin >= 0 ? `+${kpiStats.deltaMargin}%` : `${kpiStats.deltaMargin}%`}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
              {kpiStats.marginPct}%
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">
              Rasio Laba Bersih Penjualan
            </p>
          </div>
        </div>

        {/* KPI 4: Total Nota */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold">
            <span className="uppercase tracking-wider">Nota</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
              kpiStats.deltaNota >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {kpiStats.deltaNota >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {kpiStats.deltaNota >= 0 ? `+${kpiStats.deltaNota}%` : `${kpiStats.deltaNota}%`}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
              {kpiStats.nota} <span className="text-xs font-bold text-stone-400">Nota</span>
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5 truncate">
              vs Bln Lalu: {kpiStats.prevNota_N} Nota (1..{kpiStats.N})
            </p>
          </div>
        </div>

        {/* KPI 5: Total Botol Fisik (Col-span on mobile) */}
        <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl p-4 shadow-xs border border-stone-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold">
            <span className="uppercase tracking-wider">Botol</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
              kpiStats.deltaBotol >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {kpiStats.deltaBotol >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {kpiStats.deltaBotol >= 0 ? `+${kpiStats.deltaBotol}%` : `${kpiStats.deltaBotol}%`}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
              {kpiStats.botol} <span className="text-xs font-bold text-stone-400">Btl</span>
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5 truncate">
              vs Bln Lalu: {kpiStats.prevBotol_N} Btl (excl. promo)
            </p>
          </div>
        </div>
      </section>

      {/* 2. KARTU TARGET: Satu progress bar + garis pace ideal + status 1 kalimat + proyeksi akhir bulan */}
      <section className="bg-gradient-to-br from-[#1E232D] via-stone-900 to-stone-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-44 h-44 bg-[#FF5E36]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Header Target: Judul & Tombol Kontrol */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF5E36] flex items-center justify-center text-white shadow-lg flex-shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight">
                    Target Omzet {targetProgress.grainLabel}
                  </h3>
                  <span className="bg-white/10 text-stone-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Hari ke-{targetProgress.effectiveDay} dari {targetProgress.daysInCurMonth}
                  </span>
                </div>
                <p className="text-xs text-stone-300">
                  Target dasar {formatRupiah(targetProgress.baseMonthlyTarget)} • Grain {targetProgress.grainLabel}
                </p>
              </div>
            </div>

            {/* Aksi: Maju +1 Hari & Edit Target */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* Toggle Offset +1 Hari */}
              <button
                type="button"
                onClick={() => setDayOffset((prev) => (prev === 1 ? 0 : 1))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black border transition-all cursor-pointer ${
                  dayOffset === 1
                    ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-md ring-2 ring-amber-400/30'
                    : 'bg-white/10 text-stone-200 border-white/20 hover:bg-white/20'
                }`}
                title="Maju 1 hari untuk target & progress yang ditujukan buat hari ini"
              >
                <Clock className="w-3.5 h-3.5 text-amber-950" />
                <span>{dayOffset === 1 ? '⏩ Maju +1 Hari' : '▶️ Hari Ini (+0)'}</span>
              </button>

              {/* Form Inline / Tombol Edit Target */}
              {isEditingTarget ? (
                <form onSubmit={handleTargetSubmit} className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="1000000"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white text-stone-900 font-bold text-xs w-32 focus:outline-none"
                    placeholder="50000000"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTarget(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-300 font-bold text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTargetInput(String(salesTarget.targetAmount || 50000000));
                    setIsEditingTarget(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#FF5E36]" />
                  <span>Edit Target</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar Tunggal dengan Garis Pace Ideal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-stone-300">
                Tercapai: <strong className="text-white text-sm font-black">{formatRupiah(targetProgress.achieved)}</strong>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-stone-400 text-[11px]">
                  Pace Ideal: {targetProgress.idealPacePercent}%
                </span>
                <span className="text-[#FF5E36] font-black text-sm">
                  {targetProgress.rawPercent}% Tercapai
                </span>
              </div>
            </div>

            {/* Container Bar: Actual Fill + Vertical Ideal Pace Line */}
            <div className="relative w-full h-5 bg-white/10 rounded-full p-0.5 border border-white/10 overflow-hidden">
              {/* Actual Progress Fill */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF643D] via-[#FF5E36] to-emerald-400 transition-all duration-700 shadow-[0_0_12px_rgba(255,94,54,0.6)]"
                style={{ width: `${targetProgress.percent}%` }}
              />

              {/* Garis Pace Ideal */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-amber-400 z-10 shadow-sm"
                style={{ left: `${targetProgress.idealPacePercent}%` }}
                title={`Garis Pace Ideal: ${formatRupiah(targetProgress.idealPace)} (${targetProgress.idealPacePercent}%)`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-400 pt-0.5">
              <span>Target: {formatRupiah(targetProgress.target)}</span>
              <span>Sisa: {formatRupiah(targetProgress.remaining)}</span>
            </div>
          </div>

          {/* Status Satu Kalimat & Proyeksi Akhir Bulan */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
            <div className="md:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-stone-200 leading-snug">
                {targetProgress.statusSentence}
              </p>
            </div>

            <div className="md:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold">
                  Proyeksi Akhir Bulan
                </span>
                <span className="font-black text-white text-sm">
                  {formatRupiah(targetProgress.projectedMonthEnd)}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                targetProgress.projectedPercent >= 100 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
              }`}>
                {targetProgress.projectedPercent}% Target
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. COMPOSED CHART: Bar Omzet + Line Cuan, Sumbu Y rb/jt, Hari Kosong Tetap Tampil */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-stone-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100">
          <div>
            <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FF5E36]" />
              <span>Grafik Omzet & Cuan Harian</span>
            </h3>
            <p className="text-xs text-stone-500">
              Bar: Omzet Penjualan • Line: Cuan (Margin Profit) • Semua hari 1..{activeMonthInfo.daysInCurMonth}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-stone-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#FF5E36]" />
              <span>Omzet (Bar)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#10B981]" />
              <span>Cuan (Line)</span>
            </div>
          </div>
        </div>

        <div className="w-full h-72 pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F1" />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 10, fill: '#78716C' }} 
                axisLine={false} 
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#78716C' }} 
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxisRbJt}
              />
              <Tooltip 
                formatter={(value: any, name: any) => [
                  formatRupiah(Number(value) || 0),
                  name === 'omset' ? 'Omzet Penjualan' : 'Cuan (Margin)'
                ]}
                labelFormatter={(label) => `Tanggal: ${label}`}
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: '1px solid #E7E5E4', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              />
              <Bar 
                dataKey="omset" 
                fill="#FF5E36" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={28}
              />
              <Line 
                type="monotone" 
                dataKey="margin" 
                stroke="#10B981" 
                strokeWidth={2.5} 
                dot={{ r: 2, fill: '#10B981' }} 
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4. INSIGHT 2 KOLOM: Hari Terbaik, Jam Teramai, Metode Bayar % */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kolom 1: Hari Terbaik & Jam Teramai */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h4 className="font-extrabold text-stone-900 text-sm">Pola & Rekor Waktu Penjualan</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Hari Terbaik */}
            <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                ⭐ Hari Terbaik
              </span>
              <p className="text-base font-black text-stone-900">
                {insights.bestDayFormatted}
              </p>
              <div className="text-[11px] text-stone-600 pt-0.5">
                Omzet: <strong className="text-stone-900">{formatRupiah(insights.bestDayOmset)}</strong>
              </div>
              <div className="text-[10px] text-emerald-700">
                Cuan: {formatRupiah(insights.bestDayMargin)}
              </div>
            </div>

            {/* Jam Teramai */}
            <div className="bg-stone-50 border border-stone-200/70 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                ⏰ Jam Teramai
              </span>
              <p className="text-base font-black text-stone-900">
                {insights.peakHourFormatted}
              </p>
              <div className="text-[11px] text-stone-600 pt-0.5">
                Total Nota: <strong className="text-stone-900">{insights.peakHourCount} Transaksi</strong>
              </div>
              <div className="text-[10px] text-stone-500">
                Volume: {formatRupiah(insights.peakHourOmset)}
              </div>
            </div>
          </div>
        </div>

        {/* Kolom 2: Metode Bayar % */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#FF5E36]" />
              <h4 className="font-extrabold text-stone-900 text-sm">Metode Pembayaran</h4>
            </div>
            <span className="text-[11px] text-stone-400">Distribusi % Omzet</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {insights.paymentList.map((pm) => (
              <div key={pm.method} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-stone-800">{pm.method} ({pm.count}x)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 text-[11px]">{formatRupiah(pm.total)}</span>
                    <span className="text-[#FF5E36] font-black">{pm.percent}%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#FF5E36] to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${pm.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. TOP 8 PRODUK: Toggle Qty | Omzet | Cuan, plus margin % */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-stone-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">Top 8 Produk Terlaris</h3>
              <p className="text-xs text-stone-500">Peringkat kontribusi produk (ekslusif tanpa baris promo/diskon)</p>
            </div>
          </div>

          {/* Toggle Metrik: Qty | Omzet | Cuan */}
          <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setProductRankingMetric('QTY')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                productRankingMetric === 'QTY'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Qty
            </button>
            <button
              type="button"
              onClick={() => setProductRankingMetric('OMZET')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                productRankingMetric === 'OMZET'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Omzet
            </button>
            <button
              type="button"
              onClick={() => setProductRankingMetric('CUAN')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                productRankingMetric === 'CUAN'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Cuan
            </button>
          </div>
        </div>

        {/* Grid Top 8 Produk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topProducts.map((p) => {
            const rankBadges = ['🥇 #1', '🥈 #2', '🥉 #3'];
            const rankColor = p.rank === 1 
              ? 'bg-amber-100 text-amber-800 border-amber-300' 
              : p.rank === 2 
              ? 'bg-stone-200 text-stone-800 border-stone-300' 
              : p.rank === 3 
              ? 'bg-orange-100 text-orange-800 border-orange-300' 
              : 'bg-stone-100 text-stone-600 border-stone-200';

            return (
              <div
                key={p.sku}
                className="p-3.5 rounded-2xl border border-stone-100 hover:border-stone-200 bg-stone-50/50 space-y-2 transition-all hover:shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${rankColor}`}>
                      {rankBadges[p.rank - 1] || `#${p.rank}`}
                    </span>
                    <span className="text-xs font-bold text-stone-900 truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-black text-[#FF5E36] bg-[#FFF2ED] px-2.5 py-0.5 rounded-full">
                      {productRankingMetric === 'QTY' && `${p.qty} Btl`}
                      {productRankingMetric === 'OMZET' && formatRupiah(p.revenue)}
                      {productRankingMetric === 'CUAN' && formatRupiah(p.margin)}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70" title="Margin Persentase">
                      {p.marginPct}%
                    </span>
                  </div>
                </div>

                {/* Relative Progress Bar */}
                <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF5E36] to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${p.percentOfTop}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>Qty: <strong>{p.qty} btl</strong></span>
                  <span>Omzet: <strong>{formatRupiah(p.revenue)}</strong></span>
                  <span>Cuan: <strong className="text-emerald-700">{formatRupiah(p.margin)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. ARUS KAS SATU BARIS: Omzet + Pemasukan lain − Restok − Operasional = Bersih */}
      <section className="bg-stone-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-sm sm:text-base">Arus Kas Terpadu Periode Ini</h3>
          </div>
          <button
            type="button"
            onClick={onGoToKas}
            className="flex items-center gap-1 text-xs font-bold text-stone-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
          >
            <span>Buku Kas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Kalimat Penjelasan */}
        <p className="text-xs text-stone-300/90 leading-relaxed">
          Cuan = laba jualan. Arus kas = uang masuk dikurangi semua uang keluar termasuk belanja stok.
        </p>

        {/* Persamaan Satu Baris (Mobile Wrap) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 sm:gap-2.5 items-center">
          {/* Omzet Penjualan */}
          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Omzet Penjualan</p>
            <p className="text-sm sm:text-base font-black text-white mt-0.5 truncate">
              {formatRupiah(cashFlowBar.omzet)}
            </p>
          </div>

          {/* Operator + */}
          <div className="hidden lg:flex justify-center text-stone-400 font-black text-lg select-none">
            +
          </div>

          {/* Pemasukan Lain */}
          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Pemasukan Lain</p>
            <p className="text-sm sm:text-base font-black text-emerald-300 mt-0.5 truncate">
              +{formatRupiah(cashFlowBar.pemasukanLain)}
            </p>
          </div>

          {/* Operator − */}
          <div className="hidden lg:flex justify-center text-stone-400 font-black text-lg select-none">
            −
          </div>

          {/* Restok Barang */}
          <div className="bg-white/5 hover:bg-white/[0.08] p-3 rounded-2xl border border-amber-500/20 transition-all">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Restok Barang</p>
              {cashFlowBar.restokCount > 0 && (
                <span className="text-[9px] text-amber-300 font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10">
                  {cashFlowBar.restokCount} log
                </span>
              )}
            </div>
            <p className="text-sm sm:text-base font-black text-amber-300 mt-0.5 truncate">
              −{formatRupiah(cashFlowBar.restokBarang)}
            </p>
            <p className="text-[9px] text-stone-400 mt-0.5 truncate">
              History Barang Masuk Stock
            </p>
          </div>

          {/* Operator − */}
          <div className="hidden lg:flex justify-center text-stone-400 font-black text-lg select-none">
            −
          </div>

          {/* Pengeluaran Operasional */}
          <div className="bg-white/5 p-3 rounded-2xl border border-rose-500/20">
            <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Operasional</p>
            <p className="text-sm sm:text-base font-black text-rose-300 mt-0.5 truncate">
              −{formatRupiah(cashFlowBar.operasional)}
            </p>
          </div>

          {/* Operator = */}
          <div className="hidden lg:flex justify-center text-stone-400 font-black text-lg select-none">
            =
          </div>

          {/* Kas Bersih */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-[#FF5E36]/20 p-3 rounded-2xl border border-[#FF5E36]/40">
            <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Arus Kas Bersih</p>
            <p className={`text-sm sm:text-base font-black mt-0.5 truncate ${
              cashFlowBar.bersih >= 0 ? 'text-white' : 'text-rose-300'
            }`}>
              {formatRupiah(cashFlowBar.bersih)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
