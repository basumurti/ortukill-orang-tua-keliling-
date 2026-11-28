import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Card, Chip, Input, Modal, TextArea } from '@heroui/react';
import { 
  Package, 
  ArrowUpCircle, 
  Search, 
  Plus, 
  Edit3, 
  Download, 
  RefreshCw, 
  Layers, 
  History,
  SlidersHorizontal,
  ClipboardList,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Product, BarangMasukRecord, StockAuditRecord } from '../types';
import { formatRupiah, StorageService } from '../services/storageService';
import { GasApiService } from '../services/gasApiService';
import { useOverlayHistory } from '../utils/useOverlayHistory';
import { AnimatedTabPill } from './ui/motion/MotionPrimitives';
import { SmartCountUp, FadeContent } from './ui/animated/ReactBitsPrimitives';

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
    <Card className="[content-visibility:auto] [contain-intrinsic-size:auto_220px] bg-[var(--surface)] rounded-2xl p-4 gap-3 border border-[var(--border)] shadow-none">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-extrabold text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--accent)]/25 px-2 py-0.5 rounded-md truncate">
          {p.sku}
        </span>
        <Chip
          size="sm"
          variant="soft"
          color={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}
          className="font-extrabold tabular-nums font-mono border border-[var(--border)]"
        >
          <Chip.Label className={isOutOfStock ? '' : isLowStock ? 'text-amber-700 dark:text-[var(--warning)]' : 'text-emerald-700 dark:text-[var(--success)]'}>
            {isOutOfStock ? 'HABIS (0)' : isLowStock ? `MENIPIS (${p.stock})` : `STOK: ${p.stock}`}
          </Chip.Label>
        </Chip>
      </div>

      <div>
        <h4 className="text-sm font-extrabold text-[var(--foreground)] leading-snug">
          {p.name}
        </h4>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[11px] text-[var(--foreground)] font-semibold bg-[var(--surface-secondary)] border border-[var(--border)] px-2 py-0.5 rounded-md">
            {p.category}
          </span>
          <span className="text-[11px] text-[var(--muted)]">
            Margin:{' '}
            <strong className={marginPercent < 20 ? 'text-amber-700 dark:text-[var(--warning)]' : 'text-emerald-700 dark:text-[var(--success)]'}>
              {marginPercent.toFixed(1)}%
            </strong>
          </span>
        </div>
      </div>

      <div className="pt-2.5 border-t border-[var(--border)] grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[10px] text-[var(--muted)] uppercase font-bold tracking-wider">Harga Jual:</span>
          <p className="font-extrabold text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(p.price)}</p>
          {p.redPrice && p.redPrice !== p.price ? (
            <p className="text-[10px] text-amber-700 dark:text-[var(--warning)] font-bold tabular-nums font-mono">
              Reseller: {formatRupiah(p.redPrice)}
            </p>
          ) : null}
        </div>

        <div>
          <span className="text-[10px] text-[var(--muted)] uppercase font-bold tracking-wider">HPP &amp; Nilai Aset:</span>
          <p className="text-[var(--muted)] font-medium tabular-nums font-mono">HPP: {formatRupiah(p.cost)}</p>
          <p className="text-[10px] text-amber-700 dark:text-[var(--warning)] font-bold tabular-nums font-mono">
            Aset: {formatRupiah(p.totalAsset || p.cost * p.stock)}
          </p>
        </div>
      </div>

      {/* 3 Action Buttons for Mobile */}
      <div className="pt-2.5 border-t border-[var(--border)] grid grid-cols-3 gap-1.5">
        <Button
          variant="outline"
          onPress={() => onRestock(p)}
          className="px-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 text-xs font-bold min-h-[44px]"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          <span>Restock</span>
        </Button>

        <Button
          variant="outline"
          onPress={() => onOpname(p)}
          aria-label="Koreksi Stok / Opname"
          className="px-2 rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] text-xs font-bold min-h-[44px]"
        >
          <Scale className="w-3.5 h-3.5 text-amber-700 dark:text-[var(--warning)]" />
          <span>Opname</span>
        </Button>

        <Button
          variant="outline"
          onPress={() => onEdit(p)}
          className="px-2 rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] text-xs font-bold min-h-[44px]"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Info</span>
        </Button>
      </div>
    </Card>
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
    <tr className="hover:bg-[var(--surface-secondary)]/80 transition-colors">
      <td className="py-3 px-4 font-mono font-bold text-[var(--accent)] whitespace-nowrap">
        {p.sku}
      </td>
      <td className="py-3 px-4">
        <span className="font-bold text-[var(--foreground)] block">{p.name}</span>
        {p.notes ? (
          <span className="text-[10px] text-[var(--muted)] italic block">{p.notes}</span>
        ) : null}
      </td>
      <td className="py-3 px-4">
        <span className="bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border)] px-2 py-0.5 rounded-md font-semibold text-[11px] whitespace-nowrap">
          {p.category}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <Chip
          size="sm"
          variant="soft"
          color={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}
          className="font-extrabold tabular-nums font-mono border border-[var(--border)]"
        >
          <Chip.Label className={isOutOfStock ? '' : isLowStock ? 'text-amber-700 dark:text-[var(--warning)]' : 'text-emerald-700 dark:text-[var(--success)]'}>
            {p.stock} btl
          </Chip.Label>
        </Chip>
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <span className="font-extrabold text-[var(--foreground)] block tabular-nums font-mono">{formatRupiah(p.price)}</span>
        {p.redPrice && p.redPrice !== p.price ? (
          <span className="text-[10px] text-amber-700 dark:text-[var(--warning)] font-bold block tabular-nums font-mono">
            Reseller: {formatRupiah(p.redPrice)}
          </span>
        ) : null}
      </td>
      <td className="py-3 px-4 text-right text-[var(--muted)] font-medium tabular-nums font-mono whitespace-nowrap">
        {formatRupiah(p.cost)}
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <span className={`font-bold block tabular-nums font-mono ${marginPercent < 20 ? 'text-amber-700 dark:text-[var(--warning)]' : 'text-emerald-700 dark:text-[var(--success)]'}`}>
          {marginPercent.toFixed(1)}%
        </span>
        <span className="text-[10px] text-[var(--muted)] block tabular-nums font-mono">+{formatRupiah(margin)}</span>
      </td>
      <td className="py-3 px-4 text-right font-extrabold text-amber-700 dark:text-[var(--warning)] tabular-nums font-mono whitespace-nowrap">
        {formatRupiah(asset)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onPress={() => onRestock(p)}
            aria-label="Catat Restock Barang Masuk"
            className="px-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 font-bold text-xs min-h-[38px]"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>Restock</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onPress={() => onOpname(p)}
            aria-label="Koreksi Stok / Stock Opname"
            className="px-2.5 rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] font-bold text-xs min-h-[38px]"
          >
            <Scale className="w-3.5 h-3.5 text-amber-700 dark:text-[var(--warning)]" />
            <span>Opname</span>
          </Button>

          <Button
            variant="outline"
            isIconOnly
            size="sm"
            onPress={() => onEdit(p)}
            aria-label="Edit Info & Harga (Tanpa merusak stok)"
            className="rounded-xl bg-[var(--surface-secondary)] text-[var(--muted)] hover:text-[var(--foreground)] border-[var(--border)] min-h-[38px] min-w-[38px]"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
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
    <div className="space-y-4 max-w-7xl mx-auto pb-24 text-[var(--foreground)]">
      {/* Top Header Card & Sync Status */}
      <Card className="bg-[var(--surface)] rounded-2xl p-4 sm:p-5 gap-3.5 border border-[var(--border)] shadow-none flex flex-col lg:flex-row lg:items-center justify-between">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[var(--foreground)]">
                Manajemen Stok &amp; Inventori
              </h2>
              <Chip size="sm" variant="soft" color="accent" className="font-bold border border-[var(--accent)]/25">
                <Chip.Label>{products.length} SKU</Chip.Label>
              </Chip>
              <Chip size="sm" variant="soft" color="success" className="font-semibold border border-[var(--success)]/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-[var(--success)]" />
                <Chip.Label className="text-emerald-700 dark:text-[var(--success)]">Formula M:Q Aman</Chip.Label>
              </Chip>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-1 flex-wrap">
              <span className="font-medium text-[var(--foreground)]">Google Sheets ORTUKILL KEDIRI</span>
              <span className="text-[var(--muted)]">•</span>
              <span className="flex items-center gap-1 text-[11px] text-[var(--muted)] font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Sinkron: {lastSyncTime ? lastSyncTime : 'Baru saja'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full lg:w-auto">
          {onSyncSpreadsheet && (
            <Button
              variant="outline"
              onPress={onSyncSpreadsheet}
              isDisabled={isSyncing}
              className="rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] text-xs font-bold min-h-[44px] px-3.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent)] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkron...' : 'Segarkan Sheets'}</span>
            </Button>
          )}

          <Button
            variant="primary"
            onPress={handleOpenAddModal}
            className="rounded-xl text-xs font-bold min-h-[44px] px-4"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Produk</span>
          </Button>
        </div>
      </Card>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-1 border border-[var(--border)] shadow-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block">
            Total Stok Fisik
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tabular-nums font-mono">
            <SmartCountUp value={inventoryMetrics.totalBottles} formatter={(v) => `${Math.round(v)} Botol`} />
          </h3>
          <p className="text-[11px] text-[var(--muted)]">
            Formula: Stok Awal + Masuk − Keluar
          </p>
        </Card>

        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-1 border border-[var(--border)] shadow-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block">
            Nilai Aset Modal
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-amber-700 dark:text-[var(--warning)] tabular-nums font-mono">
            <SmartCountUp value={inventoryMetrics.totalAssetCost} formatter={formatRupiah} />
          </h3>
          <p className="text-[11px] text-[var(--muted)]">
            Total biaya HPP tertanam
          </p>
        </Card>

        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-1 border border-[var(--border)] shadow-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block">
            Potensi Omset
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tabular-nums font-mono">
            <SmartCountUp value={inventoryMetrics.totalPotentialRevenue} formatter={formatRupiah} />
          </h3>
          <p className="text-[11px] text-[var(--muted)]">
            Bila seluruh stok terjual
          </p>
        </Card>

        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-1 border border-[var(--border)] shadow-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block">
            Potensi Keuntungan
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono">
            <SmartCountUp value={inventoryMetrics.potentialProfit} formatter={(v) => `+${formatRupiah(v)}`} />
          </h3>
          <p className="text-[11px] text-[var(--muted)]">
            Estimasi margin kotor
          </p>
        </Card>
      </div>

      {/* Main Tab Switcher (Katalog, Riwayat Masuk, Audit Log) */}
      <Card className="bg-[var(--surface)] rounded-2xl p-1.5 gap-1 border border-[var(--border)] shadow-none flex flex-row items-center overflow-x-auto no-scrollbar">
        {([
          { id: 'PRODUCTS', icon: Layers, label: `Katalog & Stok (${filteredProducts.length})` },
          { id: 'BARANG_MASUK', icon: History, label: `Riwayat Masuk (${barangMasukList.length})` },
          { id: 'AUDIT_LOG', icon: ClipboardList, label: `Audit Log (${auditLogs.length})` },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              onPress={() => setActiveTab(tab.id)}
              className={`relative flex-1 min-w-fit whitespace-nowrap rounded-xl text-xs font-bold min-h-[44px] px-3.5 ${
                isSelected ? 'text-[var(--accent-foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {isSelected && (
                <AnimatedTabPill
                  layoutId="stock-main-tabs-pill"
                  className="absolute inset-0 rounded-xl bg-[var(--accent)] pointer-events-none"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </span>
            </Button>
          );
        })}
      </Card>

      {/* ========================================================================= */}
      {/* TAB 1: KATALOG & STOK                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'PRODUCTS' && (
        <>
          {/* Search, Filter & Stock Status Controls */}
          <Card className="bg-[var(--surface)] rounded-2xl p-3.5 sm:p-4 gap-3 border border-[var(--border)] shadow-none">
            {/* Search + Sort + CSV */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none z-10" />
                <Input
                  type="text"
                  fullWidth
                  variant="secondary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari SKU atau nama produk..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] min-h-[44px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOptionType)}
                    aria-label="Urutkan produk"
                    className="w-full sm:w-auto px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] min-h-[44px] cursor-pointer"
                  >
                    <option value="NAME_ASC">Urut: Nama (A-Z)</option>
                    <option value="STOCK_ASC">Urut: Stok Terendah</option>
                    <option value="STOCK_DESC">Urut: Stok Tertinggi</option>
                    <option value="PRICE_DESC">Urut: Harga Termahal</option>
                    <option value="ASSET_DESC">Urut: Nilai Aset Terbesar</option>
                  </select>
                </div>

                <Button
                  variant="outline"
                  onPress={handleExportProductsCSV}
                  aria-label="Ekspor CSV"
                  className="px-3.5 bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] rounded-xl text-xs font-bold min-h-[44px]"
                >
                  <Download className="w-4 h-4 text-[var(--accent)]" />
                  <span>CSV</span>
                </Button>
              </div>
            </div>

            {/* Stock Warning Status Filter Chips (0 Habis, 1-4 Menipis, >=5 Normal) */}
            <div className="pt-2.5 border-t border-[var(--border)] flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider pr-1 flex items-center gap-1 whitespace-nowrap">
                <SlidersHorizontal className="w-3 h-3" />
                Status:
              </span>

              <Button
                size="sm"
                variant={stockStatusFilter === 'ALL' ? 'primary' : 'outline'}
                onPress={() => setStockStatusFilter('ALL')}
                className={`rounded-xl text-xs font-bold whitespace-nowrap min-h-[38px] px-3 ${
                  stockStatusFilter === 'ALL' ? '' : 'bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)]'
                }`}
              >
                <span>Semua</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stockStatusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]'}`}>
                  {stockCounts.all}
                </span>
              </Button>

              <Button
                size="sm"
                variant={stockStatusFilter === 'OUT_OF_STOCK' ? 'danger' : 'outline'}
                onPress={() => setStockStatusFilter('OUT_OF_STOCK')}
                className={`rounded-xl text-xs font-bold whitespace-nowrap min-h-[38px] px-3 ${
                  stockStatusFilter === 'OUT_OF_STOCK' ? '' : 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/35'
                }`}
              >
                <span>Habis (0)</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stockStatusFilter === 'OUT_OF_STOCK' ? 'bg-white/20 text-white' : 'bg-[var(--surface)]/70 text-[var(--danger)]'}`}>
                  {stockCounts.outOfStock}
                </span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={() => setStockStatusFilter('LOW_STOCK')}
                className={`rounded-xl text-xs font-bold whitespace-nowrap min-h-[38px] px-3 ${
                  stockStatusFilter === 'LOW_STOCK'
                    ? 'bg-[var(--warning)] text-[var(--warning-foreground)] border-[var(--warning)]'
                    : 'bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border-[var(--warning)]/35'
                }`}
              >
                <span>Menipis (1–4)</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stockStatusFilter === 'LOW_STOCK' ? 'bg-black/15 text-[var(--warning-foreground)]' : 'bg-[var(--surface)]/70 text-amber-700 dark:text-[var(--warning)]'}`}>
                  {stockCounts.lowStock}
                </span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onPress={() => setStockStatusFilter('NORMAL')}
                className={`rounded-xl text-xs font-bold whitespace-nowrap min-h-[38px] px-3 ${
                  stockStatusFilter === 'NORMAL'
                    ? 'bg-[var(--success)] text-[var(--success-foreground)] border-[var(--success)]'
                    : 'bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border-[var(--success)]/35'
                }`}
              >
                <span>Normal (≥5)</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stockStatusFilter === 'NORMAL' ? 'bg-black/15 text-[var(--success-foreground)]' : 'bg-[var(--surface)]/70 text-emerald-700 dark:text-[var(--success)]'}`}>
                  {stockCounts.normal}
                </span>
              </Button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? 'primary' : 'outline'}
                  onPress={() => setSelectedCategory(cat)}
                  className={`px-3.5 rounded-full text-xs font-semibold whitespace-nowrap min-h-[36px] ${
                    selectedCategory === cat
                      ? ''
                      : 'bg-[var(--surface-secondary)] text-[var(--muted)] hover:text-[var(--foreground)] border-[var(--border)]'
                  }`}
                >
                  {cat === 'ALL' ? 'Semua Kategori' : cat}
                </Button>
              ))}
            </div>
          </Card>

          {/* MOBILE VIEW (<640px): Product Card List */}
          <div className="space-y-3 sm:hidden">
            {filteredProducts.length === 0 ? (
              <FadeContent>
                <Card className="bg-[var(--surface)] rounded-2xl p-8 text-center border border-[var(--border)] shadow-none items-center gap-1">
                  <Package className="w-8 h-8 text-[var(--muted)] mx-auto mb-1 opacity-60" />
                  <p className="text-sm font-bold text-[var(--foreground)]">Tidak ada produk yang cocok</p>
                  <p className="text-xs text-[var(--muted)]">Coba sesuaikan kata kunci pencarian atau filter status stok.</p>
                </Card>
              </FadeContent>
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
          <Card className="hidden sm:block bg-[var(--surface)] rounded-2xl p-0 gap-0 border border-[var(--border)] shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-secondary)] text-[var(--muted)] uppercase text-[10px] tracking-wider border-b border-[var(--border)] font-bold">
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
                <tbody className="divide-y divide-[var(--separator)]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[var(--muted)]">
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
          </Card>

          {filteredProducts.length > visibleProducts.length && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
              <span className="text-xs text-[var(--muted)] font-medium tabular-nums">
                Menampilkan {visibleProducts.length} dari {filteredProducts.length} produk
              </span>
              <Button
                variant="outline"
                onPress={() => setProductsVisibleCount((prev) => prev + 50)}
                className="w-full sm:w-auto px-4 rounded-xl bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] text-xs font-bold min-h-[44px]"
              >
                Muat Lagi (+50)
              </Button>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RIWAYAT BARANG MASUK & KOREKSI STOK (LOG_BARANG_MASUK)             */}
      {/* ========================================================================= */}
      {activeTab === 'BARANG_MASUK' && (
        <Card className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-none overflow-hidden p-4 sm:p-5 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[var(--foreground)] flex items-center gap-2 flex-wrap">
                <span>Riwayat Barang Masuk &amp; Koreksi</span>
                <Chip size="sm" variant="soft" color="default" className="font-bold border border-[var(--border)]">
                  <Chip.Label>{barangMasukList.length} Catatan</Chip.Label>
                </Chip>
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Membaca langsung tab spreadsheet <strong className="text-[var(--foreground)]">LOG_BARANG_MASUK</strong> (Kolom B:H).
              </p>
            </div>

            <Button
              variant="outline"
              onPress={handleExportBarangMasukCSV}
              className="px-3.5 bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] rounded-xl text-xs font-bold min-h-[44px]"
            >
              <Download className="w-4 h-4 text-[var(--accent)]" />
              <span>Ekspor Riwayat CSV</span>
            </Button>
          </div>

          {/* Mobile cards for Barang Masuk */}
          <div className="space-y-2.5 sm:hidden">
            {barangMasukList.length === 0 ? (
              <div className="py-8 text-center text-[var(--muted)] text-xs">
                Belum ada catatan barang masuk di LOG_BARANG_MASUK.
              </div>
            ) : (
              visibleBarangMasuk.map((bm, idx) => {
                const isCorrection = (bm.supplier || bm.supplierOrNotes || '').includes('KOREKSI');
                const isNegative = bm.qty < 0;

                return (
                  <div key={bm.id || idx} className="bg-[var(--surface-secondary)] rounded-xl p-3.5 border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[var(--muted)]">{bm.date}</span>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={isNegative ? 'danger' : isCorrection ? 'warning' : 'success'}
                        className="font-extrabold tabular-nums font-mono border border-[var(--border)]"
                      >
                        <Chip.Label className={isNegative ? '' : isCorrection ? 'text-amber-700 dark:text-[var(--warning)]' : 'text-emerald-700 dark:text-[var(--success)]'}>
                          {bm.qty >= 0 ? `+${bm.qty}` : bm.qty} btl
                        </Chip.Label>
                      </Chip>
                    </div>
                    <div>
                      <span className="font-mono text-[11px] font-bold text-[var(--accent)] block">{bm.sku}</span>
                      <span className="font-bold text-sm text-[var(--foreground)] block">{bm.name}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-xs">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        isCorrection
                          ? 'bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border-[var(--warning)]/35'
                          : 'bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)]'
                      }`}>
                        {bm.supplier || bm.supplierOrNotes || 'orang tua'}
                      </span>
                      <span className="font-extrabold font-mono text-[var(--foreground)] tabular-nums">
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
              <thead className="bg-[var(--surface-secondary)] text-[var(--muted)] uppercase text-[10px] tracking-wider border-b border-[var(--border)] font-bold">
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
              <tbody className="divide-y divide-[var(--separator)]">
                {barangMasukList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--muted)]">
                      Belum ada catatan barang masuk di LOG_BARANG_MASUK.
                    </td>
                  </tr>
                ) : (
                  visibleBarangMasuk.map((bm, idx) => {
                    const isCorrection = (bm.supplier || bm.supplierOrNotes || '').includes('KOREKSI');
                    const isNegative = bm.qty < 0;

                    return (
                      <tr key={bm.id || idx} className="hover:bg-[var(--surface-secondary)]/80 transition-colors">
                        <td className="py-3 px-4 text-[var(--muted)] font-medium whitespace-nowrap">
                          {bm.date}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[var(--accent)] block">{bm.sku}</span>
                          <span className="font-semibold text-[var(--foreground)] block">{bm.name}</span>
                        </td>
                        <td className="py-3 px-4 text-center text-[var(--muted)] font-medium">
                          {bm.krat ? `${bm.krat} krat` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Chip
                            size="sm"
                            variant="soft"
                            color={isNegative ? 'danger' : isCorrection ? 'warning' : 'success'}
                            className="font-extrabold tabular-nums font-mono border border-[var(--border)]"
                          >
                            <Chip.Label className={isNegative ? '' : isCorrection ? 'text-amber-700 dark:text-[var(--warning)]' : 'text-emerald-700 dark:text-[var(--success)]'}>
                              {bm.qty >= 0 ? `+${bm.qty}` : bm.qty} btl
                            </Chip.Label>
                          </Chip>
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--muted)] font-medium tabular-nums font-mono">
                          {formatRupiah(bm.cost)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold font-mono text-[var(--foreground)] tabular-nums">
                          {formatRupiah(bm.totalCost || bm.qty * bm.cost)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            isCorrection
                              ? 'bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border-[var(--warning)]/35'
                              : 'bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)]'
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
              <span className="text-xs text-[var(--muted)] font-medium tabular-nums">
                Menampilkan {visibleBarangMasuk.length} dari {barangMasukList.length} catatan
              </span>
              <Button
                variant="outline"
                onPress={() => setBarangMasukVisibleCount((prev) => prev + 50)}
                className="w-full sm:w-auto px-4 rounded-xl bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)] text-xs font-bold min-h-[44px]"
              >
                Muat Lagi (+50)
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIT LOG (PERUBAHAN PRODUK & STOK)                                */}
      {/* ========================================================================= */}
      {activeTab === 'AUDIT_LOG' && (
        <Card className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-none overflow-hidden p-4 sm:p-5 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[var(--foreground)] flex items-center gap-2 flex-wrap">
                <ClipboardList className="w-5 h-5 text-[var(--accent)]" />
                <span>Riwayat Audit Perubahan Produk &amp; Stok</span>
                <Chip size="sm" variant="soft" color="default" className="font-bold border border-[var(--border)]">
                  <Chip.Label>{auditLogs.length} Entri</Chip.Label>
                </Chip>
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Mencatat mutasi produk, restock, opname, dan pengubahan info secara transparan tanpa mengubah struktur sheet.
              </p>
            </div>
          </div>

          <div className="divide-y divide-[var(--separator)]">
            {auditLogs.length === 0 ? (
              <div className="py-12 text-center text-[var(--muted)]">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-bold text-[var(--foreground)]">Belum ada aktivitas audit yang terekam</p>
                <p className="text-xs text-[var(--muted)] mt-1">Setiap mutasi stok, koreksi opname, atau perubahan produk akan tercatat di sini.</p>
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
                        <Chip
                          size="sm"
                          variant="soft"
                          color={isRestock ? 'success' : isOpname ? 'accent' : isAdd ? 'warning' : 'default'}
                          className="font-extrabold border border-[var(--border)]"
                        >
                          <Chip.Label className={isRestock ? 'text-emerald-700 dark:text-[var(--success)]' : isAdd ? 'text-amber-700 dark:text-[var(--warning)]' : ''}>
                            {log.action}
                          </Chip.Label>
                        </Chip>

                        <span className="font-mono text-xs font-bold text-[var(--accent)]">
                          {log.sku}
                        </span>

                        <span className="text-xs font-extrabold text-[var(--foreground)]">
                          {log.productName}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--muted)] font-medium">
                        {log.details}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 sm:text-right text-xs text-[var(--muted)]">
                      <span className="bg-[var(--surface-secondary)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px] font-semibold text-[var(--foreground)]">
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
              <span className="text-xs text-[var(--muted)] font-medium tabular-nums">
                Menampilkan {visibleAuditLogs.length} dari {auditLogs.length} entri
              </span>
              <Button
                variant="outline"
                onPress={() => setAuditVisibleCount((prev) => prev + 50)}
                className="w-full sm:w-auto px-4 rounded-xl bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)] text-xs font-bold min-h-[44px]"
              >
                Muat Lagi (+50)
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RESTOCK PRODUK                                                   */}
      {/* ========================================================================= */}
      <Modal.Backdrop
        isOpen={Boolean(restockProduct)}
        onOpenChange={(open) => {
          if (!open) {
            setRestockProduct(null);
            setRestockFeedback(null);
          }
        }}
        variant="opaque"
      >
          <Modal.Container placement="auto" size="md" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="Restock Barang Masuk"
              className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full flex flex-col"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />
              <Modal.Header className="px-5 pt-2.5 sm:pt-4 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Modal.Icon className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 shrink-0">
                    <ArrowUpCircle className="w-4 h-4" />
                  </Modal.Icon>
                  <div className="min-w-0">
                    <Modal.Heading className="font-extrabold text-sm sm:text-base text-[var(--foreground)] truncate">
                      Restock Barang Masuk
                    </Modal.Heading>
                    {restockProduct && (
                      <span className="font-mono text-[11px] font-bold text-[var(--accent)] block truncate">
                        {restockProduct.sku}
                      </span>
                    )}
                  </div>
                </div>

                <Modal.CloseTrigger
                  aria-label="Tutup modal restock"
                  className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                />
              </Modal.Header>

              {restockProduct && (
                <>
                  <Modal.Body className="!mt-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5 text-xs">
                    <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)]">
                      <p className="font-extrabold text-[var(--foreground)] text-sm">{restockProduct.name}</p>
                      <div className="flex justify-between items-center mt-1 text-[var(--muted)]">
                        <span>Stok Sistem Saat Ini:</span>
                        <span className="font-extrabold text-[var(--foreground)] tabular-nums font-mono">{restockProduct.stock} Botol</span>
                      </div>
                    </div>

                    {/* Mode Restock: Krat vs Satuan Botol */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                        Metode Input Kuantitas:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={restockMode === 'KRAT' ? 'primary' : 'outline'}
                          onPress={() => setRestockMode('KRAT')}
                          className={`rounded-xl text-xs font-bold min-h-[44px] ${
                            restockMode === 'KRAT' ? '' : 'bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)]'
                          }`}
                        >
                          Per Krat ({restockBottlesPerKrat} btl/krat)
                        </Button>

                        <Button
                          variant={restockMode === 'BOTTLE' ? 'primary' : 'outline'}
                          onPress={() => setRestockMode('BOTTLE')}
                          className={`rounded-xl text-xs font-bold min-h-[44px] ${
                            restockMode === 'BOTTLE' ? '' : 'bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)]'
                          }`}
                        >
                          Kuantitas Botol Langsung
                        </Button>
                      </div>
                    </div>

                    {restockMode === 'KRAT' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                            Jumlah Krat:
                          </label>
                          <Input
                            type="number"
                            min={1}
                            fullWidth
                            variant="secondary"
                            value={String(restockKrat)}
                            onChange={(e) => setRestockKrat(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-extrabold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                            Botol / Krat:
                          </label>
                          <Input
                            type="number"
                            min={1}
                            fullWidth
                            variant="secondary"
                            value={String(restockBottlesPerKrat)}
                            onChange={(e) => setRestockBottlesPerKrat(Math.max(1, parseInt(e.target.value) || 12))}
                            className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-extrabold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                          Jumlah Botol Masuk:
                        </label>
                        <Input
                          type="number"
                          min={1}
                          fullWidth
                          variant="secondary"
                          value={String(restockDirectBottles)}
                          onChange={(e) => setRestockDirectBottles(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-extrabold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Harga Beli / HPP per Botol:
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        fullWidth
                        variant="secondary"
                        value={String(restockCost)}
                        onChange={(e) => setRestockCost(Number(e.target.value) || 0)}
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Supplier / Asal Pengiriman:
                      </label>
                      <Input
                        type="text"
                        fullWidth
                        variant="secondary"
                        value={restockSupplier}
                        onChange={(e) => setRestockSupplier(e.target.value)}
                        placeholder="Gudang Utama, Orang Tua, dll"
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] min-h-[44px]"
                      />
                    </div>

                    <div className="space-y-1.5 bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)]">
                      {(() => {
                        const effectiveQty = restockMode === 'KRAT' ? restockKrat * restockBottlesPerKrat : restockDirectBottles;
                        const totalCost = effectiveQty * restockCost;
                        const newStockPredicted = restockProduct.stock + effectiveQty;

                        return (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--muted)] font-medium">Total Botol Masuk:</span>
                              <span className="font-extrabold text-[var(--foreground)] tabular-nums font-mono">+{effectiveQty} botol</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--muted)] font-medium">Total Biaya Masuk:</span>
                              <span className="font-extrabold text-amber-700 dark:text-[var(--warning)] font-mono tabular-nums">{formatRupiah(totalCost)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[var(--border)]">
                              <span className="text-[var(--foreground)] font-bold">Stok Akhir Formula Nanti:</span>
                              <span className="font-extrabold text-[var(--accent)] text-sm tabular-nums font-mono">{newStockPredicted} botol</span>
                            </div>
                          </>
                        );
                      })()}
                      <p className="text-[10px] text-[var(--muted)] pt-1">
                        *Dicatat aman ke <strong className="text-[var(--foreground)]">LOG_BARANG_MASUK</strong> (Kolom B:H).
                      </p>
                    </div>

                    {restockFeedback && (
                      <div className={`p-3 rounded-xl text-xs font-medium border ${
                        restockFeedback.type === 'success' 
                          ? 'bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border-[var(--success)]/35' 
                          : restockFeedback.type === 'warning'
                          ? 'bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border-[var(--warning)]/35'
                          : 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/35'
                      }`}>
                        {restockFeedback.message}
                      </div>
                    )}
                  </Modal.Body>

                  <Modal.Footer className="!mt-0 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onPress={() => {
                        setRestockProduct(null);
                        setRestockFeedback(null);
                      }}
                      className="flex-1 rounded-xl bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] font-semibold text-xs min-h-[44px]"
                    >
                      Batal
                    </Button>
                    <Button
                      variant="primary"
                      isDisabled={isSubmittingRestock}
                      onPress={handleConfirmRestock}
                      className="flex-1 rounded-xl font-bold text-xs min-h-[44px]"
                    >
                      {isSubmittingRestock ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Mencatat ke Sheets...</span>
                        </>
                      ) : (
                        'Simpan Restock'
                      )}
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

      {/* ========================================================================= */}
      {/* MODAL 2: KOREKSI STOK / STOCK OPNAME                                      */}
      {/* ========================================================================= */}
      <Modal.Backdrop
        isOpen={Boolean(correctingProduct)}
        onOpenChange={(open) => {
          if (!open) {
            setCorrectingProduct(null);
            setCorrectionFeedback(null);
          }
        }}
        variant="opaque"
      >
          <Modal.Container placement="auto" size="md" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="Koreksi Stok (Stock Opname)"
              className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full flex flex-col"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />
              <Modal.Header className="px-5 pt-2.5 sm:pt-4 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Modal.Icon className="w-9 h-9 rounded-xl bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border border-[var(--warning)]/35 shrink-0">
                    <Scale className="w-4 h-4" />
                  </Modal.Icon>
                  <div className="min-w-0">
                    <Modal.Heading className="font-extrabold text-sm sm:text-base text-[var(--foreground)] truncate">
                      Koreksi Stok (Stock Opname)
                    </Modal.Heading>
                    {correctingProduct && (
                      <span className="font-mono text-[11px] font-bold text-[var(--accent)] block truncate">
                        {correctingProduct.sku}
                      </span>
                    )}
                  </div>
                </div>

                <Modal.CloseTrigger
                  aria-label="Tutup modal koreksi stok"
                  className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                />
              </Modal.Header>

              {correctingProduct && (
                <>
                  <Modal.Body className="!mt-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5 text-xs">
                    <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)]">
                      <p className="font-extrabold text-[var(--foreground)] text-sm">{correctingProduct.name}</p>
                      <div className="flex justify-between items-center mt-1 text-[var(--muted)]">
                        <span>Stok Sistem Saat Ini:</span>
                        <span className="font-extrabold text-[var(--foreground)] text-sm tabular-nums font-mono">{correctingProduct.stock} Botol</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Stok Fisik Aktual (Hasil Hitung Fisik):
                      </label>
                      <Input
                        type="number"
                        min={0}
                        fullWidth
                        variant="secondary"
                        value={physicalStockInput === '' ? '' : String(physicalStockInput)}
                        onChange={(e) => setPhysicalStockInput(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="Masukkan jumlah botol riil di rak/gudang"
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-extrabold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
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
                            ? 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted)]'
                            : delta > 0
                            ? 'bg-[var(--success-soft)] border-[var(--success)]/35 text-emerald-700 dark:text-[var(--success)]'
                            : 'bg-[var(--danger-soft)] border-[var(--danger)]/35 text-[var(--danger)]'
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
                            <p className="text-[11px] text-amber-700 dark:text-[var(--warning)] mt-1.5 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Stok fisik sama dengan stok sistem (Selisih 0 tidak dapat disimpan).</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-[var(--muted)] mt-1.5">
                              {delta > 0 
                                ? `*Stok fisik berlebih +${delta} botol. Akan dicatat penambahan ke LOG_BARANG_MASUK.` 
                                : `*Stok fisik kurang ${delta} botol. Akan dicatat penyesuaian minus ke LOG_BARANG_MASUK.`}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Alasan Koreksi (Wajib Dipilih):
                      </label>
                      <select
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] min-h-[44px] cursor-pointer"
                      >
                        {CORRECTION_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Catatan Tambahan (Opsional):
                      </label>
                      <TextArea
                        rows={2}
                        fullWidth
                        variant="secondary"
                        value={correctionNotes}
                        onChange={(e) => setCorrectionNotes(e.target.value)}
                        placeholder="Contoh: Ditemukan 2 botol pecah di kardus belakang rak"
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs text-[var(--foreground)]"
                      />
                    </div>

                    {correctionFeedback && (
                      <div className={`p-3 rounded-xl text-xs font-medium border ${
                        correctionFeedback.type === 'success' 
                          ? 'bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border-[var(--success)]/35' 
                          : correctionFeedback.type === 'warning'
                          ? 'bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border-[var(--warning)]/35'
                          : 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/35'
                      }`}>
                        {correctionFeedback.message}
                      </div>
                    )}
                  </Modal.Body>

                  <Modal.Footer className="!mt-0 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onPress={() => {
                        setCorrectingProduct(null);
                        setCorrectionFeedback(null);
                      }}
                      className="flex-1 rounded-xl bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] font-semibold text-xs min-h-[44px]"
                    >
                      Batal
                    </Button>

                    {(() => {
                      const physical = typeof physicalStockInput === 'number' ? physicalStockInput : 0;
                      const isZeroDelta = physical === correctingProduct.stock;

                      return (
                        <Button
                          variant="primary"
                          isDisabled={isSubmittingCorrection || isZeroDelta}
                          onPress={handleConfirmCorrection}
                          className="flex-1 rounded-xl font-bold text-xs min-h-[44px]"
                        >
                          {isSubmittingCorrection ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Menyimpan ke Sheets...</span>
                            </>
                          ) : (
                            'Simpan Koreksi'
                          )}
                        </Button>
                      );
                    })()}
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

      {/* ========================================================================= */}
      {/* MODAL 3: TAMBAH PRODUK BARU (DATABASE_PRODUK B:L)                         */}
      {/* ========================================================================= */}
      <Modal.Backdrop
        isOpen={isAddModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsAddModalOpen(false);
        }}
        variant="opaque"
      >
          <Modal.Container placement="auto" size="lg" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="Tambah Master Produk Baru"
              className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full flex flex-col"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />
              <form onSubmit={handleSaveNewProduct} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <Modal.Header className="px-5 pt-2.5 sm:pt-4 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                  <div className="min-w-0">
                    <Modal.Heading className="font-extrabold text-sm sm:text-base text-[var(--foreground)] truncate">
                      Tambah Master Produk Baru
                    </Modal.Heading>
                    <p className="text-[11px] text-[var(--muted)]">
                      Menulis hanya Kolom B:L di spreadsheet (Formula M:Q terlindungi)
                    </p>
                  </div>

                  <Modal.CloseTrigger
                    aria-label="Tutup modal tambah produk"
                    className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                  />
                </Modal.Header>

                <Modal.Body className="!mt-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5 text-xs">
                  {/* SKU & Auto Generate Button */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                        SKU / ID Produk (Unik):
                      </label>
                      <button
                        type="button"
                        onClick={handleAutoGenerateSku}
                        className="text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer min-h-[32px]"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto SKU</span>
                      </button>
                    </div>
                    <Input
                      type="text"
                      required
                      fullWidth
                      variant="secondary"
                      value={newSku}
                      onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                      placeholder="ORTU-BEV-001"
                      className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-mono font-bold text-[var(--foreground)] min-h-[44px]"
                    />
                  </div>

                  {/* Nama Produk & Kategori */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Nama Produk:
                      </label>
                      <Input
                        type="text"
                        required
                        fullWidth
                        variant="secondary"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Contoh: Soju Chum Churum Original"
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] min-h-[44px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Kategori Menu:
                      </label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] min-h-[44px] cursor-pointer"
                      >
                        {presentCategories.length > 0 ? (
                          presentCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="ANGGUR">ANGGUR</option>
                            <option value="BIR">BIR</option>
                            <option value="SOJU">SOJU</option>
                            <option value="VODKA">VODKA</option>
                            <option value="WHISKY">WHISKY</option>
                            <option value="RUM">RUM</option>
                            <option value="JAMU">JAMU</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Botol/Krat & Harga/Krat (Auto Compute HPP) */}
                  <div className="bg-[var(--surface-secondary)] p-3.5 rounded-2xl border border-[var(--border)] space-y-2.5">
                    <span className="text-[11px] font-bold text-[var(--foreground)] uppercase tracking-wider block">
                      Perhitungan Harga Beli / HPP:
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase mb-1">
                          Botol per Krat:
                        </label>
                        <Input
                          type="number"
                          min={1}
                          fullWidth
                          value={String(newBotolPerKrat)}
                          onChange={(e) => {
                            const btk = Math.max(1, parseInt(e.target.value) || 1);
                            setNewBotolPerKrat(btk);
                            if (newHargaPerKrat > 0) {
                              setNewCost(Math.round(newHargaPerKrat / btk));
                            }
                          }}
                          className="w-full p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--foreground)] min-h-[42px] tabular-nums font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase mb-1">
                          Harga / Krat (Rp):
                        </label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          fullWidth
                          value={String(newHargaPerKrat)}
                          onChange={(e) => {
                            const hpk = Number(e.target.value) || 0;
                            setNewHargaPerKrat(hpk);
                            if (newBotolPerKrat > 0) {
                              setNewCost(Math.round(hpk / newBotolPerKrat));
                            }
                          }}
                          className="w-full p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--foreground)] min-h-[42px] tabular-nums font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase mb-1">
                        Harga Beli HPP Satuan (Harga/Krat ÷ Botol):
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        fullWidth
                        value={String(newCost)}
                        onChange={(e) => setNewCost(Number(e.target.value) || 0)}
                        className="w-full p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--foreground)] min-h-[42px] tabular-nums font-mono"
                      />
                    </div>
                  </div>

                  {/* Harga Jual Biasa, Harga Merah, & Margin Calculation */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Harga Jual Biasa:
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        required
                        fullWidth
                        variant="secondary"
                        value={String(newPrice)}
                        onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
                        placeholder="Rp"
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-extrabold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-700 dark:text-[var(--warning)] uppercase tracking-wider mb-1">
                        Harga Merah (Reseller):
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        fullWidth
                        value={newRedPrice === 0 ? '' : String(newRedPrice)}
                        onChange={(e) => setNewRedPrice(Number(e.target.value) || 0)}
                        placeholder="Make up reseller"
                        className="w-full p-2.5 bg-[var(--warning-soft)] border border-[var(--warning)]/35 rounded-xl text-sm font-mono font-bold text-amber-700 dark:text-[var(--warning)] min-h-[44px] tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Margin Preview & Warning Alert (< 20%) */}
                  {(() => {
                    const { nominal, percent } = calculateMargin(newPrice, newCost);
                    const isLowMargin = percent < 20 && newPrice > 0;

                    return (
                      <div className={`p-3 rounded-2xl border ${isLowMargin ? 'bg-[var(--warning-soft)] border-[var(--warning)]/35' : 'bg-[var(--success-soft)] border-[var(--success)]/35'}`}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[var(--foreground)]">Margin Keuntungan:</span>
                          <span className={`font-extrabold font-mono text-sm tabular-nums ${isLowMargin ? 'text-amber-700 dark:text-[var(--warning)]' : 'text-emerald-700 dark:text-[var(--success)]'}`}>
                            +{formatRupiah(nominal)} ({percent.toFixed(1)}%)
                          </span>
                        </div>

                        {isLowMargin && (
                          <p className="text-[11px] text-amber-700 dark:text-[var(--warning)] mt-1 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Peringatan: Margin keuntungan di bawah 20%! Pertimbangkan menaikkan harga jual.</span>
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Stok Awal & Catatan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Stok Awal (Kolom K):
                      </label>
                      <Input
                        type="number"
                        min={0}
                        fullWidth
                        variant="secondary"
                        value={String(newInitialStock)}
                        onChange={(e) => setNewInitialStock(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                      />
                      <p className="text-[10px] text-[var(--muted)] mt-1">
                        *Hanya ditulis ke Kolom K (tidak dicatat ke LOG_BARANG_MASUK).
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Catatan / Supplier:
                      </label>
                      <Input
                        type="text"
                        fullWidth
                        variant="secondary"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Gudang Kediri, supplier..."
                        className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs text-[var(--foreground)] min-h-[44px]"
                      />
                    </div>
                  </div>

                  {addFeedback && (
                    <div className="p-3 bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/35 rounded-xl text-xs font-semibold">
                      {addFeedback}
                    </div>
                  )}
                </Modal.Body>

                <Modal.Footer className="!mt-0 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onPress={() => setIsAddModalOpen(false)}
                    className="flex-1 rounded-xl bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] font-semibold text-xs min-h-[44px]"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isDisabled={isSubmittingAdd}
                    className="flex-1 rounded-xl font-bold text-xs min-h-[44px]"
                  >
                    {isSubmittingAdd ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan ke Sheets...</span>
                      </>
                    ) : (
                      'Simpan Produk Baru'
                    )}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT PRODUK (SKU READONLY, HANYA B:L)                           */}
      {/* ========================================================================= */}
      <Modal.Backdrop
        isOpen={Boolean(editingProduct)}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null);
        }}
        variant="opaque"
      >
          <Modal.Container placement="auto" size="lg" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="Edit Info & Harga Produk"
              className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full flex flex-col"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />
              {editingProduct && (
                <form onSubmit={handleSaveEditProduct} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <Modal.Header className="px-5 pt-2.5 sm:pt-4 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                    <div className="min-w-0">
                      <Modal.Heading className="font-extrabold text-sm sm:text-base text-[var(--foreground)] truncate">
                        Edit Info &amp; Harga Produk
                      </Modal.Heading>
                      <span className="font-mono text-[11px] font-bold text-[var(--accent)] block truncate">
                        SKU: {editingProduct.sku} (Readonly)
                      </span>
                    </div>

                    <Modal.CloseTrigger
                      aria-label="Tutup modal edit produk"
                      className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                    />
                  </Modal.Header>

                  <Modal.Body className="!mt-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5 text-xs">
                    <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)] flex justify-between items-center">
                      <span className="text-[var(--muted)] font-medium">Stok Formula Saat Ini:</span>
                      <span className="font-extrabold text-[var(--foreground)] tabular-nums font-mono">{editingProduct.stock} Botol</span>
                    </div>

                    {/* Nama & Kategori */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                          Nama Produk:
                        </label>
                        <Input
                          type="text"
                          required
                          fullWidth
                          variant="secondary"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--foreground)] min-h-[44px]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                          Kategori:
                        </label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] min-h-[44px] cursor-pointer"
                        >
                          {presentCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Harga Jual Biasa & Merah */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                          Harga Jual Biasa:
                        </label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          required
                          fullWidth
                          variant="secondary"
                          value={String(editPrice)}
                          onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                          className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-extrabold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-amber-700 dark:text-[var(--warning)] uppercase tracking-wider mb-1">
                          Harga Merah (Reseller):
                        </label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          fullWidth
                          value={editRedPrice === 0 ? '' : String(editRedPrice)}
                          onChange={(e) => setEditRedPrice(Number(e.target.value) || 0)}
                          className="w-full p-2.5 bg-[var(--warning-soft)] border border-[var(--warning)]/35 rounded-xl text-sm font-mono font-bold text-amber-700 dark:text-[var(--warning)] min-h-[44px] tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Harga HPP */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                          Harga Beli HPP Satuan:
                        </label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          fullWidth
                          variant="secondary"
                          value={String(editCost)}
                          onChange={(e) => setEditCost(Number(e.target.value) || 0)}
                          className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                          Catatan:
                        </label>
                        <Input
                          type="text"
                          fullWidth
                          variant="secondary"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Catatan..."
                          className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs text-[var(--foreground)] min-h-[44px]"
                        />
                      </div>
                    </div>

                    {/* Margin preview */}
                    {(() => {
                      const { nominal, percent } = calculateMargin(editPrice, editCost);
                      const isLowMargin = percent < 20 && editPrice > 0;

                      return (
                        <div className={`p-3 rounded-2xl border ${isLowMargin ? 'bg-[var(--warning-soft)] border-[var(--warning)]/35' : 'bg-[var(--success-soft)] border-[var(--success)]/35'}`}>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[var(--foreground)]">Margin Keuntungan Baru:</span>
                            <span className={`font-extrabold font-mono text-sm tabular-nums ${isLowMargin ? 'text-amber-700 dark:text-[var(--warning)]' : 'text-emerald-700 dark:text-[var(--success)]'}`}>
                              +{formatRupiah(nominal)} ({percent.toFixed(1)}%)
                            </span>
                          </div>
                          {isLowMargin && (
                            <p className="text-[11px] text-amber-700 dark:text-[var(--warning)] mt-1 font-semibold">
                              Peringatan: Margin di bawah 20%.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {editFeedback && (
                      <div className="p-3 bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/35 rounded-xl text-xs font-semibold">
                        {editFeedback}
                      </div>
                    )}
                  </Modal.Body>

                  <Modal.Footer className="!mt-0 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)] pb-safe flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onPress={() => setEditingProduct(null)}
                      className="flex-1 rounded-xl bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] font-semibold text-xs min-h-[44px]"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      isDisabled={isSubmittingEdit}
                      className="flex-1 rounded-xl font-bold text-xs min-h-[44px]"
                    >
                      {isSubmittingEdit ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan ke Sheets...</span>
                        </>
                      ) : (
                        'Perbarui Info'
                      )}
                    </Button>
                  </Modal.Footer>
                </form>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
    </div>
  );
};
