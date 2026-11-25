import React, { useState, useMemo, useEffect } from 'react';
import { Button, Card, Chip, Input } from '@heroui/react';
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
  isDarkMode = false,
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

  // Arus kas satu baris: Omzet − Restok − Operasional = Bersih
  const cashFlowBar = useMemo(() => {
    const { currentMonthKey } = activeMonthInfo;
    const omzet = kpiStats.omset;

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
          restokBarang += amt;
          restokCount += 1;
        } else {
          operasional += amt;
        }
      }
    });

    const bersih = omzet - restokBarang - operasional;

    return {
      omzet,
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
        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
          <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
            <span className="uppercase tracking-wider">Omzet</span>
            <Chip
              size="sm"
              variant="soft"
              color={kpiStats.deltaOmset >= 0 ? 'success' : 'danger'}
              className="text-[10px] font-black tabular-nums border border-[var(--border)]"
            >
              {kpiStats.deltaOmset >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <Chip.Label>{kpiStats.deltaOmset >= 0 ? `+${kpiStats.deltaOmset}%` : `${kpiStats.deltaOmset}%`}</Chip.Label>
            </Chip>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-[var(--foreground)] tracking-tight tabular-nums">
              {formatRupiah(kpiStats.omset)}
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate tabular-nums" title={`Lalu (1..${kpiStats.N}): ${formatRupiah(kpiStats.prevOmset_N)}`}>
              vs Bln Lalu: {formatRupiah(kpiStats.prevOmset_N)} (tgl 1..{kpiStats.N})
            </p>
          </div>
        </Card>

        {/* KPI 2: Cuan (Margin Profit) */}
        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
          <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
            <span className="uppercase tracking-wider text-emerald-700 dark:text-[var(--success)]">Cuan</span>
            <Chip
              size="sm"
              variant="soft"
              color={kpiStats.deltaCuan >= 0 ? 'success' : 'danger'}
              className="text-[10px] font-black tabular-nums border border-[var(--border)]"
            >
              {kpiStats.deltaCuan >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <Chip.Label>{kpiStats.deltaCuan >= 0 ? `+${kpiStats.deltaCuan}%` : `${kpiStats.deltaCuan}%`}</Chip.Label>
            </Chip>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-[var(--success)] tracking-tight tabular-nums">
              {formatRupiah(kpiStats.cuan)}
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate tabular-nums" title={`Lalu (1..${kpiStats.N}): ${formatRupiah(kpiStats.prevCuan_N)}`}>
              vs Bln Lalu: {formatRupiah(kpiStats.prevCuan_N)}
            </p>
          </div>
        </Card>

        {/* KPI 3: Margin % */}
        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
          <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
            <span className="uppercase tracking-wider">Margin %</span>
            <Chip
              size="sm"
              variant="soft"
              color={kpiStats.deltaMargin >= 0 ? 'success' : 'danger'}
              className="text-[10px] font-black tabular-nums border border-[var(--border)]"
            >
              {kpiStats.deltaMargin >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <Chip.Label>{kpiStats.deltaMargin >= 0 ? `+${kpiStats.deltaMargin}%` : `${kpiStats.deltaMargin}%`}</Chip.Label>
            </Chip>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-[var(--foreground)] tracking-tight tabular-nums">
              {kpiStats.marginPct}%
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-0.5">
              Rasio Laba Bersih Penjualan
            </p>
          </div>
        </Card>

        {/* KPI 4: Total Nota */}
        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
          <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
            <span className="uppercase tracking-wider">Nota</span>
            <Chip
              size="sm"
              variant="soft"
              color={kpiStats.deltaNota >= 0 ? 'success' : 'danger'}
              className="text-[10px] font-black tabular-nums border border-[var(--border)]"
            >
              {kpiStats.deltaNota >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <Chip.Label>{kpiStats.deltaNota >= 0 ? `+${kpiStats.deltaNota}%` : `${kpiStats.deltaNota}%`}</Chip.Label>
            </Chip>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-[var(--foreground)] tracking-tight tabular-nums">
              {kpiStats.nota} <span className="text-xs font-bold text-[var(--muted)]">Nota</span>
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate tabular-nums">
              vs Bln Lalu: {kpiStats.prevNota_N} Nota (1..{kpiStats.N})
            </p>
          </div>
        </Card>

        {/* KPI 5: Total Botol Fisik */}
        <Card className="col-span-2 lg:col-span-1 bg-[var(--surface)] rounded-2xl p-4 gap-2 border border-[var(--border)] shadow-none justify-between">
          <div className="flex items-center justify-between gap-1 text-[var(--muted)] text-[11px] font-bold">
            <span className="uppercase tracking-wider">Botol</span>
            <Chip
              size="sm"
              variant="soft"
              color={kpiStats.deltaBotol >= 0 ? 'success' : 'danger'}
              className="text-[10px] font-black tabular-nums border border-[var(--border)]"
            >
              {kpiStats.deltaBotol >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <Chip.Label>{kpiStats.deltaBotol >= 0 ? `+${kpiStats.deltaBotol}%` : `${kpiStats.deltaBotol}%`}</Chip.Label>
            </Chip>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-[var(--foreground)] tracking-tight tabular-nums">
              {kpiStats.botol} <span className="text-xs font-bold text-[var(--muted)]">Btl</span>
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate tabular-nums">
              vs Bln Lalu: {kpiStats.prevBotol_N} Btl (excl. promo)
            </p>
          </div>
        </Card>
      </section>

      {/* 2. KARTU TARGET: Satu progress bar + garis pace ideal + status 1 kalimat + proyeksi akhir bulan */}
      <Card className="bg-[var(--surface)] text-[var(--foreground)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 gap-4 border border-[var(--border)] shadow-none relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          {/* Header Target: Judul & Tombol Kontrol */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--separator)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/30 flex-shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-[var(--foreground)]">
                    Target Omzet {targetProgress.grainLabel}
                  </h3>
                  <Chip size="sm" variant="soft" color="default" className="border border-[var(--border)] text-[10px] font-bold">
                    <Chip.Label>Hari ke-{targetProgress.effectiveDay} dari {targetProgress.daysInCurMonth}</Chip.Label>
                  </Chip>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Target dasar {formatRupiah(targetProgress.baseMonthlyTarget)} • Grain {targetProgress.grainLabel}
                </p>
              </div>
            </div>

            {/* Aksi: Maju +1 Hari & Edit Target */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* Toggle Offset +1 Hari */}
              <Button
                type="button"
                size="sm"
                variant={dayOffset === 1 ? 'primary' : 'outline'}
                onPress={() => setDayOffset((prev) => (prev === 1 ? 0 : 1))}
                aria-label="Maju 1 hari untuk target dan progress yang ditujukan buat hari ini"
                className="rounded-full text-xs font-bold min-h-[44px] px-3.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{dayOffset === 1 ? '⏩ Maju +1 Hari' : '▶️ Hari Ini (+0)'}</span>
              </Button>

              {/* Form Inline / Tombol Edit Target */}
              {isEditingTarget ? (
                <form onSubmit={handleTargetSubmit} className="flex items-center gap-1.5 flex-wrap">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    variant="secondary"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] font-bold text-xs w-36 border border-[var(--border)] min-h-[44px] tabular-nums"
                    placeholder="50000000"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    className="px-3.5 rounded-xl font-bold text-xs min-h-[44px]"
                  >
                    Simpan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onPress={() => setIsEditingTarget(false)}
                    className="px-3 rounded-xl font-bold text-xs min-h-[44px]"
                  >
                    Batal
                  </Button>
                </form>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setTargetInput(String(salesTarget.targetAmount || 50000000));
                    setIsEditingTarget(true);
                  }}
                  className="px-3.5 rounded-full bg-[var(--surface-secondary)] text-[var(--foreground)] text-xs font-bold border border-[var(--border)] min-h-[44px]"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Edit Target</span>
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar Tunggal dengan Garis Pace Ideal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold gap-2 flex-wrap">
              <span className="text-[var(--muted)]">
                Tercapai: <strong className="text-[var(--foreground)] text-sm font-black tabular-nums">{formatRupiah(targetProgress.achieved)}</strong>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[var(--muted)] text-[11px] tabular-nums">
                  Pace Ideal: {targetProgress.idealPacePercent}%
                </span>
                <span className="text-[var(--accent)] font-black text-sm tabular-nums">
                  {targetProgress.rawPercent}% Tercapai
                </span>
              </div>
            </div>

            {/* Container Bar: Actual Fill + Vertical Ideal Pace Line */}
            <div className="relative w-full h-5 bg-[var(--surface-secondary)] rounded-full p-0.5 border border-[var(--border)] overflow-hidden">
              {/* Actual Progress Fill */}
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700"
                style={{ width: `${targetProgress.percent}%` }}
              />

              {/* Garis Pace Ideal */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-[var(--foreground)]/80 z-10"
                style={{ left: `${targetProgress.idealPacePercent}%` }}
                title={`Garis Pace Ideal: ${formatRupiah(targetProgress.idealPace)} (${targetProgress.idealPacePercent}%)`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-0.5">
              <span className="tabular-nums">Target: {formatRupiah(targetProgress.target)}</span>
              <span className="tabular-nums">Sisa: {formatRupiah(targetProgress.remaining)}</span>
            </div>
          </div>

          {/* Status Satu Kalimat & Proyeksi Akhir Bulan */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
            <div className="md:col-span-7 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-3 flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-amber-600 dark:text-[var(--warning)] flex-shrink-0" />
              <p className="text-xs text-[var(--foreground)] leading-snug font-medium">
                {targetProgress.statusSentence}
              </p>
            </div>

            <div className="md:col-span-5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider block font-bold">
                  Proyeksi Akhir Bulan
                </span>
                <span className="font-black text-[var(--foreground)] text-sm tabular-nums">
                  {formatRupiah(targetProgress.projectedMonthEnd)}
                </span>
              </div>
              <Chip
                size="sm"
                variant="soft"
                color={targetProgress.projectedPercent >= 100 ? 'success' : 'warning'}
                className="font-black tabular-nums border border-[var(--border)]"
              >
                <Chip.Label className={targetProgress.projectedPercent >= 100 ? 'text-emerald-700 dark:text-[var(--success)]' : 'text-amber-700 dark:text-[var(--warning)]'}>
                  {targetProgress.projectedPercent}% Target
                </Chip.Label>
              </Chip>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. COMPOSED CHART: Bar Omzet + Line Cuan, Sumbu Y rb/jt, Hari Kosong Tetap Tampil */}
      <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 gap-3 border border-[var(--border)] shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--separator)]">
          <div>
            <h3 className="font-bold text-[var(--foreground)] text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
              <span>Grafik Omzet &amp; Cuan Harian</span>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Bar: Omzet Penjualan • Line: Cuan (Margin Profit) • Semua hari 1..{activeMonthInfo.daysInCurMonth}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-[var(--muted)]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[var(--accent)]" />
              <span>Omzet (Bar)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-500" />
              <span>Cuan (Line)</span>
            </div>
          </div>
        </div>

        <div className="w-full h-72 pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#27272e' : '#e4e4e7'} />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 10, fill: isDarkMode ? '#a1a1aa' : '#64748b' }} 
                axisLine={false} 
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: isDarkMode ? '#a1a1aa' : '#64748b' }} 
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
                  backgroundColor: isDarkMode ? '#1e1e24' : '#ffffff',
                  borderRadius: '14px', 
                  border: isDarkMode ? '1px solid #32323c' : '1px solid #e4e4e7', 
                  color: isDarkMode ? '#fafafa' : '#18181b',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: isDarkMode ? '0 8px 24px rgba(0, 0, 0, 0.5)' : '0 8px 24px rgba(15, 23, 42, 0.08)'
                }}
              />
              <Bar 
                dataKey="omset" 
                fill={isDarkMode ? '#e6499e' : '#c82d85'} 
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
      </Card>

      {/* 4. INSIGHT 2 KOLOM: Hari Terbaik, Jam Teramai, Metode Bayar % */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kolom 1: Hari Terbaik & Jam Teramai */}
        <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-4 border border-[var(--border)] shadow-none">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--separator)]">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-[var(--warning)]" />
            <h4 className="font-bold text-[var(--foreground)] text-sm">Pola &amp; Rekor Waktu Penjualan</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Hari Terbaik */}
            <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-[var(--warning)] block">
                ⭐ Hari Terbaik
              </span>
              <p className="text-base font-black text-[var(--foreground)]">
                {insights.bestDayFormatted}
              </p>
              <div className="text-[11px] text-[var(--muted)] pt-0.5">
                Omzet: <strong className="text-[var(--foreground)] tabular-nums">{formatRupiah(insights.bestDayOmset)}</strong>
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-[var(--success)] font-bold tabular-nums">
                Cuan: {formatRupiah(insights.bestDayMargin)}
              </div>
            </div>

            {/* Jam Teramai */}
            <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] block">
                ⏰ Jam Teramai
              </span>
              <p className="text-base font-black text-[var(--foreground)]">
                {insights.peakHourFormatted}
              </p>
              <div className="text-[11px] text-[var(--muted)] pt-0.5">
                Total Nota: <strong className="text-[var(--foreground)] tabular-nums">{insights.peakHourCount} Transaksi</strong>
              </div>
              <div className="text-[10px] text-[var(--muted)] tabular-nums">
                Volume: {formatRupiah(insights.peakHourOmset)}
              </div>
            </div>
          </div>
        </Card>

        {/* Kolom 2: Metode Bayar % */}
        <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-3 border border-[var(--border)] shadow-none">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--separator)]">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[var(--accent)]" />
              <h4 className="font-bold text-[var(--foreground)] text-sm">Metode Pembayaran</h4>
            </div>
            <span className="text-[11px] text-[var(--muted)]">Distribusi % Omzet</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {insights.paymentList.map((pm) => (
              <div key={pm.method} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-[var(--foreground)]">{pm.method} ({pm.count}x)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--muted)] text-[11px] tabular-nums">{formatRupiah(pm.total)}</span>
                    <span className="text-[var(--accent)] font-black tabular-nums">{pm.percent}%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-500"
                    style={{ width: `${pm.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* 5. TOP 8 PRODUK: Toggle Qty | Omzet | Cuan, plus margin % */}
      <Card className="bg-[var(--surface)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 gap-4 border border-[var(--border)] shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--separator)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[var(--warning-soft)] border border-[var(--warning)]/35 text-amber-700 dark:text-[var(--warning)] flex items-center justify-center font-bold flex-shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--foreground)] text-base">Top 8 Produk Terlaris</h3>
              <p className="text-xs text-[var(--muted)]">Peringkat kontribusi produk (ekslusif tanpa baris promo/diskon)</p>
            </div>
          </div>

          {/* Toggle Metrik: Qty | Omzet | Cuan */}
          <div className="flex items-center bg-[var(--surface-secondary)] p-1 rounded-full border border-[var(--border)] self-start sm:self-auto gap-1">
            <Button
              type="button"
              size="sm"
              variant={productRankingMetric === 'QTY' ? 'primary' : 'ghost'}
              onPress={() => setProductRankingMetric('QTY')}
              className={`px-3.5 rounded-full text-xs font-bold min-h-[38px] ${
                productRankingMetric === 'QTY' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Qty
            </Button>
            <Button
              type="button"
              size="sm"
              variant={productRankingMetric === 'OMZET' ? 'primary' : 'ghost'}
              onPress={() => setProductRankingMetric('OMZET')}
              className={`px-3.5 rounded-full text-xs font-bold min-h-[38px] ${
                productRankingMetric === 'OMZET' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Omzet
            </Button>
            <Button
              type="button"
              size="sm"
              variant={productRankingMetric === 'CUAN' ? 'primary' : 'ghost'}
              onPress={() => setProductRankingMetric('CUAN')}
              className={`px-3.5 rounded-full text-xs font-bold min-h-[38px] ${
                productRankingMetric === 'CUAN' ? '' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Cuan
            </Button>
          </div>
        </div>

        {/* Grid Top 8 Produk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topProducts.map((p) => {
            const rankBadges = ['🥇 #1', '🥈 #2', '🥉 #3'];
            const rankChipColor = p.rank === 1 ? 'warning' : p.rank === 2 ? 'accent' : p.rank === 3 ? 'danger' : 'default';

            return (
              <div
                key={p.sku}
                className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Chip size="sm" variant="soft" color={rankChipColor} className="text-[11px] font-extrabold border border-[var(--border)] flex-shrink-0">
                      <Chip.Label>{rankBadges[p.rank - 1] || `#${p.rank}`}</Chip.Label>
                    </Chip>
                    <span className="text-xs font-bold text-[var(--foreground)] truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Chip size="sm" variant="soft" color="accent" className="text-xs font-bold border border-[var(--border)] tabular-nums">
                      <Chip.Label>
                        {productRankingMetric === 'QTY' && `${p.qty} Btl`}
                        {productRankingMetric === 'OMZET' && formatRupiah(p.revenue)}
                        {productRankingMetric === 'CUAN' && formatRupiah(p.margin)}
                      </Chip.Label>
                    </Chip>
                    <Chip size="sm" variant="soft" color="success" className="text-[10px] font-bold border border-[var(--border)] tabular-nums">
                      <Chip.Label className="text-emerald-700 dark:text-[var(--success)]">{p.marginPct}%</Chip.Label>
                    </Chip>
                  </div>
                </div>

                {/* Relative Progress Bar */}
                <div className="w-full h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-500"
                    style={{ width: `${p.percentOfTop}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--muted)] gap-2 flex-wrap">
                  <span>Qty: <strong className="text-[var(--foreground)] tabular-nums">{p.qty} btl</strong></span>
                  <span>Omzet: <strong className="text-[var(--foreground)] tabular-nums">{formatRupiah(p.revenue)}</strong></span>
                  <span>Cuan: <strong className="text-emerald-700 dark:text-[var(--success)] tabular-nums">{formatRupiah(p.margin)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 6. ARUS KAS SATU BARIS: Omzet − Restok − Operasional = Bersih */}
      <Card className="bg-[var(--surface)] text-[var(--foreground)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 gap-3.5 border border-[var(--border)] shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--separator)]">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-emerald-700 dark:text-[var(--success)]" />
            <h3 className="font-bold text-sm sm:text-base text-[var(--foreground)]">Arus Kas Terpadu Periode Ini</h3>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onPress={onGoToKas}
            className="text-xs font-bold bg-[var(--surface-secondary)] text-[var(--foreground)] px-3.5 rounded-xl border border-[var(--border)] self-start sm:self-auto min-h-[44px]"
          >
            <span>Buku Kas</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)]" />
          </Button>
        </div>

        {/* Kalimat Penjelasan */}
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Cuan = laba jualan. Arus kas = uang masuk dikurangi semua uang keluar termasuk belanja stok.
        </p>

        {/* Persamaan Satu Baris (Mobile Wrap) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5 items-center">
          {/* Omzet Penjualan */}
          <div className="bg-[var(--surface-secondary)] p-3 rounded-2xl border border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wider">Omzet Penjualan</p>
            <p className="text-sm sm:text-base font-black text-[var(--foreground)] mt-0.5 truncate tabular-nums">
              {formatRupiah(cashFlowBar.omzet)}
            </p>
          </div>

          {/* Operator − */}
          <div className="hidden lg:flex justify-center text-[var(--muted)] font-black text-lg select-none">
            −
          </div>

          {/* Restok Barang */}
          <div className="bg-[var(--accent-soft)] p-3 rounded-2xl border border-[var(--accent)]/30 transition-colors">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] text-[var(--accent)] font-bold uppercase tracking-wider">Restok Barang</p>
              {cashFlowBar.restokCount > 0 && (
                <span className="text-[9px] text-[var(--accent)] font-bold px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--accent)]/30 tabular-nums">
                  {cashFlowBar.restokCount} log
                </span>
              )}
            </div>
            <p className="text-sm sm:text-base font-black text-[var(--accent)] mt-0.5 truncate tabular-nums">
              −{formatRupiah(cashFlowBar.restokBarang)}
            </p>
            <p className="text-[9px] text-[var(--muted)] mt-0.5 truncate">
              History Barang Masuk Stock
            </p>
          </div>

          {/* Operator − */}
          <div className="hidden lg:flex justify-center text-[var(--muted)] font-black text-lg select-none">
            −
          </div>

          {/* Pengeluaran Operasional */}
          <div className="bg-[var(--warning-soft)] p-3 rounded-2xl border border-[var(--warning)]/35">
            <p className="text-[10px] text-amber-700 dark:text-[var(--warning)] font-bold uppercase tracking-wider">Operasional</p>
            <p className="text-sm sm:text-base font-black text-amber-700 dark:text-[var(--warning)] mt-0.5 truncate tabular-nums">
              −{formatRupiah(cashFlowBar.operasional)}
            </p>
          </div>

          {/* Operator = */}
          <div className="hidden lg:flex justify-center text-[var(--muted)] font-black text-lg select-none">
            =
          </div>

          {/* Kas Bersih */}
          <div className={`col-span-2 sm:col-span-1 lg:col-span-1 p-3 rounded-2xl border ${
            cashFlowBar.bersih >= 0
              ? 'bg-[var(--success-soft)] border-[var(--success)]/35'
              : 'bg-[var(--danger-soft)] border-[var(--danger)]/35'
          }`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${
              cashFlowBar.bersih >= 0 ? 'text-emerald-700 dark:text-[var(--success)]' : 'text-red-700 dark:text-[var(--danger)]'
            }`}>Arus Kas Bersih</p>
            <p className={`text-sm sm:text-base font-black mt-0.5 truncate tabular-nums ${
              cashFlowBar.bersih >= 0 ? 'text-emerald-700 dark:text-[var(--success)]' : 'text-red-700 dark:text-[var(--danger)]'
            }`}>
              {formatRupiah(cashFlowBar.bersih)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
