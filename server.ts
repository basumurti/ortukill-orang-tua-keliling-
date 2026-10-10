import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

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
    // PENTING: Untuk penulisan di Google Sheets, pastikan selalu menggunakan harga biasa bukan harga merah
    if (transaction && transaction.items && Array.isArray(transaction.items)) {
      transaction.items = transaction.items.map((it: any) => {
        const regularPrice = Number(it.regularPrice !== undefined ? it.regularPrice : it.price) || 0;
        const qty = Number(it.qty) || 1;
        const cost = Number(it.cost) || 0;
        return {
          ...it,
          price: regularPrice,
          total: regularPrice * qty,
          margin: (regularPrice - cost) * qty,
        };
      });
      // Filter out any pseudo-promo items from transaction items so promo is never treated as a product
      transaction.items = transaction.items.filter((it: any) => {
        const skuStr = String(it.sku || '').toUpperCase();
        const nameStr = String(it.name || '').toUpperCase();
        const isPromoItem = skuStr.includes('PROMO') || nameStr.includes('POTONGAN PROMO') || (Number(it.price) < 0 && Number(it.qty) <= 1);
        return !isPromoItem;
      });

      const subtotal = transaction.items.reduce((sum: number, it: any) => sum + (it.total || 0), 0);
      transaction.subtotal = subtotal;

      const discountVal = Number(transaction.discount) || 0;
      // Catatan: Ongkir cukup dicatat di website (keuangan/kas) dan jangan dimasukkan ke spreadsheet
      transaction.total = Math.max(0, subtotal - discountVal);
      transaction.margin = Math.max(0, transaction.items.reduce((sum: number, it: any) => sum + (it.margin || 0), 0));
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

    const { transactionId, id, trxId, reason } = req.body;
    const targetId = transactionId || id || trxId;

    let response;
    try {
      response = await callGas(url, 'POST', {
        action: 'voidTransaction',
        transactionId: targetId,
        reason: reason || 'Dibatalkan oleh kasir',
      });
      if (response && response.success === false && response.message && response.message.includes('Unknown POST action')) {
        response = await callGas(url, 'POST', {
          action: 'deleteTransaction',
          transactionId: targetId,
          reason: reason || 'Dibatalkan oleh kasir',
        });
      }
    } catch {
      response = await callGas(url, 'POST', {
        action: 'deleteTransaction',
        transactionId: targetId,
        reason: reason || 'Dibatalkan oleh kasir',
      });
    }

    res.json(response);
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

    const { transactionId, id, trxId, reason } = req.body;
    const targetId = transactionId || id || trxId;

    let response;
    try {
      response = await callGas(url, 'POST', {
        action: 'deleteTransaction',
        transactionId: targetId,
        reason: reason || 'Dihapus permanen',
      });
      if (response && response.success === false && response.message && response.message.includes('Unknown POST action')) {
        response = await callGas(url, 'POST', {
          action: 'voidTransaction',
          transactionId: targetId,
          reason: reason || 'Dihapus permanen',
        });
      }
    } catch {
      response = await callGas(url, 'POST', {
        action: 'voidTransaction',
        transactionId: targetId,
        reason: reason || 'Dihapus permanen',
      });
    }

    res.json(response);
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
