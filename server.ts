import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json());

const CONFIG_FILE = path.join(process.cwd(), 'gas_config.json');
const MEMORIZED_CACHE_FILE = path.join(process.cwd(), 'gas_memorized_cache.json');
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzvryS_rbLz7h8sliys8HuFmy8X-nu-o9kagpsUxgBhp8sjukunG3Lo_RlWIY1oiJjxrA/exec';

interface GasConfig {
  webAppUrl: string;
  primaryWebAppUrl?: string;
  sheetConfig: {
    productsSheet: string;
    productRange?: string;
    salesLogSheet: string;
    barangMasukSheet: string;
    productStartRow: number;
    salesLogStartRow: number;
    barangMasukStartRow: number;
  };
  lastSynced?: string;
}

function loadGasConfig(): GasConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (!parsed.primaryWebAppUrl || !parsed.primaryWebAppUrl.trim()) {
        parsed.primaryWebAppUrl = parsed.webAppUrl || process.env.PRIMARY_GAS_WEBAPP_URL || DEFAULT_GAS_URL;
      }
      if (!parsed.webAppUrl || !parsed.webAppUrl.trim()) {
        parsed.webAppUrl = parsed.primaryWebAppUrl || process.env.GAS_WEBAPP_URL || DEFAULT_GAS_URL;
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading gas_config.json:', err);
  }
  return {
    webAppUrl: process.env.GAS_WEBAPP_URL || DEFAULT_GAS_URL,
    primaryWebAppUrl: process.env.PRIMARY_GAS_WEBAPP_URL || DEFAULT_GAS_URL,
    sheetConfig: {
      productsSheet: 'DASHBOARD_MUTASI_&_PROFIT',
      productRange: 'B70:J',
      salesLogSheet: 'LOG_PENJUALAN',
      barangMasukSheet: 'LOG_BARANG_MASUK',
      productStartRow: 70,
      salesLogStartRow: 7,
      barangMasukStartRow: 4,
    },
  };
}

function saveGasConfig(config: GasConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing gas_config.json:', err);
  }
}

// Helper to make reliable requests to Google Apps Script (following 302 redirects)
async function callGas(url: string, method: 'GET' | 'POST' = 'GET', payload?: unknown) {
  if (!url || !url.startsWith('http')) {
    throw new Error('URL Google Apps Script belum dikonfigurasi.');
  }

  const options: RequestInit = {
    method,
    redirect: 'follow',
  };

  if (method === 'POST') {
    options.headers = {
      'Content-Type': 'text/plain;charset=utf-8',
    };
    options.body = JSON.stringify(payload || {});
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Apps Script error [HTTP ${response.status}]: ${text.substring(0, 300)}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // If it returned HTML or text error
    throw new Error(`Respon bukan JSON valid: ${text.substring(0, 200)}`);
  }
}

/* ============================================================
 * API ROUTES
 * ============================================================ */

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Get GAS Status & Config
app.get('/api/gas/status', (req, res) => {
  const config = loadGasConfig();
  res.json({
    success: true,
    configured: !!config.webAppUrl,
    webAppUrl: config.webAppUrl,
    primaryWebAppUrl: config.primaryWebAppUrl || config.webAppUrl || DEFAULT_GAS_URL,
    sheetConfig: config.sheetConfig,
    lastSynced: config.lastSynced || null,
  });
});

// 2b. Cek versi Apps Script yang BENAR-BENAR terpasang (via ?action=ping)
export const EXPECTED_GAS_VERSION = 'v3.5';

