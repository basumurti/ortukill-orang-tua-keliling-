/**
 * Enhanced Google Apps Script Code Generator for ORTUKILL POS (V3.2 DEFINITIVE)
 * 
 * Sesuai kode Apps Script resmi pengguna:
 * 1. DASHBOARD_MUTASI_&_PROFIT (B70:J) -> MASTER PRODUK (READ-ONLY / REFERENSI)
 *    - B: SKU  C: Nama  D: Stok Akhir  E: Harga Jual
 *    - F: Harga Beli  G: Harga Merah  H: Total Aset  I: Extra  J: KATEGORI
 *    - ATURAN: Web App membaca data termasuk Kolom J (KATEGORI).
 * 
 * 2. LOG_PENJUALAN (B7:M, 12 Kolom) -> RIWAYAT PENJUALAN KASIR (WRITE)
 *    - B: Tanggal (dd/MM/yyyy)         G: Total Penjualan     L: No. HP
 *    - C: SKU                          H: Margin Keuntungan   M: nomor transaksi
 *    - D: Nama Produk                  I: Metode bayar
 *    - E: Harga Jual (HARGA BIASA)     J: (kosong)
 *    - F: Jumlah (Qty)                 K: Nama
 *    - ATURAN KHUSUS: Penulisan di Google Sheets selalu menggunakan HARGA BIASA, bukan harga jual merah!
 * 
 * 3. LOG_BARANG_MASUK (B4:H, 7 Kolom) -> LOG RESTOCK (WRITE)
 *    - B: Tanggal  C: SKU  D: Nama Produk  E: Qty/Krat
 *    - F: Kuantitas Masuk  G: Supplier  H: Total Biaya
 */

