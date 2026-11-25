/**
 * Enhanced Google Apps Script Code Generator for ORTUKILL POS (V3.6 - UPDATE MANAJEMEN STOK & KOREKSI OPNAME)
 * 
 * Sesuai kode Apps Script resmi pengguna:
 * 1. DATABASE_PRODUK / DASHBOARD_MUTASI_&_PROFIT -> MASTER PRODUK
 *    - B: SKU  C: Nama  D: Kategori ... Stok Akhir dihitung formula dari Stok Awal + Masuk - Keluar
 *    - ATURAN MUTLAK: DILARANG menulis atau menimpa Kolom M:Q (Stok Akhir formula & harga kompetitor).
 *    - Operasi tulis produk hanya ke Kolom B:L.
 * 
 * 2. LOG_PENJUALAN (B7:M, 12 Kolom) -> RIWAYAT PENJUALAN KASIR (WRITE & DELETE)
 *    - B: Tanggal (dd/MM/yyyy)         G: Total Penjualan     L: No. HP
 *    - C: SKU                          H: Margin Keuntungan   M: nomor transaksi
 *    - D: Nama Produk                  I: Metode bayar
 *    - E: Harga Jual (HARGA BIASA)     J: (kosong)
 *    - F: Jumlah (Qty)                 K: Nama
 *    - PENGHAPUSAN: voidTransaction / deleteTransaction menghapus baris transaksi secara permanen (deleteRow)
 * 
 * 3. LOG_BARANG_MASUK (B4:H, 7 Kolom) -> LOG RESTOCK & KOREKSI STOK (WRITE)
 *    - B: Tanggal  C: SKU  D: Nama Produk  E: Qty/Krat
 *    - F: Kuantitas Masuk  G: Supplier  H: Total Biaya
 */