app.get('/api/gas/ping', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;
    if (!url) {
      res.status(400).json({ success: false, message: 'Google Apps Script belum dikonfigurasi.' });
      return;
    }
    const sep = url.includes('?') ? '&' : '?';
    const response = await callGas(`${url}${sep}action=ping&_=${Date.now()}`, 'GET');
    const message = String(response?.message || '');
    const match = /v\d+(?:\.\d+)?(?:-[a-z]+)?/i.exec(message);
    const installedVersion = match ? match[0] : null;
    res.json({
      success: true,
      message,
      installedVersion,
      expectedVersion: EXPECTED_GAS_VERSION,
      upToDate: Boolean(installedVersion && installedVersion.toLowerCase().startsWith(EXPECTED_GAS_VERSION)),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Save / Configure GAS Web App URL
app.post('/api/gas/configure', async (req, res) => {
  try {
    const { webAppUrl, primaryWebAppUrl, setAsPrimary, sheetConfig } = req.body;
    const current = loadGasConfig();

    const targetUrl = (webAppUrl || '').trim();
    const newConfig: GasConfig = {
      webAppUrl: targetUrl,
      primaryWebAppUrl: setAsPrimary
        ? targetUrl
        : ((primaryWebAppUrl || current.primaryWebAppUrl || targetUrl || DEFAULT_GAS_URL).trim()),
      sheetConfig: {
        productsSheet: sheetConfig?.productsSheet || current.sheetConfig.productsSheet,
        productRange: sheetConfig?.productRange || current.sheetConfig.productRange || 'B70:J',
        salesLogSheet: sheetConfig?.salesLogSheet || current.sheetConfig.salesLogSheet,
        barangMasukSheet: sheetConfig?.barangMasukSheet || current.sheetConfig.barangMasukSheet,
        productStartRow: Number(sheetConfig?.productStartRow) || current.sheetConfig.productStartRow,
        salesLogStartRow: Number(sheetConfig?.salesLogStartRow) || current.sheetConfig.salesLogStartRow,
        barangMasukStartRow: Number(sheetConfig?.barangMasukStartRow) || current.sheetConfig.barangMasukStartRow,
      },
    };

    let testResult = null;
    if (newConfig.webAppUrl) {
      try {
        const testUrl = `${newConfig.webAppUrl}${newConfig.webAppUrl.includes('?') ? '&' : '?'}action=ping`;
        testResult = await callGas(testUrl, 'GET');
        newConfig.lastSynced = new Date().toISOString();
      } catch (err: any) {
        testResult = { success: false, message: 'Koneksi gagal: ' + err.message };
      }
    }

    saveGasConfig(newConfig);

    res.json({
      success: true,
      config: newConfig,
      testResult,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3b. Set Primary Web App URL (URL Utama Toko)
app.post('/api/gas/set-primary-url', (req, res) => {
  try {
    const { primaryWebAppUrl } = req.body;
    if (!primaryWebAppUrl || !primaryWebAppUrl.trim()) {
      return res.status(400).json({ success: false, message: 'URL utama toko tidak boleh kosong.' });
    }

    const current = loadGasConfig();
    const cleanUrl = primaryWebAppUrl.trim();
    current.primaryWebAppUrl = cleanUrl;
    
    // Also update active webAppUrl if empty or requested
    if (!current.webAppUrl) {
      current.webAppUrl = cleanUrl;
    }

    saveGasConfig(current);

    res.json({
      success: true,
      message: 'URL Utama Toko berhasil diubah dan disimpan permanen.',
      primaryWebAppUrl: current.primaryWebAppUrl,
      webAppUrl: current.webAppUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Test connection & Diagnose Sheets
app.post('/api/gas/test', async (req, res) => {
  try {
    const { webAppUrl } = req.body;
    const targetUrl = (webAppUrl || loadGasConfig().webAppUrl || '').trim();

    if (!targetUrl) {
      return res.status(400).json({ success: false, message: 'URL Web App tidak boleh kosong.' });
    }

    const testUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=diagnose`;
    const response = await callGas(testUrl, 'GET');

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Fetch ALL live data from Google Sheets (Products, Today's Transactions, Sales Log, Summary)
app.get('/api/gas/fetch-all', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi. Masukkan URL Web App terlebih dahulu.',
      });
    }

    // Call getAllData endpoint
    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=getAllData`;
    const data = await callGas(fetchUrl, 'GET');

    if (data.success) {
      config.lastSynced = new Date().toISOString();
      saveGasConfig(config);
      try {
        fs.writeFileSync(MEMORIZED_CACHE_FILE, JSON.stringify(data), 'utf-8');
      } catch (err) {
        console.error('Error saving memorized cache:', err);
      }
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5b. Get Server Memorized Cache Snapshot
app.get('/api/gas/memorized-cache', (req, res) => {
  try {
    if (fs.existsSync(MEMORIZED_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORIZED_CACHE_FILE, 'utf-8'));
      return res.json({ success: true, data });
    }
  } catch (err: any) {
    console.warn('Error reading memorized cache:', err);
  }
  res.json({ success: false, message: 'Belum ada cache tersimpan di server.' });
});

// 6. Save Transaction to Google Sheets
app.post('/api/gas/transaction', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi. Transaksi disimpan lokal.',
      });
    }

    const transaction = req.body;
    // PENTING: Untuk penulisan di Google Sheets (sheet LOG_PENJUALAN), pastikan produk fisik menggunakan harga biasa (bukan harga merah) dan item PROMO dicatat dengan benar (dengan Qty & nominal potongan)
    if (transaction && transaction.items && Array.isArray(transaction.items)) {
      transaction.items = transaction.items.map((it: any) => {
        const skuStr = String(it.sku || '').toUpperCase();
        const nameStr = String(it.name || '').toUpperCase();
        const isPromo = skuStr.includes('PROMO') || nameStr.includes('PROMO') || Number(it.price) < 0 || String(it.category || '').toUpperCase().includes('PROMO');

        const qty = Number(it.qty) || 1;
        if (isPromo) {
          const promoUnit = -Math.abs(Number(it.price) || (Number(it.subtotal) / qty) || 5000);
          return {
            ...it,
            sku: it.sku || 'PROMO 5RB',
            name: it.name || 'PROMO 5RB',
            price: promoUnit,
            regularPrice: promoUnit,
            qty: qty,
            total: promoUnit * qty,
            subtotal: promoUnit * qty,
            margin: promoUnit * qty,
            cost: 0,
          };
        }

        const regularPrice = Number(it.regularPrice !== undefined ? it.regularPrice : it.price) || 0;
        const cost = Number(it.cost) || 0;
        return {
          ...it,
          price: regularPrice,
          total: regularPrice * qty,
          subtotal: regularPrice * qty,
          margin: (regularPrice - cost) * qty,
        };
      });

      const regularItems = transaction.items.filter((it: any) => {
        const skuStr = String(it.sku || '').toUpperCase();
        const nameStr = String(it.name || '').toUpperCase();
        return !skuStr.includes('PROMO') && !nameStr.includes('PROMO') && Number(it.price) >= 0;
      });
      const promoItems = transaction.items.filter((it: any) => {
        const skuStr = String(it.sku || '').toUpperCase();
        const nameStr = String(it.name || '').toUpperCase();
        return skuStr.includes('PROMO') || nameStr.includes('PROMO') || Number(it.price) < 0;
      });

      const subtotal = regularItems.reduce((sum: number, it: any) => sum + (it.total || 0), 0);
      transaction.subtotal = subtotal;

      const promoTotalDiscount = Math.abs(promoItems.reduce((sum: number, it: any) => sum + (it.total || 0), 0));
      const discountVal = (Number(transaction.discount) || 0);
      const effectiveDiscount = Math.max(discountVal, promoTotalDiscount);

      // Catatan: Ongkir cukup dicatat di website (keuangan/kas atau sheet LAIN-LAIN) dan jangan dimasukkan ke kolom penjualan
      transaction.total = Math.max(0, subtotal - effectiveDiscount);
      transaction.margin = Math.max(0, regularItems.reduce((sum: number, it: any) => sum + (it.margin || 0), 0) - effectiveDiscount);
    }

    const response = await callGas(url, 'POST', {
      action: 'saveTransaction',
      transaction,
    });

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Update / Restock Product in Google Sheets
app.post('/api/gas/update-stock', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi.',
      });
    }

    const { sku, delta, reason } = req.body;
    const response = await callGas(url, 'POST', {
      action: 'updateStock',
      sku,
      delta,
      reason,
    });

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. Record Barang Masuk to LOG_BARANG_MASUK (B4:H)
app.post('/api/gas/barang-masuk', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi. Disimpan lokal.',
      });
    }

    const entry = req.body;
    const response = await callGas(url, 'POST', {
      action: 'recordBarangMasuk',
      entry,
    });

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. Void & Delete Transaction in Google Sheets (Multi-Candidate Matcher)
function buildVoidIdCandidates(rawId: unknown, rowNumber?: unknown): string[] {
  const candidates: string[] = [];
  const add = (value: unknown) => {
    const v = String(value ?? '').trim();
    if (v && !candidates.includes(v)) candidates.push(v);
  };

  const id = String(rawId ?? '').trim();
  add(id);
  add(id.replace(/^#/, '').trim());

  // Script v3.2 hanya menandai baris jadi "VOIDED-<id>" di kolom M (baris tidak
  // terhapus). Supaya baris yang sudah bertanda itu tetap bisa dibersihkan oleh
  // script v3.4/v3.5, coba juga bentuk tanpa/dengan awalan VOIDED-.
  const bare = id.replace(/^#/, '').trim();
  if (/^voided-/i.test(bare)) {
    add(bare.replace(/^voided-/i, '').trim());
  } else if (bare) {
    add(`VOIDED-${bare}`);
  }

  // ID tanpa transaksi di sheet berformat NOID-2026-10-09-1241; angka terakhir
  // adalah nomor baris di LOG_PENJUALAN, jadi coba juga format ROW-1241.
  const noid = /^(?:NOID|ROW)[-_].*?(\d+)$/i.exec(id.replace(/^#/, '').trim());
  if (noid) add(`ROW-${noid[1]}`);

  const explicitRow = Number(rowNumber);
  if (Number.isFinite(explicitRow) && explicitRow > 0) add(`ROW-${explicitRow}`);

  return candidates;
}

function countDeletedRows(response: any): number {
  if (!response) return 0;
  const raw = response.matchedRows ?? response.totalDeleted ?? response.deletedSalesRows ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function voidTransactionOnGas(url: string, targetId: unknown, reason: string, rowNumber?: unknown) {
  const candidates = buildVoidIdCandidates(targetId, rowNumber);
  const attempted: Array<{ transactionId: string; success: boolean; deletedRows: number; message?: string }> = [];
  let lastResponse: any = null;

  for (const candidate of candidates) {
    try {
      const response = await callGas(url, 'POST', {
        action: 'voidTransaction',
        transactionId: candidate,
        reason,
      });
      lastResponse = response;
      const deleted = countDeletedRows(response);
      attempted.push({
        transactionId: candidate,
        success: response?.success === true,
        deletedRows: deleted,
        message: response?.message,
      });

      console.log(`[void] id="${candidate}" -> success=${response?.success} deleted=${deleted} msg="${response?.message ?? ''}"`);
      if (response?.success === true && deleted > 0) break;

      // Kalau action voidTransaction tidak dikenal sama sekali, varian lain juga tidak akan dikenal.
      if (String(response?.message || '').includes('Unknown POST action')) break;
    } catch (err: any) {
      attempted.push({ transactionId: candidate, success: false, deletedRows: 0, message: err?.message });
      console.warn(`[void] id="${candidate}" gagal: ${err?.message}`);
    }
  }

  // Fallback untuk Apps Script versi lama yang hanya punya deleteTransaction.
  if (lastResponse && String(lastResponse.message || '').includes('Unknown POST action')) {
    const first = candidates[0];
    lastResponse = await callGas(url, 'POST', {
      action: 'deleteTransaction',
      transactionId: first,
      reason,
    });
    attempted.push({
      transactionId: `deleteTransaction:${first}`,
      success: lastResponse?.success === true,
      deletedRows: countDeletedRows(lastResponse),
      message: lastResponse?.message,
    });
  }

  const deletedRows = countDeletedRows(lastResponse);
  const isAlreadyDeleted = String(lastResponse?.message || '').toLowerCase().includes('tidak ditemukan') ||
                           String(lastResponse?.message || '').toLowerCase().includes('sudah terhapus');

  return {
    ...(lastResponse || { success: false, message: 'Tidak ada jawaban dari Google Apps Script.' }),
    success: (lastResponse?.success === true && deletedRows > 0) || isAlreadyDeleted,
    deletedRows,
    alreadyDeletedOnSheet: isAlreadyDeleted,
    attemptedIds: attempted,
  };
}

function purgeTransactionFromMemorizedCache(targetId: unknown) {
  try {
    if (!fs.existsSync(MEMORIZED_CACHE_FILE)) return;
    const raw = fs.readFileSync(MEMORIZED_CACHE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const idToPurge = String(targetId || '').trim().toUpperCase();
    const bare = idToPurge.replace(/^#/, '').replace(/^VOIDED-/, '');

    const matchesId = (idStr: unknown) => {
      const cur = String(idStr || '').trim().toUpperCase();
      const curBare = cur.replace(/^#/, '').replace(/^VOIDED-/, '');
      return cur === idToPurge || curBare === bare || (bare.length >= 4 && cur.includes(bare));
    };

    let modified = false;
    if (Array.isArray(data.salesHistory)) {
      const prevLen = data.salesHistory.length;
      data.salesHistory = data.salesHistory.filter((t: any) => !matchesId(t.id));
      if (data.salesHistory.length !== prevLen) modified = true;
    }
    if (Array.isArray(data.todayTransactions)) {
      const prevLen = data.todayTransactions.length;
      data.todayTransactions = data.todayTransactions.filter((t: any) => !matchesId(t.id));
      if (data.todayTransactions.length !== prevLen) modified = true;
    }
    if (Array.isArray(data.transactions)) {
      const prevLen = data.transactions.length;
      data.transactions = data.transactions.filter((t: any) => !matchesId(t.id));
      if (data.transactions.length !== prevLen) modified = true;
    }

    if (modified) {
      fs.writeFileSync(MEMORIZED_CACHE_FILE, JSON.stringify(data), 'utf-8');
      console.log(`[cache] Successfully purged transaction "${targetId}" from memorized cache.`);
    }
  } catch (err) {
    console.warn('[cache] Error purging from memorized cache:', err);
  }
}

// 9. Void Transaction in Google Sheets
app.post('/api/gas/void', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi.',
      });
    }

    const { transactionId, id, trxId, reason, rowNumber } = req.body;
    const targetId = transactionId || id || trxId;

    const result = await voidTransactionOnGas(url, targetId, reason || 'Dibatalkan oleh kasir', rowNumber);
    purgeTransactionFromMemorizedCache(targetId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9b. Delete Transaction from Google Sheets
app.post('/api/gas/delete-transaction', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi.',
      });
    }

    const { transactionId, id, trxId, reason, rowNumber } = req.body;
    const targetId = transactionId || id || trxId;

    // Pakai jalur multi-kandidat yang sama supaya penghapusan benar-benar terjadi
    const result = await voidTransactionOnGas(url, targetId, reason || 'Dihapus permanen', rowNumber);
    purgeTransactionFromMemorizedCache(targetId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9c. Test Write & Delete in LOG_PENJUALAN
app.post('/api/gas/test-write-delete', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = (req.body?.webAppUrl || config.webAppUrl || '').trim();

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi.',
      });
    }

    // 1. Try built-in Apps Script action first
    try {
      const scriptDirectRes = await callGas(url, 'POST', { action: 'testWriteDelete' });
      if (scriptDirectRes && scriptDirectRes.success) {
        return res.json(scriptDirectRes);
      }
    } catch {
      // Fallback to manual write + delete sequence
    }

    const testId = `TEST-POS-${Date.now()}`;
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const dateFormatted = `${d}/${m}/${y}`;

    const testTrx = {
      id: testId,
      date: dateFormatted,
      transactionDate: `${dateFormatted} ${now.toLocaleTimeString('id-ID')}`,
      customerName: 'Sistem Tes POS (Otomatis)',
      paymentMethod: 'CASH',
      items: [
        {
          sku: 'TES-VERIFIKASI',
          name: 'Verifikasi Tulis Hapus LOG_PENJUALAN',
          price: 1000,
          regularPrice: 1000,
          qty: 1,
          total: 1000,
          margin: 500,
        },
      ],
      subtotal: 1000,
      total: 1000,
      margin: 500,
    };

    // Step 1: Write
    const writeRes = await callGas(url, 'POST', {
      action: 'saveTransaction',
      transaction: testTrx,
    });

    if (!writeRes || !writeRes.success) {
      return res.json({
        success: false,
        stage: 'WRITE',
        message: 'Gagal menulis ke LOG_PENJUALAN: ' + (writeRes?.message || 'Koneksi error'),
        writeRes,
      });
    }

    // Step 2: Delete
    let deleteRes;
    try {
      deleteRes = await callGas(url, 'POST', {
        action: 'deleteTransaction',
        transactionId: testId,
        reason: 'Verifikasi otomatis sistem',
      });
      if (deleteRes && !deleteRes.success && deleteRes.message?.includes('Unknown POST action')) {
        deleteRes = await callGas(url, 'POST', {
          action: 'voidTransaction',
          transactionId: testId,
          reason: 'Verifikasi otomatis sistem',
        });
      }
    } catch {
      deleteRes = await callGas(url, 'POST', {
        action: 'voidTransaction',
        transactionId: testId,
        reason: 'Verifikasi otomatis sistem',
      });
    }

    res.json({
      success: true,
      message: 'Uji coba Tulis dan Hapus di LOG_PENJUALAN berhasil 100%!',
      testId,
      writeResult: writeRes,
      deleteResult: deleteRes,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. Auto Fill Categories in Google Sheets Kolom J
app.post('/api/gas/fill-categories', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi.',
      });
    }

    const fillUrl = `${url}${url.includes('?') ? '&' : '?'}action=fillCategories`;
    const response = await callGas(fillUrl, 'GET');
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10b. Clean Duplicates in Google Sheets
app.post('/api/gas/clean-duplicates', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi.',
      });
    }

    const response = await callGas(url, 'POST', { action: 'cleanDuplicates' });
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. Fetch Pengeluaran Lain from sheet LAIN-LAIN
app.get('/api/gas/pengeluaran-lain', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi.',
      });
    }

    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=getPengeluaranLain`;
    const response = await callGas(fetchUrl, 'GET');
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 12. Record Pengeluaran Lain to sheet LAIN-LAIN (A4:F)
app.post('/api/gas/pengeluaran-lain', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi. Disimpan lokal.',
      });
    }

    const entry = req.body || {};
    const desc = String(entry.description || '').toUpperCase();
    const isIncome = entry.type === 'INCOME' || entry.isIncome === true || desc.includes('ONGKIR');
    entry.type = isIncome ? 'INCOME' : 'EXPENSE';
    entry.isIncome = isIncome;
    entry.isExpense = !isIncome;

    const response = await callGas(url, 'POST', {
      action: 'recordPengeluaranLain',
      entry,
    });

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13. Delete Pengeluaran Lain row in sheet LAIN-LAIN
app.post('/api/gas/pengeluaran-lain/delete', async (req, res) => {
  try {
    const config = loadGasConfig();
    const url = config.webAppUrl;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi.',
      });
    }

    const { rowNumber } = req.body;
    const response = await callGas(url, 'POST', {
      action: 'deletePengeluaranLain',
      rowNumber,
    });

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
 * 14. AI COPILOT KASIR (GEMINI 3.8 FLASH + FUNCTION CALLING)
 * ============================================================ */

function findBestProduct(products: any[], query: string) {
  if (!query || !Array.isArray(products)) return null;
  const q = String(query).trim().toLowerCase();
  const exactSku = products.find((p) => String(p.sku || '').toLowerCase() === q);
  if (exactSku) return exactSku;
  const exactName = products.find((p) => String(p.name || '').toLowerCase() === q);
  if (exactName) return exactName;
  const partial = products.find((p) =>
    String(p.sku || '').toLowerCase().includes(q) ||
    String(p.name || '').toLowerCase().includes(q)
  );
  if (partial) return partial;
  const words = q.split(/\s+/).filter(Boolean);
  return products.find((p) => {
    const combined = `${p.sku || ''} ${p.name || ''}`.toLowerCase();
    return words.every((w) => combined.includes(w));
  }) || null;
}

const aiTools: FunctionDeclaration[] = [
  {
    name: 'check_or_search_products',
    description: 'Mencari atau memeriksa daftar produk minuman, harga biasa, harga merah reseller, dan sisa stok di ORTUKILL POS.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Kata kunci nama produk atau SKU (misal: "amer", "anggur", "kawa", "topi miring")',
        },
        onlyLowStock: {
          type: Type.BOOLEAN,
          description: 'Jika true, hanya tampilkan produk yang stoknya menipis (di bawah 10 botol)',
        },
      },
    },
  },
  {
    name: 'add_stock',
    description: 'Menambah stok produk minuman (restock / barang masuk) ke sistem kasir dan mencatatnya ke Google Sheets LOG_BARANG_MASUK.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        sku_or_name: {
          type: Type.STRING,
          description: 'SKU atau nama produk yang ingin ditambah stoknya',
        },
        quantity: {
          type: Type.NUMBER,
          description: 'Jumlah botol yang ditambahkan (angka bulat positif, misal: 12, 24)',
        },
        reason: {
          type: Type.STRING,
          description: 'Keterangan restock (misal: "Restock gudang", "Barang masuk supplier")',
        },
        supplier: {
          type: Type.STRING,
          description: 'Nama supplier / pemasok (opsional)',
        },
      },
      required: ['sku_or_name', 'quantity'],
    },
  },
  {
    name: 'create_sale_receipt',
    description: 'Membuat struk nota penjualan kasir (POS), memotong stok produk, menghitung total bayar (termasuk promo jika ada), dan mencatat transaksi ke Google Sheets.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          description: 'Daftar produk minuman yang dibeli pelanggan',
          items: {
            type: Type.OBJECT,
            properties: {
              sku_or_name: { type: Type.STRING, description: 'Nama atau SKU produk' },
              quantity: { type: Type.NUMBER, description: 'Jumlah botol (default 1)' },
              is_red_price: { type: Type.BOOLEAN, description: 'True jika pembeli reseller / menggunakan harga merah' },
            },
            required: ['sku_or_name'],
          },
        },
        payment_method: {
          type: Type.STRING,
          description: 'Metode pembayaran: CASH, QRIS, atau TRANSFER (default: CASH)',
        },
        customer_name: {
          type: Type.STRING,
          description: 'Nama pembeli / pelanggan (opsional)',
        },
        customer_phone: {
          type: Type.STRING,
          description: 'Nomor WhatsApp / telepon pembeli (opsional)',
        },
        promo_code: {
          type: Type.STRING,
          description: 'Kode promo jika ada (misal: "PROMO 5RB")',
        },
        promo_quantity: {
          type: Type.NUMBER,
          description: 'Jumlah voucher promo yang dipakai (default 1)',
        },
        shipping_fee: {
          type: Type.NUMBER,
          description: 'Biaya ongkos kirim jika delivery (masuk ke sheet LAIN-LAIN)',
        },
        cash_received: {
          type: Type.NUMBER,
          description: 'Nominal uang tunai yang diserahkan pembeli jika bayar CASH',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'get_sales_today',
    description: 'Melihat ringkasan penjualan & omset hari ini (total omset, keuntungan margin, jumlah botol terjual, breakdown metode bayar CASH/QRIS/TRANSFER, dan daftar struk terakhir).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'record_expense',
    description: 'Mencatat pengeluaran operasional atau pemasukan lain-lain ke sheet LAIN-LAIN (misal beli es batu, kantong plastik, bensin kurir).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description: 'Keterangan pengeluaran (misal: "Beli es batu kristal", "Beli plastik kresek", "Bensin operasional")',
        },
        amount: {
          type: Type.NUMBER,
          description: 'Nominal uang dalam rupiah',
        },
        payment_method: {
          type: Type.STRING,
          description: 'Metode bayar yang dipakai: CASH, BCA, JAGO, GOPAY (default: CASH)',
        },
        type: {
          type: Type.STRING,
          description: 'EXPENSE (pengeluaran) atau INCOME (pemasukan)',
        },
      },
      required: ['description', 'amount'],
    },
  },
  {
    name: 'void_receipt',
    description: 'Membatalkan / void nota transaksi struk kasir jika salah input, dan mengembalikan stok produk yang dibatalkan.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transaction_id: {
          type: Type.STRING,
          description: 'Nomor transaksi struk yang dibatalkan (misal: TRX-20261019-143000-123 atau #1)',
        },
        reason: {
          type: Type.STRING,
          description: 'Alasan pembatalan',
        },
      },
      required: ['transaction_id'],
    },
  },
];

app.post('/api/ai/copilot', async (req, res) => {
  try {
    const { message, history, context } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Pesan kasir tidak boleh kosong.' });
    }

    const config = loadGasConfig();
    const url = config.webAppUrl;

    // Load memorized cache as fallback context
    let cachedData: any = null;
    try {
      if (fs.existsSync(MEMORIZED_CACHE_FILE)) {
        cachedData = JSON.parse(fs.readFileSync(MEMORIZED_CACHE_FILE, 'utf-8'));
      }
    } catch {}

    const products = Array.isArray(context?.products) && context.products.length > 0
      ? context.products
      : (cachedData?.products || []);

    const todayTransactions = Array.isArray(context?.todayTransactions)
      ? context.todayTransactions
      : (cachedData?.todayTransactions || []);

    const executedActions: Array<{ type: string; payload: any; result: any }> = [];

    // Local Tool Executor
    const executeLocalTool = async (name: string, args: any): Promise<any> => {
      if (name === 'check_or_search_products') {
        const q = String(args.query || '').trim().toLowerCase();
        let list = products;
        if (args.onlyLowStock) {
          list = list.filter((p: any) => (Number(p.stock) || 0) <= 10);
        }
        if (q) {
          list = list.filter((p: any) =>
            String(p.sku || '').toLowerCase().includes(q) ||
            String(p.name || '').toLowerCase().includes(q)
          );
        }
        const sample = list.slice(0, 8).map((p: any) => ({
          sku: p.sku,
          name: p.name,
          stock: p.stock,
          price: p.price,
          redPrice: p.redPrice || p.price,
          category: p.category,
        }));
        return {
          totalFound: list.length,
          products: sample,
          message: list.length > 0
            ? `Ditemukan ${list.length} produk.`
            : `Tidak ditemukan produk dengan kata kunci "${q}".`,
        };
      }

      if (name === 'add_stock') {
        const prod = findBestProduct(products, args.sku_or_name);
        if (!prod) {
          return { success: false, message: `Produk "${args.sku_or_name}" tidak ditemukan di database produk.` };
        }
        const delta = Math.max(1, Math.round(Number(args.quantity) || 1));
        const oldStock = Number(prod.stock) || 0;
        const newStock = oldStock + delta;
        prod.stock = newStock;

        const reason = args.reason || 'Restock via AI Copilot';
        const supplier = args.supplier || 'Supplier Pusat';

        // Background sync to Google Sheets if connected
        if (url) {
          callGas(url, 'POST', {
            action: 'recordBarangMasuk',
            entry: {
              sku: prod.sku,
              name: prod.name,
              qty: delta,
              supplier,
              notes: reason,
            },
          }).catch(() => {});
          callGas(url, 'POST', {
            action: 'updateStock',
            sku: prod.sku,
            delta,
            reason,
          }).catch(() => {});
        }

        const action = {
          type: 'ADD_STOCK',
          payload: {
            productId: prod.id || prod.sku,
            sku: prod.sku,
            name: prod.name,
            addedQty: delta,
            oldStock,
            newStock,
            reason,
          },
          result: { success: true },
        };
        executedActions.push(action);

        return {
          success: true,
          sku: prod.sku,
          name: prod.name,
          addedQty: delta,
          oldStock,
          newStock,
          message: `Stok ${prod.name} (${prod.sku}) berhasil ditambah +${delta} botol. Stok sekarang: ${newStock} botol.`,
        };
      }

      if (name === 'create_sale_receipt') {
        const itemsArg = Array.isArray(args.items) ? args.items : [];
        if (itemsArg.length === 0) {
          return { success: false, message: 'Daftar item belanja tidak boleh kosong.' };
        }

        const receiptItems: any[] = [];
        let grossSubtotal = 0;
        let totalQty = 0;

        for (const it of itemsArg) {
          const prod = findBestProduct(products, it.sku_or_name);
          if (!prod) {
            return { success: false, message: `Produk "${it.sku_or_name}" tidak ditemukan.` };
          }
          const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
          const isRed = Boolean(it.is_red_price);
          const regularPrice = Number(prod.price) || 0;
          const redPrice = Number(prod.redPrice) || regularPrice;
          const unitPrice = isRed ? redPrice : regularPrice;
          const itemTotal = unitPrice * qty;
          const cost = Number(prod.cost) || 0;
          const itemMargin = (unitPrice - cost) * qty;

          receiptItems.push({
            productId: prod.id || prod.sku,
            sku: prod.sku,
            name: prod.name,
            qty,
            price: unitPrice,
            regularPrice,
            redPrice,
            cost,
            subtotal: itemTotal,
            total: itemTotal,
            margin: itemMargin,
            isRedPrice: isRed,
          });

          grossSubtotal += itemTotal;
          totalQty += qty;
        }

        // Handle Promo
        let promoDiscount = 0;
        let promoSkuFinal: string | undefined = undefined;
        let promoNameFinal: string | undefined = undefined;
        if (args.promo_code) {
          const promoQty = Math.max(1, Math.round(Number(args.promo_quantity) || 1));
          const promoVal = 5000; // Standar PROMO 5RB
          promoSkuFinal = String(args.promo_code).trim().toUpperCase();
          promoNameFinal = promoSkuFinal === 'PROMO 5RB' ? 'PROMO 5RB' : `PROMO: ${promoSkuFinal}`;
          promoDiscount = promoVal * promoQty;

          receiptItems.push({
            productId: 'promo-5rb',
            sku: promoSkuFinal,
            name: promoNameFinal,
            qty: promoQty,
            price: -promoVal,
            regularPrice: -promoVal,
            cost: 0,
            subtotal: -promoDiscount,
            total: -promoDiscount,
            margin: -promoDiscount,
          });
        }

        const shipping = Number(args.shipping_fee) || 0;
        const finalTotal = Math.max(0, grossSubtotal - promoDiscount + shipping);
        const cashRec = args.payment_method === 'CASH'
          ? Math.max(finalTotal, Number(args.cash_received) || finalTotal)
          : undefined;

        const now = new Date();
        const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const ymdCompact = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const timeCompact = timeFormatted.replace(/[^0-9]/g, '');
        const random = Math.floor(100 + Math.random() * 900);
        const generatedId = `TRX-${ymdCompact}-${timeCompact}-${random}`;

        const newReceipt = {
          id: generatedId,
          date: dateFormatted,
          transactionDate: `${dateFormatted} ${timeFormatted}`,
          websiteTime: timeFormatted,
          createdAt: now.getTime(),
          customerName: args.customer_name || 'Pelanggan',
          customerPhone: args.customer_phone || '',
          paymentMethod: args.payment_method || 'CASH',
          promoCode: promoSkuFinal,
          promoName: promoNameFinal,
          items: receiptItems,
          subtotal: grossSubtotal,
          discount: promoDiscount,
          shippingFee: shipping > 0 ? shipping : undefined,
          total: finalTotal,
          margin: receiptItems.reduce((sum, i) => sum + i.margin, 0),
          totalQty,
          cashReceived: cashRec,
          cashChange: cashRec ? Math.max(0, cashRec - finalTotal) : undefined,
          cashier: context?.cashierName || 'Kasir AI',
          status: 'COMPLETED',
        };

        // Sync to Google Sheets if connected
        if (url) {
          callGas(url, 'POST', {
            action: 'saveTransaction',
            transaction: newReceipt,
          }).catch(() => {});
        }

        const action = {
          type: 'CREATE_SALE_RECEIPT',
          payload: { receipt: newReceipt },
          result: { success: true },
        };
        executedActions.push(action);

        return {
          success: true,
          transactionId: newReceipt.id,
          total: newReceipt.total,
          itemsCount: newReceipt.items.length,
          paymentMethod: newReceipt.paymentMethod,
          customerName: newReceipt.customerName,
          receipt: newReceipt,
          message: `Struk #${newReceipt.id} berhasil dibuat dengan total Rp ${finalTotal.toLocaleString('id-ID')}.`,
        };
      }

      if (name === 'get_sales_today') {
        const totalOmset = todayTransactions.reduce((sum: number, t: any) => sum + (Number(t.total) || 0), 0);
        const totalMargin = todayTransactions.reduce((sum: number, t: any) => sum + (Number(t.margin) || 0), 0);
        const totalTransactions = todayTransactions.length;
        const totalBottles = todayTransactions.reduce((sum: number, t: any) => sum + (Number(t.totalQty) || 0), 0);

        let filteredBottles = 0;
        todayTransactions.forEach((t: any) => {
          if (t.status === 'VOIDED') return;
          if (Array.isArray(t.items)) {
            t.items.forEach((item: any) => {
              const sku = String(item.sku || '').toUpperCase();
              const itemName = String(item.name || '').toUpperCase();
              const cat = String(item.category || '').toUpperCase();
              const isPromo = sku.includes('PROMO') || itemName.includes('PROMO') || itemName.includes('POTONGAN') || itemName.includes('DISKON') || itemName.includes('VOUCHER') || cat === 'PROMO' || Number(item.price) < 0;
              const isBeer = cat === 'BIR' || cat === 'BEER' || /^(PL-|BP-|SK5-|PALM-|PAL-|KDS-|SAJM-|SA-OT-|S-OT-)/.test(sku) || itemName.includes('BIR') || itemName.includes('BEER') || itemName.includes('PROST') || itemName.includes('BINTANG') || itemName.includes('SINGARAJA') || itemName.includes('PILSENER') || itemName.includes('STOUT') || itemName.includes('ALSTER') || itemName.includes('KONIG') || itemName.includes('HEINEKEN') || itemName.includes('GUINNESS') || itemName.includes('ANKER') || itemName.includes('CARLSBERG') || itemName.includes('BALI HAI');
              const unitPrice = Number(item.price ?? item.regularPrice ?? item.originalPrice ?? 0);
              const isUnder30k = unitPrice < 30000;

              if (!isPromo && !isBeer && !isUnder30k) {
                filteredBottles += Number(item.qty) || 0;
              }
            });
          }
        });

        const breakdown = {
          CASH: todayTransactions.filter((t: any) => t.paymentMethod === 'CASH').reduce((sum: number, t: any) => sum + Number(t.total || 0), 0),
          QRIS: todayTransactions.filter((t: any) => t.paymentMethod === 'QRIS').reduce((sum: number, t: any) => sum + Number(t.total || 0), 0),
          TRANSFER: todayTransactions.filter((t: any) => t.paymentMethod === 'TRANSFER').reduce((sum: number, t: any) => sum + Number(t.total || 0), 0),
        };

        const action = {
          type: 'SALES_SUMMARY',
          payload: { totalOmset, totalMargin, totalTransactions, totalBottles, filteredBottles, breakdown },
          result: { success: true },
        };
        executedActions.push(action);

        return {
          success: true,
          totalOmset,
          totalMargin,
          totalTransactions,
          totalBottles,
          filteredBottles,
          breakdown,
        };
      }

      if (name === 'record_expense') {
        const amount = Math.abs(Number(args.amount) || 0);
        const desc = args.description || 'Pengeluaran Kasir';
        const pay = args.payment_method || 'CASH';
        const type = args.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

        const now = new Date();
        const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const record = {
          id: `FIN-${Date.now()}`,
          date: dateFormatted,
          description: desc,
          amount,
          paymentMethod: pay,
          type,
          category: 'OPERASIONAL',
          categoryLabel: type === 'EXPENSE' ? 'Pengeluaran Toko' : 'Pemasukan Lain',
          cashier: context?.cashierName || 'Kasir',
        };

        if (url) {
          callGas(url, 'POST', {
            action: 'recordPengeluaranLain',
            entry: record,
          }).catch(() => {});
        }

        const action = {
          type: 'RECORD_EXPENSE',
          payload: { record },
          result: { success: true },
        };
        executedActions.push(action);

        return {
          success: true,
          message: `${type === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan'} "${desc}" sebesar Rp ${amount.toLocaleString('id-ID')} berhasil dicatat.`,
        };
      }

      if (name === 'void_receipt') {
        const cleanId = String(args.transaction_id || '').trim();
        const reason = args.reason || 'Dibatalkan via AI Copilot';
        if (url) {
          callGas(url, 'POST', {
            action: 'voidTransaction',
            transactionId: cleanId,
            reason,
          }).catch(() => {});
        }

        const action = {
          type: 'VOID_RECEIPT',
          payload: { transactionId: cleanId, reason },
          result: { success: true },
        };
        executedActions.push(action);

        return {
          success: true,
          message: `Transaksi #${cleanId} berhasil dibatalkan.`,
        };
      }

      return { success: false, message: `Tool ${name} tidak diketahui.` };
    };

    const systemPrompt = `Kamu adalah AI Copilot Kasir resmi ORTUKILL (Orang Tua Keliling Kediri), asisten pintar yang ramah, gesit, dan akurat dalam membantu kasir mengoperasikan POS.

Kemampuan utamamu:
1. Menambah stok produk (restock / barang masuk) langsung ke sistem dan Google Sheets menggunakan function 'add_stock'.
2. Membuatkan struk nota transaksi penjualan kasir menggunakan 'create_sale_receipt' (mendukung harga biasa, harga reseller merah, potongan PROMO 5RB, dan metode bayar CASH/QRIS/TRANSFER).
3. Mengecek produk dan stok menipis menggunakan 'check_or_search_products'.
4. Melaporkan rekap omset dan keuntungan hari ini menggunakan 'get_sales_today'.
5. Mencatat biaya pengeluaran operasional menggunakan 'record_expense'.
6. Membatalkan struk penjualan menggunakan 'void_receipt'.

Jika kasir meminta menambah stok, buat struk, atau aksi kasir lainnya, PANGGIL FUNCTION YANG TEPAT!
Gunakan bahasa Indonesia yang santun, praktis, ramah khas kasir toko ORTUKILL. Ringkas dan sebutkan rincian hasil aksimu dengan jelas.`;

    // 1. Try with GoogleGenAI if GEMINI_API_KEY is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({});
        const contents: any[] = [];

        // Add history if present
        if (Array.isArray(history)) {
          for (const h of history.slice(-6)) {
            contents.push({
              role: h.role === 'model' ? 'model' : 'user',
              parts: [{ text: h.text }],
            });
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: message }],
        });

        const initialRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: aiTools }],
          },
        });

        const functionCalls = initialRes.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          const toolResponses: any[] = [];
          for (const call of functionCalls) {
            const toolResult = await executeLocalTool(call.name, call.args || {});
            toolResponses.push({
              name: call.name,
              response: { result: toolResult },
            });
          }

          // Follow-up generation with tool responses
          const candidateContent = initialRes.candidates?.[0]?.content;
          const followUpContents = [
            ...contents,
            candidateContent || { role: 'model', parts: [{ text: 'Menjalankan instruksi kasir...' }] },
            {
              role: 'tool',
              parts: toolResponses.map((tr) => ({
                functionResponse: tr,
              })),
            },
          ];

          const followUpRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: followUpContents,
            config: {
              systemInstruction: systemPrompt,
              tools: [{ functionDeclarations: aiTools }],
            },
          });

          return res.json({
            success: true,
            reply: followUpRes.text || 'Instruksi kasir telah berhasil dijalankan.',
            executedActions,
          });
        }

        return res.json({
          success: true,
          reply: initialRes.text || 'Halo! Saya AI Copilot Kasir ORTUKILL, ada yang bisa saya bantu untuk operasional kasir hari ini?',
          executedActions,
        });
      } catch (geminiErr: any) {
        console.warn('Gemini API call failed, falling back to smart rule engine:', geminiErr?.message);
      }
    }

    // 2. Intelligent Rule-Based Engine (Fallback when GEMINI_API_KEY is not set or network fails)
    const lower = message.toLowerCase();

    // Intent: Omset / Penjualan Hari Ini
    if (lower.includes('omset') || lower.includes('penjualan hari ini') || lower.includes('rekap') || lower.includes('laporan')) {
      const summary = await executeLocalTool('get_sales_today', {});
      return res.json({
        success: true,
        reply: `📊 **Laporan Penjualan Hari Ini**:\n- **Total Omset**: Rp ${(summary.totalOmset || 0).toLocaleString('id-ID')}\n- **Laba Margin**: Rp ${(summary.totalMargin || 0).toLocaleString('id-ID')}\n- **Jumlah Transaksi**: ${summary.totalTransactions || 0} struk (${summary.totalBottles || 0} botol terjual)\n- **Metode Bayar**: CASH Rp ${(summary.breakdown?.CASH || 0).toLocaleString('id-ID')} | QRIS Rp ${(summary.breakdown?.QRIS || 0).toLocaleString('id-ID')} | Transfer Rp ${(summary.breakdown?.TRANSFER || 0).toLocaleString('id-ID')}`,
        executedActions,
      });
    }

    // Intent: Cek Stok Menipis
    if (lower.includes('stok menipis') || lower.includes('habis') || lower.includes('sisa stok')) {
      const stockRes = await executeLocalTool('check_or_search_products', { onlyLowStock: true });
      const itemsText = stockRes.products.map((p: any) => `• **${p.name}** (${p.sku}): sisa **${p.stock} botol**`).join('\n');
      return res.json({
        success: true,
        reply: stockRes.totalFound > 0
          ? `⚠️ **Daftar Produk Stok Menipis (<= 10 botol)**:\n${itemsText}`
          : '✅ Semua stok produk dalam kondisi aman (tidak ada yang di bawah 10 botol).',
        executedActions,
      });
    }

    // Intent: Tambah Stok
    if (lower.includes('tambah stok') || lower.includes('tambah stock') || lower.includes('restock')) {
      const matchNum = lower.match(/(\d+)\s*(botol|pcs|krat|dus)?/);
      const qty = matchNum ? parseInt(matchNum[1], 10) : 10;
      let cleanQuery = lower
        .replace(/tambah stok/g, '')
        .replace(/tambah stock/g, '')
        .replace(/restock/g, '')
        .replace(/\d+\s*(botol|pcs|krat|dus)?/g, '')
        .replace(/sebanyak/g, '')
        .replace(/untuk/g, '')
        .trim();

      const prod = findBestProduct(products, cleanQuery);
      if (prod) {
        const result = await executeLocalTool('add_stock', {
          sku_or_name: prod.sku,
          quantity: qty,
          reason: 'Restock via AI Copilot',
        });
        return res.json({
          success: true,
          reply: `✅ **Stok Berhasil Ditambahkan**!\nProduk: **${prod.name}** (${prod.sku})\nJumlah Tambah: **+${qty} botol**\nStok Sekarang: **${result.newStock} botol**.\nPerubahan telah dicatat ke sistem & Google Sheets.`,
          executedActions,
        });
      }
    }

    // Intent: Buat Struk
    if (lower.includes('buat struk') || lower.includes('bikin struk') || lower.includes('buatkan struk') || lower.includes('struk')) {
      const matchNum = lower.match(/(\d+)\s*(botol|pcs)?/);
      const qty = matchNum ? parseInt(matchNum[1], 10) : 1;
      const isQris = lower.includes('qris');
      const isTransfer = lower.includes('transfer') || lower.includes('bca');
      const payMethod = isQris ? 'QRIS' : isTransfer ? 'TRANSFER' : 'CASH';

      // Find product
      let cleanQuery = lower
        .replace(/buat struk/g, '')
        .replace(/bikin struk/g, '')
        .replace(/buatkan struk/g, '')
        .replace(/bayar\s+(cash|qris|transfer|tunai)/g, '')
        .replace(/\d+\s*(botol|pcs)?/g, '')
        .trim();

      const prod = findBestProduct(products, cleanQuery) || products[0];
      if (prod) {
        const custMatch = lower.match(/pelanggan\s+([a-zA-Z0-9]+)/) || lower.match(/untuk\s+([a-zA-Z0-9]+)/);
        const custName = custMatch ? custMatch[1] : 'Pelanggan';

        const result = await executeLocalTool('create_sale_receipt', {
          items: [{ sku_or_name: prod.sku, quantity: qty }],
          payment_method: payMethod,
          customer_name: custName,
          promo_code: lower.includes('promo') ? 'PROMO 5RB' : undefined,
        });

        return res.json({
          success: true,
          reply: `🧾 **Struk Berhasil Dibuat**!\n- **No. Transaksi**: #${result.transactionId}\n- **Pelanggan**: ${result.customerName}\n- **Produk**: ${qty}x ${prod.name}\n- **Total**: Rp ${(result.total || 0).toLocaleString('id-ID')} (${payMethod})\n\nStruk telah tersimpan dan siap dicetak / dilihat.`,
          executedActions,
        });
      }
    }

    // Default conversational response
    return res.json({
      success: true,
      reply: 'Halo! Saya **AI Copilot Kasir ORTUKILL**. Saya bisa membantu Anda mengoperasikan kasir, contohnya:\n\n1. *"Tambah stok Anggur Merah 12 botol"*\n2. *"Buat struk: 2 Amer pelanggan Doni bayar Cash"*\n3. *"Cek produk yang stoknya menipis"*\n4. *"Berapa omset dan penjualan hari ini?"*\n5. *"Catat pengeluaran beli es batu Rp 20.000"*\n\nSilakan ketik atau gunakan tombol mikrofon untuk berbicara langsung!',
      executedActions,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
 * VITE / STATIC SERVING
 * ============================================================ */

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ORTUKILL POS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
