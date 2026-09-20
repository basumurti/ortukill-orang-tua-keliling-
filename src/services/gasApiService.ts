import { Product, TransactionReceipt, BarangMasukRecord } from '../types';
import { StorageService, classifyProduct } from './storageService';

export interface GasDiagnosticResult {
  success: boolean;
  message?: string;
  spreadsheetName?: string;
  timezone?: string;
  availableSheets?: string[];
  configuredRanges?: {
    products: string;
    salesLog: string;
    barangMasuk: string;
  };
  sheetsStatus?: {
    productsSheetFound: boolean;
    productsSheetName: string;
    productsRowCount?: number;
    salesLogSheetFound: boolean;
    salesLogSheetName: string;
    salesLogRowCount?: number;
    barangMasukSheetFound?: boolean;
    barangMasukRowCount?: number;
  };
  sampleProductsLoaded?: Product[];
  ready?: boolean;
}

export interface GasAllDataResponse {
  success: boolean;
  message?: string;
  timestamp?: string;
  products?: Product[];
  todayTransactions?: TransactionReceipt[];
  todaySummary?: any;
  salesHistory?: TransactionReceipt[];
  barangMasukList?: BarangMasukRecord[];
  diagnostics?: {
    productsCount: number;
    todayCount: number;
    totalSalesLogged: number;
    barangMasukCount?: number;
  };
}

export const DEFAULT_GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbz3ETMp4XjXq7Qi2zdGuMNr9EVjZGrU5UTuT6g93nXNH3SyZSmIa6sys4Jrd8nNAJFiAA/exec';

export class GasApiService {
  private static STORAGE_URL_KEY = 'ortukill_pos_gas_url_v2';
  private static STORAGE_LAST_SYNC = 'ortukill_pos_last_sync_v2';

  static getSavedWebAppUrl(): string {
    const saved = localStorage.getItem(this.STORAGE_URL_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
    // Auto populate default permanent URL so user NEVER has to re-enter it
    try {
      localStorage.setItem(this.STORAGE_URL_KEY, DEFAULT_GAS_WEBAPP_URL);
    } catch {
      // ignore
    }
    return DEFAULT_GAS_WEBAPP_URL;
  }

  static setSavedWebAppUrl(url: string): void {
    const finalUrl = (url && url.trim()) || DEFAULT_GAS_WEBAPP_URL;
    localStorage.setItem(this.STORAGE_URL_KEY, finalUrl);
  }

  static getLastSync(): string | null {
    return localStorage.getItem(this.STORAGE_LAST_SYNC);
  }

  static setLastSync(timeStr: string): void {
    localStorage.setItem(this.STORAGE_LAST_SYNC, timeStr);
  }

  // Get status from backend
  static async getStatus(): Promise<{ configured: boolean; webAppUrl: string; lastSynced?: string }> {
    try {
      const res = await fetch('/api/gas/status');
      if (res.ok) {
        const data = await res.json();
        const urlToUse = (data.webAppUrl && data.webAppUrl.trim()) || DEFAULT_GAS_WEBAPP_URL;
        this.setSavedWebAppUrl(urlToUse);
        return {
          ...data,
          configured: true,
          webAppUrl: urlToUse,
        };
      }
    } catch {
      // Offline / fallback to local storage
    }
    const localUrl = this.getSavedWebAppUrl();
    return {
      configured: !!localUrl,
      webAppUrl: localUrl,
      lastSynced: this.getLastSync() || undefined,
    };
  }

  // Save config & test
  static async configureWebAppUrl(webAppUrl: string): Promise<{ success: boolean; message: string; testResult?: any }> {
    this.setSavedWebAppUrl(webAppUrl);

    try {
      const res = await fetch('/api/gas/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          message: 'Konfigurasi tersimpan.',
          testResult: data.testResult,
        };
      }
    } catch (err: any) {
      console.warn('Backend proxy configure failed, saved to localStorage', err);
    }

    return {
      success: true,
      message: 'URL tersimpan di browser.',
    };
  }