export function generateEnhancedGoogleAppsScriptCode(): string {
  return `/**
 * ============================================================
 * ORTUKILL POS - GOOGLE APPS SCRIPT WEB APP (V3.6)
 * ============================================================
 * Database Google Sheets:
 *   1. DATABASE_PRODUK / DASHBOARD_MUTASI_&_PROFIT -> MASTER PRODUK (WRITE B:L HANYA, M:Q FORMULA READ-ONLY)
 *   2. LOG_PENJUALAN (B7:M)                        -> Riwayat Penjualan Kasir (WRITE & DELETE PERMANEN)
 *   3. LOG_BARANG_MASUK (B4:H)                     -> Log Restock & Koreksi Opname (WRITE)
 *   4. LAIN-LAIN (A4:F)                            -> PENGELUARAN LAIN-LAIN (READ & WRITE)
 *
 * PERBAIKAN PENTING V3.6:
 *   - DUKUNGAN RESMI DATABASE_PRODUK (B:L): Tambah produk (addProduct) dan edit info (updateProduct)
 *     hanya menulis Kolom B:L dan DILARANG KERAS menyentuh Kolom M:Q (Stok Akhir formula & kompetitor).
 *   - KOREKSI STOK OPNAME: Dicatat satu transaksi ke LOG_BARANG_MASUK (positif/negatif) sehingga formula
 *     stok akhir di Google Sheets otomatis terbarui tanpa merusak formula master.
 *   - PERTAHANKAN VOID TETAP PERMANEN: Fungsi voidTransaction tetap menghapus baris secara permanen
 *     (sheet.deleteRow) dengan verifikasi nyata re-read sheet dan hapus ongkir di LAIN-LAIN.
 *   - DETEKSI SPREADSHEET FLEKSIBEL: Mendukung sheet bernama DATABASE_PRODUK maupun DASHBOARD_MUTASI_&_PROFIT.
 *   - Penulisan di LOG_PENJUALAN (Kolom E) selalu menggunakan HARGA BIASA, bukan harga merah.
 *   - Biaya ongkir dialihkan otomatis ke sheet LAIN-LAIN.
 *
 * STRUKTUR LAIN-LAIN (A4:F, 6 kolom):
 *   A: Tanggal          D: Jumlah
 *   B: Keterangan       E: Total
 *   C: Harga            F: Dibayar dengan (BCA, CASH, GOPAY, JAGO)
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
    LAIN_LAIN: 'LAIN-LAIN',
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

  // Range 4: LAIN-LAIN A4:F (PENGELUARAN LAIN-LAIN)
  PENGELUARAN_LAIN: {
    HEADER_ROW: 3,
    DATA_START_ROW: 4,
    START_COLUMN: 1,             // Kolom A
    NUM_COLUMNS: 6               // A..F (A=Tanggal, B=Keterangan, C=Harga, D=Jumlah, E=Total, F=Dibayar dengan)
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
      result = { success: true, message: 'ORTUKILL POS GAS Online (v3.6)', timestamp: new Date().toISOString() };
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
    } else if (action === 'getPengeluaranLain') {
      result = getPengeluaranLainHistory();
    } else if (action === 'getConfig') {
      result = getAppConfig();
    } else if (action === 'fillCategories') {
      result = fillCategoriesColumnJ();
    } else if (action === 'cleanDuplicates') {
      result = cleanUpDuplicates();
    } else if (action === 'testWriteDelete') {
      result = testWriteAndDelete();
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

    if (action === 'saveTransaction' || action === 'writeTransaction' || action === 'writeSalesLog') {
      result = saveTransaction(payload.transaction || payload.entry || payload);
    } else if (action === 'recordBarangMasuk') {
      result = recordBarangMasuk(payload.entry || payload);
    } else if (action === 'recordPengeluaranLain') {
      result = recordPengeluaranLain(payload.entry || payload);
    } else if (action === 'deletePengeluaranLain') {
      result = deletePengeluaranLain(payload.rowNumber);
    } else if (action === 'voidTransaction' || action === 'deleteTransaction' || action === 'deleteSales' || action === 'deleteSalesLog') {
      result = voidTransaction(payload.transactionId || payload.id || payload.trxId, payload.reason, payload);
    } else if (action === 'testWriteDelete') {
      result = testWriteAndDelete();
    } else if (action === 'fillCategories') {
      result = fillCategoriesColumnJ();
    } else if (action === 'cleanDuplicates') {
      result = cleanUpDuplicates();
    } else if (action === 'addProduct') {
      result = addProduct(payload.product || payload);
    } else if (action === 'updateProduct') {
      result = updateProduct(payload.product || payload);
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
 * Mendukung sheet DATABASE_PRODUK maupun DASHBOARD_MUTASI_&_PROFIT.
 * Kolom M:Q (stok akhir formula & kompetitor) hanya dibaca, dilarang ditimpa.
 * ============================================================ */
function getProductSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('DATABASE_PRODUK');
  if (sheet) return sheet;
  sheet = ss.getSheetByName('DATABASE PRODUK');
  if (sheet) return sheet;
  sheet = ss.getSheetByName('DATA_PRODUK');
  if (sheet) return sheet;
  sheet = ss.getSheetByName(CONFIG.SHEETS.PRODUCTS);
  if (sheet) return sheet;

  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const rawName = sheets[i].getName().trim().toUpperCase().replace(/[-_ ]/g, '');
    if (rawName.indexOf('DATABASEPRODUK') >= 0 || rawName.indexOf('DASHBOARDMUTASI') >= 0 || rawName === 'PRODUK') {
      return sheets[i];
    }
  }
  return null;
}

function getProducts() {
  const sheet = getProductSheet();
  if (!sheet) {
    return { success: false, message: 'Sheet produk tidak ditemukan (DATABASE_PRODUK / DASHBOARD_MUTASI_&_PROFIT).' };
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    return { success: true, products: [], count: 0, message: 'Belum ada baris data produk.' };
  }

  // Cari letak baris header secara dinamis (misal baris 70 pada DASHBOARD atau baris 1-5 pada DATABASE_PRODUK)
  let headerRow = CONFIG.PRODUCT.HEADER_ROW;
  let dataStartRow = CONFIG.PRODUCT.DATA_START_ROW;
  let startCol = CONFIG.PRODUCT.START_COLUMN; // Kolom B
  let foundHeader = false;
  let headerValues = [];

  const maxScanHeader = Math.min(lastRow, 85);
  const scanRange = sheet.getRange(1, 1, maxScanHeader, Math.min(Math.max(lastCol, 15), 20)).getValues();

  for (let r = 0; r < scanRange.length; r++) {
    const rowVals = scanRange[r].map(function(c) { return String(c || '').trim().toUpperCase(); });
    for (let c = 0; c < rowVals.length; c++) {
      if (rowVals[c] === 'SKU' || rowVals[c] === 'SKU/ID PRODUK' || rowVals[c] === 'ID PRODUK' || rowVals[c] === 'KODE PRODUK') {
        headerRow = r + 1;
        dataStartRow = headerRow + 1;
        startCol = c + 1;
        headerValues = rowVals.slice(c);
        foundHeader = true;
        break;
      }
    }
    if (foundHeader) break;
  }

  if (lastRow < dataStartRow) {
    return { success: true, products: [], count: 0, message: 'Belum ada baris data produk setelah baris ' + headerRow + '.' };
  }

  const numRows = lastRow - dataStartRow + 1;
  const numColumns = Math.max(16, sheet.getLastColumn() - startCol + 1);
  const range = sheet.getRange(dataStartRow, startCol, numRows, numColumns);
  const values = range.getValues();

  // Deteksi kolom secara cerdas berdasarkan baris header
  let colSku = 0;
  let colName = 1;
  let colStock = 2; // Default Kolom D untuk DASHBOARD_MUTASI_&_PROFIT
  let colPrice = 3; // Default Kolom E
  let colCost = 4;  // Default Kolom F
  let colRed = 5;   // Default Kolom G
  let colAsset = 6; // Default Kolom H
  let colCategory = 8; // Default Kolom J

  if (headerValues && headerValues.length > 0) {
    for (let h = 0; h < headerValues.length; h++) {
      const hv = headerValues[h];
      if (!hv) continue;
      if (hv === 'SKU' || hv.indexOf('SKU') >= 0 || hv === 'ID PRODUK') colSku = h;
      else if (hv.indexOf('NAMA') >= 0) colName = h;
      else if (hv === 'STOK AKHIR' || hv === 'SISA STOK' || (hv.indexOf('STOK') >= 0 && hv.indexOf('AWAL') < 0 && hv.indexOf('MASUK') < 0 && hv.indexOf('KELUAR') < 0)) colStock = h;
      else if (hv.indexOf('HARGA JUAL') >= 0 || (hv.indexOf('JUAL') >= 0 && hv.indexOf('MERAH') < 0)) colPrice = h;
      else if (hv.indexOf('HARGA BELI') >= 0 || hv.indexOf('HPP') >= 0 || hv.indexOf('MODAL') >= 0) colCost = h;
      else if (hv.indexOf('MERAH') >= 0 || hv.indexOf('RESELLER') >= 0) colRed = h;
      else if (hv.indexOf('ASET') >= 0 || hv.indexOf('NILAI') >= 0) colAsset = h;
      else if (hv.indexOf('KATEGORI') >= 0 || hv.indexOf('JENIS') >= 0) colCategory = h;
    }
  }

  const products = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const currentRowNumber = dataStartRow + i;

    const sku = String(row[colSku] || '').trim();
    const name = String(row[colName] || '').trim();

    if (!sku || !name || name.toUpperCase() === 'NAMA PRODUK' || sku.toUpperCase() === 'SKU/ID PRODUK') {
      continue;
    }

    const stock = Number(row[colStock]) || 0;
    const price = Number(row[colPrice]) || 0;
    const cost = Number(row[colCost]) || 0;
    const redPrice = Number(row[colRed]) || price;
    const totalAsset = Number(row[colAsset]) || (stock * cost);

    const rawCategory = row.length > colCategory ? String(row[colCategory] || '').trim() : '';
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
    sheetName: sheet.getName(),
    readOnly: true,
    rangeRead: 'Baris ' + dataStartRow + ' - ' + lastRow
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
  if (sheet) return sheet;
  sheet = ss.getSheetByName('LOG-PENJUALAN');
  if (sheet) return sheet;
  sheet = ss.getSheetByName('log-penjualan');
  if (sheet) return sheet;
  sheet = ss.getSheetByName('Log-Penjualan');
  if (sheet) return sheet;
  sheet = ss.getSheetByName(CONFIG.SHEETS.OLD_INPUT);
  if (sheet) return sheet;

  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const rawName = sheets[i].getName().trim();
    const name = rawName.toUpperCase();
    const clean = name.replace(/[-_ ]/g, '');
    if (clean === 'LOGPENJUALAN' || name === 'PENJUALAN' || clean === 'INPUTPOS' || name === 'SALES') {
      return sheets[i];
    }
  }
  return null;
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

    const isPromoRow = price < 0 || 
                       sku.toUpperCase().indexOf('PROMO') >= 0 || 
                       name.toUpperCase().indexOf('PROMO') >= 0;

    if (!isPromoRow) {
      trxMap[key].totalQty += qty;
    }
    trxMap[key].subtotal += total;
    trxMap[key].total    += total;
    trxMap[key].margin   += margin;

    if (isPromoRow) {
      trxMap[key].discount = (trxMap[key].discount || 0) + Math.abs(total);
      if (!trxMap[key].promoCode) trxMap[key].promoCode = sku;
      if (!trxMap[key].promoName) trxMap[key].promoName = name;
    }
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
  const plRes = getPengeluaranLainHistory();

  return {
    success: true,
    timestamp: new Date().toISOString(),
    products: prodRes.products || [],
    todayTransactions: salesSummary.todayTransactions || [],
    todaySummary: salesSummary.todaySummary || null,
    salesHistory: salesSummary.salesHistory || [],
    barangMasukList: bmRes.list || [],
    pengeluaranLainList: plRes.list || [],
    diagnostics: {
      productsCount: prodRes.count || 0,
      todayCount: (salesSummary.todayTransactions || []).length,
      totalSalesLogged: salesSummary.totalSalesLogged || 0,
      barangMasukCount: bmRes.count || 0,
      pengeluaranLainCount: plRes.count || 0
    },
    note: 'DASHBOARD_MUTASI_&_PROFIT bersifat read-only. Semua penulisan ke LOG_PENJUALAN, LOG_BARANG_MASUK, dan LAIN-LAIN.'
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

  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(10000);
  } catch (e) {
    hasLock = false;
  }
  if (!hasLock) {
    try {
      const docLock = LockService.getDocumentLock();
      if (docLock) hasLock = docLock.tryLock(5000);
    } catch (e) {}
  }

  try {
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
    // Gunakan tanggal & jam input website asli agar tidak ditimpa / diacak Google
    var websiteDate = String(trx.transactionDate || '').trim();
    if (!websiteDate && trx.date) {
      websiteDate = String(trx.date) + (trx.websiteTime ? (' ' + trx.websiteTime) : '');
    }
    const finalDateStr = websiteDate || Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');

    const trxId         = String(trx.id || trx.transactionId || ('TRX-' + now.getTime())).trim();
    const customerName  = trx.customerName  || trx.customer || '';
    const customerPhone = trx.customerPhone || trx.phone    || '';
    const paymentMethod = trx.paymentMethod || 'CASH';

    // Cek Duplikat Sebelum Insert (Hanya lewati jika transaksi PERSIS SAMA persis ada di sheet)
    const lastRowScan = sheet.getLastRow();
    if (lastRowScan >= CONFIG.SALES_LOG.DATA_START_ROW) {
      const numRowsScan = lastRowScan - CONFIG.SALES_LOG.DATA_START_ROW + 1;
      const allValues = sheet.getRange(CONFIG.SALES_LOG.DATA_START_ROW, CONFIG.SALES_LOG.START_COLUMN, numRowsScan, CONFIG.SALES_LOG.NUM_COLUMNS).getValues();

      for (let i = 0; i < allValues.length; i++) {
        const colM = String(allValues[i][11] || '').trim();
        // Strict match: tidak parsial, dan abaikan jika berstatus VOIDED
        if (colM && (colM === trxId || colM.toUpperCase() === trxId.toUpperCase())) {
          return {
            success: true,
            message: 'Transaksi ' + trxId + ' sudah pernah dicatat di Google Sheets (Abaikan duplikat).',
            transactionId: trxId,
            isDuplicateSkipped: true
          };
        }
      }
    }

    const rowsToInsert = [];
    for (let i = 0; i < trx.items.length; i++) {
      const item = trx.items[i];
      const skuUpper = String(item.sku || '').toUpperCase();
      const nameUpper = String(item.name || '').toUpperCase();

      // ATURAN MUTLAK: Biaya ongkir TIDAK BOLEH masuk ke sheet LOG_PENJUALAN (khusus masuk ke sheet LAIN-LAIN)
      if (skuUpper === 'ONGKIR' || nameUpper.indexOf('ONGKIR') >= 0 || nameUpper.indexOf('BIAYA PENGIRIMAN') >= 0) {
        continue;
      }

      const isPromoItem = Number(item.price) < 0 || 
                          skuUpper.indexOf('PROMO') >= 0 || 
                          nameUpper.indexOf('PROMO') >= 0 || 
                          String(item.category || '').toUpperCase().indexOf('PROMO') >= 0;

      const qty = Number(item.qty) || 1;
      let price = 0;
      let total = 0;
      let margin = 0;

      if (isPromoItem) {
        // ATURAN PROMO: Masuk ke sheet LOG_PENJUALAN dengan harga jual minus, Qty terpilih, dan total minus
        const unitVal = Math.abs(Number(item.price) || (Number(item.subtotal) / qty) || 5000);
        price = -unitVal;
        total = price * qty;
        margin = price * qty;
      } else {
        // ATURAN MUTLAK: Gunakan harga biasa (regularPrice / originalPrice), BUKAN harga jual merah!
        const regularPrice = Number(item.regularPrice !== undefined ? item.regularPrice : (item.originalPrice !== undefined ? item.originalPrice : item.price)) || 0;
        price = regularPrice;
        const cost = Number(item.cost) || 0;
        total = Number(item.total !== undefined && item.regularPrice === undefined ? item.total : (price * qty));
        margin = Number(item.margin !== undefined && item.regularPrice === undefined ? item.margin : ((price - cost) * qty));
      }

      rowsToInsert.push([
        finalDateStr,                         // B: Tanggal & Jam Input Website Asli
        item.sku  || (isPromoItem ? 'PROMO 5RB' : '-'), // C: SKU (PROMO 5RB jika promo)
        item.name || (isPromoItem ? 'PROMO 5RB' : '-'), // D: Nama Produk
        price,                                // E: Harga Jual (Harga Biasa atau minus jika promo)
        qty,                                  // F: Jumlah (Qty)
        total,                                // G: Total Penjualan
        margin,                               // H: Margin Keuntungan
        paymentMethod,                        // I: Metode bayar
        '',                                   // J: (kosong)
        customerName,                         // K: Nama
        customerPhone,                        // L: No. HP
        trxId                                 // M: nomor transaksi
      ]);
    }

    // PENTING: Catat baris potongan promo ke sheet LOG_PENJUALAN HANYA jika belum ada promo di baris item
    const discountVal = Number(trx.discount) || 0;
    if (discountVal > 0) {
      const hasPromoRow = rowsToInsert.some(function(r) {
        const s = String(r[1] || '').toUpperCase();
        const n = String(r[2] || '').toUpperCase();
        const p = Number(r[3]) || 0;
        const tot = Number(r[5]) || 0;
        return s.indexOf('PROMO') >= 0 || n.indexOf('PROMO') >= 0 || p < 0 || tot < 0;
      });
      if (!hasPromoRow) {
        const promoSku = trx.promoCode ? String(trx.promoCode).trim().toUpperCase() : 'PROMO 5RB';
        let promoName = trx.promoName ? String(trx.promoName).trim() : 'PROMO 5RB';
        if (promoSku === 'PROMO 5RB' || promoName.toUpperCase() === 'PROMO 5RB') {
          promoName = 'PROMO 5RB';
        } else if (!promoName.toUpperCase().includes('PROMO')) {
          promoName = 'PROMO: ' + promoName;
        }
        rowsToInsert.push([
          finalDateStr,             // B: Tanggal & Jam Input Website Asli
          promoSku,                 // C: SKU (PROMO 5RB / kode voucher)
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

    // ATURAN MUTLAK: Semua ongkir masuk ke sheet LAIN-LAIN (BUKAN LOG_PENJUALAN)
    const shippingFeeVal = Number(trx.shippingFee) || 0;
    let ongkirResult = null;
    if (shippingFeeVal > 0) {
      try {
        ongkirResult = recordPengeluaranLain({
          date: dateOnly,
          description: 'Ongkir Nota ' + trxId + (customerName ? ' (' + customerName + ')' : ''),
          unitPrice: shippingFeeVal,
          qty: 1,
          amount: shippingFeeVal,
          paymentMethod: paymentMethod,
          type: 'INCOME',
          category: 'ONGKIR',
          isIncome: true
        });
      } catch (ongkirErr) {
        // ignore
      }
    }

    return {
      success: true,
      message: 'Transaksi ' + trxId + ' dicatat di LOG_PENJUALAN baris ' + targetRow + ' (Harga Biasa).' +
        (shippingFeeVal > 0 ? ' Ongkir Rp ' + shippingFeeVal + ' berhasil masuk ke sheet LAIN-LAIN.' : ''),
      transactionId: trxId,
      startRow: targetRow,
      rowsInserted: rowsToInsert.length,
      stockTouched: false,
      ongkirRecordedInLainLain: !!ongkirResult
    };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
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

  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(10000);
  } catch (e) {
    hasLock = false;
  }
  if (!hasLock) {
    try {
      const docLock = LockService.getDocumentLock();
      if (docLock) hasLock = docLock.tryLock(5000);
    } catch (e) {}
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.BARANG_MASUK);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS.BARANG_MASUK);
      sheet.getRange(CONFIG.BARANG_MASUK.HEADER_ROW, CONFIG.BARANG_MASUK.START_COLUMN, 1, CONFIG.BARANG_MASUK.NUM_COLUMNS)
        .setValues([[
          'Tanggal', 'SKU', 'Nama Produk', 'Qty/Krat', 'Kuantitas Masuk', 'Supplier', 'Total Biaya'
        ]]);
    }

    const now = new Date();
    const formattedDate = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');
    const sku = String(entry.sku).trim();
    const qty = Number(entry.qty) || 0;
    const cost = Number(entry.cost) || 0;
    const krat = Number(entry.krat) || 0;
    const supplier = String(entry.supplier || entry.supplierOrNotes || 'orang tua').trim();
    const totalCost = Number(entry.totalCost) || (qty * cost);

    // === LAPIS KEAMANAN 2: CEK DUPLIKAT BARANG MASUK SEBELUM INSERT ===
    const lastRowBM = sheet.getLastRow();
    if (lastRowBM >= CONFIG.BARANG_MASUK.DATA_START_ROW) {
      const numRowsBM = lastRowBM - CONFIG.BARANG_MASUK.DATA_START_ROW + 1;
      const existingBM = sheet.getRange(CONFIG.BARANG_MASUK.DATA_START_ROW, 2, numRowsBM, 7).getValues();

      for (let i = 0; i < existingBM.length; i++) {
        const exDate = String(existingBM[i][0] || '').trim(); // B: Tanggal
        const exSku = String(existingBM[i][1] || '').trim();  // C: SKU
        const exQty = Number(existingBM[i][4]) || 0;           // F: Qty
        const exTotalCost = Number(existingBM[i][6]) || 0;     // H: Total Cost

        if (exDate === formattedDate && exSku === sku && exQty === qty && Math.abs(exTotalCost - totalCost) < 0.01) {
          return {
            success: true,
            message: 'Barang masuk ' + sku + ' (' + qty + ' pcs) sudah pernah dicatat di LOG_BARANG_MASUK (Abaikan duplikat).',
            isDuplicateSkipped: true,
            rowNumber: CONFIG.BARANG_MASUK.DATA_START_ROW + i
          };
        }
      }
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

    const rowData = [
      formattedDate,
      sku,
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
      message: 'Barang masuk ' + sku + ' (' + qty + ' pcs) tersimpan di LOG_BARANG_MASUK baris ' + targetRow + '.',
      rowNumber: targetRow,
      sku: sku,
      qty: qty,
      stockTouched: false
    };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

/* ============================================================
 * 7. VOID & HAPUS STRUK TRANSAKSI DARI GOOGLE SHEETS
 * ============================================================
 * ATURAN MUTLAK:
 * Jika struk di-void atau dihapus, SELURUH BARIS TRANSAKSI
 * di sheet LOG_PENJUALAN dan baris ongkir di sheet LAIN-LAIN
 * langsung DIHAPUS PERMANEN (sheet.deleteRow) dari spreadsheet!
 * Penghapusan dilakukan dari baris bawah ke atas agar nomor
 * baris tidak bergeser selama proses iterasi.
 * ============================================================ */
function voidTransaction(transactionId, reason, options) {
  if (!transactionId) return { success: false, message: 'ID Transaksi / Nomor Struk wajib diisi.' };

  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(10000);
  } catch (e) {
    hasLock = false;
  }
  if (!hasLock) {
    try {
      const docLock = LockService.getDocumentLock();
      if (docLock) hasLock = docLock.tryLock(5000);
    } catch (e) {}
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let deletedSalesRows = 0;
    let deletedLainRows = 0;

    // Bersihkan ID: hilangkan tanda #, trim, buat uppercase
    const rawIdStr = String(transactionId || '').trim();
    const cleanTargetId = rawIdStr.replace(/^#/, '').trim();
    const cleanTargetIdUpper = cleanTargetId.toUpperCase();
    const digitsOnly = cleanTargetId.replace(/[^0-9]/g, '');

    // Target row jika dikirimkan di options
    const explicitRow = options && options.rowNumber ? Number(options.rowNumber) : -1;

    // -------------------------------------------------------------
    // 1. HAPUS BARIS DI SHEET LOG_PENJUALAN
    // -------------------------------------------------------------
    const salesSheet = getSalesLogSheet();
    if (salesSheet) {
      const lastRow = salesSheet.getLastRow();
      if (lastRow >= CONFIG.SALES_LOG.DATA_START_ROW) {
        const numRows = lastRow - CONFIG.SALES_LOG.DATA_START_ROW + 1;
        // Baca seluruh kolom B..M (12 kolom)
        const allValues = salesSheet.getRange(
          CONFIG.SALES_LOG.DATA_START_ROW,
          CONFIG.SALES_LOG.START_COLUMN,
          numRows,
          CONFIG.SALES_LOG.NUM_COLUMNS
        ).getValues();

        const rowsToDelete = [];

        // Ekstrak baris jika ID berformat NOID-xxx-15 atau ROW-15
        let targetRowIndex = -1;
        if (cleanTargetIdUpper.indexOf('NOID-') >= 0 || cleanTargetIdUpper.indexOf('ROW-') >= 0) {
          const parts = cleanTargetId.split('-');
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum) && lastNum >= 0) {
            targetRowIndex = lastNum;
          }
        }

        for (let i = 0; i < allValues.length; i++) {
          const row = allValues[i];
          const currentRowNumber = CONFIG.SALES_LOG.DATA_START_ROW + i;

          // Index 11 adalah Kolom M (nomor transaksi) relative terhadap B (index 0)
          const colM = String(row[11] || '').trim();
          const colMClean = colM.replace(/^#/, '').trim().toUpperCase();

          // Teks lengkap satu baris
          const rowTextUpper = row.map(function(val) { return String(val || ''); }).join(' ').toUpperCase();

          let isMatch = false;

          // Pengecekan 1: Cocokkan nomor transaksi persis atau dengan prefix/suffix
          if (colMClean && (
            colMClean === cleanTargetIdUpper ||
            colMClean.indexOf(cleanTargetIdUpper) >= 0 ||
            colMClean.replace('VOIDED-', '') === cleanTargetIdUpper
          )) {
            isMatch = true;
          }
          // Pengecekan 2: Cocokkan deretan angka unik (misal timestamp TRX ID)
          else if (colMClean && digitsOnly.length >= 6 && colMClean.replace(/[^0-9]/g, '') === digitsOnly) {
            isMatch = true;
          }
          // Pengecekan 3: Cari ID unik spesifik di seluruh teks baris
          else if (cleanTargetIdUpper.length >= 6 && rowTextUpper.indexOf(cleanTargetIdUpper) >= 0) {
            isMatch = true;
          }
          // Pengecekan 4: Match berdasarkan nomor baris langsung jika dikirim targetRowIndex
          else if (targetRowIndex > 0 && targetRowIndex === currentRowNumber) {
            isMatch = true;
          }
          // Pengecekan 5: Match jika baris dikirimkan via explicit rowNumber
          else if (explicitRow > 0 && explicitRow === currentRowNumber) {
            isMatch = true;
          }
          // Pengecekan 6: Match tanggal jika format ID adalah TGL-YYYY-MM-DD
          else if (cleanTargetIdUpper.indexOf('TGL-') === 0) {
            const targetYmd = cleanTargetIdUpper.replace('TGL-', '').trim();
            const rowYmd = normalizeDateToYmd(row[0]);
            if (rowYmd && rowYmd === targetYmd) {
              isMatch = true;
            }
          }

          if (isMatch) {
            rowsToDelete.push(currentRowNumber);
          }
        }

        for (let j = rowsToDelete.length - 1; j >= 0; j--) {
          salesSheet.deleteRow(rowsToDelete[j]);
        }
        SpreadsheetApp.flush();

        // V3.5: VERIFIKASI NYATA — baca ulang sheet dan pastikan barisnya benar-benar
        // hilang. Bug v3.2: bilang "1 baris di-void" padahal sheet tidak berubah.
        const afterLastRow = salesSheet.getLastRow();
        let masihAdaDiSheet = false;
        if (afterLastRow >= CONFIG.SALES_LOG.DATA_START_ROW) {
          const afterValues = salesSheet.getRange(
            CONFIG.SALES_LOG.DATA_START_ROW,
            CONFIG.SALES_LOG.START_COLUMN,
            afterLastRow - CONFIG.SALES_LOG.DATA_START_ROW + 1,
            CONFIG.SALES_LOG.NUM_COLUMNS
          ).getValues();
          for (let i = 0; i < afterValues.length; i++) {
            const colM = String(afterValues[i][11] || '').trim().replace(/^#/, '').toUpperCase();
            if (colM && (colM === cleanTargetIdUpper || colM.indexOf(cleanTargetIdUpper) >= 0)) {
              masihAdaDiSheet = true;
              break;
            }
            const rowText = afterValues[i].map(function (v) { return String(v || ''); }).join(' ').toUpperCase();
            if (cleanTargetIdUpper.length >= 6 && rowText.indexOf(cleanTargetIdUpper) >= 0) {
              masihAdaDiSheet = true;
              break;
            }
          }
        }

        if (rowsToDelete.length > 0 && masihAdaDiSheet) {
          return {
            success: false,
            matchedRows: rowsToDelete.length,
            deletedSalesRows: 0,
            deletedLainRows: 0,
            totalDeleted: 0,
            stockTouched: false,
            message: 'Ditemukan ' + rowsToDelete.length + ' baris untuk dihapus (' + cleanTargetId + '), tetapi baris TIDAK berhasil dihapus. Biasanya karena baris di LOG_PENJUALAN dilindungi (Data > Protect sheets and ranges). Lepas proteksinya lalu coba lagi.'
          };
        }

        deletedSalesRows = rowsToDelete.length;
      }
    }

    // -------------------------------------------------------------
    // 2. HAPUS BARIS ONGKIR / DIBAYAR DI SHEET LAIN-LAIN
    // -------------------------------------------------------------
    let lainSheet = ss.getSheetByName(CONFIG.SHEETS.LAIN_LAIN);
    if (!lainSheet) {
      const sheets = ss.getSheets();
      for (let i = 0; i < sheets.length; i++) {
        const name = sheets[i].getName().trim().toUpperCase();
        if (name === 'LAIN-LAIN' || name === 'LAIN_LAIN' || name === 'PENGELUARAN LAIN-LAIN' || name === 'PENGELUARAN') {
          lainSheet = sheets[i];
          break;
        }
      }
    }

    if (lainSheet) {
      const lastLainRow = lainSheet.getLastRow();
      if (lastLainRow >= CONFIG.PENGELUARAN_LAIN.DATA_START_ROW) {
        const lainRows = lastLainRow - CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + 1;
        const lainValues = lainSheet.getRange(
          CONFIG.PENGELUARAN_LAIN.DATA_START_ROW,
          CONFIG.PENGELUARAN_LAIN.START_COLUMN,
          lainRows,
          CONFIG.PENGELUARAN_LAIN.NUM_COLUMNS
        ).getValues();

        const lainToDelete = [];

        // Cek jika ID berformat LAIN-ROW-15 atau ROW-15
        let lainRowTarget = -1;
        if (cleanTargetIdUpper.indexOf('LAIN-ROW-') >= 0) {
          const parts = cleanTargetId.split('-');
          const rowNum = parseInt(parts[2], 10);
          if (!isNaN(rowNum) && rowNum >= CONFIG.PENGELUARAN_LAIN.DATA_START_ROW) {
            lainRowTarget = rowNum;
          }
        }

        for (let k = 0; k < lainValues.length; k++) {
          const currentLainRow = CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + k;
          const rowTextUpper = lainValues[k].map(function(v) { return String(v || ''); }).join(' ').toUpperCase();

          let isLainMatch = false;

          if (cleanTargetIdUpper && rowTextUpper.indexOf(cleanTargetIdUpper) >= 0) {
            isLainMatch = true;
          } else if (digitsOnly.length >= 4 && rowTextUpper.indexOf(digitsOnly) >= 0) {
            isLainMatch = true;
          } else if (lainRowTarget === currentLainRow) {
            isLainMatch = true;
          }

          if (isLainMatch) {
            lainToDelete.push(currentLainRow);
          }
        }

        for (let k = lainToDelete.length - 1; k >= 0; k--) {
          lainSheet.deleteRow(lainToDelete[k]);
        }
        SpreadsheetApp.flush();
        deletedLainRows = lainToDelete.length;
      }
    }

    const totalDeleted = deletedSalesRows + deletedLainRows;
    return {
      // V3.5: hanya bilang sukses kalau benar-benar ada baris yang terhapus.
      success: totalDeleted > 0,
      matchedRows: totalDeleted,
      deletedSalesRows: deletedSalesRows,
      deletedLainRows: deletedLainRows,
      totalDeleted: totalDeleted,
      stockTouched: false,
      message: totalDeleted > 0
        ? 'Struk/transaksi ' + cleanTargetId + ' berhasil dihapus permanen (' + deletedSalesRows + ' baris LOG_PENJUALAN' + (deletedLainRows > 0 ? ', ' + deletedLainRows + ' baris LAIN-LAIN' : '') + ').'
        : 'Transaksi ' + cleanTargetId + ' tidak ditemukan di Google Sheets (atau sudah terhapus).'
    };
  } catch (err) {
    return { success: false, message: 'Gagal VOID transaksi: ' + err.toString() };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

function deleteTransaction(transactionId) {
  return voidTransaction(transactionId, 'Dihapus permanen');
}

/**
 * ============================================================
 * PEMBERSIH BARIS UJI COBA (jalankan LANGSUNG dari editor Apps Script)
 * ============================================================
 * Pilih fungsi "hapusBarisUjiCoba" di editor lalu klik Run.
 * Fungsi ini menghapus setiap baris LOG_PENJUALAN yang mengandung teks
 * "UJI COBA" (mis. baris uji coba dari aplikasi POS) beserta baris
 * terkait di LAIN-LAIN, lalu mencatat hasilnya di Execution log.
 *
 * Berguna juga sebagai bukti cepat bahwa deleteRow benar-benar bekerja.
 * ============================================================
 */
function hapusBarisUjiCoba() {
  const hasil = voidTransaction('UJI COBA', 'Bersihkan baris uji coba');
  Logger.log('HASIL hapusBarisUjiCoba: ' + JSON.stringify(hasil));
  return hasil;
}

/**
 * CEK KESIAPAN SCRIPT (jalankan dari editor): memastikan sheet & range terbaca.
 */
function cekKesiapanScript() {
  const hasil = diagnoseSheets();
  Logger.log('HASIL cekKesiapanScript: ' + JSON.stringify(hasil));
  return hasil;
}

/**
 * ============================================================
 * TES MANDIRI: TULIS DAN HAPUS DI LOG_PENJUALAN (?action=testWriteDelete)
 * ============================================================
 * Menulis 1 baris transaksi uji coba ke LOG_PENJUALAN, lalu
 * langsung menghapusnya kembali untuk memverifikasi kedua fungsi
 * bekerja 100% normal tanpa meninggalkan sampah data di spreadsheet.
 * ============================================================
 */
function testWriteAndDelete() {
  const testId = 'TEST-VERIFY-' + new Date().getTime();
  const testTrx = {
    id: testId,
    customerName: 'Sistem Tes POS',
    paymentMethod: 'CASH',
    items: [{
      sku: 'TES-VERIFIKASI',
      name: 'Uji Coba Tulis & Hapus LOG_PENJUALAN',
      price: 1000,
      regularPrice: 1000,
      qty: 1,
      cost: 500,
      total: 1000,
      margin: 500
    }],
    subtotal: 1000,
    total: 1000,
    margin: 500
  };

  const writeResult = saveTransaction(testTrx);
  if (!writeResult || !writeResult.success) {
    return {
      success: false,
      stage: 'WRITE',
      message: 'Gagal menulis ke LOG_PENJUALAN: ' + (writeResult ? writeResult.message : 'Error')
    };
  }

  // Hapus transaksi uji coba yang baru saja ditulis
  Utilities.sleep(500);
  const deleteResult = voidTransaction(testId, 'Uji coba hapus otomatis');

  return {
    success: true,
    message: 'Verifikasi sukses! Tulis dan Hapus di LOG_PENJUALAN bekerja 100% normal.',
    testId: testId,
    writeResult: writeResult,
    deleteResult: deleteResult
  };
}

/* ============================================================
 * 8. PENGELUARAN LAIN-LAIN (READ & WRITE SHEET LAIN-LAIN)
 * ============================================================
 * Sesuai format sheet LAIN-LAIN (ORTUKILL_KEDIRI):
 * Baris 2: Judul "PENGELUARAN LAIN-LAIN"
 * Baris 3: Header [Tanggal, Keterangan, Harga, Jumlah, Total, Dibayar dengan]
 * Baris 4 ke bawah: Data transaksi
 * Pilihan metode bayar referensi (H4:H7): BCA, CASH, GOPAY, JAGO
 * ============================================================ */

function getPengeluaranLainHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.LAIN_LAIN);
  if (!sheet) {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      const name = sheets[i].getName().trim().toUpperCase();
      if (name === 'LAIN-LAIN' || name === 'LAIN_LAIN' || name === 'PENGELUARAN LAIN-LAIN' || name === 'PENGELUARAN') {
        sheet = sheets[i];
        break;
      }
    }
  }

  if (!sheet) {
    return { success: true, list: [], count: 0, message: 'Sheet LAIN-LAIN belum dibuat di spreadsheet.' };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.PENGELUARAN_LAIN.DATA_START_ROW) {
    return { success: true, list: [], count: 0 };
  }

  const numRows = lastRow - CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + 1;
  const range = sheet.getRange(
    CONFIG.PENGELUARAN_LAIN.DATA_START_ROW,
    CONFIG.PENGELUARAN_LAIN.START_COLUMN,
    numRows,
    CONFIG.PENGELUARAN_LAIN.NUM_COLUMNS
  );
  const values = range.getValues();

  const list = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rawDate = row[0];
    const keterangan = String(row[1] || '').trim();
    const rawHarga = Number(row[2]) || 0;
    const rawJumlah = Number(row[3]) || (rawHarga > 0 ? 1 : 0);
    const rawTotal = Number(row[4]) || (rawHarga * rawJumlah);
    const dibayarDengan = String(row[5] || '').trim() || 'CASH';

    // Lewati baris kosong
    if (!rawDate && !keterangan && rawTotal === 0) continue;

    const rowNum = CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + i;
    const dateDisplay = formatDateDisplay(rawDate);
    const dateYmd = normalizeDateToYmd(rawDate || dateDisplay);

    const keteranganUpper = keterangan.toUpperCase();
    const isNegative = rawTotal < 0 || rawHarga < 0;
    const isOngkir = keteranganUpper.indexOf('ONGKIR') >= 0;
    const isIncome = !isNegative && (isOngkir || keteranganUpper.indexOf('MASUK') >= 0 || keteranganUpper.indexOf('MODAL') >= 0 || keteranganUpper.indexOf('PENDAPATAN') >= 0);

    const recType = isIncome ? 'INCOME' : 'EXPENSE';
    const recCategory = isOngkir ? 'ONGKIR' : (isIncome ? 'MODAL_LAIN' : 'PENGELUARAN_LAIN');
    const recCategoryLabel = isOngkir ? 'Ongkir Pengiriman (+)' : (isIncome ? 'Pemasukan Lain (+)' : 'Pengeluaran Lain-Lain (-)');

    list.push({
      id: 'LAIN-ROW-' + rowNum + '-' + (dateYmd || 'LOG'),
      rowNumber: rowNum,
      date: dateDisplay.split(' ')[0] || dateDisplay,
      dateYmd: dateYmd,
      dateTimeStr: dateDisplay,
      type: recType,
      category: recCategory,
      categoryLabel: recCategoryLabel,
      description: keterangan || (isIncome ? 'Ongkir / Pemasukan' : 'Pengeluaran Kas'),
      unitPrice: Math.abs(rawHarga),
      qty: rawJumlah,
      amount: Math.abs(rawTotal),
      sheetRawTotal: rawTotal,
      paymentMethod: dibayarDengan.toUpperCase(),
      syncStatus: 'SYNCED'
    });
  }

  // Tampilkan baris terbaru di atas
  list.reverse();
  return { success: true, count: list.length, list: list };
}

function recordPengeluaranLain(entry) {
  if (!entry) {
    return { success: false, message: 'Data pengeluaran tidak boleh kosong.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.LAIN_LAIN);
  if (!sheet) {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      const name = sheets[i].getName().trim().toUpperCase();
      if (name === 'LAIN-LAIN' || name === 'LAIN_LAIN' || name === 'PENGELUARAN LAIN-LAIN') {
        sheet = sheets[i];
        break;
      }
    }
  }

  // Jika belum ada sheet LAIN-LAIN, buat otomatis dengan template
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.LAIN_LAIN);
    sheet.getRange('A2:F2').merge().setValue('PENGELUARAN LAIN-LAIN')
      .setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
    sheet.getRange(CONFIG.PENGELUARAN_LAIN.HEADER_ROW, CONFIG.PENGELUARAN_LAIN.START_COLUMN, 1, CONFIG.PENGELUARAN_LAIN.NUM_COLUMNS)
      .setValues([['Tanggal', 'Keterangan', 'Harga', 'Jumlah', 'Total', 'Dibayar dengan']])
      .setBackground('#0F172A').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.getRange('H4:H7').setValues([['BCA'], ['CASH'], ['GOPAY'], ['JAGO']]);
  }

  // Cari baris kosong pertama mulai dari baris 4
  const lastRow = Math.max(sheet.getLastRow(), CONFIG.PENGELUARAN_LAIN.DATA_START_ROW - 1);
  const rowCountToScan = Math.max(1, lastRow - CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + 1);
  const checkValues = sheet.getRange(CONFIG.PENGELUARAN_LAIN.DATA_START_ROW, 1, rowCountToScan, 2).getValues();

  let targetRow = CONFIG.PENGELUARAN_LAIN.DATA_START_ROW;
  let foundEmpty = false;

  for (let i = 0; i < checkValues.length; i++) {
    const dateVal = checkValues[i][0];
    const descVal = String(checkValues[i][1] || '').trim();

    if (!dateVal && !descVal) {
      targetRow = CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + i;
      foundEmpty = true;
      break;
    }
  }

  if (!foundEmpty) {
    targetRow = CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + checkValues.length;
  }

  const tanggal = entry.date || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy');
  const keterangan = String(entry.description || entry.keterangan || '-').trim();
  const rawHarga = Number(entry.unitPrice ?? entry.price ?? entry.amount ?? 0);
  const jumlah = Number(entry.qty ?? 1);
  const rawTotal = Number(entry.amount ?? entry.total ?? (rawHarga * jumlah));
  const dibayarDengan = String(entry.paymentMethod || entry.paidWith || 'CASH').toUpperCase();

  // ATURAN MUTLAK:
  // 1. Jika ini Pemasukan (misal Ongkir dari transaksi), simpan nilai positif (+).
  // 2. Jika ini Pengeluaran, pastikan ketika di-input di sheet nilainya menjadi MINUS (-).
  const isIncome = entry.type === 'INCOME' || entry.isIncome === true || keterangan.toUpperCase().indexOf('ONGKIR') >= 0;

  let harga = 0;
  let total = 0;
  if (isIncome) {
    harga = Math.abs(rawHarga);
    total = Math.abs(rawTotal);
  } else {
    // Pengeluaran bernilai MINUS di sheet
    harga = -Math.abs(rawHarga);
    total = -Math.abs(rawTotal);
  }

  const rowData = [
    [tanggal, keterangan, harga, jumlah, total, dibayarDengan]
  ];

  sheet.getRange(targetRow, CONFIG.PENGELUARAN_LAIN.START_COLUMN, 1, CONFIG.PENGELUARAN_LAIN.NUM_COLUMNS)
    .setValues(rowData);

  // Format angka mata uang untuk Harga dan Total (format angka minus dengan warna merah)
  try {
    sheet.getRange(targetRow, 3).setNumberFormat('#,##0;[Red]-#,##0');
    sheet.getRange(targetRow, 4).setNumberFormat('#,##0');
    sheet.getRange(targetRow, 5).setNumberFormat('#,##0;[Red]-#,##0');
  } catch (fmtErr) {}

  return {
    success: true,
    message: (isIncome ? 'Ongkir / Pemasukan "' : 'Pengeluaran "') + keterangan + '" (' + total + ') berhasil dicatat ke sheet LAIN-LAIN baris ' + targetRow + '.',
    rowNumber: targetRow,
    entry: {
      id: 'LAIN-ROW-' + targetRow + '-' + Date.now(),
      rowNumber: targetRow,
      date: tanggal,
      description: keterangan,
      unitPrice: Math.abs(harga),
      qty: jumlah,
      amount: Math.abs(total),
      sheetRawTotal: total,
      paymentMethod: dibayarDengan,
      type: isIncome ? 'INCOME' : 'EXPENSE',
      category: isIncome ? 'ONGKIR' : 'PENGELUARAN_LAIN',
      syncStatus: 'SYNCED'
    }
  };
}

function deletePengeluaranLain(rowNumber) {
  const row = Number(rowNumber);
  if (!row || row < CONFIG.PENGELUARAN_LAIN.DATA_START_ROW) {
    return { success: false, message: 'Nomor baris tidak valid.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.LAIN_LAIN);
  if (!sheet) {
    return { success: false, message: 'Sheet LAIN-LAIN tidak ditemukan.' };
  }

  // Bersihkan isi baris A..F
  sheet.getRange(row, CONFIG.PENGELUARAN_LAIN.START_COLUMN, 1, CONFIG.PENGELUARAN_LAIN.NUM_COLUMNS).clearContent();

  return {
    success: true,
    message: 'Baris ' + row + ' pada sheet LAIN-LAIN berhasil dihapus.'
  };
}

/* ============================================================
 * 9. DIAGNOSTIK SPREADSHEET (?action=diagnose)
 * ============================================================ */
function diagnoseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().map(function(s) { return s.getName(); });

  const prodSheet = getProductSheet();
  const salesSheet = getSalesLogSheet();
  const bmSheet = ss.getSheetByName(CONFIG.SHEETS.BARANG_MASUK);
  const plSheet = ss.getSheetByName(CONFIG.SHEETS.LAIN_LAIN);

  const prodStatus  = { found: !!prodSheet,  rowCount: prodSheet  ? prodSheet.getLastRow()  : 0 };
  const salesStatus = { found: !!salesSheet, rowCount: salesSheet ? salesSheet.getLastRow() : 0 };
  const bmStatus    = { found: !!bmSheet,    rowCount: bmSheet    ? bmSheet.getLastRow()    : 0 };
  const plStatus    = { found: !!plSheet,    rowCount: plSheet    ? plSheet.getLastRow()    : 0 };

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
      DATABASE_PRODUK: 'WRITE (Kolom B:L saja, M:Q formula terlindungi)',
      LOG_PENJUALAN: 'WRITE (Harga Biasa) & DELETE (Hapus Permanen)',
      LOG_BARANG_MASUK: 'WRITE (Restock & Koreksi Stok)',
      LAIN_LAIN: 'READ & WRITE'
    },
    availableSheets: sheets,
    configuredRanges: {
      products:        (prodSheet ? prodSheet.getName() : CONFIG.SHEETS.PRODUCTS) + ' (B:L data produk, M:Q formula)',
      salesLog:        CONFIG.SHEETS.SALES_LOG       + ' (B7:M)  [write & delete]',
      barangMasuk:     CONFIG.SHEETS.BARANG_MASUK    + ' (B4:H)  [write]',
      pengeluaranLain: CONFIG.SHEETS.LAIN_LAIN       + ' (A4:F)  [read & write]'
    },
    sheetsStatus: {
      productsSheetFound: prodStatus.found,
      productsSheetName: prodSheet ? prodSheet.getName() : CONFIG.SHEETS.PRODUCTS,
      productsRowCount: prodStatus.rowCount,
      salesLogSheetFound: salesStatus.found,
      salesLogSheetName: salesSheet ? salesSheet.getName() : CONFIG.SHEETS.SALES_LOG,
      salesLogRowCount: salesStatus.rowCount,
      salesLogFirstEmptyRow: firstEmptySalesRow,
      barangMasukSheetFound: bmStatus.found,
      barangMasukRowCount: bmStatus.rowCount,
      pengeluaranLainSheetFound: plStatus.found,
      pengeluaranLainRowCount: plStatus.rowCount
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
 * 10. PEMBERSIH DUPLIKAT OTOMATIS (?action=cleanDuplicates)
 * ============================================================ */
function cleanUpDuplicates() {
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(10000);
  } catch (e) {
    hasLock = false;
  }
  if (!hasLock) {
    return { success: false, message: 'Sistem sedang sibuk memproses permintaan lain.' };
  }

  let deletedSalesCount = 0;
  let deletedLainCount = 0;
  let deletedBMCount = 0;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Bersihkan duplikat di LOG_PENJUALAN (Berdasarkan Nomor Transaksi di Kolom M / Isi Baris)
    const salesSheet = getSalesLogSheet();
    if (salesSheet && salesSheet.getLastRow() >= CONFIG.SALES_LOG.DATA_START_ROW) {
      const numRows = salesSheet.getLastRow() - CONFIG.SALES_LOG.DATA_START_ROW + 1;
      const values = salesSheet.getRange(CONFIG.SALES_LOG.DATA_START_ROW, CONFIG.SALES_LOG.START_COLUMN, numRows, CONFIG.SALES_LOG.NUM_COLUMNS).getValues();

      const seenSalesKeys = {};
      const salesRowsToDelete = [];

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const date = String(row[0] || '').trim();
        const sku = String(row[1] || '').trim();
        const price = String(row[3] || '').trim();
        const qty = String(row[4] || '').trim();
        const total = String(row[5] || '').trim();
        const trxId = String(row[11] || '').trim();

        if (!date && !sku && !trxId) continue;

        // Kunci unik duplikat harus identik nota, SKU, qty, dan total belanja
        const dedupeKey = trxId ? (trxId + '|' + sku + '|' + qty + '|' + total) : (date + '|' + sku + '|' + price + '|' + qty + '|' + total);

        if (seenSalesKeys[dedupeKey]) {
          salesRowsToDelete.push(CONFIG.SALES_LOG.DATA_START_ROW + i);
        } else {
          seenSalesKeys[dedupeKey] = true;
        }
      }

      for (let j = salesRowsToDelete.length - 1; j >= 0; j--) {
        salesSheet.deleteRow(salesRowsToDelete[j]);
        deletedSalesCount++;
      }
    }

    // 2. Bersihkan duplikat di LAIN-LAIN
    let lainSheet = ss.getSheetByName(CONFIG.SHEETS.LAIN_LAIN);
    if (!lainSheet) {
      const sheets = ss.getSheets();
      for (let i = 0; i < sheets.length; i++) {
        if (sheets[i].getName().trim().toUpperCase().indexOf('LAIN') >= 0) {
          lainSheet = sheets[i];
          break;
        }
      }
    }

    if (lainSheet && lainSheet.getLastRow() >= CONFIG.PENGELUARAN_LAIN.DATA_START_ROW) {
      const numRowsLain = lainSheet.getLastRow() - CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + 1;
      const valuesLain = lainSheet.getRange(CONFIG.PENGELUARAN_LAIN.DATA_START_ROW, CONFIG.PENGELUARAN_LAIN.START_COLUMN, numRowsLain, CONFIG.PENGELUARAN_LAIN.NUM_COLUMNS).getValues();

      const seenLainKeys = {};
      const lainToDelete = [];

      for (let i = 0; i < valuesLain.length; i++) {
        const row = valuesLain[i];
        const date = String(row[0] || '').trim();
        const desc = String(row[1] || '').trim();
        const total = String(row[4] || '').trim();

        if (!date && !desc) continue;

        const key = date + '|' + desc + '|' + total;
        if (seenLainKeys[key]) {
          lainToDelete.push(CONFIG.PENGELUARAN_LAIN.DATA_START_ROW + i);
        } else {
          seenLainKeys[key] = true;
        }
      }

      for (let k = lainToDelete.length - 1; k >= 0; k--) {
        lainSheet.deleteRow(lainToDelete[k]);
        deletedLainCount++;
      }
    }

    // 3. Bersihkan duplikat di LOG_BARANG_MASUK
    const bmSheet = ss.getSheetByName(CONFIG.SHEETS.BARANG_MASUK);
    if (bmSheet && bmSheet.getLastRow() >= CONFIG.BARANG_MASUK.DATA_START_ROW) {
      const numRowsBM = bmSheet.getLastRow() - CONFIG.BARANG_MASUK.DATA_START_ROW + 1;
      const valuesBM = bmSheet.getRange(CONFIG.BARANG_MASUK.DATA_START_ROW, CONFIG.BARANG_MASUK.START_COLUMN, numRowsBM, CONFIG.BARANG_MASUK.NUM_COLUMNS).getValues();

      const seenBMKeys = {};
      const bmToDelete = [];

      for (let i = 0; i < valuesBM.length; i++) {
        const row = valuesBM[i];
        const date = String(row[0] || '').trim();
        const sku = String(row[1] || '').trim();
        const qty = String(row[4] || '').trim();
        const totalCost = String(row[6] || '').trim();

        if (!date && !sku) continue;

        const key = date + '|' + sku + '|' + qty + '|' + totalCost;
        if (seenBMKeys[key]) {
          bmToDelete.push(CONFIG.BARANG_MASUK.DATA_START_ROW + i);
        } else {
          seenBMKeys[key] = true;
        }
      }

      for (let k = bmToDelete.length - 1; k >= 0; k--) {
        bmSheet.deleteRow(bmToDelete[k]);
        deletedBMCount++;
      }
    }

    return {
      success: true,
      message: 'Pembersihan duplikat selesai. Total ' + (deletedSalesCount + deletedLainCount + deletedBMCount) + ' baris duplikat dihapus (' + deletedSalesCount + ' LOG_PENJUALAN, ' + deletedLainCount + ' LAIN-LAIN, ' + deletedBMCount + ' LOG_BARANG_MASUK).',
      deletedSalesCount: deletedSalesCount,
      deletedLainCount: deletedLainCount,
      deletedBMCount: deletedBMCount,
      totalDeleted: deletedSalesCount + deletedLainCount + deletedBMCount
    };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
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
      var p0 = parseInt(parts[0], 10);
      var p1 = parseInt(parts[1], 10);
      if (p0 <= 12 && p1 > 12) {
        return parts[2] + '-' + ('0' + p0).slice(-2) + '-' + ('0' + p1).slice(-2);
      }
      return parts[2] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[0]).slice(-2);
    }
  }
  return clean;
}

/**
 * Format tanggal standar Google Sheet Indonesia (dd/MM/yyyy atau dd/MM/yyyy HH:mm:ss)
 * dengan timezone Asia/Jakarta (GMT+7)
 */
function formatIndonesianSheetDate(d, includeTime) {
  if (!d) return '';
  var dateObj = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dateObj.getTime())) {
    var str = String(d).trim();
    var ymd = normalizeDateToYmd(str);
    if (ymd && ymd.length === 10) {
      var p = ymd.split('-');
      var dateOnly = p[2] + '/' + p[1] + '/' + p[0];
      if (!includeTime) return dateOnly;
      var t = str.match(/(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?/);
      var timePart = t ? (('0' + t[1]).slice(-2) + ':' + ('0' + t[2]).slice(-2) + ':' + ('0' + (t[3] || '0')).slice(-2)) : '00:00:00';
      return dateOnly + ' ' + timePart;
    }
    return String(d);
  }
  var pattern = includeTime ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy';
  return Utilities.formatDate(dateObj, 'Asia/Jakarta', pattern);
}

/* ============================================================
 * 10. TAMBAH & EDIT MASTER PRODUK (HANYA KOLOM B:L)
 * ============================================================
 * ATURAN MUTLAK SPREADSHEET:
 * - Dilarang menulis atau menimpa Kolom M:Q (Stok Akhir formula & harga kompetitor).
 * - Kolom B..L:
 *     B: SKU (Unik, tidak boleh duplikat)
 *     C: Nama Produk
 *     D: Kategori
 *     E: Qty/Krat (Botol per Krat)
 *     F: Harga / Krat
 *     G: Harga Beli (HPP) = Harga/Krat ÷ Botol/Krat
 *     H: Harga Jual (Biasa)
 *     I: Harga Merah (Reseller)
 *     J: Margin = Harga Jual − Harga Beli
 *     K: Stok Awal (HANYA ditulis di sini, TIDAK dicatat di LOG_BARANG_MASUK)
 *     L: Catatan / Keterangan
 * ============================================================ */
function addProduct(prod) {
  if (!prod || !prod.sku || !prod.name) {
    return { success: false, message: 'SKU dan Nama Produk wajib diisi.' };
  }

  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(10000);
  } catch (e) {
    hasLock = false;
  }

  try {
    const sheet = getProductSheet();
    if (!sheet) {
      return { success: false, message: 'Sheet produk tidak ditemukan (DATABASE_PRODUK / DASHBOARD_MUTASI_&_PROFIT).' };
    }

    const sku = String(prod.sku).trim().toUpperCase();
    const name = String(prod.name).trim();
    const category = String(prod.category || classifyProduct(sku, name)).trim();
    const botolPerKrat = Number(prod.botolPerKrat || prod.krat) || 12;
    const hargaPerKrat = Number(prod.hargaPerKrat) || 0;
    const cost = Number(prod.cost) || (hargaPerKrat > 0 ? Math.round(hargaPerKrat / botolPerKrat) : 0);
    const price = Number(prod.price) || 0;
    const redPrice = Number(prod.redPrice) || price;
    const margin = Number(prod.margin) || (price - cost);
    const stokAwal = Number(prod.initialStock || prod.stock || prod.stokAwal) || 0;
    const notes = String(prod.notes || prod.keterangan || '').trim();

    // Deteksi baris awal data produk secara otomatis
    const lastRow = sheet.getLastRow();
    let dataStartRow = CONFIG.PRODUCT.DATA_START_ROW;
    const maxScan = Math.min(lastRow, 85);
    if (maxScan >= 1) {
      const scanVals = sheet.getRange(1, 2, maxScan, 1).getValues();
      for (let r = 0; r < scanVals.length; r++) {
        const v = String(scanVals[r][0] || '').trim().toUpperCase();
        if (v === 'SKU' || v === 'ID PRODUK' || v === 'SKU/ID PRODUK' || v === 'KODE PRODUK') {
          dataStartRow = r + 2;
          break;
        }
      }
    }

    // Validasi SKU unik di database
    if (lastRow >= dataStartRow) {
      const numRows = lastRow - dataStartRow + 1;
      const existingSkus = sheet.getRange(dataStartRow, 2, numRows, 1).getValues();
      for (let i = 0; i < existingSkus.length; i++) {
        const exSku = String(existingSkus[i][0] || '').trim().toUpperCase();
        if (exSku === sku) {
          return { success: false, message: 'SKU "' + sku + '" sudah terdaftar pada baris ' + (dataStartRow + i) + '. Gunakan SKU lain.' };
        }
      }
    }

    // Cari baris kosong pertama di Kolom B (SKU) & C (Nama)
    const scanLimit = Math.max(lastRow, dataStartRow);
    const rowCountToScan = Math.max(1, scanLimit - dataStartRow + 1);
    const checkValues = sheet.getRange(dataStartRow, 2, rowCountToScan, 2).getValues();

    let targetRow = dataStartRow;
    let foundEmpty = false;
    for (let i = 0; i < checkValues.length; i++) {
      const sVal = String(checkValues[i][0] || '').trim();
      const nVal = String(checkValues[i][1] || '').trim();
      if (!sVal && !nVal) {
        targetRow = dataStartRow + i;
        foundEmpty = true;
        break;
      }
    }
    if (!foundEmpty) {
      targetRow = dataStartRow + checkValues.length;
    }

    // Tulis HANYA B:L (11 kolom: Kolom 2 sampai Kolom 12). DILARANG MENYENTUH M:Q.
    const rowData = [
      sku,          // B
      name,         // C
      category,     // D
      botolPerKrat, // E
      hargaPerKrat, // F
      cost,         // G (Harga Beli)
      price,        // H (Harga Jual)
      redPrice,     // I (Harga Merah)
      margin,       // J (Margin)
      stokAwal,     // K (Stok Awal)
      notes         // L (Catatan)
    ];

    sheet.getRange(targetRow, 2, 1, 11).setValues([rowData]);

    return {
      success: true,
      message: 'Produk ' + sku + ' (' + name + ') berhasil ditambahkan ke database pada baris ' + targetRow + ' (B:L).',
      rowNumber: targetRow,
      sku: sku,
      stockTouched: false
    };
  } catch (err) {
    return { success: false, message: 'Gagal menambah produk: ' + err.toString() };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

function updateProduct(prod) {
  if (!prod || !prod.sku) {
    return { success: false, message: 'SKU produk wajib diisi untuk pembaruan.' };
  }

  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(10000);
  } catch (e) {
    hasLock = false;
  }

  try {
    const sheet = getProductSheet();
    if (!sheet) {
      return { success: false, message: 'Sheet produk tidak ditemukan (DATABASE_PRODUK / DASHBOARD_MUTASI_&_PROFIT).' };
    }

    const sku = String(prod.sku).trim().toUpperCase();
    const lastRow = sheet.getLastRow();

    // Deteksi baris awal data produk secara otomatis
    let dataStartRow = CONFIG.PRODUCT.DATA_START_ROW;
    const maxScan = Math.min(lastRow, 85);
    if (maxScan >= 1) {
      const scanVals = sheet.getRange(1, 2, maxScan, 1).getValues();
      for (let r = 0; r < scanVals.length; r++) {
        const v = String(scanVals[r][0] || '').trim().toUpperCase();
        if (v === 'SKU' || v === 'ID PRODUK' || v === 'SKU/ID PRODUK' || v === 'KODE PRODUK') {
          dataStartRow = r + 2;
          break;
        }
      }
    }

    if (lastRow < dataStartRow) {
      return { success: false, message: 'Database produk masih kosong.' };
    }

    const numRows = lastRow - dataStartRow + 1;
    const skuRange = sheet.getRange(dataStartRow, 2, numRows, 1).getValues();

    let targetRow = -1;
    for (let i = 0; i < skuRange.length; i++) {
      if (String(skuRange[i][0] || '').trim().toUpperCase() === sku) {
        targetRow = dataStartRow + i;
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, message: 'Produk dengan SKU "' + sku + '" tidak ditemukan di database.' };
    }

    // Baca data baris saat ini (B:L) agar nilai yang tidak diubah tetap utuh
    const currentRowVals = sheet.getRange(targetRow, 2, 1, 11).getValues()[0];

    const name = prod.name !== undefined ? String(prod.name).trim() : currentRowVals[1];
    const category = prod.category !== undefined ? String(prod.category).trim() : currentRowVals[2];
    const botolPerKrat = prod.botolPerKrat !== undefined ? Number(prod.botolPerKrat) : currentRowVals[3];
    const hargaPerKrat = prod.hargaPerKrat !== undefined ? Number(prod.hargaPerKrat) : currentRowVals[4];
    const cost = prod.cost !== undefined ? Number(prod.cost) : currentRowVals[5];
    const price = prod.price !== undefined ? Number(prod.price) : currentRowVals[6];
    const redPrice = prod.redPrice !== undefined ? Number(prod.redPrice) : currentRowVals[7];
    const margin = prod.margin !== undefined ? Number(prod.margin) : (price - cost);
    const stokAwal = currentRowVals[9]; // Pertahankan stok awal asli
    const notes = prod.notes !== undefined ? String(prod.notes).trim() : currentRowVals[10];

    // Update B..L (SKU tetap di B, nilai baru di C..L)
    const updatedRow = [
      sku,
      name,
      category,
      botolPerKrat,
      hargaPerKrat,
      cost,
      price,
      redPrice,
      margin,
      stokAwal,
      notes
    ];

    sheet.getRange(targetRow, 2, 1, 11).setValues([updatedRow]);

    return {
      success: true,
      message: 'Informasi produk ' + sku + ' (' + name + ') berhasil diperbarui di baris ' + targetRow + '.',
      rowNumber: targetRow,
      sku: sku,
      stockTouched: false
    };
  } catch (err) {
    return { success: false, message: 'Gagal memperbarui produk: ' + err.toString() };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}
`;
}
