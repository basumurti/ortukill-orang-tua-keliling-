import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
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
  ArrowUpRight
} from 'lucide-react';
import { TransactionReceipt, Product } from '../types';
import { formatRupiah, isDateToday, normalizeDateToYmd, classifyProduct } from '../services/storageService';

interface SalesHistoryViewProps {
  transactions: TransactionReceipt[];
  products: Product[];
  onViewReceipt: (receipt: TransactionReceipt) => void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
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

interface CategoryStat {
  qty: number;
  revenue: number;
  margin: number;
  count: number;
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
  onViewReceipt,
  onSyncSpreadsheet,
  isSyncing,
}) => {
  const [viewMode, setViewMode] = useState<'BY_DATE' | 'FLAT_LOG'>('BY_DATE');
  const [timeFilter, setTimeFilter] = useState<'TODAY' | '7DAYS' | '30DAYS' | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const expandAllDates = () => {
    const next: Record<string, boolean> = {};
    dateGroups.forEach((g) => (next[g.dateKey] = true));
    setExpandedDates(next);
  };

  const collapseAllDates = () => {
    setExpandedDates({});
  };

  // Flatten items
  const allFlattenedItems = useMemo(() => {
    const list: FlattenedSaleItem[] = [];

    transactions.forEach((t) => {
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
          sku: rawSku || '-',
          name: rawName || 'Item Tanpa Nama',
          category,
          price,
          cost,
          qty,
          total,
          margin,
          customer: t.customerName && t.customerName !== '-' ? t.customerName : '-',
          paymentMethod: t.paymentMethod || 'CASH',
          status: t.status || 'COMPLETED',
          rawReceipt: t,
        });
      });
    });

    return list;
  }, [transactions]);

  // Apply filters
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const filteredItems = useMemo(() => {
    return allFlattenedItems.filter((item) => {
      if (timeFilter === 'TODAY') {
        if (!isDateToday(item.dateStr)) return false;
      } else if (timeFilter === '7DAYS' || timeFilter === '30DAYS') {
        const parts = item.dateYmd.split('-');
        if (parts.length === 3) {
          const itemMidnight = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
          const diffDays = Math.floor((startOfToday - itemMidnight) / (1000 * 3600 * 24));
          if (timeFilter === '7DAYS' && (diffDays < 0 || diffDays > 7)) return false;
          if (timeFilter === '30DAYS' && (diffDays < 0 || diffDays > 30)) return false;
        }
      }

      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }

      if (paymentFilter !== 'ALL' && item.paymentMethod !== paymentFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.dateStr.includes(q) ||
          item.customer.toLowerCase().includes(q) ||
          item.trxId.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allFlattenedItems, timeFilter, categoryFilter, paymentFilter, searchQuery, startOfToday]);

  // Group by Date
  const dateGroups = useMemo(() => {
    const map: Record<string, DateSalesGroup> = {};

    filteredItems.forEach((item) => {
      const key = item.dateYmd || item.dateStr;
      if (!map[key]) {
        map[key] = {
          dateKey: key,
          dateDisplay: item.dateStr,
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
      }

      map[key].totalOmset += item.total;
      map[key].totalMargin += item.margin;
      map[key].totalHPP += item.cost * item.qty;
      map[key].totalQty += item.qty;
      map[key].itemCount += 1;
      map[key].paymentMethods[item.paymentMethod] = (map[key].paymentMethods[item.paymentMethod] || 0) + item.qty;
      map[key].items.push(item);
    });

    const list = Object.values(map);
    list.sort((a, b) => String(b.dateYmd || b.dateDisplay).localeCompare(String(a.dateYmd || a.dateDisplay)));
    return list;
  }, [filteredItems]);

  // Aggregates
  const totalOmset = filteredItems.reduce((sum, i) => sum + i.total, 0);
  const totalMargin = filteredItems.reduce((sum, i) => sum + i.margin, 0);
  const totalQty = filteredItems.reduce((sum, i) => sum + i.qty, 0);
  const totalHPP = totalOmset - totalMargin;
  const totalUniqueDates = dateGroups.length;
  const avgPerDay = totalUniqueDates > 0 ? Math.round(totalOmset / totalUniqueDates) : 0;
  const marginRatio = totalOmset > 0 ? ((totalMargin / totalOmset) * 100).toFixed(1) : '0';

  // Category breakdown
  const categorySummaryMap = useMemo(() => {
    const catMap: Record<string, { qty: number; revenue: number; margin: number; count: number }> = {};
    filteredItems.forEach((item) => {
      const cat = item.category || 'LAINNYA';
      if (!catMap[cat]) {
        catMap[cat] = { qty: 0, revenue: 0, margin: 0, count: 0 };
      }
      catMap[cat].qty += item.qty;
      catMap[cat].revenue += item.total;
      catMap[cat].margin += item.margin;
      catMap[cat].count += 1;
    });
    return catMap;
  }, [filteredItems]);

  // Ranked products
  const rankedProducts = useMemo(() => {
    const pMap: Record<string, { sku: string; name: string; category: string; qty: number; revenue: number; margin: number }> = {};
    filteredItems.forEach((item) => {
      const key = item.sku || item.name;
      if (!pMap[key]) {
        pMap[key] = {
          sku: item.sku,
          name: item.name,
          category: item.category,
          qty: 0,
          revenue: 0,
          margin: 0,
        };
      }
      pMap[key].qty += item.qty;
      pMap[key].revenue += item.total;
      pMap[key].margin += item.margin;
    });
    return Object.values(pMap).sort((a, b) => b.qty - a.qty);
  }, [filteredItems]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((it) => {
      if (it.category && String(it.category).trim()) {
        cats.add(String(it.category).trim());
      }
    });
    return ['ALL', ...Array.from(cats)];
  }, [items]);

  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;

    const headers = [
      'TANGGAL',
      'NO_TRANSAKSI',
      'SKU',
      'NAMA_PRODUK',
      'KATEGORI',
      'HARGA_JUAL',
      'HARGA_BELI_HPP',
      'QTY',
      'TOTAL_OMSET',
      'MARGIN_LABA',
      'METODE_BAYAR',
      'STATUS'
    ];

    const rows = filteredItems.map((item) => [
      item.dateStr,
      item.trxId,
      item.sku,
      `"${item.name.replace(/"/g, '""')}"`,
      item.category,
      item.price,
      item.cost,
      item.qty,
      item.total,
      item.margin,
      item.paymentMethod,
      item.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ortukill_Laporan_Penjualan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
                Laporan Penjualan & Margin
              </h2>
              <span className="bg-[#FFF2ED] text-[#FF5E36] text-[10px] px-2 py-0.5 rounded-full font-bold">
                Rekap Harian
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Analisis omset, modal HPP, dan margin laba bersih
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSyncSpreadsheet && (
            <button
              onClick={onSyncSpreadsheet}
              disabled={isSyncing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all cursor-pointer min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#FF5E36] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkron...' : 'Segarkan'}</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white text-xs font-bold transition-all cursor-pointer shadow-xs min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Time Filter Chips */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          {[
            { id: 'ALL', label: 'Semua Waktu' },
            { id: 'TODAY', label: 'Hari Ini' },
            { id: '7DAYS', label: '7 Hari Terakhir' },
            { id: '30DAYS', label: '30 Hari Terakhir' },
          ].map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeFilter(tf.id as any)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer min-h-[38px] ${
                timeFilter === tf.id
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Omset */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Omset
            </span>
            <div className="w-7 h-7 rounded-xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
              {formatRupiah(totalOmset)}
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {totalUniqueDates} hari aktif • {formatRupiah(avgPerDay)}/hari
            </p>
          </div>
        </div>

        {/* Modal HPP */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Modal (HPP)
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-amber-700 tracking-tight">
              {formatRupiah(totalHPP)}
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Biaya kulakan produk
            </p>
          </div>
        </div>

        {/* Margin Cuan */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Laba Bersih
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-emerald-600 tracking-tight">
              {formatRupiah(totalMargin)}
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Margin {marginRatio}%
            </p>
          </div>
        </div>

        {/* Volume */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Volume Terjual
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
              {totalQty} Botol
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {filteredItems.length} baris transaksi
            </p>
          </div>
        </div>
      </div>

      {/* Category Breakdown Cards */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2.5">
          Rangkuman Per Kategori Minuman
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {(Object.entries(categorySummaryMap) as [string, CategoryStat][]).map(([category, stats]) => {
            const pctOfOmset = totalOmset > 0 ? ((stats.revenue / totalOmset) * 100).toFixed(1) : '0';
            return (
              <div key={category} className="bg-stone-50 p-3 rounded-xl space-y-1.5 border border-stone-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-900 truncate max-w-[150px]">{category}</span>
                  <span className="text-stone-500 font-medium">{stats.qty} botol</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-stone-900 font-bold">{formatRupiah(stats.revenue)}</span>
                  <span className="text-emerald-600">+{formatRupiah(stats.margin)}</span>
                </div>
                <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#FF5E36] h-full rounded-full" style={{ width: `${Math.min(100, Number(pctOfOmset))}%` }} />
                </div>
                <p className="text-[10px] text-stone-400">Porsi {pctOfOmset}% dari total omset</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 5 Best Sellers */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-2.5">
          <Trophy className="w-4 h-4 text-amber-500" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
            5 Produk Terlaris
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {rankedProducts.slice(0, 5).map((item, idx) => (
            <div key={idx} className="bg-stone-50 p-3 rounded-xl space-y-1 border border-stone-100">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-stone-400">#{idx + 1}</span>
                <span className="text-amber-600 font-extrabold">{item.qty} botol</span>
              </div>
              <p className="text-xs font-bold text-stone-900 truncate" title={item.name}>
                {item.name}
              </p>
              <div className="flex justify-between text-[11px] text-stone-500">
                <span>{formatRupiah(item.revenue)}</span>
                <span className="text-emerald-600 font-semibold">+{formatRupiah(item.margin)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mode Switcher: Rekap Tanggal vs Semua Baris */}
      <div className="bg-white rounded-2xl p-3.5 border border-stone-200/80 shadow-xs space-y-3">
        {/* Tab Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('BY_DATE')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'BY_DATE'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#FF5E36]" />
              <span>Rekap Per Tanggal ({dateGroups.length} Hari)</span>
            </button>
            <button
              onClick={() => setViewMode('FLAT_LOG')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'FLAT_LOG'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#FF5E36]" />
              <span>Semua Baris ({filteredItems.length})</span>
            </button>
          </div>

          {/* Quick expand/collapse for dates */}
          {viewMode === 'BY_DATE' && (
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={expandAllDates}
                className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 font-medium text-xs cursor-pointer"
              >
                Buka Semua
              </button>
              <button
                onClick={collapseAllDates}
                className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 font-medium text-xs cursor-pointer"
              >
                Tutup Semua
              </button>
            </div>
          )}
        </div>

        {/* Filter & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Cari produk, SKU, tanggal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-stone-50 text-stone-700 border border-stone-200 px-3 py-2 rounded-xl text-xs font-medium focus:outline-none focus:border-[#FF5E36] cursor-pointer"
          >
            <option value="ALL">Semua Kategori</option>
            {availableCategories.filter(c => c !== 'ALL').map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-stone-50 text-stone-700 border border-stone-200 px-3 py-2 rounded-xl text-xs font-medium focus:outline-none focus:border-[#FF5E36] cursor-pointer"
          >
            <option value="ALL">Semua Pembayaran</option>
            <option value="CASH">CASH / Tunai</option>
            <option value="TRANSFER">Transfer Bank</option>
            <option value="QRIS">QRIS</option>
          </select>
        </div>
      </div>

      {/* VIEW MODE 1: REKAP PER TANGGAL */}
      {viewMode === 'BY_DATE' && (
        <div className="space-y-3">
          {dateGroups.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-stone-200/80 shadow-xs space-y-2">
              <Calendar className="w-10 h-10 mx-auto text-stone-300" />
              <p className="text-sm font-bold text-stone-800">Tidak ada data penjualan</p>
              <p className="text-xs text-stone-500">
                Pilih rentang tanggal lain atau sesuaikan kata kunci pencarian.
              </p>
            </div>
          ) : (
            dateGroups.map((group) => {
              const isExpanded = !!expandedDates[group.dateKey];

              return (
                <div
                  key={group.dateKey}
                  className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs"
                >
                  {/* Date Card Header / Clickable */}
                  <div
                    onClick={() => toggleDateExpand(group.dateKey)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-stone-50/80 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-stone-900">
                            {group.dateDisplay}
                          </span>
                          <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">
                            {group.totalQty} botol
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {group.itemCount} baris penjualan
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm sm:text-base font-extrabold text-stone-900">
                        {formatRupiah(group.totalOmset)}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-bold">
                        +{formatRupiah(group.totalMargin)}
                      </p>
                    </div>
                  </div>

                  {/* Expanded Items List */}
                  {isExpanded && (
                    <div className="p-3 sm:p-4 bg-stone-50/70 border-t border-stone-100 space-y-2">
                      <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                        Rincian Item Terjual pada {group.dateDisplay}
                      </div>

                      {/* Mobile friendly item cards */}
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white p-3 rounded-xl border border-stone-200/70 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-stone-900 truncate">
                                  {item.name}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                  {item.qty}x
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-stone-400 font-mono mt-0.5">
                                <span>SKU: {item.sku}</span>
                                <span>•</span>
                                <span>{item.category}</span>
                                <span>•</span>
                                <span>Nota: #{item.trxId}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                              <div className="text-left sm:text-right">
                                <p className="text-xs font-extrabold text-stone-900">
                                  {formatRupiah(item.total)}
                                </p>
                                <p className="text-[10px] text-emerald-600 font-semibold">
                                  +{formatRupiah(item.margin)}
                                </p>
                              </div>

                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                                {item.paymentMethod}
                              </span>

                              {item.rawReceipt && (
                                <button
                                  onClick={() => onViewReceipt(item.rawReceipt)}
                                  className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
                                >
                                  Struk
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: FLAT LOG (LOG_PENJUALAN B7:M) */}
      {viewMode === 'FLAT_LOG' && (
        <div className="space-y-3">
          {/* Mobile Card List (<640px) */}
          <div className="space-y-2.5 sm:hidden">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-3.5 border border-stone-200/80 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-stone-900">
                    {item.dateStr}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                    {item.paymentMethod}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-bold text-stone-900 leading-snug">
                    {item.name}
                  </p>
                  <p className="text-[10px] font-mono text-stone-400">
                    SKU: {item.sku} • {item.category}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-stone-900">
                      {item.qty}x @{formatRupiah(item.price)} = {formatRupiah(item.total)}
                    </span>
                    <p className="text-[10px] text-emerald-600 font-semibold">
                      Laba: +{formatRupiah(item.margin)}
                    </p>
                  </div>

                  {item.rawReceipt && (
                    <button
                      onClick={() => onViewReceipt(item.rawReceipt)}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-100 text-stone-800 text-xs font-bold"
                    >
                      Struk
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>=640px) */}
          <div className="hidden sm:block bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] tracking-wider border-b border-stone-200 font-semibold">
                  <tr>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3">No. Trx</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Nama Produk</th>
                    <th className="py-3 px-3">Kategori</th>
                    <th className="py-3 px-3 text-right">Harga</th>
                    <th className="py-3 px-3 text-center">Qty</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3 text-right">Margin</th>
                    <th className="py-3 px-3 text-center">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/80">
                      <td className="py-3 px-3 font-mono text-stone-600 whitespace-nowrap">{item.dateStr}</td>
                      <td className="py-3 px-3 font-mono font-bold text-[#FF5E36] whitespace-nowrap">#{item.trxId}</td>
                      <td className="py-3 px-3 font-mono text-stone-500 whitespace-nowrap">{item.sku}</td>
                      <td className="py-3 px-3 font-semibold text-stone-900 max-w-xs truncate">{item.name}</td>
                      <td className="py-3 px-3 text-stone-500 whitespace-nowrap">{item.category}</td>
                      <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">{formatRupiah(item.price)}</td>
                      <td className="py-3 px-3 text-center font-bold text-stone-900 whitespace-nowrap">{item.qty}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-stone-900 whitespace-nowrap">{formatRupiah(item.total)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">+{formatRupiah(item.margin)}</td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                          {item.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