  // Test & diagnose Google Sheet connection
  static async testConnection(webAppUrl?: string): Promise<GasDiagnosticResult> {
    const targetUrl = webAppUrl || this.getSavedWebAppUrl();
    if (!targetUrl) {
      return { success: false, message: 'URL Google Apps Script belum diisi.' };
    }

    try {
      const res = await fetch('/api/gas/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl: targetUrl }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback direct call if server is unreachable
    }

    // Direct fetch fallback
    try {
      const pingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=diagnose`;
      const direct = await fetch(pingUrl, { redirect: 'follow' });
      if (direct.ok) {
        return await direct.json();
      }
    } catch (e: any) {
      return { success: false, message: 'Gagal menghubungi Google Apps Script: ' + e.message };
    }

    return { success: false, message: 'Tidak dapat menghubungi server.' };
  }

  // Fetch ALL live data from Google Sheets and synchronize to local state
  static async fetchAndSyncAll(): Promise<GasAllDataResponse> {
    let result: GasAllDataResponse;

    try {
      const res = await fetch('/api/gas/fetch-all');
      if (res.ok) {
        result = await res.json();
      } else {
        const err = await res.json();
        throw new Error(err.message || 'Gagal memuat data dari spreadsheet');
      }
    } catch (serverErr: any) {
      // Fallback: direct GET request to Web App URL
      const webAppUrl = this.getSavedWebAppUrl();
      if (!webAppUrl) {
        throw new Error('Google Apps Script belum dikonfigurasi.');
      }

      const fetchUrl = `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}action=getAllData`;
      const direct = await fetch(fetchUrl, { redirect: 'follow' });
      if (!direct.ok) {
        throw new Error('Gagal mengambil data dari Google Apps Script: ' + serverErr.message);
      }
      result = await direct.json();
    }

    if (result && result.success) {
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      this.setLastSync(nowStr);

      // 1. Sync Products
      if (result.products && result.products.length > 0) {
        StorageService.saveProducts(result.products);
      }

      // 2. Sync Sales History & Today's Transactions (Berdasarkan Tanggal)
      if (result.salesHistory || result.todayTransactions) {
        const rawSales = result.salesHistory || [];
        const normalizedSales = this.normalizeSalesData(rawSales);
        const rawToday = result.todayTransactions || [];
        const normalizedToday = this.normalizeSalesData(rawToday);

        const todayMap = new Map(normalizedToday.map((t) => [t.id, t]));

        // Merge today into all
        const mergedMap = new Map<string, TransactionReceipt>();
        normalizedSales.forEach((t) => mergedMap.set(t.id, t));
        todayMap.forEach((t, id) => mergedMap.set(id, t));

        const finalTransactions = Array.from(mergedMap.values());
        finalTransactions.sort((a, b) => String(b.dateYmd || b.date || '').localeCompare(String(a.dateYmd || a.date || '')));

        if (finalTransactions.length > 0) {
          localStorage.setItem('ortukill_pos_transactions_v1', JSON.stringify(finalTransactions));
        }
      }

      // 3. Sync LOG_BARANG_MASUK
      if (result.barangMasukList && result.barangMasukList.length > 0) {
        StorageService.saveBarangMasukList(result.barangMasukList);
      }
    }

    return result;
  }

  // Push new transaction to Google Sheets
  // PENTING: Untuk penulisan di Google Sheets (LOG_PENJUALAN), wajib menggunakan harga biasa bukan harga jual merah!
  static async pushTransaction(trx: TransactionReceipt): Promise<{ success: boolean; message?: string }> {
    const webAppUrl = this.getSavedWebAppUrl();

    // Siapkan data transaksi khusus Google Sheets menggunakan HARGA BIASA
    const sheetItems = trx.items.map((item) => {
      const regularPrice = Number(item.regularPrice ?? item.price) || 0;
      const regularTotal = regularPrice * item.qty;
      const regularMargin = (regularPrice - (item.cost || 0)) * item.qty;

      return {
        ...item,
        price: regularPrice, // Harga Jual Biasa
        regularPrice: regularPrice,
        total: regularTotal,
        subtotal: regularTotal,
        margin: regularMargin,
      };
    });

    // PENTING: Jika ada diskon/promo, masukkan sebagai baris potongan PROMO-DISKON
    // agar kolom G (Total Penjualan) di Google Sheets klop 100% dengan omset kasir
    if (trx.discount && trx.discount > 0) {
      const promoSku = (trx.promoCode ? trx.promoCode.trim().toUpperCase() : 'PROMO-DISKON');
      const promoLabel = trx.promoName
        ? `PROMO: ${trx.promoName}`
        : 'POTONGAN PROMO / DISKON';

      sheetItems.push({
        productId: promoSku,
        sku: promoSku,
        name: promoLabel,
        price: -Math.abs(trx.discount),
        regularPrice: -Math.abs(trx.discount),
        qty: 1,
        total: -Math.abs(trx.discount),
        subtotal: -Math.abs(trx.discount),
        margin: -Math.abs(trx.discount),
      });
    }

    // Jika ada ongkir, catat baris biaya pengiriman
    if (trx.shippingFee && trx.shippingFee > 0) {
      sheetItems.push({
        productId: 'ONGKIR',
        sku: 'ONGKIR',
        name: 'BIAYA PENGIRIMAN / ONGKIR',
        price: trx.shippingFee,
        regularPrice: trx.shippingFee,
        qty: 1,
        total: trx.shippingFee,
        subtotal: trx.shippingFee,
        margin: 0,
      });
    }

    const sheetSubtotal = sheetItems.reduce((sum, item) => sum + item.total, 0);
    const sheetTotal = sheetSubtotal;
    const sheetMargin = sheetItems.reduce((sum, item) => sum + item.margin, 0);

    const sheetsPayload = {
      ...trx,
      items: sheetItems,
      subtotal: sheetSubtotal,
      total: sheetTotal,
      margin: sheetMargin,
      customerName: trx.isResellerMode 
        ? `${trx.customerName || 'Reseller'} [Harga Merah]` 
        : trx.customerName,
    };

    // 1. Try server backend proxy
    try {
      const res = await fetch('/api/gas/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetsPayload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) return data;
      }
    } catch (err) {
      console.warn('Backend proxy /api/gas/transaction failed:', err);
    }

    // 2. Direct fallback to Google Apps Script Web App
    if (webAppUrl) {
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveTransaction', transaction: sheetsPayload }),
        });
        if (direct.ok) {
          return await direct.json();
        }
      } catch (err: any) {
        console.warn('Direct GAS sync failed:', err);
        return { success: false, message: 'Koneksi ke Google Sheets gagal: ' + (err?.message || 'Error') };
      }
    }

    return { success: false, message: 'Google Apps Script belum dikonfigurasi atau belum terhubung.' };
  }

  // Push record barang masuk to LOG_BARANG_MASUK (B4:H)
  static async pushBarangMasuk(entry: BarangMasukRecord): Promise<{ success: boolean; message?: string; updatedStock?: number; rowNumber?: number }> {
    const webAppUrl = this.getSavedWebAppUrl();

    // 1. Try server backend proxy
    try {
      const res = await fetch('/api/gas/barang-masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) return data;
      }
    } catch (err) {
      console.warn('Backend proxy /api/gas/barang-masuk error:', err);
    }

    // 2. Direct fallback to Google Apps Script Web App
    if (webAppUrl) {
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'recordBarangMasuk', entry }),
        });
        if (direct.ok) {
          return await direct.json();
        }
      } catch (err: any) {
        console.warn('Direct GAS barang masuk failed:', err);
        return { success: false, message: 'Koneksi ke Google Sheets gagal: ' + (err?.message || 'Error') };
      }
    }

    return { success: false, message: 'Google Apps Script belum dikonfigurasi atau belum terhubung.' };
  }

  // Push stock update to Google Sheets
  static async pushStockUpdate(sku: string, delta: number, reason?: string): Promise<{ success: boolean; message?: string }> {
    const webAppUrl = this.getSavedWebAppUrl();
    if (!webAppUrl) return { success: false, message: 'Belum terhubung ke spreadsheet' };

    try {
      const res = await fetch('/api/gas/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, delta, reason }),
      });
      if (res.ok) return await res.json();
    } catch {
      // direct
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'updateStock', sku, delta, reason }),
        });
        if (direct.ok) return await direct.json();
      } catch (e) {
        console.warn(e);
      }
    }
    return { success: false, message: 'Gagal update stok ke spreadsheet' };
  }

  // Push void transaction
  static async pushVoidTransaction(transactionId: string, reason?: string): Promise<{ success: boolean; message?: string }> {
    const webAppUrl = this.getSavedWebAppUrl();
    if (!webAppUrl) return { success: false, message: 'Belum terhubung ke spreadsheet' };

    try {
      const res = await fetch('/api/gas/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, reason }),
      });
      if (res.ok) return await res.json();
    } catch {
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'voidTransaction', transactionId, reason }),
        });
        if (direct.ok) return await direct.json();
      } catch (e) {
        console.warn(e);
      }
    }
    return { success: false, message: 'Gagal void ke spreadsheet' };
  }

  // Isi otomatis Kolom J (KATEGORI) di spreadsheet DASHBOARD_MUTASI_&_PROFIT
  static async fillCategoriesInSheet(): Promise<{ success: boolean; message?: string; count?: number }> {
    const webAppUrl = this.getSavedWebAppUrl();
    if (!webAppUrl) return { success: false, message: 'Belum terhubung ke spreadsheet.' };

    try {
      const res = await fetch('/api/gas/fill-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Direct call fallback
      try {
        const direct = await fetch(`${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}action=fillCategories`, {
          redirect: 'follow',
        });
        if (direct.ok) {
          return await direct.json();
        }
      } catch (err: any) {
        return { success: false, message: 'Gagal menjalankan auto-fill: ' + (err?.message || 'Error') };
      }
    }

    return { success: false, message: 'Gagal menghubungi server Apps Script.' };
  }

  // Normalisasi data transaksi agar selalu dikelompokkan berdasarkan tanggal penjualan
  static normalizeSalesData(rawList: TransactionReceipt[]): TransactionReceipt[] {
    if (!rawList || rawList.length === 0) return [];

    // Deteksi apakah format data lama (di mana t.id adalah SKU dan it.name adalah harga)
    const isOldFormat = rawList.some(
      (t) => !t.id.startsWith('TGL-') && t.items && t.items.some((it) => !isNaN(Number(it.name)) && Number(it.name) > 1000)
    );

    if (!isOldFormat) {
      return rawList.map((t) => ({
        ...t,
        status: t.status || 'COMPLETED',
        subtotal: t.subtotal ?? t.total ?? 0,
        discount: t.discount ?? 0,
        shippingFee: t.shippingFee ?? 0,
        items: (t.items || []).map((it) => ({
          ...it,
          productId: it.productId || it.sku || '-',
          sku: it.sku || '-',
          name: it.name || '-',
          price: Number(it.price) || 0,
          qty: Number(it.qty) || 1,
          total: Number(it.total) || (Number(it.price || 0) * Number(it.qty || 1)),
          subtotal: Number(it.subtotal || it.total) || (Number(it.price || 0) * Number(it.qty || 1)),
          margin: Number(it.margin) || 0,
        })),
      }));
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

        dateMap[key].totalQty += actualQty;
        dateMap[key].subtotal += actualTotal;
        dateMap[key].total += actualTotal;
        dateMap[key].margin += actualMargin;
      });
    });

    const result = Object.values(dateMap);
    result.sort((a, b) => String(b.dateYmd || b.date || '').localeCompare(String(a.dateYmd || a.date || '')));
    return result;
  }
}
