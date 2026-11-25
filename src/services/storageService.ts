import { 
  Product, 
  TransactionReceipt, 
  AppConfig, 
  ShiftRecord, 
  DailySummary, 
  PaymentMethod, 
  BrandConfig, 
  BarangMasukRecord,
  PromoRule,
  FinanceRecord,
  SalesTarget,
  LastUpdateInfo,
  StockAuditRecord
} from '../types';
import { 
  INITIAL_CONFIG, 
  INITIAL_PRODUCTS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_BARANG_MASUK, 
  INITIAL_FINANCE_RECORDS,
  INITIAL_SALES_TARGET
} from '../data/initialData';

const STORAGE_KEYS = {
  CONFIG: 'ortukill_pos_config_v1',
  PRODUCTS: 'ortukill_pos_products_v3',
  TRANSACTIONS: 'ortukill_pos_transactions_v2',
  TRANSACTIONS_LEGACY: 'ortukill_pos_transactions_v1',
  BARANG_MASUK: 'ortukill_pos_barang_masuk_v2',
  BARANG_MASUK_LEGACY: 'ortukill_pos_barang_masuk_v1',
  SHIFTS: 'ortukill_pos_shifts_v1',
  CURRENT_SHIFT: 'ortukill_pos_current_shift_v1',
  PROMOS: 'ortukill_pos_promos_v1',
  FINANCES: 'ortukill_pos_finances_v2',
  FINANCES_LEGACY: 'ortukill_pos_finances_v1',
  SALES_TARGET: 'ortukill_pos_sales_target_v1',
  LAST_UPDATE: 'ortukill_pos_last_update_v2',
  PURGE_FLAG: 'ortukill_pos_demo_purged_v2',
  DELETED_TRX: 'ortukill_pos_deleted_trx_v2',
  STOCK_AUDIT: 'ortukill_pos_stock_audit_v1',
};

// Daftar ID transaksi demo dari initialData untuk mencegah demo muncul kembali
const DEMO_TRANSACTION_IDS = new Set([
  'TRX-20260915-001',
  'TRX-20260915-002',
  'TRX-20260915-003',
  'TRX-20260320-1001',
  'TRX-20260320-1002',
  'TRX-20260322-1003',
  'TRX-20260322-1004',
  'TRX-20260323-1005',
  'TRX-20260324-1006',
  'TRX-20260325-1007',
  'TRX-20260325-1008',
]);

export const INITIAL_PROMOS: PromoRule[] = [
  {
    id: 'promo-5rb',
    code: 'PROMO 5RB',
    name: 'PROMO 5RB',
    type: 'FIXED',
    value: 5000,
    minOrder: 0,
    description: 'Potongan diskon Rp 5.000 (SKU: PROMO 5RB)',
    isActive: true,
  },
  {
    id: 'promo-10k',
    code: 'PROMO-10K',
    name: 'Promo Belanja Rp 10.000',
    type: 'FIXED',
    value: 10000,
    minOrder: 100000,
    description: 'Potongan Rp 10.000 untuk belanja min. Rp 100.000',
    isActive: true,
  },
  {
    id: 'promo-20k',
    code: 'PROMO-20K',
    name: 'Promo Sultan Rp 20.000',
    type: 'FIXED',
    value: 20000,
    minOrder: 200000,
    description: 'Potongan Rp 20.000 untuk belanja min. Rp 200.000',
    isActive: true,
  },
  {
    id: 'promo-member',
    code: 'MEMBER-5',
    name: 'Diskon Member Setia 5%',
    type: 'PERCENT',
    value: 5,
    minOrder: 0,
    description: 'Diskon 5% untuk pelanggan setia',
    isActive: true,
  },
  {
    id: 'promo-jumat',
    code: 'JUMAT-HEMAT',
    name: 'Jumat Santai Rp 15.000',
    type: 'FIXED',
    value: 15000,
    minOrder: 150000,
    description: 'Potongan Rp 15.000 untuk pembelian min. Rp 150.000',
    isActive: true,
  },
];

// Singleton formatters (hindari alokasi Intl berulang pada ribuan baris)
const RUPIAH_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const JAKARTA_DATETIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const WIB_TIME_SHORT_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
});

// Format utilities
export function formatRupiah(val: number | string): string {
  const num = typeof val === 'number' ? val : Number(val) || 0;
  return RUPIAH_FORMATTER.format(num);
}

export function normalizeDateToYmd(s: string): string {
  if (!s) return '';
  const clean = String(s).trim().split(' ')[0];
  const parts = clean.replace(/[/.]/g, '-').split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      // Jika p0 <= 12 dan p1 > 12, ini format MM-DD-YYYY (seperti 10/17/2026)
      if (p0 <= 12 && p1 > 12) {
        return `${parts[2]}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
      // Default: DD-MM-YYYY
      return `${parts[2]}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
    }
  }
  return clean;
}

/**
 * Konversi tanggal (string seperti "10/17/2026 0:00:00" atau Date object)
 * menjadi format standar inputan Google Sheets untuk regional Indonesia (GMT+7 / Asia/Jakarta).
 *
 * Contoh:
 * - "10/17/2026 0:00:00" -> "17/10/2026 00:00:00" (dengan waktu) atau "17/10/2026" (hanya tanggal)
 */