export function generateEnhancedGoogleAppsScriptCode(): string {
  return `/**
 * ============================================================
 * ORTUKILL POS - GOOGLE APPS SCRIPT WEB APP (V3.2 DEFINITIVE)
 * ============================================================
 * Database Google Sheets:
 *   1. DASHBOARD_MUTASI_&_PROFIT (B70:H) -> MASTER PRODUK (READ-ONLY / REFERENSI)
 *   2. LOG_PENJUALAN (B7:M)              -> Riwayat Penjualan Kasir (WRITE)
 *   3. LOG_BARANG_MASUK (B4:H)           -> Log Restock (WRITE)
 *
 * ATURAN PENTING:
 *   - DASHBOARD_MUTASI_&_PROFIT adalah SHEET REFERENSI.
 *     Web App HANYA BOLEH MEMBACA. TIDAK BOLEH menulis / mengubah stok di sini.
 *   - Semua perubahan data hanya boleh ditulis ke:
 *       * LOG_PENJUALAN
 *       * LOG_BARANG_MASUK
 *   - Penulisan di LOG_PENJUALAN (Kolom E) selalu menggunakan HARGA BIASA,
 *     bukan harga jual merah (reseller markup).
 *
 * STRUKTUR LOG_PENJUALAN (B:M, 12 kolom):
 *   B: Tanggal (dd/MM/yyyy)         G: Total Penjualan     L: No. HP
 *   C: SKU                          H: Margin Keuntungan   M: nomor transaksi
 *   D: Nama Produk                  I: Metode bayar
 *   E: Harga Jual (Harga Biasa)     J: (kosong)
 *   F: Jumlah (Qty)                 K: Nama
 *
 * STRUKTUR LOG_BARANG_MASUK (B:H, 7 kolom):
 *   B: Tanggal  C: SKU  D: Nama Produk  E: Qty/Krat
 *   F: Kuantitas Masuk  G: Supplier  H: Total Biaya
 *
 * STRUKTUR DASHBOARD_MUTASI_&_PROFIT (B70:J, master produk):
 *   B: SKU  C: Nama  D: Stok Akhir  E: Harga Jual
 *   F: Harga Beli  G: Harga Merah  H: Total Aset  I: Extra  J: KATEGORI
 * ============================================================
 */

const CONFIG = {
  SHEETS: {
    PRODUCTS: 'DASHBOARD_MUTASI_&_PROFIT',
    SALES_LOG: 'LOG_PENJUALAN',
    BARANG_MASUK: 'LOG_BARANG_MASUK',
    OLD_INPUT: 'INPUT_POS'
  },

  // Range 1: DASHBOARD_MUTASI_&_PROFIT B70:J (MASTER PRODUK)
  PRODUCT: {
    HEADER_ROW: 70,
    DATA_START_ROW: 71,
    START_COLUMN: 2,             // Kolom B
    NUM_COLUMNS: 9               // B..J (B=SKU, C=Nama, D=Stok, E=Harga Jual, F=Harga Beli, G=Harga Merah, H=Total Aset, I=Extra, J=KATEGORI)
  },

  // Range 2: LOG_PENJUALAN B7:M
  SALES_LOG: {
    HEADER_ROW: 7,
    DATA_START_ROW: 8,
    START_COLUMN: 2,
    NUM_COLUMNS: 12              // B..M
  },

  // Range 3: LOG_BARANG_MASUK B4:H
  BARANG_MASUK: {
    HEADER_ROW: 4,
    DATA_START_ROW: 5,
    START_COLUMN: 2,
    NUM_COLUMNS: 7               // B..H
  },

  BRAND: {
    NAME: 'ORTUKILL',
    SUBTITLE: 'POS / KASIR',
    DESCRIPTION_1: 'ORANG TUA KELILING KEDIRI',
    DESCRIPTION_2: 'MELAYANI SETIAP KEBUTUHAN MINUM KAMU',
    PHONE: '087779779796'
  }
};

/* ============================================================
 * ROUTER UTAMA: doGet & doPost
 * ============================================================ */

function doGet(e) {
  const param = e && e.parameter ? e.parameter : {};
  const action = param.action || 'diagnose';

  let result = {};
  try {
    if (action === 'ping') {
      result = { success: true, message: 'ORTUKILL POS GAS Online (v3.2)', timestamp: new Date().toISOString() };
    } else if (action === 'diagnose') {
      result = diagnoseSheets();
    } else if (action === 'getAllData') {
      result = getAllData();
    } else if (action === 'getProducts') {
      result = getProducts();
    } else if (action === 'getToday') {
      result = getTodayTransactions();
    } else if (action === 'getSummary') {
      result = getSalesSummary(param.startDate, param.endDate);
    } else if (action === 'getBarangMasuk') {
      result = getBarangMasukHistory();
    } else if (action === 'getConfig') {
      result = getAppConfig();
    } else if (action === 'fillCategories') {
      result = fillCategoriesColumnJ();
    } else {
      result = { success: false, message: 'Action tidak dikenal: ' + action };
    }
  } catch (err) {
    result = { success: false, message: 'Error: ' + err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result = {};
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || (e && e.parameter ? e.parameter.action : 'saveTransaction');

    if (action === 'saveTransaction') {
      result = saveTransaction(payload.transaction);
    } else if (action === 'recordBarangMasuk') {
      result = recordBarangMasuk(payload.entry);
    } else if (action === 'voidTransaction') {
      result = voidTransaction(payload.transactionId, payload.reason);
    } else if (action === 'fillCategories') {
      result = fillCategoriesColumnJ();
    } else if (action === 'updateStock') {
      // Ditolak secara sengaja: DASHBOARD bersifat referensi (read-only)
      result = {
        success: false,
        message: 'Ditolak: sheet DASHBOARD_MUTASI_&_PROFIT bersifat referensi (read-only). ' +
                 'Perubahan stok hanya boleh via LOG_PENJUALAN atau LOG_BARANG_MASUK.'
      };
    } else {
      result = { success: false, message: 'Unknown POST action: ' + action };
    }
  } catch (err) {
    result = { success: false, message: 'POST Error: ' + err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
 * PENGKATEGORIAN MENU OTOMATIS
 * ============================================================ */
function classifyProduct(sku, name) {
  const s = String(sku || '').trim().toUpperCase();
  const n = String(name || '').trim().toUpperCase();

  // 1. Promo / Diskon
  if (s.indexOf('PROMO') >= 0 || n.indexOf('PROMO') >= 0 || n.indexOf('DISKON') >= 0 || n.indexOf('POTONGAN') >= 0) {
    return 'PROMO';
  }

  // 2. Jamu / Herbal
  if (n.indexOf('BERAS KENCUR') >= 0 || s.indexOf('BK-') === 0) {
    return 'JAMU';
  }

  // 3. Soju
  if (
    s.indexOf('BSP-') === 0 ||
    s.indexOf('BSPM-') === 0 ||
    s.indexOf('BSL-') === 0 ||
    n.indexOf('SOJU') >= 0 ||
    n.indexOf('BAE') >= 0
  ) {
    return 'SOJU';
  }

  // 4. Whisky
  if (
    s.indexOf('DWR') === 0 ||
    s.indexOf('DB7-') === 0 ||
    s.indexOf('DS3-') === 0 ||
    s.indexOf('MDKW-') === 0 ||
    n.indexOf('WHISKY') >= 0 ||
    n.indexOf('DRUM') >= 0
  ) {
    return 'WHISKY';
  }

  // 5. Rum
  if (
    s.indexOf('CMS') === 0 ||
    n.indexOf('CAPTAIN MORGAN') >= 0 ||
    n.indexOf('RUM') >= 0
  ) {
    return 'RUM';
  }

  // 6. Vodka
  if (
    s.indexOf('IVM-') === 0 ||
    s.indexOf('IS3R-') === 0 ||
    s.indexOf('IB5-') === 0 ||
    s.indexOf('IX7-') === 0 ||
    s.indexOf('ITO7-') === 0 ||
    s.indexOf('ITL7-') === 0 ||
    s.indexOf('IVO2-') === 0 ||
    s.indexOf('IVL2-') === 0 ||
    s.indexOf('MDKV') === 0 ||
    s.indexOf('MDV-') === 0 ||
    s.indexOf('FB-') === 0 ||
    s.indexOf('FBK-') === 0 ||
    s.indexOf('NR-') === 0 ||
    s.indexOf('NPG-') === 0 ||
    s.indexOf('NPIT-') === 0 ||
    n.indexOf('ICELAND') >= 0 ||
    n.indexOf('VODKA') >= 0 ||
    n.indexOf('NEW PORT') >= 0 ||
    n.indexOf('NEWPORT') >= 0 ||
    n.indexOf('FRIENDSHIP') >= 0 ||
    n.indexOf('MC DONALD') >= 0
  ) {
    return 'VODKA';
  }

  // 7. Bir
  if (
    s.indexOf('PL-') === 0 ||
    s.indexOf('BP-') === 0 ||
    s.indexOf('SK5-') === 0 ||
    s.indexOf('PALM-') === 0 ||
    s.indexOf('PAL-') === 0 ||
    s.indexOf('KDS-') === 0 ||
    s.indexOf('SAJM-') === 0 ||
    s.indexOf('SA-OT-') === 0 ||
    s.indexOf('S-OT-') === 0 ||
    n.indexOf('PROST') >= 0 ||
    n.indexOf('BINTANG') >= 0 ||
    n.indexOf('PILSENER') >= 0 ||
    n.indexOf('STOUT') >= 0 ||
    n.indexOf('ALSTER') >= 0 ||
    n.indexOf('KONIG') >= 0 ||
    n.indexOf('SINGARAJA') >= 0
  ) {
    return 'BIR';
  }

  // 8. Anggur
  if (
    s.indexOf('AMG-') === 0 ||
    s.indexOf('AKKT-') === 0 ||
    s.indexOf('AP-') === 0 ||
    s.indexOf('AKH-') === 0 ||
    s.indexOf('IAG-') === 0 ||
    s.indexOf('AA-') === 0 ||
    s.indexOf('AABC-') === 0 ||
    s.indexOf('KKAM-') === 0 ||
    s.indexOf('KKAH-') === 0 ||
    s.indexOf('KKB-') === 0 ||
    s.indexOf('AAL-') === 0 ||
    s.indexOf('AARP-') === 0 ||
    s.indexOf('AAP-') === 0 ||
    s.indexOf('AAS-') === 0 ||
    s.indexOf('AL-A-') === 0 ||
    s.indexOf('AAH-') === 0 ||
    s.indexOf('AB-A-') === 0 ||
    n.indexOf('ANGGUR') >= 0 ||
    n.indexOf('KOLESOM') >= 0 ||
    n.indexOf('KETAN HITAM') >= 0 ||
    n.indexOf('INTISARI') >= 0 ||
    n.indexOf('KAWA KAWA') >= 0 ||
    n.indexOf('ATLAS') >= 0 ||
    n.indexOf('ALEXIS') >= 0
  ) {
    return 'ANGGUR';
  }

  return 'ANGGUR';
}

/* ============================================================
 * 1. AMBIL MASTER PRODUK (READ-ONLY)
 * ============================================================
 * Fungsi ini HANYA membaca DASHBOARD_MUTASI_&_PROFIT.
 * Tidak ada operasi tulis apapun ke sheet ini.
 * ============================================================ */
function getProducts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PRODUCTS);
  if (!sheet) {
    return { success: false, message: 'Sheet tidak ditemukan: ' + CONFIG.SHEETS.PRODUCTS };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.PRODUCT.DATA_START_ROW) {
    return { success: true, products: [], count: 0, message: 'Belum ada baris data produk.' };
  }

  const numRows = lastRow - CONFIG.PRODUCT.DATA_START_ROW + 1;
  // Membaca Kolom B sampai J (atau kolom terjauh yang ada)
  const numColumns = Math.max(CONFIG.PRODUCT.NUM_COLUMNS, sheet.getLastColumn() - CONFIG.PRODUCT.START_COLUMN + 1);
  const range = sheet.getRange(
    CONFIG.PRODUCT.DATA_START_ROW,
    CONFIG.PRODUCT.START_COLUMN,
    numRows,
    numColumns
  );
  const values = range.getValues();

  const products = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const currentRowNumber = CONFIG.PRODUCT.DATA_START_ROW + i;

    const sku = String(row[0] || '').trim();
    const name = String(row[1] || '').trim();

    if (!sku || !name || name.toUpperCase() === 'NAMA PRODUK' || sku.toUpperCase() === 'SKU/ID PRODUK') {
      continue;
    }

    const stock = Number(row[2]) || 0;             // D: Stok Akhir (hanya dibaca)
    const price = Number(row[3]) || 0;             // E: Harga Jual
    const cost = Number(row[4]) || 0;              // F: Harga Beli
    const redPrice = Number(row[5]) || price;      // G: Harga Merah (Make up price)
    const totalAsset = Number(row[6]) || (stock * cost); // H: Total Aset

    // Kolom J (index 8): KATEGORI PRODUK dari Google Sheets B70:J
    const rawCategory = row.length > 8 ? String(row[8] || '').trim() : '';
    // Jika diisi di Kolom J, gunakan kategori dari spreadsheet; jika belum, gunakan klasifikasi pintar
    const category = rawCategory || classifyProduct(sku, name);

    products.push({
      id: sku,
      sku: sku,
      name: name,
      stock: stock,
      price: price,
      cost: cost,
      purchasePrice: cost,
      redPrice: redPrice,
      totalAsset: totalAsset,
      category: category,
      minStockAlert: 5,
      rowNumber: currentRowNumber
    });
  }

  return {
    success: true,
    count: products.length,
    products: products,
    sheetName: CONFIG.SHEETS.PRODUCTS,
    readOnly: true,
    rangeRead: 'B' + CONFIG.PRODUCT.DATA_START_ROW + ':J' + lastRow
  };
}

/**
 * ============================================================
 * FUNGSI BANTUAN: ISI OTOMATIS KOLOM J DI DASHBOARD_MUTASI_&_PROFIT
 * ============================================================
 * Fungsi ini dapat dijalankan langsung di Apps Script (1-klik)
 * atau dipanggil dari web app via action=fillCategories.
 * Akan menulis Header 'KATEGORI' di cell J70 dan mengisi
 * seluruh kategori yang sesuai untuk setiap produk di baris 71+.
 * ============================================================
 */
function fillCategoriesColumnJ() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PRODUCTS);
  if (!sheet) {
    return { success: false, message: 'Sheet tidak ditemukan: ' + CONFIG.SHEETS.PRODUCTS };
  }

  // Tulis Header di Kolom J baris 70 (Kolom 10)
  sheet.getRange(CONFIG.PRODUCT.HEADER_ROW, 10).setValue('KATEGORI');

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.PRODUCT.DATA_START_ROW) {
    return { success: true, message: 'Belum ada data produk di baris 71+.' };
  }

  const numRows = lastRow - CONFIG.PRODUCT.DATA_START_ROW + 1;
  const prodData = sheet.getRange(CONFIG.PRODUCT.DATA_START_ROW, 2, numRows, 2).getValues(); // Kolom B & C
  const categoryValues = [];

  for (let i = 0; i < prodData.length; i++) {
    const sku = prodData[i][0];
    const name = prodData[i][1];
    if (!sku && !name) {
      categoryValues.push(['']);
    } else {
      categoryValues.push([classifyProduct(sku, name)]);
    }
  }

  sheet.getRange(CONFIG.PRODUCT.DATA_START_ROW, 10, numRows, 1).setValues(categoryValues);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Berhasil mengisi ' + numRows + ' baris kategori di Kolom J (baris ' + CONFIG.PRODUCT.DATA_START_ROW + ' - ' + lastRow + ')!',
    count: numRows
  };
}

/* ============================================================
 * 2. LOG PENJUALAN (WRITE TARGET)
 * ============================================================ */
function getSalesLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.SALES_LOG);
  if (!sheet) {
    sheet = ss.getSheetByName(CONFIG.SHEETS.OLD_INPUT);
  }
  return sheet;
}

/**
 * Cari baris pertama yang benar-benar kosong di LOG_PENJUALAN.
 * Baris dianggap kosong jika kolom B (Tanggal) DAN kolom C (SKU) keduanya kosong.
 */
function findFirstEmptySalesRow(sheet) {
  const lastRow = sheet.getLastRow();
  const scanEnd = Math.max(lastRow, CONFIG.SALES_LOG.HEADER_ROW);
  const numRows = scanEnd - CONFIG.SALES_LOG.DATA_START_ROW + 1;
  if (numRows < 1) return CONFIG.SALES_LOG.DATA_START_ROW;

  const values = sheet.getRange(
    CONFIG.SALES_LOG.DATA_START_ROW, 2, numRows, 2   // B & C
  ).getValues();

  for (let i = 0; i < values.length; i++) {
    const dateVal = values[i][0];
    const skuVal  = String(values[i][1] || '').trim();
    if (!dateVal && !skuVal) {
      return CONFIG.SALES_LOG.DATA_START_ROW + i;
    }
  }
  return CONFIG.SALES_LOG.DATA_START_ROW + values.length;
}

function getTodayTransactions() {
  const todaySummary = getSalesSummary();
  return {
    success: true,
    todayTransactions: todaySummary.todayTransactions || [],
    count: (todaySummary.todayTransactions || []).length
  };
}

function getSalesSummary(customStart, customEnd) {
  const sheet = getSalesLogSheet();
  if (!sheet) {
    return {
      success: false,
      message: 'Sheet log penjualan tidak ditemukan: ' + CONFIG.SHEETS.SALES_LOG
    };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.SALES_LOG.DATA_START_ROW) {
    return {
      success: true,
      totalSalesLogged: 0,
      todayTransactions: [],
      salesHistory: [],
      todaySummary: {
        date: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy'),
        totalTransactions: 0,
        totalOmset: 0,
        totalMargin: 0,
        totalQty: 0,
        avgBasketSize: 0,
        paymentBreakdown: {
          CASH: { count: 0, total: 0 },
          TRANSFER: { count: 0, total: 0 },
          QRIS: { count: 0, total: 0 }
        }
      }
    };
  }

  const numRows = lastRow - CONFIG.SALES_LOG.DATA_START_ROW + 1;
  const values = sheet.getRange(
    CONFIG.SALES_LOG.DATA_START_ROW,
    2,                 // mulai B
    numRows,
    12                 // sampai M
  ).getValues();

  // 0:B Tgl | 1:C SKU | 2:D Nama | 3:E Harga | 4:F Qty | 5:G Total
  // 6:H Margin | 7:I Metode | 8:J - | 9:K Nama | 10:L HP | 11:M No.Trx
  const trxMap = {};
  const todayYmd = normalizeDateToYmd(new Date());

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rawDate = row[0];
    const sku     = String(row[1] || '').trim();
    const name    = String(row[2] || '').trim();
    if (!rawDate && !sku && !name) continue;

    const price  = Number(row[3]) || 0;
    const qty    = Number(row[4]) || 1;
    const total  = Number(row[5]) || (price * qty);
    const margin = Number(row[6]) || 0;
    const payRaw = String(row[7] || 'CASH').toUpperCase();
    const pay    = payRaw.indexOf('QRIS') >= 0 ? 'QRIS'
                 : payRaw.indexOf('TRANS') >= 0 ? 'TRANSFER' : 'CASH';
    const custName  = String(row[9]  || '').trim();
    const custPhone = String(row[10] || '').trim();
    const trxIdRaw  = String(row[11] || '').trim();

    const isVoided  = trxIdRaw.indexOf('VOIDED-') === 0;
    const cleanId   = isVoided ? trxIdRaw.replace('VOIDED-', '') : trxIdRaw;

    const dateDisplay = formatDateDisplay(rawDate);
    const dateYmd     = normalizeDateToYmd(rawDate);
    const dateOnly    = dateDisplay ? dateDisplay.split(' ')[0] : (dateYmd || 'Lainnya');
    const key         = cleanId || ('NOID-' + dateYmd + '-' + i);

    if (!trxMap[key]) {
      trxMap[key] = {
        id: cleanId || key,
        transactionDate: dateDisplay || dateOnly,
        date: dateOnly,
        dateYmd: dateYmd,
        paymentMethod: pay,
        items: [],
        totalQty: 0,
        subtotal: 0,
        discount: 0,
        total: 0,
        margin: 0,
        customerName: custName || '-',
        customerPhone: custPhone || '',
        status: isVoided ? 'VOIDED' : 'COMPLETED'
      };
    }

    trxMap[key].items.push({
      productId: sku,
      sku: sku,
      name: name,
      category: classifyProduct(sku, name),
      price: price,
      cost: 0,
      qty: qty,
      subtotal: total,
      total: total,
      margin: margin,
      customer: custName,
      customerPhone: custPhone,
      paymentMethod: pay
    });

    trxMap[key].totalQty += qty;
    trxMap[key].subtotal += total;
    trxMap[key].total    += total;
    trxMap[key].margin   += margin;
  }

  const allTransactions = Object.values(trxMap);
  allTransactions.sort(function(a, b) {
    return String(b.dateYmd || '').localeCompare(String(a.dateYmd || ''));
  });

  const todayTransactions = allTransactions.filter(function(t) {
    return t.dateYmd === todayYmd;
  });

  let todayOmset = 0;
  let todayMargin = 0;
  let todayQty = 0;

  const paymentBreakdown = {
    CASH:     { count: 0, total: 0 },
    TRANSFER: { count: 0, total: 0 },
    QRIS:     { count: 0, total: 0 }
  };

  for (let j = 0; j < todayTransactions.length; j++) {
    const t = todayTransactions[j];
    if (t.status === 'VOIDED') continue; // Transaksi void tidak dihitung ke omset

    todayOmset  += t.total;
    todayMargin += t.margin;
    todayQty    += t.totalQty;

    const m = t.paymentMethod;
    if (paymentBreakdown[m]) {
      paymentBreakdown[m].count += 1;
      paymentBreakdown[m].total += t.total;
    }
  }

  const avgBasket = todayTransactions.length > 0
    ? Math.round(todayOmset / todayTransactions.length)
    : 0;

  return {
    success: true,
    totalSalesLogged: allTransactions.length,
    todayTransactions: todayTransactions,
    salesHistory: allTransactions,
    todaySummary: {
      date: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy'),
      totalTransactions: todayTransactions.length,
      totalOmset: todayOmset,
      totalMargin: todayMargin,
      totalQty: todayQty,
      avgBasketSize: avgBasket,
      paymentBreakdown: paymentBreakdown
    }
  };
}

/* ============================================================
 * 3. LOG BARANG MASUK (WRITE TARGET)
 * ============================================================ */
function getBarangMasukHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.BARANG_MASUK);
  if (!sheet) {
    return { success: true, list: [], message: 'Sheet LOG_BARANG_MASUK belum dibuat.' };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.BARANG_MASUK.DATA_START_ROW) {
    return { success: true, list: [], count: 0 };
  }

  const numRows = lastRow - CONFIG.BARANG_MASUK.DATA_START_ROW + 1;
  const range = sheet.getRange(
    CONFIG.BARANG_MASUK.DATA_START_ROW,
    CONFIG.BARANG_MASUK.START_COLUMN,
    numRows,
    CONFIG.BARANG_MASUK.NUM_COLUMNS
  );
  const values = range.getValues();

  const list = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rawDate = row[0];
    const sku = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    const krat = Number(row[3]) || 0;
    const qty = Number(row[4]) || 0;
    const supplier = String(row[5] || '').trim();
    const totalCost = Number(row[6]) || 0;

    if (!rawDate && !sku) continue;

    const rowNum = CONFIG.BARANG_MASUK.DATA_START_ROW + i;
    list.push({
      id: 'BM-ROW-' + rowNum,
      rowNumber: rowNum,
      date: formatDateDisplay(rawDate),
      sku: sku,
      name: name,
      krat: krat,
      qty: qty,
      cost: qty > 0 ? Math.round(totalCost / qty) : 0,
      totalCost: totalCost,
      supplierOrNotes: supplier || 'orang tua'
    });
  }

  list.reverse();
  return { success: true, count: list.length, list: list };
}

/* ============================================================
 * 4. ENDPOINT TUNGGAL: getAllData
 * ============================================================ */
function getAllData() {
  const prodRes = getProducts();
  const salesSummary = getSalesSummary();
  const bmRes = getBarangMasukHistory();

  return {
    success: true,
    timestamp: new Date().toISOString(),
    products: prodRes.products || [],
    todayTransactions: salesSummary.todayTransactions || [],
    todaySummary: salesSummary.todaySummary || null,
    salesHistory: salesSummary.salesHistory || [],
    barangMasukList: bmRes.list || [],
    diagnostics: {
      productsCount: prodRes.count || 0,
      todayCount: (salesSummary.todayTransactions || []).length,
      totalSalesLogged: salesSummary.totalSalesLogged || 0,
      barangMasukCount: bmRes.count || 0
    },
    note: 'DASHBOARD_MUTASI_&_PROFIT bersifat read-only. Semua penulisan hanya ke LOG_PENJUALAN & LOG_BARANG_MASUK.'
  };
}

/* ============================================================
 * 5. SIMPAN TRANSAKSI KE LOG_PENJUALAN (HANYA TULIS DI SINI)
 * ============================================================
 * PENTING:
 *   1. Fungsi ini TIDAK menyentuh DASHBOARD_MUTASI_&_PROFIT.
 *   2. Penulisan di LOG_PENJUALAN (Kolom E) selalu menggunakan HARGA BIASA,
 *      bukan harga merah (reseller markup).
 * ============================================================ */
function saveTransaction(trx) {
  if (!trx || !trx.items || trx.items.length === 0) {
    return { success: false, message: 'Data transaksi kosong atau tidak memiliki item.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getSalesLogSheet();
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.SALES_LOG);
    sheet.getRange(CONFIG.SALES_LOG.HEADER_ROW, CONFIG.SALES_LOG.START_COLUMN, 1, CONFIG.SALES_LOG.NUM_COLUMNS)
      .setValues([[
        'Tanggal', 'SKU', 'Nama Produk', 'Harga Jual', 'Jumlah',
        'Total Penjualan', 'Margin Keuntungan', 'Metode bayar', '',
        'Nama', 'No. HP', 'nomor transaksi'
      ]]);
  }

  const now = new Date();
  const dateOnly = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');

  const trxId         = trx.id || trx.transactionId || ('TRX-' + now.getTime());
  const customerName  = trx.customerName  || trx.customer || '';
  const customerPhone = trx.customerPhone || trx.phone    || '';
  const paymentMethod = trx.paymentMethod || 'CASH';

  const rowsToInsert = [];
  for (let i = 0; i < trx.items.length; i++) {
    const item = trx.items[i];
    const qty    = Number(item.qty) || 1;
    
    // ATURAN MUTLAK: Gunakan harga biasa (regularPrice / originalPrice), BUKAN harga jual merah!
    const regularPrice = Number(item.regularPrice !== undefined ? item.regularPrice : (item.originalPrice !== undefined ? item.originalPrice : item.price)) || 0;
    const price  = regularPrice;
    const cost   = Number(item.cost) || 0;
    const total  = Number(item.total !== undefined && item.regularPrice === undefined ? item.total : (price * qty));
    const margin = Number(item.margin !== undefined && item.regularPrice === undefined ? item.margin : ((price - cost) * qty));

    rowsToInsert.push([
      dateOnly,           // B: Tanggal (dd/MM/yyyy)
      item.sku  || '-',   // C: SKU
      item.name || '-',   // D: Nama Produk
      price,              // E: Harga Jual (Harga Biasa)
      qty,                // F: Jumlah (Qty)
      total,              // G: Total Penjualan
      margin,             // H: Margin Keuntungan
      paymentMethod,      // I: Metode bayar
      '',                 // J: (kosong)
      customerName,       // K: Nama
      customerPhone,      // L: No. HP
      trxId               // M: nomor transaksi
    ]);
  }

  // PENTING: Catat baris potongan promo jika ada diskon transaksi agar kolom G di Sheets akurat 100%
  const discountVal = Number(trx.discount) || 0;
  if (discountVal > 0) {
    const hasPromoRow = rowsToInsert.some(function(r) {
      return String(r[1]).indexOf('PROMO-') === 0 || String(r[2]).indexOf('POTONGAN PROMO') >= 0;
    });
    if (!hasPromoRow) {
      const promoSku = trx.promoCode ? String(trx.promoCode).toUpperCase() : 'PROMO-DISKON';
      const promoName = trx.promoName ? ('PROMO: ' + trx.promoName) : 'POTONGAN PROMO / DISKON';
      rowsToInsert.push([
        dateOnly,                 // B: Tanggal
        promoSku,                 // C: SKU (PROMO-DISKON / kode voucher)
        promoName,                // D: Nama Potongan Promo
        -Math.abs(discountVal),   // E: Harga Jual (minus)
        1,                        // F: Jumlah (Qty 1)
        -Math.abs(discountVal),   // G: Total Penjualan (minus)
        -Math.abs(discountVal),   // H: Margin Keuntungan (minus)
        paymentMethod,            // I: Metode bayar
        '',                       // J: (kosong)
        customerName,             // K: Nama
        customerPhone,            // L: No. HP
        trxId                     // M: nomor transaksi
      ]);
    }
  }

  const targetRow = findFirstEmptySalesRow(sheet);

  const targetRange = sheet.getRange(
    targetRow,
    CONFIG.SALES_LOG.START_COLUMN,
    rowsToInsert.length,
    CONFIG.SALES_LOG.NUM_COLUMNS
  );
  targetRange.setValues(rowsToInsert);

  return {
    success: true,
    message: 'Transaksi ' + trxId + ' dicatat di LOG_PENJUALAN baris ' + targetRow + ' (Harga Biasa).',
    transactionId: trxId,
    startRow: targetRow,
    rowsInserted: rowsToInsert.length,
    stockTouched: false
  };
}

/* ============================================================
 * 6. CATAT BARANG MASUK (HANYA TULIS DI LOG_BARANG_MASUK)
 * ============================================================
 * PENTING: Fungsi ini TIDAK menyentuh DASHBOARD_MUTASI_&_PROFIT.
 * ============================================================ */
function recordBarangMasuk(entry) {
  if (!entry || !entry.sku) {
    return { success: false, message: 'Data barang masuk tidak valid (SKU wajib diisi).' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.BARANG_MASUK);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.BARANG_MASUK);
    sheet.getRange(CONFIG.BARANG_MASUK.HEADER_ROW, CONFIG.BARANG_MASUK.START_COLUMN, 1, CONFIG.BARANG_MASUK.NUM_COLUMNS)
      .setValues([[
        'Tanggal', 'SKU', 'Nama Produk', 'Qty/Krat', 'Kuantitas Masuk', 'Supplier', 'Total Biaya'
      ]]);
  }

  const scanLimit = Math.max(sheet.getLastRow(), 300);
  const rowCountToScan = Math.max(1, scanLimit - CONFIG.BARANG_MASUK.DATA_START_ROW + 1);
  const checkValues = sheet.getRange(CONFIG.BARANG_MASUK.DATA_START_ROW, 2, rowCountToScan, 2).getValues();

  let targetRow = CONFIG.BARANG_MASUK.DATA_START_ROW;
  let foundEmpty = false;

  for (let i = 0; i < checkValues.length; i++) {
    const dateVal = checkValues[i][0];
    const skuVal = String(checkValues[i][1] || '').trim();

    if (!dateVal && !skuVal) {
      targetRow = CONFIG.BARANG_MASUK.DATA_START_ROW + i;
      foundEmpty = true;
      break;
    }
  }

  if (!foundEmpty) {
    targetRow = CONFIG.BARANG_MASUK.DATA_START_ROW + checkValues.length;
  }

  const now = new Date();
  const formattedDate = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');
  const qty = Number(entry.qty) || 0;
  const cost = Number(entry.cost) || 0;
  const krat = Number(entry.krat) || 0;
  const supplier = String(entry.supplier || entry.supplierOrNotes || 'orang tua').trim();
  const totalCost = Number(entry.totalCost) || (qty * cost);

  const rowData = [
    formattedDate,
    String(entry.sku).trim(),
    String(entry.name || '-').trim(),
    krat,
    qty,
    supplier,
    totalCost
  ];

  sheet.getRange(targetRow, CONFIG.BARANG_MASUK.START_COLUMN, 1, CONFIG.BARANG_MASUK.NUM_COLUMNS)
    .setValues([rowData]);

  return {
    success: true,
    message: 'Barang masuk ' + entry.sku + ' (' + qty + ' pcs) tersimpan di LOG_BARANG_MASUK baris ' + targetRow + '.',
    rowNumber: targetRow,
    sku: entry.sku,
    qty: qty,
    stockTouched: false
  };
}

/* ============================================================
 * 7. VOID TRANSAKSI (HANYA TANDAI DI LOG_PENJUALAN)
 * ============================================================
 * Mekanisme: prefiks "VOIDED-" pada kolom M.
 * Tidak menyentuh DASHBOARD_MUTASI_&_PROFIT.
 * ============================================================ */
function voidTransaction(transactionId, reason) {
  if (!transactionId) return { success: false, message: 'ID Transaksi wajib diisi.' };

  const sheet = getSalesLogSheet();
  if (!sheet) return { success: false, message: 'Sheet penjualan tidak ditemukan.' };

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.SALES_LOG.DATA_START_ROW) {
    return { success: false, message: 'Log penjualan kosong.' };
  }

  const numRows = lastRow - CONFIG.SALES_LOG.DATA_START_ROW + 1;
  const trxIdValues = sheet.getRange(CONFIG.SALES_LOG.DATA_START_ROW, 13, numRows, 1).getValues(); // Kolom M

  let matched = 0;
  for (let i = 0; i < trxIdValues.length; i++) {
    const val = String(trxIdValues[i][0] || '').trim();
    if (val !== transactionId && val !== ('VOIDED-' + transactionId)) continue;

    const currentRow = CONFIG.SALES_LOG.DATA_START_ROW + i;
    sheet.getRange(currentRow, 13).setValue('VOIDED-' + transactionId);
    matched++;
  }

  return {
    success: matched > 0,
    matchedRows: matched,
    stockTouched: false,
    message: matched > 0
      ? 'Transaksi ' + transactionId + ' di-void (' + matched + ' baris). Tidak ada perubahan stok di DASHBOARD.'
      : 'Transaksi tidak ditemukan.'
  };
}

/* ============================================================
 * 8. DIAGNOSTIK SPREADSHEET (?action=diagnose)
 * ============================================================ */
function diagnoseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().map(function(s) { return s.getName(); });

  const prodSheet = ss.getSheetByName(CONFIG.SHEETS.PRODUCTS);
  const salesSheet = getSalesLogSheet();
  const bmSheet = ss.getSheetByName(CONFIG.SHEETS.BARANG_MASUK);

  const prodStatus  = { found: !!prodSheet,  rowCount: prodSheet  ? prodSheet.getLastRow()  : 0 };
  const salesStatus = { found: !!salesSheet, rowCount: salesSheet ? salesSheet.getLastRow() : 0 };
  const bmStatus    = { found: !!bmSheet,    rowCount: bmSheet    ? bmSheet.getLastRow()    : 0 };

  let sample = [];
  if (prodSheet) {
    const pRes = getProducts();
    if (pRes.products) sample = pRes.products.slice(0, 5);
  }

  let firstEmptySalesRow = null;
  if (salesSheet) {
    try { firstEmptySalesRow = findFirstEmptySalesRow(salesSheet); } catch (e) {}
  }

  return {
    success: true,
    spreadsheetName: ss.getName(),
    timezone: ss.getSpreadsheetTimeZone(),
    writePolicy: {
      DASHBOARD_MUTASI_AND_PROFIT: 'READ-ONLY (referensi)',
      LOG_PENJUALAN: 'WRITE (Harga Biasa)',
      LOG_BARANG_MASUK: 'WRITE'
    },
    availableSheets: sheets,
    configuredRanges: {
      products:    CONFIG.SHEETS.PRODUCTS     + ' (B70:J) [read-only master & kategori]',
      salesLog:    CONFIG.SHEETS.SALES_LOG    + ' (B7:M)  [write]',
      barangMasuk: CONFIG.SHEETS.BARANG_MASUK + ' (B4:H)  [write]'
    },
    sheetsStatus: {
      productsSheetFound: prodStatus.found,
      productsSheetName: CONFIG.SHEETS.PRODUCTS,
      productsRowCount: prodStatus.rowCount,
      salesLogSheetFound: salesStatus.found,
      salesLogSheetName: salesSheet ? salesSheet.getName() : CONFIG.SHEETS.SALES_LOG,
      salesLogRowCount: salesStatus.rowCount,
      salesLogFirstEmptyRow: firstEmptySalesRow,
      barangMasukSheetFound: bmStatus.found,
      barangMasukRowCount: bmStatus.rowCount
    },
    sampleProductsLoaded: sample,
    ready: prodStatus.found && (salesStatus.found || prodStatus.rowCount > 70)
  };
}

/* ============================================================
 * 9. KONFIGURASI APLIKASI UNTUK FRONTEND
 * ============================================================ */
function getAppConfig() {
  return {
    success: true,
    brand: CONFIG.BRAND,
    sheets: CONFIG.SHEETS,
    policy: {
      productsSheetReadOnly: true,
      productsSheetName: CONFIG.SHEETS.PRODUCTS,
      writableSheets: [CONFIG.SHEETS.SALES_LOG, CONFIG.SHEETS.BARANG_MASUK]
    },
    salesLogLayout: [
      'Tanggal', 'SKU', 'Nama Produk', 'Harga Jual', 'Jumlah',
      'Total Penjualan', 'Margin Keuntungan', 'Metode bayar', '',
      'Nama', 'No. HP', 'nomor transaksi'
    ],
    barangMasukLayout: [
      'Tanggal', 'SKU', 'Nama Produk', 'Qty/Krat',
      'Kuantitas Masuk', 'Supplier', 'Total Biaya'
    ]
  };
}

/* ============================================================
 * HELPER FORMAT TANGGAL
 * ============================================================ */
function formatDateDisplay(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  try {
    return Utilities.formatDate(new Date(d), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm');
  } catch (e) {
    return String(d);
  }
}

function normalizeDateToYmd(d) {
  if (!d) return '';
  if (d instanceof Date) {
    return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  var clean = String(d).trim().split(' ')[0];
  var parts = clean.replace(/[/.]/g, '-').split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return parts[0] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[2]).slice(-2);
    }
    if (parts[2].length === 4) {
      return parts[2] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[0]).slice(-2);
    }
  }
  return clean;
}
`;
}
