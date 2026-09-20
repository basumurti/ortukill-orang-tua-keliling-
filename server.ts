import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

const CONFIG_FILE = path.join(process.cwd(), 'gas_config.json');
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzvryS_rbLz7h8sliys8HuFmy8X-nu-o9kagpsUxgBhp8sjukunG3Lo_RlWIY1oiJjxrA/exec';

interface GasConfig {
  webAppUrl: string;
  sheetConfig: {
    productsSheet: string;
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
      if (!parsed.webAppUrl || !parsed.webAppUrl.trim()) {
        parsed.webAppUrl = process.env.GAS_WEBAPP_URL || DEFAULT_GAS_URL;
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading gas_config.json:', err);
  }
  return {
    webAppUrl: process.env.GAS_WEBAPP_URL || DEFAULT_GAS_URL,
    sheetConfig: {
      productsSheet: 'DASHBOARD_MUTASI_&_PROFIT',
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
    sheetConfig: config.sheetConfig,
    lastSynced: config.lastSynced || null,
  });
});

// 3. Save / Configure GAS Web App URL
app.post('/api/gas/configure', async (req, res) => {
  try {
    const { webAppUrl, sheetConfig } = req.body;
    const current = loadGasConfig();

    const newConfig: GasConfig = {
      webAppUrl: (webAppUrl || '').trim(),
      sheetConfig: {
        productsSheet: sheetConfig?.productsSheet || current.sheetConfig.productsSheet,
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
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
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
      const subtotal = transaction.items.reduce((sum: number, it: any) => sum + (it.total || 0), 0);
      transaction.subtotal = subtotal;

      // Pastikan baris potongan promo tercatat jika ada diskon
      const discountVal = Number(transaction.discount) || 0;
      if (discountVal > 0) {
        const hasPromoItem = transaction.items.some((it: any) => 
          String(it.sku || '').toUpperCase().includes('PROMO-') || 
          String(it.name || '').toUpperCase().includes('POTONGAN PROMO')
        );
        if (!hasPromoItem) {
          const promoSku = transaction.promoCode || 'PROMO-DISKON';
          const promoName = transaction.promoName ? `PROMO: ${transaction.promoName}` : 'POTONGAN PROMO / DISKON';
          transaction.items.push({
            productId: promoSku,
            sku: promoSku,
            name: promoName,
            price: -Math.abs(discountVal),
            regularPrice: -Math.abs(discountVal),
            qty: 1,
            total: -Math.abs(discountVal),
            subtotal: -Math.abs(discountVal),
            margin: -Math.abs(discountVal),
            cost: 0,
          });
        }
      }

      transaction.total = Math.max(0, subtotal - discountVal + (Number(transaction.shippingFee) || 0));
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

    const { transactionId, reason } = req.body;
    const response = await callGas(url, 'POST', {
      action: 'voidTransaction',
      transactionId,
      reason,
    });

    res.json(response);
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