export function formatDateForGoogleSheet(
  inputDate: string | Date | number,
  includeTime = true
): { dateStr: string; timeStr: string; fullSheetStr: string; ymd: string; wibDisplay: string } {
  if (!inputDate) {
    inputDate = new Date();
  }

  // Jika input adalah string yang mengandung format MM/DD/YYYY atau DD/MM/YYYY
  if (typeof inputDate === 'string') {
    const raw = inputDate.trim();
    const timeMatch = raw.match(/(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?/);
    const timeStr = timeMatch
      ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}:${(timeMatch[3] || '00').padStart(2, '0')}`
      : '00:00:00';

    const datePart = raw.split(' ')[0];
    const parts = datePart.replace(/[/.]/g, '-').split('-');
    if (parts.length === 3) {
      let y = '', m = '', d = '';
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        y = parts[0];
        m = parts[1].padStart(2, '0');
        d = parts[2].padStart(2, '0');
      } else if (parts[2].length === 4) {
        y = parts[2];
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        if (p0 <= 12 && p1 > 12) {
          // Format MM/DD/YYYY (seperti 10/17/2026)
          m = String(p0).padStart(2, '0');
          d = String(p1).padStart(2, '0');
        } else {
          // Format DD/MM/YYYY
          d = String(p0).padStart(2, '0');
          m = String(p1).padStart(2, '0');
        }
      }

      if (y && m && d) {
        const dateStr = `${d}/${m}/${y}`;
        const fullSheetStr = includeTime ? `${dateStr} ${timeStr}` : dateStr;
        const ymd = `${y}-${m}-${d}`;
        const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][parseInt(m, 10) - 1] || m;
        const wibDisplay = `${d} ${bulanIndo} ${y}, ${timeStr} WIB`;
        return { dateStr, timeStr, fullSheetStr, ymd, wibDisplay };
      }
    }
  }

  // Jika berupa Date object atau timestamp, format ke timezone Asia/Jakarta (GMT+7)
  const dateObj = typeof inputDate === 'object' && inputDate instanceof Date
    ? inputDate
    : new Date(inputDate);

  const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;

  // Format GMT+7 via singleton Intl formatter
  const parts = JAKARTA_DATETIME_FORMATTER.formatToParts(validDate);
  const partMap: Record<string, string> = {};
  parts.forEach((p) => { partMap[p.type] = p.value; });

  const d = partMap['day'] || '01';
  const m = partMap['month'] || '01';
  const y = partMap['year'] || '2026';
  const hh = (partMap['hour'] || '00').padStart(2, '0');
  const mm = (partMap['minute'] || '00').padStart(2, '0');
  const ss = (partMap['second'] || '00').padStart(2, '0');

  const dateStr = `${d}/${m}/${y}`;
  const timeStr = `${hh}:${mm}:${ss}`;
  const fullSheetStr = includeTime ? `${dateStr} ${timeStr}` : dateStr;
  const ymd = `${y}-${m}-${d}`;
  const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][parseInt(m, 10) - 1] || m;
  const wibDisplay = `${d} ${bulanIndo} ${y}, ${timeStr} WIB`;

  return { dateStr, timeStr, fullSheetStr, ymd, wibDisplay };
}

export function isSameDay(date1: string, date2: string): boolean {
  if (!date1 || !date2) return false;
  if (date1 === date2) return true;
  return normalizeDateToYmd(date1) === normalizeDateToYmd(date2);
}

export function isDateToday(dateStr: string): boolean {
  const { ymd } = formatDateForGoogleSheet(new Date(), false);
  return normalizeDateToYmd(dateStr) === ymd;
}

export function getTodayDateString(): string {
  const { dateStr } = formatDateForGoogleSheet(new Date(), false);
  return dateStr;
}

export function getFormattedNow(): { full: string; date: string; time: string } {
  const { dateStr, timeStr, fullSheetStr } = formatDateForGoogleSheet(new Date(), true);
  return {
    full: fullSheetStr,
    date: dateStr,
    time: timeStr.slice(0, 5), // "HH:mm"
  };
}

/**
 * Otomatis mengelompokkan kategori menu ORTUKILL secara presisi
 * Berdasarkan SKU kode produk dan nama barang dari sheet
 */
export function classifyProduct(sku: string = '', name: string = ''): string {
  const s = (sku || '').trim().toUpperCase();
  const n = (name || '').trim().toUpperCase();

  // 1. Promo / Diskon
  if (s.startsWith('PROMO') || n.includes('PROMO') || n.includes('DISKON') || n.includes('VOUCHER')) {
    return 'PROMO';
  }

  // 2. Jamu / Herbal
  if (n.includes('BERAS KENCUR') || s.startsWith('BK-')) {
    return 'JAMU';
  }

  // 3. Soju
  if (
    s.startsWith('BSP-') || 
    s.startsWith('BSPM-') || 
    s.startsWith('BSL-') || 
    n.includes('SOJU') || 
    n.includes('BAE')
  ) {
    return 'SOJU';
  }

  // 4. Whisky
  if (
    s.startsWith('DWR') || 
    s.startsWith('DB7-') || 
    s.startsWith('DS3-') || 
    s.startsWith('MDKW-') ||
    n.includes('WHISKY') || 
    n.includes('DRUM')
  ) {
    return 'WHISKY';
  }

  // 5. Rum
  if (
    s.startsWith('CMS') || 
    n.includes('CAPTAIN MORGAN') || 
    n.includes('RUM')
  ) {
    return 'RUM';
  }

  // 6. Vodka
  if (
    s.startsWith('IVM-') || 
    s.startsWith('IS3R-') || 
    s.startsWith('IB5-') || 
    s.startsWith('IX7-') || 
    s.startsWith('ITO7-') || 
    s.startsWith('ITL7-') || 
    s.startsWith('IVO2-') || 
    s.startsWith('IVL2-') || 
    s.startsWith('MDKV') || 
    s.startsWith('MDV-') || 
    s.startsWith('FB-') || 
    s.startsWith('FBK-') || 
    s.startsWith('NR-') || 
    s.startsWith('NPG-') || 
    s.startsWith('NPIT-') ||
    n.includes('ICELAND') || 
    n.includes('VODKA') || 
    n.includes('NEW PORT') || 
    n.includes('NEWPORT') ||
    n.includes('FRIENDSHIP') ||
    n.includes('MC DONALD')
  ) {
    return 'VODKA';
  }

  // 7. Bir
  if (
    s.startsWith('PL-') || 
    s.startsWith('BP-') || 
    s.startsWith('SK5-') || 
    s.startsWith('PALM-') || 
    s.startsWith('PAL-') || 
    s.startsWith('KDS-') ||
    s.startsWith('SAJM-') || 
    s.startsWith('SA-OT-') || 
    s.startsWith('S-OT-') ||
    n.includes('PROST') || 
    n.includes('BINTANG') || 
    n.includes('PILSENER') || 
    n.includes('STOUT') || 
    n.includes('ALSTER') ||
    n.includes('KONIG') ||
    n.includes('SINGARAJA')
  ) {
    return 'BIR';
  }

  // 8. Anggur
  if (
    s.startsWith('AMG-') || 
    s.startsWith('AKKT-') || 
    s.startsWith('AP-') || 
    s.startsWith('AKH-') || 
    s.startsWith('IAG-') || 
    s.startsWith('AA-') || 
    s.startsWith('AABC-') || 
    s.startsWith('KKAM-') || 
    s.startsWith('KKAH-') || 
    s.startsWith('KKB-') ||
    s.startsWith('AAL-') || 
    s.startsWith('AARP-') || 
    s.startsWith('AAP-') || 
    s.startsWith('AAS-') || 
    s.startsWith('AL-A-') || 
    s.startsWith('AAH-') || 
    s.startsWith('AB-A-') ||
    n.includes('ANGGUR') || 
    n.includes('KOLESOM') || 
    n.includes('KETAN HITAM') || 
    n.includes('INTISARI') || 
    n.includes('KAWA KAWA') || 
    n.includes('ATLAS') || 
    n.includes('ALEXIS')
  ) {
    return 'ANGGUR';
  }

  return 'ANGGUR';
}

/**
 * Memeriksa apakah suatu item transaksi merupakan item diskon/promo/potongan.
 * Item promo TIDAK BOLEH dihitung ke dalam Volume Terjual (Total Qty Botol).
 */
export function isPromoItem(item: {
  sku?: string;
  name?: string;
  price?: number;
  regularPrice?: number;
  originalPrice?: number;
  category?: string;
}): boolean {
  if (!item) return false;
  if (typeof item.price === 'number' && item.price < 0) return true;
  const sku = (item.sku || '').trim().toUpperCase();
  const name = (item.name || '').trim().toUpperCase();
  const cat = (item.category || '').trim().toUpperCase();

  return (
    sku.includes('PROMO') ||
    sku.includes('POTONGAN') ||
    sku.includes('DISKON') ||
    sku.includes('VOUCHER') ||
    name.includes('PROMO') ||
    name.includes('POTONGAN') ||
    name.includes('DISKON') ||
    name.includes('VOUCHER') ||
    cat === 'PROMO' ||
    cat.includes('PROMO') ||
    cat === 'DAFTAR PROMO'
  );
}

/**
 * Memeriksa apakah suatu item transaksi termasuk botol minuman yang dihitung.
 * Aturan pengecualian (KECUALI):
 * 1. Bir: Kategori BIR/BEER, SKU bir, nama bir (Prost, Bintang, Singaraja, dll)
 * 2. Promo: SKU/Nama PROMO/POTONGAN/DISKON/VOUCHER atau harga negatif
 * 3. Semua harga minuman di bawah 30rb (harga satuan < 30.000)
 */
export function isEligibleBottleItem(item: {
  sku?: string;
  name?: string;
  price?: number;
  regularPrice?: number;
  originalPrice?: number;
  category?: string;
}): boolean {
  if (!item) return false;
  const sku = (item.sku || '').trim().toUpperCase();
  const name = (item.name || '').trim().toUpperCase();
  const cat = (item.category || '').trim().toUpperCase();

  // 1. Pengecualian Promo (menggunakan aturan isPromoItem)
  if (isPromoItem(item)) {
    return false;
  }

  // 2. Pengecualian Bir
  if (
    cat === 'BIR' ||
    cat === 'BEER' ||
    classifyProduct(item.sku, item.name) === 'BIR' ||
    /^(PL-|BP-|SK5-|PALM-|PAL-|KDS-|SAJM-|SA-OT-|S-OT-)/.test(sku) ||
    name.includes('BIR') ||
    name.includes('BEER') ||
    name.includes('PROST') ||
    name.includes('BINTANG') ||
    name.includes('SINGARAJA') ||
    name.includes('PILSENER') ||
    name.includes('STOUT') ||
    name.includes('ALSTER') ||
    name.includes('KONIG') ||
    name.includes('HEINEKEN') ||
    name.includes('GUINNESS') ||
    name.includes('ANKER') ||
    name.includes('CARLSBERG') ||
    name.includes('BALI HAI')
  ) {
    return false;
  }

  // 3. Pengecualian Semua harga minuman di bawah 30rb (< 30.000)
  const unitPrice = item.price ?? item.regularPrice ?? item.originalPrice ?? 0;
  if (unitPrice < 30000) {
    return false;
  }

  return true;
}

/**
 * Menghitung total botol yang keluar dari daftar transaksi
 * dengan mengecualikan bir, promo, dan semua minuman di bawah 30rb.
 */
export function calculateFilteredBottleCount(transactions: TransactionReceipt[]): number {
  if (!transactions || !Array.isArray(transactions)) return 0;
  let count = 0;
  transactions.forEach((t) => {
    if (t.status === 'VOIDED') return;
    if (Array.isArray(t.items)) {
      t.items.forEach((item) => {
        if (isEligibleBottleItem(item)) {
          count += Number(item.qty) || 0;
        }
      });
    }
  });
  return count;
}

export function normalizeTransactionsByDate(rawList: TransactionReceipt[]): TransactionReceipt[] {
  if (!rawList || rawList.length === 0) return [];

  // Deteksi format lama di mana t.id adalah SKU produk, bukan tanggal atau nomor nota
  const isOldFormat = rawList.some(
    (t) => !t.id.startsWith('TGL-') && !t.id.startsWith('TRX-') && t.items && t.items.some((it) => !isNaN(Number(it.name)) && Number(it.name) > 1000)
  );

  if (!isOldFormat) {
    return rawList;
  }

  const dateMap: Record<string, TransactionReceipt> = {};

  rawList.forEach((t) => {
    const dateStr = t.date || (t.transactionDate ? t.transactionDate.split(' ')[0] : 'Lainnya');
    const parts = dateStr.split('/');
    const dateYmd = parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : dateStr;
    const key = 'TGL-' + (dateYmd || dateStr);

    if (!dateMap[key]) {
      const pm = t.paymentMethod && !String(t.paymentMethod).startsWith('+') ? (t.paymentMethod as any) : 'CASH';
      dateMap[key] = {
        id: key,
        date: dateStr,
        dateYmd: dateYmd,
        transactionDate: t.transactionDate || dateStr,
        paymentMethod: pm,
        items: [],
        totalQty: 0,
        subtotal: 0,
        discount: 0,
        total: 0,
        margin: 0,
        customerName: t.paymentMethod && String(t.paymentMethod).startsWith('+') ? t.paymentMethod : '-',
        status: 'COMPLETED',
      };
    }

    (t.items || []).forEach((it) => {
      const actualSku = t.id;
      const actualName = isNaN(Number(it.sku)) ? it.sku || actualSku : it.name;
      const actualPrice = !isNaN(Number(it.name)) && Number(it.name) > 0 ? Number(it.name) : Number(it.price) || 0;
      const actualQty = !isNaN(Number(it.category)) && Number(it.category) > 0 ? Number(it.category) : Number(it.qty) || 1;
      const actualTotal = Number(it.price) || (actualPrice * actualQty);
      const actualCost = Number(it.cost) || 0;
      const actualMargin = Number(it.margin) || (actualTotal - (actualCost * actualQty));
      const cat = classifyProduct(actualSku, actualName);

      dateMap[key].items.push({
        productId: actualSku,
        sku: actualSku,
        name: actualName,
        category: cat,
        price: actualPrice,
        qty: actualQty,
        total: actualTotal,
        cost: actualCost,
        margin: actualMargin,
      });

      if (!isPromoItem({ sku: actualSku, name: actualName, price: actualPrice, category: cat })) {
        dateMap[key].totalQty += actualQty;
      }
      dateMap[key].subtotal += actualTotal;
      dateMap[key].total += actualTotal;
      dateMap[key].margin += actualMargin;
    });
  });

  const result = Object.values(dateMap);
  result.sort((a, b) => String(b.dateYmd || b.date || '').localeCompare(String(a.dateYmd || a.date || '')));
  return result;
}

export class StorageService {
  // In-memory cache untuk menghindari JSON.parse berulang pada data besar
  private static memoryCache = new Map<string, unknown>();
  private static deletedTrxSetCache: Set<string> | null = null;
  private static demoPurgedCache: boolean | null = null;
  private static storageListenerAttached = false;

  private static ensureStorageListener(): void {
    if (this.storageListenerAttached) return;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', (event: StorageEvent) => {
        this.invalidateCache(event.key ?? undefined);
      });
      this.storageListenerAttached = true;
    }
  }

  /**
   * Membuang cache memori (semua key atau key tertentu).
   * Otomatis dipanggil saat write, event `storage`, dan setelah sinkronisasi Sheets.
   */
  static invalidateCache(key?: string): void {
    if (!key) {
      this.memoryCache.clear();
      this.deletedTrxSetCache = null;
      this.demoPurgedCache = null;
      return;
    }
    this.memoryCache.delete(key);
    if (key === STORAGE_KEYS.DELETED_TRX) {
      this.deletedTrxSetCache = null;
      this.memoryCache.delete(STORAGE_KEYS.TRANSACTIONS);
    } else if (key === STORAGE_KEYS.PURGE_FLAG) {
      this.demoPurgedCache = null;
    }
  }

  private static setStorageAndCache<T>(key: string, value: T): void {
    this.ensureStorageListener();
    localStorage.setItem(key, JSON.stringify(value));
    this.memoryCache.set(key, value);
  }

  private static getCachedItemCount(key: string): number {
    this.ensureStorageListener();
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      return Array.isArray(cached) ? cached.length : 0;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }

  // Config
  static getConfig(): AppConfig {
    this.ensureStorageListener();
    if (this.memoryCache.has(STORAGE_KEYS.CONFIG)) {
      return this.memoryCache.get(STORAGE_KEYS.CONFIG) as AppConfig;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored) as AppConfig;
        this.memoryCache.set(STORAGE_KEYS.CONFIG, parsed);
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load config', e);
    }
    return INITIAL_CONFIG;
  }

  static getBrandConfig(): BrandConfig {
    return this.getConfig().brand;
  }

  static saveConfig(config: AppConfig): void {
    this.setStorageAndCache(STORAGE_KEYS.CONFIG, config);
  }

  // Pastikan data demo statis awal tidak lagi memuat ulang transaksi palsu
  static ensureDemoPurged(): void {
    this.ensureStorageListener();
    if (this.demoPurgedCache === true) return;
    try {
      const isPurged = localStorage.getItem(STORAGE_KEYS.PURGE_FLAG);
      if (isPurged === 'true') {
        this.demoPurgedCache = true;
        return;
      }

      // Cek dan bersihkan transaksi demo jika masih ada di browser
      const v2 = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const v1 = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS_LEGACY);

      let cleanTransactions: TransactionReceipt[] = [];
      const sourceStr = v2 || v1;
      if (sourceStr) {
        try {
          const parsed = JSON.parse(sourceStr);
          if (Array.isArray(parsed)) {
            cleanTransactions = parsed.filter(
              (t) => !DEMO_TRANSACTION_IDS.has(t.id) && !t.id?.startsWith('TRX-20260915-')
            );
          }
        } catch (e) {}
      }

      this.setStorageAndCache(STORAGE_KEYS.TRANSACTIONS, cleanTransactions);

      // Bersihkan catatan keuangan demo jika ada
      const fLegacy = localStorage.getItem(STORAGE_KEYS.FINANCES_LEGACY);
      const fV2 = localStorage.getItem(STORAGE_KEYS.FINANCES);
      const fSource = fV2 || fLegacy;
      let cleanFinances: FinanceRecord[] = [];
      if (fSource) {
        try {
          const parsedFin = JSON.parse(fSource);
          if (Array.isArray(parsedFin)) {
            cleanFinances = parsedFin.filter((f) => !f.id?.startsWith('FIN-00'));
          }
        } catch (e) {}
      }
      this.setStorageAndCache(STORAGE_KEYS.FINANCES, cleanFinances);

      // Bersihkan barang masuk demo
      const bmLegacy = localStorage.getItem(STORAGE_KEYS.BARANG_MASUK_LEGACY);
      const bmV2 = localStorage.getItem(STORAGE_KEYS.BARANG_MASUK);
      const bmSource = bmV2 || bmLegacy;
      let cleanBm: BarangMasukRecord[] = [];
      if (bmSource) {
        try {
          const parsedBm = JSON.parse(bmSource);
          if (Array.isArray(parsedBm) && parsedBm.length > 0) {
            cleanBm = parsedBm.filter((b) => !b.id?.startsWith('BM-10'));
          }
        } catch (e) {}
      }
      if (cleanBm.length === 0 && Array.isArray(INITIAL_BARANG_MASUK) && INITIAL_BARANG_MASUK.length > 0) {
        cleanBm = [...INITIAL_BARANG_MASUK];
      }
      this.setStorageAndCache(STORAGE_KEYS.BARANG_MASUK, cleanBm);

      localStorage.setItem(STORAGE_KEYS.PURGE_FLAG, 'true');
      this.demoPurgedCache = true;
    } catch (e) {
      console.warn('ensureDemoPurged warning:', e);
    }
  }

  // Products - Memorized berdasarkan pembaruan terakhir
  static getProducts(): Product[] {
    this.ensureStorageListener();
    if (this.memoryCache.has(STORAGE_KEYS.PRODUCTS)) {
      const cached = this.memoryCache.get(STORAGE_KEYS.PRODUCTS) as Product[];
      return cached.map((p) => ({ ...p }));
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (stored !== null) {
        const parsed: Product[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize and categorize
          const normalized = parsed.map((p) => ({
            ...p,
            category: p.category && p.category !== 'PRODUK' ? p.category : classifyProduct(p.sku, p.name),
            cost: Number(p.cost) || 0,
            price: Number(p.price) || 0,
            stock: Number(p.stock) || 0,
          }));
          this.memoryCache.set(STORAGE_KEYS.PRODUCTS, normalized);
          return normalized.map((p) => ({ ...p }));
        }
      }
    } catch (e) {
      console.error('Failed to load products', e);
    }
    // Jika benar-benar pertama kali di browser, inisialisasi katalog sekali saja
    this.setStorageAndCache(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    return INITIAL_PRODUCTS.map((p) => ({ ...p }));
  }

  static saveProducts(products: Product[], source: 'GOOGLE_SHEETS' | 'POS' | 'LOCAL' = 'LOCAL', details?: string): void {
    const formatted = products.map((p) => ({
      ...p,
      category: p.category && p.category !== 'PRODUK' ? p.category : classifyProduct(p.sku, p.name),
    }));
    this.setStorageAndCache(STORAGE_KEYS.PRODUCTS, formatted);
    this.setLastUpdateInfo({
      source,
      sourceLabel: source === 'GOOGLE_SHEETS' ? 'Google Sheets' : 'Pembaruan Lokal',
      details: details || `Katalog produk diperbarui (${formatted.length} produk)`,
      itemCounts: { products: formatted.length },
    });
  }

  static updateProductStock(idOrSku: string, newStockOrDelta: number, isDirectSet: boolean = true): Product[] {
    const products = this.getProducts();
    const updated = products.map((p) => {
      if (p.id === idOrSku || p.sku === idOrSku) {
        const stock = isDirectSet
          ? Math.max(0, newStockOrDelta)
          : Math.max(0, p.stock + newStockOrDelta);
        const totalAsset = stock * (p.cost || 0);
        return { ...p, stock, totalAsset };
      }
      return p;
    });
    this.saveProducts(updated, 'LOCAL', `Update stok ${idOrSku}: ${newStockOrDelta}`);
    return updated;
  }

  static addProduct(product: Omit<Product, 'id'>): Product[] {
    const products = this.getProducts();
    const cat = product.category || classifyProduct(product.sku, product.name);
    const newProd: Product = {
      ...product,
      id: product.sku || `PROD-${Date.now()}`,
      category: cat,
      totalAsset: (product.stock || 0) * (product.cost || 0),
    };
    const updated = [newProd, ...products];
    this.saveProducts(updated, 'LOCAL', `Tambah produk baru: ${newProd.name}`);
    return updated;
  }

  static updateProduct(product: Product): Product[] {
    const products = this.getProducts();
    const cat = product.category || classifyProduct(product.sku, product.name);
    const updatedProduct = {
      ...product,
      category: cat,
      totalAsset: (product.stock || 0) * (product.cost || 0),
    };

    const index = products.findIndex((p) => p.id === product.id || p.sku === product.sku);
    if (index >= 0) {
      products[index] = updatedProduct;
    } else {
      products.push(updatedProduct);
    }
    this.saveProducts(products, 'LOCAL', `Ubah produk: ${product.name}`);
    return products;
  }

  static deleteProduct(sku: string): Product[] {
    const products = this.getProducts().filter((p) => p.sku !== sku);
    this.saveProducts(products, 'LOCAL', `Hapus produk SKU ${sku}`);
    return products;
  }

  // Stock Audit Trail (Perubahan Produk & Stok)
  static getStockAuditLogs(): StockAuditRecord[] {
    this.ensureStorageListener();
    if (this.memoryCache.has(STORAGE_KEYS.STOCK_AUDIT)) {
      return [...(this.memoryCache.get(STORAGE_KEYS.STOCK_AUDIT) as StockAuditRecord[])];
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.STOCK_AUDIT);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.memoryCache.set(STORAGE_KEYS.STOCK_AUDIT, parsed);
          return [...parsed];
        }
      }
    } catch (e) {
      console.warn('Failed to load stock audit logs', e);
    }
    return [];
  }

  static addStockAuditLog(log: Omit<StockAuditRecord, 'id' | 'timestamp' | 'dateStr'>): StockAuditRecord {
    const logs = this.getStockAuditLogs();
    const { fullSheetStr } = formatDateForGoogleSheet(new Date(), true);
    const newRecord: StockAuditRecord = {
      ...log,
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      dateStr: fullSheetStr,
    };
    const updated = [newRecord, ...logs].slice(0, 200); // keep last 200 records
    try {
      this.setStorageAndCache(STORAGE_KEYS.STOCK_AUDIT, updated);
    } catch (e) {
      console.warn('Failed to save stock audit log', e);
    }
    return newRecord;
  }

  // Blacklist ID Transaksi yang sudah dihapus / di-void secara permanen
  static getDeletedTransactionIds(): Set<string> {
    this.ensureStorageListener();
    if (this.deletedTrxSetCache !== null) {
      return this.deletedTrxSetCache;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DELETED_TRX);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          const set = new Set<string>(arr);
          this.deletedTrxSetCache = set;
          return set;
        }
      }
    } catch {}
    const emptySet = new Set<string>();
    this.deletedTrxSetCache = emptySet;
    return emptySet;
  }

  static isTransactionDeleted(id: string, deletedSet: Set<string>): boolean {
    if (!id) return false;
    const raw = String(id).trim();
    const noHash = raw.replace(/^#/, '').trim();
    const bare = noHash.replace(/^VOIDED-/i, '').trim();
    return (
      deletedSet.has(raw) ||
      deletedSet.has(noHash) ||
      deletedSet.has(bare) ||
      deletedSet.has(`VOIDED-${bare}`) ||
      deletedSet.has(`#${bare}`) ||
      deletedSet.has(`#VOIDED-${bare}`)
    );
  }

  static markTransactionAsDeleted(trxId: string): void {
    if (!trxId) return;
    try {
      const deletedSet = new Set(this.getDeletedTransactionIds());
      const raw = String(trxId).trim();
      const noHash = raw.replace(/^#/, '').trim();
      const bare = noHash.replace(/^VOIDED-/i, '').trim();

      deletedSet.add(raw);
      deletedSet.add(noHash);
      deletedSet.add(bare);
      deletedSet.add(`VOIDED-${bare}`);
      deletedSet.add(`#${raw}`);
      deletedSet.add(`#${bare}`);
      deletedSet.add(`#VOIDED-${bare}`);

      localStorage.setItem(STORAGE_KEYS.DELETED_TRX, JSON.stringify(Array.from(deletedSet)));
      this.deletedTrxSetCache = deletedSet;
    } catch (e) {
      console.error(e);
    }
  }

  // Bersihkan semua transaksi berawalan VOIDED- lama dari memori kasir
  static purgeAllVoidedTransactions(): TransactionReceipt[] {
    try {
      const list = this.getTransactions();
      const deletedSet = this.getDeletedTransactionIds();
      const cleaned: TransactionReceipt[] = [];
      let hadVoided = false;

      for (const t of list) {
        const rawId = String(t.id || '').trim();
        const isVoidedPrefix = rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-');
        if (isVoidedPrefix || this.isTransactionDeleted(rawId, deletedSet)) {
          this.markTransactionAsDeleted(rawId);
          hadVoided = true;
        } else {
          cleaned.push(t);
        }
      }

      if (hadVoided && cleaned.length !== list.length) {
        this.setStorageAndCache(STORAGE_KEYS.TRANSACTIONS, cleaned);
      }
      return cleaned;
    } catch (e) {
      console.error('Failed to purge voided transactions', e);
    }
    return this.getTransactions();
  }

  // Transactions - Memorized riil, TIDAK PERNAH memuat demo awal
  static getTransactions(): TransactionReceipt[] {
    this.ensureDemoPurged();
    if (this.memoryCache.has(STORAGE_KEYS.TRANSACTIONS)) {
      return [...(this.memoryCache.get(STORAGE_KEYS.TRANSACTIONS) as TransactionReceipt[])];
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (stored !== null) {
        const parsed: TransactionReceipt[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const deletedSet = this.getDeletedTransactionIds();
          const activeOnly = parsed.filter((t) => {
            const rawId = String(t.id || '').trim();
            if (this.isTransactionDeleted(rawId, deletedSet)) return false;
            if (rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-')) return false;
            return true;
          });
          const normalized = normalizeTransactionsByDate(activeOnly);
          if (normalized !== parsed) {
            this.setStorageAndCache(STORAGE_KEYS.TRANSACTIONS, normalized);
          } else {
            this.memoryCache.set(STORAGE_KEYS.TRANSACTIONS, normalized);
          }
          return [...normalized];
        }
      }
    } catch (e) {
      console.error('Failed to load transactions', e);
    }
    return [];
  }

  static saveTransactions(transactions: TransactionReceipt[], source: 'GOOGLE_SHEETS' | 'POS' | 'LOCAL' = 'LOCAL', details?: string): void {
    this.ensureDemoPurged();
    const deletedSet = this.getDeletedTransactionIds();
    // Filter transaksi yang sudah dihapus secara permanen atau berawalan VOIDED-
    const filtered = transactions.filter((t) => {
      const rawId = String(t.id || '').trim();
      if (this.isTransactionDeleted(rawId, deletedSet)) return false;
      if (rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-')) return false;
      return true;
    });
    const normalized = normalizeTransactionsByDate(filtered);
    this.setStorageAndCache(STORAGE_KEYS.TRANSACTIONS, normalized);
    this.setLastUpdateInfo({
      source,
      sourceLabel: source === 'GOOGLE_SHEETS' ? 'Google Sheets' : source === 'POS' ? 'Kasir POS' : 'Update Lokal',
      details: details || `Memorize ${normalized.length} transaksi`,
      itemCounts: { transactions: normalized.length },
    });
  }

  static generateTransactionId(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(100 + Math.random() * 900);
    return `TRX-${y}${m}${d}-${hh}${mm}${ss}-${random}`;
  }

  static saveTransaction(trx: TransactionReceipt): TransactionReceipt[] {
    const products = this.getProducts();
    const productMap = new Map(products.map((p) => [p.sku, p]));

    // Pastikan jam input website asli dan timestamp terekam sempurna
    if (!trx.websiteTime && trx.transactionDate && trx.transactionDate.includes(' ')) {
      trx.websiteTime = trx.transactionDate.split(' ')[1].replace(/\./g, ':');
    }
    if (!trx.createdAt) {
      trx.createdAt = Date.now();
    }

    // Ensure items have category, cost, and accurate margins
    const enrichedItems = trx.items.map((item) => {
      const prod = productMap.get(item.sku || '') || products.find((p) => p.id === item.productId);
      const cat = item.category || (prod ? prod.category : classifyProduct(item.sku || '', item.name));
      const cost = typeof item.cost === 'number' ? item.cost : (prod ? prod.cost : 0);
      const itemMargin = (item.price - cost) * item.qty;
      return {
        ...item,
        category: cat,
        cost,
        margin: itemMargin,
      };
    });

    const grossMargin = enrichedItems.reduce((sum, i) => sum + i.margin, 0);
    const discount = Number(trx.discount) || 0;
    const finalMargin = Math.max(0, grossMargin - discount);

    const enrichedTrx: TransactionReceipt = {
      ...trx,
      items: enrichedItems,
      margin: finalMargin,
    };

    const list = this.getTransactions();
    const updated = [enrichedTrx, ...list];
    this.setStorageAndCache(STORAGE_KEYS.TRANSACTIONS, updated);

    // Automatically record shipping fee as website income (+) if present
    if (trx.shippingFee && trx.shippingFee > 0) {
      try {
        this.saveFinanceRecord({
          id: `FIN-ONGKIR-${trx.id}`,
          type: 'INCOME',
          category: 'ONGKIR',
          categoryLabel: 'Ongkir Pengiriman (+)',
          amount: trx.shippingFee,
          description: `Ongkir Nota ${trx.id} (${trx.customerName || 'Pelanggan'})`,
          cashier: trx.cashier || 'Kasir Utama',
          date: trx.date,
        });
      } catch (e) {
        console.error('Failed to auto-record shipping fee', e);
      }
    }

    // Deduct stock locally from DASHBOARD_MUTASI_&_PROFIT (khusus produk fisik minuman, abaikan item promo)
    enrichedTrx.items.forEach((item) => {
      const isPromo = item.price < 0 || String(item.sku || '').toUpperCase().includes('PROMO') || String(item.category || '').toUpperCase().includes('PROMO');
      if (isPromo) return;
      const prod = products.find((p) => p.id === item.productId || p.sku === item.sku);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.qty);
        prod.totalAsset = prod.stock * (prod.cost || 0);
      }
    });
    this.saveProducts(products, 'POS', `Stok dikurangi nota ${trx.id}`);

    this.setLastUpdateInfo({
      source: 'POS',
      sourceLabel: 'Kasir POS',
      details: `Transaksi ${trx.id} (${formatRupiah(trx.total)})`,
      itemCounts: { transactions: updated.length, products: products.length },
    });

    return updated;
  }

  static voidTransaction(trxId: string, reason: string): TransactionReceipt[] {
    // Sesuai aturan mutlak Code.gs v3.5: VOID = HAPUS PERMANEN + KEMBALIKAN STOK
    this.markTransactionAsDeleted(trxId);
    const list = this.getTransactions();
    const products = this.getProducts();

    const rawTarget = String(trxId).trim().toUpperCase();
    const bareTarget = rawTarget.replace(/^#/, '').replace(/^VOIDED-/, '');

    const target = list.find((t) => {
      const curRaw = String(t.id).trim().toUpperCase();
      const curBare = curRaw.replace(/^#/, '').replace(/^VOIDED-/, '');
      return curRaw === rawTarget || curBare === bareTarget;
    });

    // Kembalikan stok barang yang dibatalkan
    if (target && target.status !== 'VOIDED') {
      target.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId || p.sku === item.sku);
        if (prod) {
          prod.stock += item.qty;
          prod.totalAsset = prod.stock * (prod.cost || 0);
        }
      });
      this.saveProducts(products, 'POS', `Stok dikembalikan nota VOID ${trxId}`);
    }

    // Hapus total dari transaksi lokal
    const updated = list.filter((t) => {
      const curRaw = String(t.id).trim().toUpperCase();
      const curBare = curRaw.replace(/^#/, '').replace(/^VOIDED-/, '');
      return curRaw !== rawTarget && curBare !== bareTarget;
    });

    this.setStorageAndCache(STORAGE_KEYS.TRANSACTIONS, updated);

    // Bersihkan juga catatan keuangan ongkir jika ada
    try {
      const finances = this.getFinanceRecords();
      const updatedFinances = finances.filter((f) => !f.description.includes(bareTarget) && !f.description.includes(trxId));
      if (updatedFinances.length !== finances.length) {
        this.setStorageAndCache(STORAGE_KEYS.FINANCES, updatedFinances);
      }
    } catch (e) {}

    this.setLastUpdateInfo({
      source: 'POS',
      sourceLabel: 'Void & Hapus Permanen',
      details: `Nota ${trxId} dibatalkan & dihapus permanen (${reason || 'VOID'})`,
      itemCounts: { transactions: updated.length },
    });

    return updated;
  }

  static deleteTransaction(trxId: string, restoreStock = false): TransactionReceipt[] {
    this.markTransactionAsDeleted(trxId);
    const list = this.getTransactions();
    const products = this.getProducts();

    const rawTarget = String(trxId).trim().toUpperCase();
    const bareTarget = rawTarget.replace(/^#/, '').replace(/^VOIDED-/, '');

    const target = list.find((t) => {
      const curRaw = String(t.id).trim().toUpperCase();
      const curBare = curRaw.replace(/^#/, '').replace(/^VOIDED-/, '');
      return curRaw === rawTarget || curBare === bareTarget;
    });

    if (target && restoreStock && target.status !== 'VOIDED') {
      target.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId || p.sku === item.sku);
        if (prod) {
          prod.stock += item.qty;
          prod.totalAsset = prod.stock * (prod.cost || 0);
        }
      });
      this.saveProducts(products, 'POS', `Stok dikembalikan nota dihapus ${trxId}`);
    }

    const updated = list.filter((t) => {
      const curRaw = String(t.id).trim().toUpperCase();
      const curBare = curRaw.replace(/^#/, '').replace(/^VOIDED-/, '');
      return curRaw !== rawTarget && curBare !== bareTarget;
    });
    this.setStorageAndCache(STORAGE_KEYS.TRANSACTIONS, updated);

    // Hapus juga catatan keuangan ongkir jika ada yang terikat nomor struk ini
    try {
      const finances = this.getFinanceRecords();
      const updatedFinances = finances.filter((f) => !f.description.includes(bareTarget) && !f.description.includes(trxId));
      if (updatedFinances.length !== finances.length) {
        this.setStorageAndCache(STORAGE_KEYS.FINANCES, updatedFinances);
      }
    } catch (e) {}

    this.setLastUpdateInfo({
      source: 'POS',
      sourceLabel: 'Hapus Transaksi',
      details: `Nota ${trxId} dihapus permanen`,
      itemCounts: { transactions: updated.length },
    });

    return updated;
  }

  // Today's Transactions using flexible date matcher
  static getTodayTransactions(): TransactionReceipt[] {
    const all = this.getTransactions();
    return all.filter((t) => {
      const rawId = String(t.id || '').trim();
      if (rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-')) return false;
      return isDateToday(t.date);
    });
  }

  static getDailySummary(): DailySummary {
    const todayList = this.getTodayTransactions().filter((t) => t.status !== 'VOIDED');
    const today = getTodayDateString();

    const paymentBreakdown: Record<PaymentMethod, { count: number; total: number }> = {
      CASH: { count: 0, total: 0 },
      TRANSFER: { count: 0, total: 0 },
      QRIS: { count: 0, total: 0 },
    };

    let totalOmset = 0;
    let totalMargin = 0;
    let totalQty = 0;
    let filteredBottleQty = 0;

    todayList.forEach((t) => {
      totalOmset += t.total;
      totalMargin += t.margin || 0;

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
        totalQty += t.totalQty || 0;
      }

      const method = t.paymentMethod;
      if (paymentBreakdown[method]) {
        paymentBreakdown[method].count += 1;
        paymentBreakdown[method].total += t.total;
      }
    });

    return {
      date: today,
      totalTransactions: todayList.length,
      totalOmset,
      totalMargin,
      totalQty,
      filteredBottleQty,
      avgBasketSize: todayList.length > 0 ? Math.round(totalOmset / todayList.length) : 0,
      paymentBreakdown,
    };
  }

  // LOG_BARANG_MASUK (B4:H) - Memorized, tidak memuat demo
  static getBarangMasukList(): BarangMasukRecord[] {
    this.ensureDemoPurged();
    if (this.memoryCache.has(STORAGE_KEYS.BARANG_MASUK)) {
      return [...(this.memoryCache.get(STORAGE_KEYS.BARANG_MASUK) as BarangMasukRecord[])];
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BARANG_MASUK);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoryCache.set(STORAGE_KEYS.BARANG_MASUK, parsed);
          return [...parsed];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return Array.isArray(INITIAL_BARANG_MASUK) ? INITIAL_BARANG_MASUK : [];
  }

  static saveBarangMasukList(list: BarangMasukRecord[]): void {
    this.ensureDemoPurged();
    this.setStorageAndCache(STORAGE_KEYS.BARANG_MASUK, list);
    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Barang Masuk',
      details: `Catatan barang masuk disimpan (${list.length} data)`,
      itemCounts: { barangMasuk: list.length },
    });
  }

  static addBarangMasuk(entry: BarangMasukRecord): void {
    const list = this.getBarangMasukList();
    const updated = [entry, ...list.filter((b) => b.id !== entry.id)];
    this.saveBarangMasukList(updated);
  }

  static classifyProduct(sku: string = '', name: string = ''): string {
    return classifyProduct(sku, name);
  }

  static recordBarangMasuk(entry: Omit<BarangMasukRecord, 'id' | 'date'> & { id?: string; date?: string }): BarangMasukRecord {
    const list = this.getBarangMasukList();
    const { full } = getFormattedNow();
    const nowId = `BM-${Date.now().toString().slice(-6)}`;
    const qty = Number(entry.qty) || 0;
    const cost = Number(entry.cost) || 0;
    const totalCost = entry.totalCost !== undefined ? Number(entry.totalCost) : (qty * cost);

    const newRecord: BarangMasukRecord = {
      id: entry.id || nowId,
      date: entry.date || full,
      sku: entry.sku,
      name: entry.name,
      krat: Number(entry.krat) || 0,
      qty: qty,
      cost: cost,
      supplier: entry.supplier || entry.supplierOrNotes || 'orang tua',
      supplierOrNotes: entry.supplierOrNotes || entry.supplier || 'Restock Barang Masuk',
      totalCost: totalCost,
    };

    const updated = [newRecord, ...list];
    this.saveBarangMasukList(updated);

    // Also update product stock in catalog
    this.updateProductStock(entry.sku, newRecord.qty, false);

    const isCorrection = (entry.supplierOrNotes || '').includes('KOREKSI') || (entry.supplier || '').includes('KOREKSI');
    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: isCorrection ? 'Koreksi Stok' : 'Restock Barang',
      details: `${isCorrection ? 'Koreksi Stok' : 'Barang Masuk'}: ${newRecord.name} (${qty >= 0 ? '+' : ''}${qty})`,
    });

    return newRecord;
  }

  // Shift & Cash Drawer
  static getCurrentShift(): ShiftRecord {
    this.ensureStorageListener();
    if (this.memoryCache.has(STORAGE_KEYS.CURRENT_SHIFT)) {
      const cached = this.memoryCache.get(STORAGE_KEYS.CURRENT_SHIFT) as ShiftRecord;
      return { ...cached, expenses: [...(cached.expenses || [])] };
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_SHIFT);
      if (stored) {
        const parsed = JSON.parse(stored) as ShiftRecord;
        this.memoryCache.set(STORAGE_KEYS.CURRENT_SHIFT, parsed);
        return { ...parsed, expenses: [...(parsed.expenses || [])] };
      }
    } catch (e) {
      console.error(e);
    }

    const { full } = getFormattedNow();
    const newShift: ShiftRecord = {
      id: 'SHIFT-' + Date.now(),
      cashierName: 'Kasir ORTUKILL Kediri',
      startTime: full,
      startingCash: 200000,
      cashSales: 0,
      expenses: [],
      actualCash: 200000,
      difference: 0,
      status: 'OPEN',
    };
    this.setStorageAndCache(STORAGE_KEYS.CURRENT_SHIFT, newShift);
    return { ...newShift, expenses: [] };
  }

  static updateShiftCashSales(amount: number): ShiftRecord {
    const shift = this.getCurrentShift();
    shift.cashSales += amount;
    this.setStorageAndCache(STORAGE_KEYS.CURRENT_SHIFT, shift);
    return shift;
  }

  static addShiftExpense(description: string, amount: number): ShiftRecord {
    const shift = this.getCurrentShift();
    const { time } = getFormattedNow();
    shift.expenses = shift.expenses || [];
    shift.expenses.push({
      id: 'EXP-' + Date.now(),
      time,
      description,
      amount,
    });
    this.setStorageAndCache(STORAGE_KEYS.CURRENT_SHIFT, shift);
    return shift;
  }

  static closeCurrentShift(actualCash: number, notes: string): ShiftRecord {
    const current = this.getCurrentShift();
    const { full } = getFormattedNow();
    const totalExpenses = (current.expenses || []).reduce((sum, e) => sum + e.amount, 0);
    const expected = current.startingCash + current.cashSales - totalExpenses;
    const difference = actualCash - expected;

    const closed: ShiftRecord = {
      ...current,
      endTime: full,
      actualCash,
      difference,
      notes,
      status: 'CLOSED',
    };

    const allShifts = this.getShiftHistory();
    allShifts.unshift(closed);
    this.setStorageAndCache(STORAGE_KEYS.SHIFTS, allShifts);
    this.setStorageAndCache(STORAGE_KEYS.CURRENT_SHIFT, closed);

    return closed;
  }

  static startNewShift(startingCash: number, cashierName: string): ShiftRecord {
    const { full } = getFormattedNow();
    const newShift: ShiftRecord = {
      id: 'SHIFT-' + Date.now(),
      cashierName: cashierName || 'Kasir ORTUKILL',
      startTime: full,
      startingCash,
      cashSales: 0,
      expenses: [],
      actualCash: startingCash,
      difference: 0,
      status: 'OPEN',
    };
    this.setStorageAndCache(STORAGE_KEYS.CURRENT_SHIFT, newShift);
    return newShift;
  }

  static getShiftHistory(): ShiftRecord[] {
    this.ensureStorageListener();
    if (this.memoryCache.has(STORAGE_KEYS.SHIFTS)) {
      return [...(this.memoryCache.get(STORAGE_KEYS.SHIFTS) as ShiftRecord[])];
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.memoryCache.set(STORAGE_KEYS.SHIFTS, parsed);
          return [...parsed];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  // Promo Management
  static getPromos(): PromoRule[] {
    this.ensureStorageListener();
    if (this.memoryCache.has(STORAGE_KEYS.PROMOS)) {
      return [...(this.memoryCache.get(STORAGE_KEYS.PROMOS) as PromoRule[])];
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROMOS);
      if (stored) {
        const list: PromoRule[] = JSON.parse(stored);
        if (Array.isArray(list)) {
          const hasPromo5rb = list.some(
            (p) => String(p.code || '').toUpperCase() === 'PROMO 5RB' || String(p.name || '').toUpperCase() === 'PROMO 5RB'
          );
          if (!hasPromo5rb) {
            const promo5rb: PromoRule = {
              id: 'promo-5rb',
              code: 'PROMO 5RB',
              name: 'PROMO 5RB',
              type: 'FIXED',
              value: 5000,
              minOrder: 0,
              description: 'Potongan diskon Rp 5.000 (SKU: PROMO 5RB)',
              isActive: true,
            };
            const updated = [promo5rb, ...list];
            this.setStorageAndCache(STORAGE_KEYS.PROMOS, updated);
            return [...updated];
          }
          this.memoryCache.set(STORAGE_KEYS.PROMOS, list);
          return [...list];
        }
      }
    } catch (e) {
      console.error('Failed to parse promos:', e);
    }
    // Inisialisasi awal jika belum ada
    this.setStorageAndCache(STORAGE_KEYS.PROMOS, INITIAL_PROMOS);
    return [...INITIAL_PROMOS];
  }

  static savePromo(promo: PromoRule): PromoRule[] {
    const promos = this.getPromos();
    const existingIndex = promos.findIndex((p) => p.id === promo.id || (promo.code && p.code.toUpperCase() === promo.code.toUpperCase()));
    let updated: PromoRule[];

    if (existingIndex >= 0) {
      updated = [...promos];
      updated[existingIndex] = { ...updated[existingIndex], ...promo };
    } else {
      updated = [promo, ...promos];
    }

    this.setStorageAndCache(STORAGE_KEYS.PROMOS, updated);
    return updated;
  }

  static deletePromo(id: string): PromoRule[] {
    const promos = this.getPromos().filter((p) => p.id !== id);
    this.setStorageAndCache(STORAGE_KEYS.PROMOS, promos);
    return promos;
  }

  static togglePromo(id: string): PromoRule[] {
    const promos = this.getPromos().map((p) => 
      p.id === id ? { ...p, isActive: p.isActive === false ? true : false } : p
    );
    this.setStorageAndCache(STORAGE_KEYS.PROMOS, promos);
    return promos;
  }

  // Finance (Pemasukan & Pengeluaran Non-Penjualan) - Memorized, tidak memuat demo
  static getFinanceRecords(): FinanceRecord[] {
    this.ensureDemoPurged();
    if (this.memoryCache.has(STORAGE_KEYS.FINANCES)) {
      return [...(this.memoryCache.get(STORAGE_KEYS.FINANCES) as FinanceRecord[])];
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FINANCES);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.memoryCache.set(STORAGE_KEYS.FINANCES, parsed);
          return [...parsed];
        }
      }
    } catch (e) {
      console.error('Failed to load finance records', e);
    }
    return [];
  }

  static saveFinanceRecord(rec: Omit<FinanceRecord, 'id' | 'dateYmd' | 'dateTimeStr'> & { id?: string; date?: string; dateYmd?: string; dateTimeStr?: string }): FinanceRecord[] {
    const list = this.getFinanceRecords();
    const { date } = getFormattedNow();
    const entryDate = rec.date || date;
    const dateYmd = rec.dateYmd || normalizeDateToYmd(entryDate);

    const categoryMap: Record<string, string> = {
      ONGKIR: 'Ongkir Pengiriman (+)',
      TIPS: 'Tips & Bonus (+)',
      MODAL_LAIN: 'Modal / Pemasukan Lain (+)',
      BENSIN: 'Bensin Motor/Kendaraan (-)',
      PEMBELIAN_STOK: 'Pembelian Stok / Kulakan (-)',
      OPERASIONAL: 'Operasional Toko (-)',
      PENGELUARAN_LAIN: 'Pengeluaran Lain-Lain (-)',
    };

    const qty = Number(rec.qty) || 1;
    const unitPrice = rec.unitPrice !== undefined ? Number(rec.unitPrice) : Math.abs(Number(rec.amount) || 0) / qty;
    const amount = rec.amount !== undefined ? Math.abs(Number(rec.amount) || 0) : unitPrice * qty;

    const newRec: FinanceRecord = {
      id: rec.id || `FIN-${Date.now().toString().slice(-8)}`,
      date: entryDate,
      dateYmd: dateYmd,
      dateTimeStr: rec.dateTimeStr || `${entryDate} ${WIB_TIME_SHORT_FORMATTER.format(new Date())}`,
      type: rec.type,
      category: rec.category,
      categoryLabel: rec.categoryLabel || categoryMap[rec.category] || rec.category,
      unitPrice: unitPrice,
      qty: qty,
      amount: amount,
      description: rec.description || '',
      paymentMethod: (rec.paymentMethod || 'CASH').toUpperCase(),
      cashier: rec.cashier || 'Kasir Utama',
      notes: rec.notes || '',
      rowNumber: rec.rowNumber,
      syncStatus: rec.syncStatus || 'LOCAL',
    };

    const updated = [newRec, ...list.filter((f) => f.id !== newRec.id)];
    this.setStorageAndCache(STORAGE_KEYS.FINANCES, updated);

    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Catatan Keuangan',
      details: `${newRec.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}: ${newRec.description} (${formatRupiah(amount)})`,
      itemCounts: { finances: updated.length },
    });

    return updated;
  }

  // Sinkronisasi data dari sheet LAIN-LAIN (Google Sheets)
  static syncPengeluaranLainList(remoteList: FinanceRecord[]): FinanceRecord[] {
    if (!remoteList || remoteList.length === 0) {
      return this.getFinanceRecords();
    }

    const localList = this.getFinanceRecords();
    const mergedMap = new Map<string, FinanceRecord>();

    // 1. Masukkan remote items lebih dulu
    remoteList.forEach((r) => {
      const key = r.rowNumber ? `SHEET-ROW-${r.rowNumber}` : (r.id || `${r.date}-${r.description}-${r.amount}`);
      mergedMap.set(key, {
        ...r,
        syncStatus: 'SYNCED',
      });
    });

    // 2. Pertahankan local records yang belum ada di spreadsheet (misal pemasukan atau lokal baru)
    localList.forEach((loc) => {
      const hasMatch = remoteList.some(
        (rem) =>
          (loc.rowNumber && rem.rowNumber === loc.rowNumber) ||
          (loc.date === rem.date && loc.description === rem.description && loc.amount === rem.amount)
      );

      if (!hasMatch) {
        mergedMap.set(loc.id, loc);
      }
    });

    const result = Array.from(mergedMap.values());
    result.sort((a, b) => String(b.dateYmd || b.date || '').localeCompare(String(a.dateYmd || a.date || '')));

    this.setStorageAndCache(STORAGE_KEYS.FINANCES, result);
    return result;
  }

  static deleteFinanceRecord(id: string): FinanceRecord[] {
    const list = this.getFinanceRecords().filter((f) => f.id !== id);
    this.setStorageAndCache(STORAGE_KEYS.FINANCES, list);
    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Hapus Keuangan',
      details: 'Catatan keuangan dihapus',
      itemCounts: { finances: list.length },
    });
    return list;
  }

  // Sales Target Bulanan
  static getSalesTarget(): SalesTarget {
    this.ensureStorageListener();
    if (this.memoryCache.has(STORAGE_KEYS.SALES_TARGET)) {
      return this.memoryCache.get(STORAGE_KEYS.SALES_TARGET) as SalesTarget;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SALES_TARGET);
      if (stored) {
        const parsed = JSON.parse(stored) as SalesTarget;
        this.memoryCache.set(STORAGE_KEYS.SALES_TARGET, parsed);
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load sales target', e);
    }
    this.setStorageAndCache(STORAGE_KEYS.SALES_TARGET, INITIAL_SALES_TARGET);
    return INITIAL_SALES_TARGET;
  }

  static saveSalesTarget(targetAmount: number, month?: string): SalesTarget {
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const newTarget: SalesTarget = {
      targetAmount: Math.max(0, Number(targetAmount) || 0),
      month: currentMonth,
      updatedAt: new Date().toISOString(),
    };
    this.setStorageAndCache(STORAGE_KEYS.SALES_TARGET, newTarget);
    return newTarget;
  }

  // Memorize Base on Last Update State Management
  static getLastUpdateInfo(): LastUpdateInfo {
    this.ensureStorageListener();
    if (this.memoryCache.has(STORAGE_KEYS.LAST_UPDATE)) {
      return this.memoryCache.get(STORAGE_KEYS.LAST_UPDATE) as LastUpdateInfo;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_UPDATE);
      if (stored) {
        const parsed = JSON.parse(stored) as LastUpdateInfo;
        this.memoryCache.set(STORAGE_KEYS.LAST_UPDATE, parsed);
        return parsed;
      }
    } catch (e) {}

    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const time = WIB_TIME_SHORT_FORMATTER.format(now);

    return {
      timestamp: now.toISOString(),
      formatted: `${d}/${m}/${y} ${time} WIB`,
      source: 'LOCAL',
      sourceLabel: 'Memorize Aktif',
      details: 'Menggunakan data pembaruan terakhir',
    };
  }

  static setLastUpdateInfo(info: Partial<LastUpdateInfo>): LastUpdateInfo {
    const current = this.getLastUpdateInfo();
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const time = WIB_TIME_SHORT_FORMATTER.format(now);

    const updated: LastUpdateInfo = {
      timestamp: now.toISOString(),
      formatted: `${d}/${m}/${y} ${time} WIB`,
      source: info.source || current.source,
      sourceLabel: info.sourceLabel || (info.source === 'GOOGLE_SHEETS' ? 'Google Sheets' : info.source === 'POS' ? 'Kasir POS' : 'Update Lokal'),
      details: info.details || current.details || 'Pembaruan data kasir',
      itemCounts: {
        products: info.itemCounts?.products ?? this.getCachedItemCount(STORAGE_KEYS.PRODUCTS),
        transactions: info.itemCounts?.transactions ?? this.getCachedItemCount(STORAGE_KEYS.TRANSACTIONS),
        finances: info.itemCounts?.finances ?? this.getCachedItemCount(STORAGE_KEYS.FINANCES),
        barangMasuk: info.itemCounts?.barangMasuk ?? this.getCachedItemCount(STORAGE_KEYS.BARANG_MASUK),
      },
    };

    try {
      this.setStorageAndCache(STORAGE_KEYS.LAST_UPDATE, updated);
    } catch (e) {}

    return updated;
  }

  // Bersihkan data transaksi dan keuangan ke kondisi fresh (TIDAK menyuntikkan data demo palsu!)
  static resetToInitialData(): void {
    this.setStorageAndCache(STORAGE_KEYS.TRANSACTIONS, []);
    this.setStorageAndCache(STORAGE_KEYS.BARANG_MASUK, []);
    this.setStorageAndCache(STORAGE_KEYS.FINANCES, []);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SHIFT);
    localStorage.removeItem(STORAGE_KEYS.SHIFTS);
    this.memoryCache.delete(STORAGE_KEYS.CURRENT_SHIFT);
    this.memoryCache.delete(STORAGE_KEYS.SHIFTS);
    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Data Dibersihkan',
      details: 'Data transaksi & catatan kasir dibersihkan (tanpa data demo)',
      itemCounts: { transactions: 0, barangMasuk: 0, finances: 0 },
    });
  }
}
