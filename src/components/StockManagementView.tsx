import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Package, 
  ArrowUpCircle, 
  Search, 
  Plus, 
  Edit3, 
  X, 
  Download, 
  RefreshCw, 
  Layers, 
  History,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  ClipboardList,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Sparkles
} from 'lucide-react';
import { Product, BarangMasukRecord, StockAuditRecord } from '../types';
import { formatRupiah, StorageService } from '../services/storageService';
import { GasApiService } from '../services/gasApiService';
import { useOverlayHistory } from '../utils/useOverlayHistory';

interface StockManagementViewProps {
  products: Product[];
  onUpdateStock: (productId: string, newStock: number) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

type TabType = 'PRODUCTS' | 'BARANG_MASUK' | 'AUDIT_LOG';
type StockFilterType = 'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL';
type SortOptionType = 'NAME_ASC' | 'STOCK_ASC' | 'STOCK_DESC' | 'PRICE_DESC' | 'ASSET_DESC';

const CORRECTION_REASONS = [
  { value: 'SELISIH_OPNAME', label: 'Selisih Hitung Opname Fisik' },
  { value: 'BARANG_RUSAK', label: 'Barang Rusak / Pecah / Bocor' },
  { value: 'BARANG_HILANG', label: 'Barang Hilang / Selisih Kasir' },
  { value: 'BONUS_SUPPLIER', label: 'Bonus / Sample Supplier' },
  { value: 'KOREKSI_ADMIN', label: 'Koreksi Salah Input Data' },
  { value: 'LAINNYA', label: 'Alasan Lainnya' },
];

interface StockItemRowProps {
  product: Product;
  onRestock: (product: Product) => void;
  onOpname: (product: Product) => void;
  onEdit: (product: Product) => void;
}

const StockMobileCard: React.FC<StockItemRowProps> = React.memo(({
  product: p,
  onRestock,
  onOpname,
  onEdit,
}) => {
  const isOutOfStock = p.stock <= 0;
  const isLowStock = p.stock >= 1 && p.stock <= 4;
  const margin = p.price - p.cost;
  const marginPercent = p.price > 0 ? (margin / p.price) * 100 : 0;

  return (
    <div className="[content-visibility:auto] [contain-intrinsic-size:auto_220px] bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-extrabold text-[#2563EB] dark:text-[#C084FC] bg-blue-50 dark:bg-purple-500/15 border border-blue-200 dark:border-purple-500/35 px-2 py-0.5 rounded-md truncate">
          {p.sku}
        </span>
        <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full tabular-nums font-mono whitespace-nowrap ${
          isOutOfStock
            ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35'
            : isLowStock
            ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
            : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35'
        }`}>
          {isOutOfStock ? 'HABIS (0)' : isLowStock ? `MENIPIS (${p.stock})` : `STOK: ${p.stock}`}
        </span>
      </div>

      <div>
        <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] leading-snug">
          {p.name}
        </h4>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-semibold bg-slate-100 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] px-2 py-0.5 rounded-md">
            {p.category}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400">
            Margin: <strong className={marginPercent < 20 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>{marginPercent.toFixed(1)}%</strong>
          </span>
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-100 dark:border-[#2B2B33] grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-bold tracking-wider">Harga Jual:</span>
          <p className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(p.price)}</p>
          {p.redPrice && p.redPrice !== p.price ? (
            <p className="text-[10px] text-red-600 dark:text-red-400 font-bold tabular-nums font-mono">Merah: {formatRupiah(p.redPrice)}</p>
          ) : null}
        </div>

        <div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-bold tracking-wider">HPP &amp; Nilai Aset:</span>
          <p className="text-slate-600 dark:text-zinc-300 font-medium tabular-nums font-mono">HPP: {formatRupiah(p.cost)}</p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold tabular-nums font-mono">Aset: {formatRupiah(p.totalAsset || p.cost * p.stock)}</p>
        </div>
      </div>

      {/* 3 Action Buttons for Mobile */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-[#2B2B33] grid grid-cols-3 gap-1.5">
        <button
          onClick={() => onRestock(p)}
          className="py-2.5 px-2 rounded-xl bg-blue-50 dark:bg-purple-500/15 hover:bg-blue-100 dark:hover:bg-purple-500/25 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35 text-xs font-bold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer transition-colors"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          <span>Restock</span>
        </button>

        <button
          onClick={() => onOpname(p)}
          className="py-2.5 px-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-[#343440] text-xs font-bold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer transition-colors"
          title="Koreksi Stok / Opname"
        >
          <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Opname</span>
        </button>

        <button
          onClick={() => onEdit(p)}
          className="py-2.5 px-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-[#343440] text-xs font-bold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Info</span>
        </button>
      </div>
    </div>
  );
});

const StockTableRow: React.FC<StockItemRowProps> = React.memo(({
  product: p,
  onRestock,
  onOpname,
  onEdit,
}) => {
  const isOutOfStock = p.stock <= 0;
  const isLowStock = p.stock >= 1 && p.stock <= 4;
  const margin = p.price - p.cost;
  const marginPercent = p.price > 0 ? (margin / p.price) * 100 : 0;
  const asset = p.totalAsset || p.cost * p.stock;

  return (
    <tr className="hover:bg-slate-50/80 dark:hover:bg-[#24242B]/70 transition-colors">
      <td className="py-3 px-4 font-mono font-bold text-[#2563EB] dark:text-[#C084FC] whitespace-nowrap">
        {p.sku}
      </td>
      <td className="py-3 px-4">
        <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6] block">{p.name}</span>
        {p.notes ? (
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 italic block">{p.notes}</span>
        ) : null}
      </td>
      <td className="py-3 px-4">
        <span className="bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-[#343440] px-2 py-0.5 rounded-md font-semibold text-[11px] whitespace-nowrap">
          {p.category}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`inline-block font-extrabold px-2.5 py-0.5 rounded-full text-xs tabular-nums font-mono whitespace-nowrap ${
          isOutOfStock
            ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35'
            : isLowStock
            ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
            : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35'
        }`}>
          {p.stock} btl
        </span>
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] block tabular-nums font-mono">{formatRupiah(p.price)}</span>
        {p.redPrice && p.redPrice !== p.price ? (
          <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block tabular-nums font-mono">Merah: {formatRupiah(p.redPrice)}</span>
        ) : null}
      </td>
      <td className="py-3 px-4 text-right text-slate-600 dark:text-zinc-300 font-medium tabular-nums font-mono whitespace-nowrap">
        {formatRupiah(p.cost)}
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <span className={`font-bold block tabular-nums font-mono ${marginPercent < 20 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {marginPercent.toFixed(1)}%
        </span>
        <span className="text-[10px] text-slate-500 dark:text-zinc-400 block tabular-nums font-mono">+{formatRupiah(margin)}</span>
      </td>
      <td className="py-3 px-4 text-right font-extrabold text-amber-700 dark:text-amber-400 tabular-nums font-mono whitespace-nowrap">
        {formatRupiah(asset)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => onRestock(p)}
            title="Catat Restock Barang Masuk"
            className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-purple-500/15 hover:bg-blue-100 dark:hover:bg-purple-500/25 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer min-h-[38px]"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>Restock</span>
          </button>

          <button
            onClick={() => onOpname(p)}
            title="Koreksi Stok / Stock Opname"
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-[#343440] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer min-h-[38px]"
          >
            <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Opname</span>
          </button>

          <button
            onClick={() => onEdit(p)}
            title="Edit Info & Harga (Tanpa merusak stok)"
            className="p-2 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-[#343440] transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export const StockManagementView: React.FC<StockManagementViewProps> = ({
  products,
  onUpdateStock,
  onAddProduct,
  onUpdateProduct,
  onSyncSpreadsheet,
  isSyncing,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('PRODUCTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockFilterType>('ALL');
  const [sortOption, setSortOption] = useState<SortOptionType>('NAME_ASC');
  const [productsVisibleCount, setProductsVisibleCount] = useState<number>(50);
  const [barangMasukVisibleCount, setBarangMasukVisibleCount] = useState<number>(50);
  const [auditVisibleCount, setAuditVisibleCount] = useState<number>(50);

  useEffect(() => {
    setProductsVisibleCount(50);
  }, [searchQuery, selectedCategory, stockStatusFilter, sortOption]);

  // Sync info
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Incoming stock records & audit logs
  const [barangMasukList, setBarangMasukList] = useState<BarangMasukRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<StockAuditRecord[]>([]);

  // Restock modal state
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockMode, setRestockMode] = useState<'BOTTLE' | 'KRAT'>('KRAT');
  const [restockKrat, setRestockKrat] = useState<number>(1);
  const [restockBottlesPerKrat, setRestockBottlesPerKrat] = useState<number>(12);
  const [restockDirectBottles, setRestockDirectBottles] = useState<number>(12);
  const [restockCost, setRestockCost] = useState<number>(0);
  const [restockSupplier, setRestockSupplier] = useState<string>('orang tua');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);
  const [restockFeedback, setRestockFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Stock Opname / Koreksi Stok modal state
  const [correctingProduct, setCorrectingProduct] = useState<Product | null>(null);
  const [physicalStockInput, setPhysicalStockInput] = useState<number | ''>('');
  const [correctionReason, setCorrectionReason] = useState<string>('SELISIH_OPNAME');
  const [correctionNotes, setCorrectionNotes] = useState<string>('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionFeedback, setCorrectionFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // New product modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('ANGGUR');
  const [newBotolPerKrat, setNewBotolPerKrat] = useState<number>(12);
  const [newHargaPerKrat, setNewHargaPerKrat] = useState<number>(0);
  const [newCost, setNewCost] = useState<number>(0);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newRedPrice, setNewRedPrice] = useState<number>(0);
  const [newInitialStock, setNewInitialStock] = useState<number>(0);
  const [newNotes, setNewNotes] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  // Edit product modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editBotolPerKrat, setEditBotolPerKrat] = useState<number>(12);
  const [editHargaPerKrat, setEditHargaPerKrat] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editRedPrice, setEditRedPrice] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editFeedback, setEditFeedback] = useState<string | null>(null);

  useOverlayHistory(
    Boolean(restockProduct),
    () => {
      setRestockProduct(null);
      setRestockFeedback(null);
    },
    'stock-restock-modal'
  );
  useOverlayHistory(
    Boolean(correctingProduct),
    () => {
      setCorrectingProduct(null);
      setCorrectionFeedback(null);
    },
    'stock-opname-modal'
  );
  useOverlayHistory(isAddModalOpen, () => setIsAddModalOpen(false), 'stock-add-modal');
  useOverlayHistory(Boolean(editingProduct), () => setEditingProduct(null), 'stock-edit-modal');

  // Refresh local data & sync timestamp
  const reloadLocalData = () => {
    setBarangMasukList(StorageService.getBarangMasukList());
    setAuditLogs(StorageService.getStockAuditLogs());
    setLastSyncTime(GasApiService.getLastSync());
  };

  useEffect(() => {
    reloadLocalData();
  }, [products]);

  // Categories list
  const presentCategories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((p) => (p.category ? String(p.category).trim() : ''))
          .filter((c): c is string => Boolean(c) && c !== 'PROMO')
      )
    );
  }, [products]);

  const categories: string[] = ['ALL', ...presentCategories];

  // Stock status counts for filter badges
  const stockCounts = useMemo(() => {
    const valid = products.filter((p) => {
      const sku = (p.sku || '').toUpperCase();
      const name = (p.name || '').toUpperCase();
      return !sku.includes('PROMO') && !name.includes('PROMO') && p.category !== 'PROMO';
    });

    return {
      all: valid.length,
      outOfStock: valid.filter((p) => p.stock <= 0).length,
      lowStock: valid.filter((p) => p.stock >= 1 && p.stock <= 4).length,
      normal: valid.filter((p) => p.stock >= 5).length,
    };
  }, [products]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const skuUpper = String(p.sku || '').toUpperCase();
        const nameUpper = String(p.name || '').toUpperCase();
        // Exclude promo rules from stock inventory list
        if (skuUpper.includes('PROMO') || nameUpper.includes('PROMO') || nameUpper.includes('POTONGAN') || p.category === 'PROMO') {
          return false;
        }

        // Category filter
        if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
          return false;
        }

        // Stock status filter: 0 = Habis, 1-4 = Menipis, >= 5 = Normal
        if (stockStatusFilter === 'OUT_OF_STOCK' && p.stock > 0) return false;
        if (stockStatusFilter === 'LOW_STOCK' && (p.stock <= 0 || p.stock >= 5)) return false;
        if (stockStatusFilter === 'NORMAL' && p.stock < 5) return false;

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortOption === 'NAME_ASC') return a.name.localeCompare(b.name);
        if (sortOption === 'STOCK_ASC') return a.stock - b.stock;
        if (sortOption === 'STOCK_DESC') return b.stock - a.stock;
        if (sortOption === 'PRICE_DESC') return b.price - a.price;
        if (sortOption === 'ASSET_DESC') {
          const assetA = a.totalAsset || a.cost * a.stock;
          const assetB = b.totalAsset || b.cost * b.stock;
          return assetB - assetA;
        }
        return 0;
      });
  }, [products, selectedCategory, stockStatusFilter, searchQuery, sortOption]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, productsVisibleCount);
  }, [filteredProducts, productsVisibleCount]);

  const visibleBarangMasuk = useMemo(() => {
    return barangMasukList.slice(0, barangMasukVisibleCount);
  }, [barangMasukList, barangMasukVisibleCount]);

  const visibleAuditLogs = useMemo(() => {
    return auditLogs.slice(0, auditVisibleCount);
  }, [auditLogs, auditVisibleCount]);

  // Inventory aggregate metrics
  const inventoryMetrics = useMemo(() => {
    const valid = products.filter((p) => {
      const sku = (p.sku || '').toUpperCase();
      const name = (p.name || '').toUpperCase();
      return !sku.includes('PROMO') && !name.includes('PROMO') && p.category !== 'PROMO';
    });

    const totalBottles = valid.reduce((sum, p) => sum + p.stock, 0);
    const totalAssetCost = valid.reduce((sum, p) => sum + (p.totalAsset || p.cost * p.stock), 0);
    const totalPotentialRevenue = valid.reduce((sum, p) => sum + p.price * p.stock, 0);
    const potentialProfit = totalPotentialRevenue - totalAssetCost;

    return { totalBottles, totalAssetCost, totalPotentialRevenue, potentialProfit };
  }, [products]);

  // Helper: Generate SKU pattern
  const handleAutoGenerateSku = () => {
    const catPrefix = (newCategory || 'OT').slice(0, 3).toUpperCase();
    const shortRandom = Math.random().toString(36).substring(2, 6).toUpperCase();
    setNewSku(`ORTU-${catPrefix}-${shortRandom}`);
  };

  // Helper: Open Add Modal
  const handleOpenAddModal = () => {
    const initialCat = presentCategories[0] || 'ANGGUR';
    setNewCategory(initialCat);
    setNewSku(`ORTU-${initialCat.slice(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
    setNewName('');
    setNewBotolPerKrat(12);
    setNewHargaPerKrat(0);
    setNewCost(0);
    setNewPrice(0);
    setNewRedPrice(0);
    setNewInitialStock(0);
    setNewNotes('');
    setAddFeedback(null);
    setIsAddModalOpen(true);
  };

  // Helper: Calculate Margin for Add/Edit
  const calculateMargin = (sellPrice: number, costPrice: number) => {
    const nominal = sellPrice - costPrice;
    const percent = sellPrice > 0 ? (nominal / sellPrice) * 100 : 0;
    return { nominal, percent };
  };

  // Submit Add Product
  const handleSaveNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSku = newSku.trim().toUpperCase();
    const cleanName = newName.trim();

    if (!cleanSku || !cleanName || newPrice <= 0) {
      setAddFeedback('SKU, Nama Produk, dan Harga Jual wajib diisi dengan benar.');
      return;
    }

    // Check SKU uniqueness on client
    const isDuplicate = products.some((p) => p.sku.toUpperCase() === cleanSku);
    if (isDuplicate) {
      setAddFeedback(`SKU "${cleanSku}" sudah terdaftar pada katalog. Gunakan SKU lain.`);
      return;
    }

    setIsSubmittingAdd(true);
    setAddFeedback(null);

    const marginNominal = newPrice - newCost;

    try {
      await onAddProduct({
        sku: cleanSku,
        name: cleanName,
        category: newCategory,
        botolPerKrat: newBotolPerKrat,
        hargaPerKrat: newHargaPerKrat,
        cost: newCost,
        purchasePrice: newCost,
        price: newPrice,
        redPrice: newRedPrice > 0 ? newRedPrice : newPrice,
        stock: newInitialStock,
        initialStock: newInitialStock,
        totalAsset: newInitialStock * newCost,
        notes: newNotes.trim(),
      });

      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddFeedback(err?.message || 'Gagal menambahkan produk ke Google Sheets');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = useCallback((p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditCategory(p.category || 'ANGGUR');
    setEditBotolPerKrat(p.botolPerKrat || 12);
    setEditHargaPerKrat(p.hargaPerKrat || (p.cost ? p.cost * 12 : 0));
    setEditCost(p.cost);
    setEditPrice(p.price);
    setEditRedPrice(p.redPrice || p.price);
    setEditNotes(p.notes || '');
    setEditFeedback(null);
  }, []);

  // Submit Edit Product
  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editName.trim() || editPrice <= 0) {
      setEditFeedback('Nama produk dan harga jual wajib diisi.');
      return;
    }

    setIsSubmittingEdit(true);
    setEditFeedback(null);

    try {
      const updated: Product = {
        ...editingProduct,
        name: editName.trim(),
        category: editCategory,
        botolPerKrat: editBotolPerKrat,
        hargaPerKrat: editHargaPerKrat,
        cost: editCost,
        purchasePrice: editCost,
        price: editPrice,
        redPrice: editRedPrice > 0 ? editRedPrice : editPrice,
        totalAsset: editingProduct.stock * editCost,
        notes: editNotes.trim(),
      };

      await onUpdateProduct(updated);
      setEditingProduct(null);
    } catch (err: any) {
      setEditFeedback(err?.message || 'Gagal memperbarui info produk');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Open Restock Modal
  const handleOpenRestockModal = useCallback((p: Product) => {
    setRestockProduct(p);
    setRestockMode('KRAT');
    setRestockKrat(1);
    setRestockBottlesPerKrat(p.botolPerKrat || 12);
    setRestockDirectBottles(12);
    setRestockCost(p.cost || 0);
    setRestockSupplier('Gudang Utama / Orang Tua');
    setRestockFeedback(null);
  }, []);

  // Confirm Restock
  const handleConfirmRestock = async () => {
    if (!restockProduct) return;

    const totalQty = restockMode === 'KRAT' 
      ? restockKrat * restockBottlesPerKrat 
      : restockDirectBottles;

    if (totalQty <= 0) {
      setRestockFeedback({ type: 'error', message: 'Jumlah restock harus lebih dari 0 botol.' });
      return;
    }

    setIsSubmittingRestock(true);
    setRestockFeedback(null);

    try {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      const dateStr = `${d}/${m}/${y}`;
      const recordId = `BM-${Date.now().toString().slice(-6)}`;
      const totalCost = totalQty * restockCost;

      const newRecord: BarangMasukRecord = {
        id: recordId,
        date: dateStr,
        sku: restockProduct.sku,
        name: restockProduct.name,
        krat: restockMode === 'KRAT' ? restockKrat : 0,
        qty: totalQty,
        cost: restockCost,
        totalCost: totalCost,
        supplier: restockSupplier || 'orang tua',
        supplierOrNotes: restockSupplier || 'orang tua',
      };

      // 1. Send to Google Sheets (LOG_BARANG_MASUK B:H)
      const pushRes = await GasApiService.pushBarangMasuk(newRecord);

      if (pushRes && pushRes.success) {
        // 2. Simpan lokal & update audit log
        StorageService.recordBarangMasuk(newRecord);
        StorageService.addStockAuditLog({
          sku: restockProduct.sku,
          productName: restockProduct.name,
          action: 'RESTOCK',
          details: `Restock +${totalQty} btl (${restockMode === 'KRAT' ? `${restockKrat} krat @${restockBottlesPerKrat}` : `${totalQty} btl`}) - Supplier: ${restockSupplier}`,
          oldValue: restockProduct.stock,
          newValue: restockProduct.stock + totalQty,
          source: 'GOOGLE_SHEETS',
          operator: 'Admin',
        });

        // Update local memory stock
        onUpdateStock(restockProduct.id, restockProduct.stock + totalQty);
        reloadLocalData();

        showToast?.(`✓ Restock ${restockProduct.sku} (+${totalQty} btl) tercatat di LOG_BARANG_MASUK!`, 'success');
        setRestockFeedback({
          type: 'success',
          message: pushRes.message || `Berhasil dicatat ke LOG_BARANG_MASUK baris ${pushRes.rowNumber || 'baru'}.`,
        });

        // Trigger re-sync from sheets
        onSyncSpreadsheet?.();

        setTimeout(() => {
          setRestockProduct(null);
          setRestockFeedback(null);
        }, 1200);
      } else {
        showToast?.(`⚠️ Gagal mencatat restock ke Google Sheets: ${pushRes?.message || 'Error'}`, 'error');
        setRestockFeedback({
          type: 'warning',
          message: pushRes?.message || 'Gagal menyimpan ke spreadsheet.',
        });
      }
    } catch (err: any) {
      setRestockFeedback({
        type: 'error',
        message: 'Koneksi error: ' + (err?.message || 'Gagal menghubungi server/Google Sheets'),
      });
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  // Open Stock Correction Modal
  const handleOpenCorrectionModal = useCallback((p: Product) => {
    setCorrectingProduct(p);
    setPhysicalStockInput(p.stock);
    setCorrectionReason('SELISIH_OPNAME');
    setCorrectionNotes('');
    setCorrectionFeedback(null);
  }, []);

  // Confirm Stock Correction
  const handleConfirmCorrection = async () => {
    if (!correctingProduct) return;

    const physicalStock = typeof physicalStockInput === 'number' ? physicalStockInput : 0;
    const systemStock = correctingProduct.stock;
    const delta = physicalStock - systemStock;

    if (delta === 0) {
      setCorrectionFeedback({
        type: 'error',
        message: 'Selisih 0: Stok fisik sama dengan stok sistem. Tidak ada perubahan yang perlu disimpan.',
      });
      return;
    }

    setIsSubmittingCorrection(true);
    setCorrectionFeedback(null);

    const reasonItem = CORRECTION_REASONS.find((r) => r.value === correctionReason);
    const reasonLabel = reasonItem ? reasonItem.label : correctionReason;

    try {
      // Push single transaction to LOG_BARANG_MASUK with positive or negative delta
      const res = await GasApiService.adjustStock({
        sku: correctingProduct.sku,
        name: correctingProduct.name,
        delta: delta,
        cost: correctingProduct.cost || 0,
        reason: reasonLabel,
        notes: correctionNotes.trim(),
      });

      if (res && res.success) {
        // Record local audit log
        StorageService.addStockAuditLog({
          sku: correctingProduct.sku,
          productName: correctingProduct.name,
          action: 'KOREKSI_STOK',
          details: `Opname: Fisik ${physicalStock} vs Sistem ${systemStock} (Selisih ${delta >= 0 ? '+' : ''}${delta} btl, Nilai: ${formatRupiah(Math.abs(delta * correctingProduct.cost))}) - Alasan: ${reasonLabel}`,
          oldValue: systemStock,
          newValue: physicalStock,
          source: 'GOOGLE_SHEETS',
          operator: 'Admin',
        });

        // Also update local storage record
        StorageService.updateProductStock(correctingProduct.sku, physicalStock, true);
        onUpdateStock(correctingProduct.id, physicalStock);
        reloadLocalData();

        showToast?.(`✓ Koreksi stok ${correctingProduct.sku} (${delta >= 0 ? '+' : ''}${delta} btl) tercatat di LOG_BARANG_MASUK!`, 'success');
        setCorrectionFeedback({
          type: 'success',
          message: res.message || 'Koreksi stok berhasil dicatat ke LOG_BARANG_MASUK!',
        });

        // Reload live from Google Sheets
        onSyncSpreadsheet?.();

        setTimeout(() => {
          setCorrectingProduct(null);
          setCorrectionFeedback(null);
        }, 1200);
      } else {
        showToast?.(`⚠️ Gagal mencatat koreksi stok: ${res?.message || 'Error'}`, 'error');
        setCorrectionFeedback({
          type: 'warning',
          message: res?.message || 'Gagal menyimpan koreksi stok ke spreadsheet.',
        });
      }
    } catch (err: any) {
      setCorrectionFeedback({
        type: 'error',
        message: 'Koneksi error: ' + (err?.message || 'Gagal menghubungi server/Google Sheets'),
      });
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  // CSV Exports
  const handleExportProductsCSV = () => {
    if (products.length === 0) return;

    const headers = ['SKU_ColB', 'NAMA_PRODUK_ColC', 'STOK_ColD', 'HARGA_JUAL_ColE', 'HARGA_MODAL_ColF', 'HARGA_MERAH_ColG', 'TOTAL_ASET_ColH', 'KATEGORI'];
    const rows = products.map((p) => [
      p.sku,
      `"${p.name.replace(/"/g, '""')}"`,
      p.stock,
      p.price,
      p.cost,
      p.redPrice || p.price,
      p.totalAsset || p.cost * p.stock,
      p.category,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ortukill_Stok_B70_H_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBarangMasukCSV = () => {
    if (barangMasukList.length === 0) return;

    const headers = ['TANGGAL_ColB', 'NO_BUKTI_ColC', 'SKU_ColD', 'NAMA_PRODUK_ColE', 'KRAT_ColE', 'QTY_ColF', 'HARGA_MODAL_ColG', 'TOTAL_BIAYA_ColH', 'SUPPLIER_ColI'];
    const rows = barangMasukList.map((bm) => [
      bm.date,
      bm.id,
      bm.sku,
      `"${bm.name.replace(/"/g, '""')}"`,
      bm.krat || 0,
      bm.qty,
      bm.cost,
      bm.totalCost || (bm.qty * bm.cost),
      `"${(bm.supplier || bm.supplierOrNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ortukill_BarangMasuk_B4_H_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24">
      {/* Top Header Card & Sync Status */}
      <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 transition-colors">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-[#F4F4F6]">
                Manajemen Stok &amp; Inventori
              </h2>
              <span className="bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                {products.length} SKU
              </span>
              <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35 text-[11px] px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Formula M:Q Aman</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-1 flex-wrap">
              <span className="font-medium text-slate-600 dark:text-zinc-300">Google Sheets ORTUKILL KEDIRI</span>
              <span className="text-slate-300 dark:text-zinc-600">•</span>
              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                <span>Sinkron: {lastSyncTime ? lastSyncTime : 'Baru saja'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full lg:w-auto">
          {onSyncSpreadsheet && (
            <button
              onClick={onSyncSpreadsheet}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-[#343440] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkron...' : 'Segarkan Sheets'}</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white text-xs font-bold transition-colors cursor-pointer min-h-[44px] shadow-xs dark:shadow-[0_0_14px_rgba(168,85,247,0.3)]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] transition-colors">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
            Total Stok Fisik
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-1 tabular-nums font-mono">
            {inventoryMetrics.totalBottles} Botol
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Formula: Stok Awal + Masuk − Keluar
          </p>
        </div>

        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] transition-colors">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
            Nilai Aset Modal
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums font-mono">
            {formatRupiah(inventoryMetrics.totalAssetCost)}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Total biaya HPP tertanam
          </p>
        </div>

        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] transition-colors">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
            Potensi Omset
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-1 tabular-nums font-mono">
            {formatRupiah(inventoryMetrics.totalPotentialRevenue)}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Bila seluruh stok terjual
          </p>
        </div>

        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] transition-colors">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
            Potensi Keuntungan
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums font-mono">
            +{formatRupiah(inventoryMetrics.potentialProfit)}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Estimasi margin kotor
          </p>
        </div>
      </div>

      {/* Main Tab Switcher (Katalog, Riwayat Masuk, Audit Log) */}
      <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-1.5 border border-slate-200 dark:border-[#2B2B33] flex items-center gap-1 overflow-x-auto no-scrollbar transition-colors">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`flex-1 min-w-fit whitespace-nowrap flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'PRODUCTS'
              ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#24242B]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Katalog &amp; Stok ({filteredProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('BARANG_MASUK')}
          className={`flex-1 min-w-fit whitespace-nowrap flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'BARANG_MASUK'
              ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#24242B]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Riwayat Masuk ({barangMasukList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT_LOG')}
          className={`flex-1 min-w-fit whitespace-nowrap flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'AUDIT_LOG'
              ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#24242B]'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Audit Log ({auditLogs.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: KATALOG & STOK                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'PRODUCTS' && (
        <>
          {/* Search, Filter & Stock Status Controls */}
          <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-[#2B2B33] space-y-3 transition-colors">
            {/* Search + Sort + CSV */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari SKU atau nama produk..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-[#1B1B20] focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOptionType)}
                    className="w-full sm:w-auto px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 focus:outline-none focus:bg-white dark:focus:bg-[#1B1B20] focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="NAME_ASC" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">Urut: Nama (A-Z)</option>
                    <option value="STOCK_ASC" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">Urut: Stok Terendah</option>
                    <option value="STOCK_DESC" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">Urut: Stok Tertinggi</option>
                    <option value="PRICE_DESC" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">Urut: Harga Termahal</option>
                    <option value="ASSET_DESC" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">Urut: Nilai Aset Terbesar</option>
                  </select>
                </div>

                <button
                  onClick={handleExportProductsCSV}
                  title="Ekspor CSV"
                  className="px-3.5 py-2.5 bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC]" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Stock Warning Status Filter Chips (0 Habis, 1-4 Menipis, >=5 Normal) */}
            <div className="pt-2.5 border-t border-slate-100 dark:border-[#2B2B33] flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider pr-1 flex items-center gap-1 whitespace-nowrap">
                <SlidersHorizontal className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                Status:
              </span>

              <button
                onClick={() => setStockStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                  stockStatusFilter === 'ALL'
                    ? 'bg-[#0F172A] dark:bg-[#9333EA] text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440]'
                }`}
              >
                <span>Semua</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stockStatusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-[#343440] text-slate-700 dark:text-zinc-300'}`}>
                  {stockCounts.all}
                </span>
              </button>

              <button
                onClick={() => setStockStatusFilter('OUT_OF_STOCK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                  stockStatusFilter === 'OUT_OF_STOCK'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35 hover:bg-red-100 dark:hover:bg-red-500/25'
                }`}
              >
                <span>Habis (0)</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stockStatusFilter === 'OUT_OF_STOCK' ? 'bg-white/20 text-white' : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'}`}>
                  {stockCounts.outOfStock}
                </span>
              </button>

              <button
                onClick={() => setStockStatusFilter('LOW_STOCK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                  stockStatusFilter === 'LOW_STOCK'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35 hover:bg-amber-100 dark:hover:bg-amber-500/25'
                }`}
              >
                <span>Menipis (1–4)</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stockStatusFilter === 'LOW_STOCK' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'}`}>
                  {stockCounts.lowStock}
                </span>
              </button>

              <button
                onClick={() => setStockStatusFilter('NORMAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                  stockStatusFilter === 'NORMAL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35 hover:bg-emerald-100 dark:hover:bg-emerald-500/25'
                }`}
              >
                <span>Normal (≥5)</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stockStatusFilter === 'NORMAL' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'}`}>
                  {stockCounts.normal}
                </span>
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[34px] ${
                    selectedCategory === cat
                      ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-[#2E2E37] hover:text-[#0F172A] dark:hover:text-white border border-transparent dark:border-[#343440]'
                  }`}
                >
                  {cat === 'ALL' ? 'Semua Kategori' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* MOBILE VIEW (<640px): Product Card List */}
          <div className="space-y-3 sm:hidden">
            {filteredProducts.length === 0 ? (
              <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-8 text-center border border-slate-200 dark:border-[#2B2B33]">
                <Package className="w-8 h-8 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">Tidak ada produk yang cocok</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter status stok.</p>
              </div>
            ) : (
              visibleProducts.map((p) => (
                <StockMobileCard
                  key={p.id}
                  product={p}
                  onRestock={handleOpenRestockModal}
                  onOpname={handleOpenCorrectionModal}
                  onEdit={handleOpenEditModal}
                />
              ))
            )}
          </div>

          {/* DESKTOP VIEW (>=640px): Full Table */}
          <div className="hidden sm:block bg-white dark:bg-[#1B1B20] rounded-2xl border border-slate-200 dark:border-[#2B2B33] overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-[#343440] font-bold">
                  <tr>
                    <th className="py-3 px-4">SKU / Kode</th>
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-center">Stok Fisik</th>
                    <th className="py-3 px-4 text-right">Harga Jual</th>
                    <th className="py-3 px-4 text-right">Harga HPP</th>
                    <th className="py-3 px-4 text-right">Margin (%)</th>
                    <th className="py-3 px-4 text-right">Nilai Aset</th>
                    <th className="py-3 px-4 text-center">Aksi Operasional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2B2B33]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-zinc-400">
                        Tidak ada data produk yang cocok dengan pencarian atau filter.
                      </td>
                    </tr>
                  ) : (
                    visibleProducts.map((p) => (
                      <StockTableRow
                        key={p.id}
                        product={p}
                        onRestock={handleOpenRestockModal}
                        onOpname={handleOpenCorrectionModal}
                        onEdit={handleOpenEditModal}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredProducts.length > visibleProducts.length && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                Menampilkan {visibleProducts.length} dari {filteredProducts.length} produk
              </span>
              <button
                type="button"
                onClick={() => setProductsVisibleCount((prev) => prev + 50)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
              >
                Muat Lagi (+50)
              </button>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RIWAYAT BARANG MASUK & KOREKSI STOK (LOG_BARANG_MASUK)             */}
      {/* ========================================================================= */}
      {activeTab === 'BARANG_MASUK' && (
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl border border-slate-200 dark:border-[#2B2B33] overflow-hidden p-4 sm:p-5 space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6] flex items-center gap-2 flex-wrap">
                <span>Riwayat Barang Masuk &amp; Koreksi</span>
                <span className="text-xs bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-[#343440] px-2 py-0.5 rounded-full font-bold">
                  {barangMasukList.length} Catatan
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Membaca langsung tab spreadsheet <strong className="text-[#0F172A] dark:text-[#F4F4F6]">LOG_BARANG_MASUK</strong> (Kolom B:H).
              </p>
            </div>

            <button
              onClick={handleExportBarangMasukCSV}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
            >
              <Download className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC]" />
              <span>Ekspor Riwayat CSV</span>
            </button>
          </div>

          {/* Mobile cards for Barang Masuk */}
          <div className="space-y-2.5 sm:hidden">
            {barangMasukList.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-zinc-400 text-xs">
                Belum ada catatan barang masuk di LOG_BARANG_MASUK.
              </div>
            ) : (
              visibleBarangMasuk.map((bm, idx) => {
                const isCorrection = (bm.supplier || bm.supplierOrNotes || '').includes('KOREKSI');
                const isNegative = bm.qty < 0;

                return (
                  <div key={bm.id || idx} className="bg-slate-50 dark:bg-[#24242B] rounded-xl p-3.5 border border-slate-200 dark:border-[#343440] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">{bm.date}</span>
                      <span className={`inline-block font-extrabold px-2.5 py-0.5 rounded-full text-xs tabular-nums font-mono ${
                        isNegative
                          ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35'
                          : isCorrection
                          ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
                          : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35'
                      }`}>
                        {bm.qty >= 0 ? `+${bm.qty}` : bm.qty} btl
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[11px] font-bold text-[#2563EB] dark:text-[#C084FC] block">{bm.sku}</span>
                      <span className="font-bold text-sm text-[#0F172A] dark:text-[#F4F4F6] block">{bm.name}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-[#343440] text-xs">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        isCorrection
                          ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
                          : 'bg-white dark:bg-[#1B1B20] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-[#343440]'
                      }`}>
                        {bm.supplier || bm.supplierOrNotes || 'orang tua'}
                      </span>
                      <span className="font-extrabold font-mono text-[#0F172A] dark:text-[#F4F4F6] tabular-nums">
                        {formatRupiah(bm.totalCost || bm.qty * bm.cost)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-[#343440] font-bold">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">SKU &amp; Produk</th>
                  <th className="py-3 px-4 text-center">Qty / Krat</th>
                  <th className="py-3 px-4 text-center">Kuantitas Masuk</th>
                  <th className="py-3 px-4 text-right">Biaya Satuan</th>
                  <th className="py-3 px-4 text-right">Total Biaya</th>
                  <th className="py-3 px-4">Supplier / Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2B2B33]">
                {barangMasukList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-zinc-400">
                      Belum ada catatan barang masuk di LOG_BARANG_MASUK.
                    </td>
                  </tr>
                ) : (
                  visibleBarangMasuk.map((bm, idx) => {
                    const isCorrection = (bm.supplier || bm.supplierOrNotes || '').includes('KOREKSI');
                    const isNegative = bm.qty < 0;

                    return (
                      <tr key={bm.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#24242B]/70 transition-colors">
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300 font-medium whitespace-nowrap">
                          {bm.date}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[#2563EB] dark:text-[#C084FC] block">{bm.sku}</span>
                          <span className="font-semibold text-[#0F172A] dark:text-[#F4F4F6] block">{bm.name}</span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 dark:text-zinc-300 font-medium">
                          {bm.krat ? `${bm.krat} krat` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block font-extrabold px-2.5 py-0.5 rounded-full text-xs tabular-nums font-mono ${
                            isNegative
                              ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35'
                              : isCorrection
                              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
                              : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35'
                          }`}>
                            {bm.qty >= 0 ? `+${bm.qty}` : bm.qty} btl
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-zinc-300 font-medium tabular-nums font-mono">
                          {formatRupiah(bm.cost)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold font-mono text-[#0F172A] dark:text-[#F4F4F6] tabular-nums">
                          {formatRupiah(bm.totalCost || bm.qty * bm.cost)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            isCorrection
                              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
                              : 'bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-[#343440]'
                          }`}>
                            {bm.supplier || bm.supplierOrNotes || 'orang tua'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {barangMasukList.length > visibleBarangMasuk.length && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                Menampilkan {visibleBarangMasuk.length} dari {barangMasukList.length} catatan
              </span>
              <button
                type="button"
                onClick={() => setBarangMasukVisibleCount((prev) => prev + 50)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
              >
                Muat Lagi (+50)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIT LOG (PERUBAHAN PRODUK & STOK)                                */}
      {/* ========================================================================= */}
      {activeTab === 'AUDIT_LOG' && (
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl border border-slate-200 dark:border-[#2B2B33] overflow-hidden p-4 sm:p-5 space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6] flex items-center gap-2 flex-wrap">
                <ClipboardList className="w-5 h-5 text-[#2563EB] dark:text-[#C084FC]" />
                <span>Riwayat Audit Perubahan Produk &amp; Stok</span>
                <span className="text-xs bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-[#343440] px-2 py-0.5 rounded-full font-bold">
                  {auditLogs.length} Entri
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Mencatat mutasi produk, restock, opname, dan pengubahan info secara transparan tanpa mengubah struktur sheet.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#2B2B33]">
            {auditLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-zinc-400">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-zinc-500" />
                <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6]">Belum ada aktivitas audit yang terekam</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Setiap mutasi stok, koreksi opname, atau perubahan produk akan tercatat di sini.</p>
              </div>
            ) : (
              visibleAuditLogs.map((log) => {
                const isRestock = log.action === 'RESTOCK';
                const isOpname = log.action === 'KOREKSI_STOK';
                const isAdd = log.action === 'TAMBAH_PRODUK';

                return (
                  <div key={log.id} className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                          isRestock
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35'
                            : isOpname
                            ? 'bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35'
                            : isAdd
                            ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
                            : 'bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-[#343440]'
                        }`}>
                          {log.action}
                        </span>

                        <span className="font-mono text-xs font-bold text-[#2563EB] dark:text-[#C084FC]">
                          {log.sku}
                        </span>

                        <span className="text-xs font-extrabold text-[#0F172A] dark:text-[#F4F4F6]">
                          {log.productName}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
                        {log.details}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 sm:text-right text-xs text-slate-500 dark:text-zinc-400">
                      <span className="bg-slate-100 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                        {log.source === 'GOOGLE_SHEETS' ? 'Sheets Sync' : 'POS'}
                      </span>
                      <span>{log.dateStr}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {auditLogs.length > visibleAuditLogs.length && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                Menampilkan {visibleAuditLogs.length} dari {auditLogs.length} entri
              </span>
              <button
                type="button"
                onClick={() => setAuditVisibleCount((prev) => prev + 50)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-[#0F172A] dark:text-[#F4F4F6] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
              >
                Muat Lagi (+50)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RESTOCK PRODUK                                                   */}
      {/* ========================================================================= */}
      {restockProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div
            className="fixed inset-0"
            onClick={() => {
              setRestockProduct(null);
              setRestockFeedback(null);
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
            <div className="px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/35 flex items-center justify-center shrink-0">
                    <ArrowUpCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm sm:text-base text-[#0F172A] dark:text-[#F4F4F6] truncate">
                      Restock Barang Masuk
                    </h3>
                    <span className="font-mono text-[11px] font-bold text-[#2563EB] dark:text-[#C084FC] block truncate">
                      {restockProduct.sku}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRestockProduct(null);
                    setRestockFeedback(null);
                  }}
                  aria-label="Tutup modal restock"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full bg-slate-100 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white active:scale-[0.97] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5 text-xs">
              <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440]">
                <p className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] text-sm">{restockProduct.name}</p>
                <div className="flex justify-between items-center mt-1 text-slate-600 dark:text-zinc-300">
                  <span>Stok Sistem Saat Ini:</span>
                  <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{restockProduct.stock} Botol</span>
                </div>
              </div>

              {/* Mode Restock: Krat vs Satuan Botol */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Metode Input Kuantitas:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRestockMode('KRAT')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[44px] ${
                      restockMode === 'KRAT'
                        ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440]'
                    }`}
                  >
                    Per Krat ({restockBottlesPerKrat} btl/krat)
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestockMode('BOTTLE')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[44px] ${
                      restockMode === 'BOTTLE'
                        ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-[#24242B] text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440]'
                    }`}
                  >
                    Kuantitas Botol Langsung
                  </button>
                </div>
              </div>

              {restockMode === 'KRAT' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Jumlah Krat:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={restockKrat}
                      onChange={(e) => setRestockKrat(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Botol / Krat:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={restockBottlesPerKrat}
                      onChange={(e) => setRestockBottlesPerKrat(Math.max(1, parseInt(e.target.value) || 12))}
                      className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Jumlah Botol Masuk:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={restockDirectBottles}
                    onChange={(e) => setRestockDirectBottles(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Harga Beli / HPP per Botol:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={restockCost}
                  onChange={(e) => setRestockCost(Number(e.target.value) || 0)}
                  className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Supplier / Asal Pengiriman:
                </label>
                <input
                  type="text"
                  value={restockSupplier}
                  onChange={(e) => setRestockSupplier(e.target.value)}
                  placeholder="Gudang Utama, Orang Tua, dll"
                  className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                />
              </div>

              <div className="pt-2.5 border-t border-slate-200 dark:border-[#343440] space-y-1.5 bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border">
                {(() => {
                  const effectiveQty = restockMode === 'KRAT' ? restockKrat * restockBottlesPerKrat : restockDirectBottles;
                  const totalCost = effectiveQty * restockCost;
                  const newStockPredicted = restockProduct.stock + effectiveQty;

                  return (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-zinc-300 font-medium">Total Botol Masuk:</span>
                        <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">+{effectiveQty} botol</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-zinc-300 font-medium">Total Biaya Masuk:</span>
                        <span className="font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums">{formatRupiah(totalCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-200 dark:border-[#343440]">
                        <span className="text-[#0F172A] dark:text-[#F4F4F6] font-bold">Stok Akhir Formula Nanti:</span>
                        <span className="font-extrabold text-[#2563EB] dark:text-[#C084FC] text-sm tabular-nums font-mono">{newStockPredicted} botol</span>
                      </div>
                    </>
                  );
                })()}
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 pt-1">
                  *Dicatat aman ke <strong className="text-[#0F172A] dark:text-[#F4F4F6]">LOG_BARANG_MASUK</strong> (Kolom B:H).
                </p>
              </div>

              {restockFeedback && (
                <div className={`p-3 rounded-xl text-xs font-medium ${
                  restockFeedback.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35' 
                    : restockFeedback.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
                    : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35'
                }`}>
                  {restockFeedback.message}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRestockProduct(null);
                  setRestockFeedback(null);
                }}
                className="flex-1 py-3 rounded-xl bg-white dark:bg-[#1B1B20] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-[#343440] font-semibold text-xs min-h-[44px] active:scale-[0.97] cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingRestock}
                onClick={handleConfirmRestock}
                className="flex-1 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white font-bold text-xs min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer disabled:opacity-60 transition-colors dark:shadow-[0_0_16px_rgba(168,85,247,0.3)]"
              >
                {isSubmittingRestock ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mencatat ke Sheets...</span>
                  </>
                ) : (
                  'Simpan Restock'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: KOREKSI STOK / STOCK OPNAME                                      */}
      {/* ========================================================================= */}
      {correctingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div
            className="fixed inset-0"
            onClick={() => {
              setCorrectingProduct(null);
              setCorrectionFeedback(null);
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
            <div className="px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35 flex items-center justify-center shrink-0">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm sm:text-base text-[#0F172A] dark:text-[#F4F4F6] truncate">
                      Koreksi Stok (Stock Opname)
                    </h3>
                    <span className="font-mono text-[11px] font-bold text-[#2563EB] dark:text-[#C084FC] block truncate">
                      {correctingProduct.sku}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCorrectingProduct(null);
                    setCorrectionFeedback(null);
                  }}
                  aria-label="Tutup modal koreksi stok"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full bg-slate-100 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] active:scale-[0.97] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5 text-xs">
              <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440]">
                <p className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] text-sm">{correctingProduct.name}</p>
                <div className="flex justify-between items-center mt-1 text-slate-600 dark:text-zinc-300">
                  <span>Stok Sistem Saat Ini:</span>
                  <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] text-sm tabular-nums font-mono">{correctingProduct.stock} Botol</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Stok Fisik Aktual (Hasil Hitung Fisik):
                </label>
                <input
                  type="number"
                  min="0"
                  value={physicalStockInput}
                  onChange={(e) => setPhysicalStockInput(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Masukkan jumlah botol riil di rak/gudang"
                  className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                />
              </div>

              {/* Dynamic Delta Calculation & Rupiah Value */}
              {(() => {
                const physical = typeof physicalStockInput === 'number' ? physicalStockInput : 0;
                const system = correctingProduct.stock;
                const delta = physical - system;
                const cost = correctingProduct.cost || 0;
                const deltaRupiah = Math.abs(delta * cost);

                return (
                  <div className={`p-3 rounded-2xl border ${
                    delta === 0
                      ? 'bg-slate-50 dark:bg-[#24242B] border-slate-200 dark:border-[#343440] text-slate-600 dark:text-zinc-300'
                      : delta > 0
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-400'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs">Selisih Fisik vs Sistem:</span>
                      <span className="font-extrabold text-sm font-mono tabular-nums">
                        {delta > 0 ? `+${delta}` : delta} Botol
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-1 text-xs">
                      <span>Nilai Rupiah Selisih:</span>
                      <span className="font-extrabold font-mono tabular-nums">
                        {delta === 0 ? 'Rp 0' : `${delta > 0 ? '+' : '-'}${formatRupiah(deltaRupiah)}`}
                      </span>
                    </div>

                    {delta === 0 ? (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span>Stok fisik sama dengan stok sistem (Selisih 0 tidak dapat disimpan).</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1.5">
                        {delta > 0 
                          ? `*Stok fisik berlebih +${delta} botol. Akan dicatat penambahan ke LOG_BARANG_MASUK.` 
                          : `*Stok fisik kurang ${delta} botol. Akan dicatat penyesuaian minus ke LOG_BARANG_MASUK.`}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Alasan Koreksi (Wajib Dipilih):
                </label>
                <select
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {CORRECTION_REASONS.map((r) => (
                    <option key={r.value} value={r.value} className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Catatan Tambahan (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="Contoh: Ditemukan 2 botol pecah di kardus belakang rak"
                  className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7]"
                />
              </div>

              {correctionFeedback && (
                <div className={`p-3 rounded-xl text-xs font-medium ${
                  correctionFeedback.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/35' 
                    : correctionFeedback.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35'
                    : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35'
                }`}>
                  {correctionFeedback.message}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCorrectingProduct(null);
                  setCorrectionFeedback(null);
                }}
                className="flex-1 py-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-[#343440] font-semibold text-xs min-h-[44px] active:scale-[0.97] cursor-pointer transition-colors"
              >
                Batal
              </button>

              {(() => {
                const physical = typeof physicalStockInput === 'number' ? physicalStockInput : 0;
                const isZeroDelta = physical === correctingProduct.stock;

                return (
                  <button
                    type="button"
                    disabled={isSubmittingCorrection || isZeroDelta}
                    onClick={handleConfirmCorrection}
                    className="flex-1 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] dark:shadow-[0_0_16px_rgba(168,85,247,0.3)] text-white font-bold text-xs min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmittingCorrection ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan ke Sheets...</span>
                      </>
                    ) : (
                      'Simpan Koreksi'
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TAMBAH PRODUK BARU (DATABASE_PRODUK B:L)                         */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div className="fixed inset-0" onClick={() => setIsAddModalOpen(false)} aria-hidden="true" />
          <form onSubmit={handleSaveNewProduct} className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
            <div className="px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base text-[#0F172A] dark:text-[#F4F4F6] truncate">
                    Tambah Master Produk Baru
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Menulis hanya Kolom B:L di spreadsheet (Formula M:Q terlindungi)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  aria-label="Tutup modal tambah produk"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full bg-slate-100 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] active:scale-[0.97] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5 text-xs">
              {/* SKU & Auto Generate Button */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    SKU / ID Produk (Unik):
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSku}
                    className="text-[11px] font-bold text-[#2563EB] dark:text-[#C084FC] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto SKU</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                  placeholder="ORTU-BEV-001"
                  className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-mono font-bold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                />
              </div>

              {/* Nama Produk & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Nama Produk:
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Soju Chum Churum Original"
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Kategori Menu:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    {presentCategories.length > 0 ? (
                      presentCategories.map((c) => (
                        <option key={c} value={c} className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">
                          {c}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="ANGGUR" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">ANGGUR</option>
                        <option value="BIR" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">BIR</option>
                        <option value="SOJU" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">SOJU</option>
                        <option value="VODKA" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">VODKA</option>
                        <option value="WHISKY" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">WHISKY</option>
                        <option value="RUM" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">RUM</option>
                        <option value="JAMU" className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">JAMU</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Botol/Krat & Harga/Krat (Auto Compute HPP) */}
              <div className="bg-slate-50 dark:bg-[#24242B] p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440] space-y-2.5">
                <span className="text-[11px] font-bold text-[#0F172A] dark:text-[#F4F4F6] uppercase tracking-wider block">
                  Perhitungan Harga Beli / HPP:
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase mb-1">
                      Botol per Krat:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newBotolPerKrat}
                      onChange={(e) => {
                        const btk = Math.max(1, parseInt(e.target.value) || 1);
                        setNewBotolPerKrat(btk);
                        if (newHargaPerKrat > 0) {
                          setNewCost(Math.round(newHargaPerKrat / btk));
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[42px] tabular-nums font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase mb-1">
                      Harga / Krat (Rp):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={newHargaPerKrat}
                      onChange={(e) => {
                        const hpk = Number(e.target.value) || 0;
                        setNewHargaPerKrat(hpk);
                        if (newBotolPerKrat > 0) {
                          setNewCost(Math.round(hpk / newBotolPerKrat));
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[42px] tabular-nums font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase mb-1">
                    Harga Beli HPP Satuan (Harga/Krat ÷ Botol):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newCost}
                    onChange={(e) => setNewCost(Number(e.target.value) || 0)}
                    className="w-full p-2.5 bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[42px] tabular-nums font-mono"
                  />
                </div>
              </div>

              {/* Harga Jual Biasa, Harga Merah, & Margin Calculation */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Harga Jual Biasa:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
                    placeholder="Rp"
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
                    Harga Merah (Reseller):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newRedPrice === 0 ? '' : newRedPrice}
                    onChange={(e) => setNewRedPrice(Number(e.target.value) || 0)}
                    placeholder="Make up reseller"
                    className="w-full p-2.5 bg-red-50/40 dark:bg-red-500/10 border border-red-200 dark:border-red-500/35 rounded-xl text-sm font-mono font-bold text-red-700 dark:text-red-400 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-500 min-h-[44px] tabular-nums"
                  />
                </div>
              </div>

              {/* Margin Preview & Warning Alert (< 20%) */}
              {(() => {
                const { nominal, percent } = calculateMargin(newPrice, newCost);
                const isLowMargin = percent < 20 && newPrice > 0;

                return (
                  <div className={`p-3 rounded-2xl border ${isLowMargin ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/35' : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35'}`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6]">Margin Keuntungan:</span>
                      <span className={`font-extrabold font-mono text-sm tabular-nums ${isLowMargin ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        +{formatRupiah(nominal)} ({percent.toFixed(1)}%)
                      </span>
                    </div>

                    {isLowMargin && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span>Peringatan: Margin keuntungan di bawah 20%! Pertimbangkan menaikkan harga jual.</span>
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Stok Awal & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Stok Awal (Kolom K):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newInitialStock}
                    onChange={(e) => setNewInitialStock(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                    *Hanya ditulis ke Kolom K (tidak dicatat ke LOG_BARANG_MASUK).
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Catatan / Supplier:
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Gudang Kediri, supplier..."
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                  />
                </div>
              </div>

              {addFeedback && (
                <div className="p-3 bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35 rounded-xl text-xs font-semibold">
                  {addFeedback}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-[#343440] font-semibold text-xs min-h-[44px] active:scale-[0.97] cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingAdd}
                className="flex-1 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] dark:shadow-[0_0_16px_rgba(168,85,247,0.3)] text-white font-bold text-xs min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer disabled:opacity-60 transition-colors"
              >
                {isSubmittingAdd ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan ke Sheets...</span>
                  </>
                ) : (
                  'Simpan Produk Baru'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT PRODUK (SKU READONLY, HANYA B:L)                           */}
      {/* ========================================================================= */}
      {editingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div className="fixed inset-0" onClick={() => setEditingProduct(null)} aria-hidden="true" />
          <form onSubmit={handleSaveEditProduct} className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
            <div className="px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base text-[#0F172A] dark:text-[#F4F4F6] truncate">
                    Edit Info &amp; Harga Produk
                  </h3>
                  <span className="font-mono text-[11px] font-bold text-[#2563EB] dark:text-[#C084FC] block truncate">
                    SKU: {editingProduct.sku} (Readonly)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  aria-label="Tutup modal edit produk"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full bg-slate-100 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] active:scale-[0.97] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5 text-xs">
              <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440] flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-300 font-medium">Stok Formula Saat Ini:</span>
                <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{editingProduct.stock} Botol</span>
              </div>

              {/* Nama & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Nama Produk:
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Kategori:
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs font-semibold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    {presentCategories.map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-[#1B1B20] text-[#0F172A] dark:text-[#F4F4F6]">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Harga Jual Biasa & Merah */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Harga Jual Biasa:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
                    Harga Merah (Reseller):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editRedPrice === 0 ? '' : editRedPrice}
                    onChange={(e) => setEditRedPrice(Number(e.target.value) || 0)}
                    className="w-full p-2.5 bg-red-50/40 dark:bg-red-500/10 border border-red-200 dark:border-red-500/35 rounded-xl text-sm font-mono font-bold text-red-700 dark:text-red-400 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-500 min-h-[44px] tabular-nums"
                  />
                </div>
              </div>

              {/* Harga HPP */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Harga Beli HPP Satuan:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editCost}
                    onChange={(e) => setEditCost(Number(e.target.value) || 0)}
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px] tabular-nums font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Catatan:
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Catatan..."
                    className="w-full p-2.5 bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] min-h-[44px]"
                  />
                </div>
              </div>

              {/* Margin preview */}
              {(() => {
                const { nominal, percent } = calculateMargin(editPrice, editCost);
                const isLowMargin = percent < 20 && editPrice > 0;

                return (
                  <div className={`p-3 rounded-2xl border ${isLowMargin ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/35' : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35'}`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6]">Margin Keuntungan Baru:</span>
                      <span className={`font-extrabold font-mono text-sm tabular-nums ${isLowMargin ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        +{formatRupiah(nominal)} ({percent.toFixed(1)}%)
                      </span>
                    </div>
                    {isLowMargin && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-semibold">
                        Peringatan: Margin di bawah 20%.
                      </p>
                    )}
                  </div>
                );
              })()}

              {editFeedback && (
                <div className="p-3 bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/35 rounded-xl text-xs font-semibold">
                  {editFeedback}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] pb-safe flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="flex-1 py-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-[#343440] font-semibold text-xs min-h-[44px] active:scale-[0.97] cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="flex-1 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] dark:shadow-[0_0_16px_rgba(168,85,247,0.3)] text-white font-bold text-xs min-h-[44px] flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer disabled:opacity-60 transition-colors"
              >
                {isSubmittingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan ke Sheets...</span>
                  </>
                ) : (
                  'Perbarui Info'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
