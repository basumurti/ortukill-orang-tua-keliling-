import assert from 'node:assert/strict';

// Isolated in-memory localStorage mock (never touches any real browser localStorage)
const memoryStore = new Map<string, string>();
const mockStorage: Storage = {
  get length() {
    return memoryStore.size;
  },
  clear() {
    memoryStore.clear();
  },
  getItem(key: string) {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },
  key(index: number) {
    return Array.from(memoryStore.keys())[index] ?? null;
  },
  removeItem(key: string) {
    memoryStore.delete(key);
  },
  setItem(key: string, value: string) {
    memoryStore.set(key, String(value));
  },
};

// Setup isolated globals before dynamically importing StorageService
const storageEventListeners: Array<(e: { key: string | null }) => void> = [];
(globalThis as any).localStorage = mockStorage;
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    localStorage: mockStorage,
    addEventListener: (eventName: string, cb: (e: { key: string | null }) => void) => {
      if (eventName === 'storage') storageEventListeners.push(cb);
    },
    removeEventListener: () => {},
  };
}

import type { Product, TransactionReceipt, CartItem } from '../src/types';

function formatDailyWaReport(
  targetYmd: string,
  transactions: TransactionReceipt[],
  normalizeDate: (s: string) => string
): string {
  const parts = targetYmd.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);

  const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()] || 'Hari';
  const namaBulan =
    ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][
      parts[1] - 1
    ] || String(parts[1]);
  const formattedDateHeader = `${namaHari}, ${String(parts[2]).padStart(2, '0')} ${namaBulan} ${parts[0]}`;

  const dayTrx = transactions.filter((t) => {
    const rawId = String(t.id || '').trim();
    if (rawId.toUpperCase().startsWith('VOIDED-') || rawId.toUpperCase().startsWith('#VOIDED-') || t.status === 'VOIDED') {
      return false;
    }
    const ymd = normalizeDate(t.date || t.transactionDate || '');
    return ymd === targetYmd;
  });

  const productQtyMap = new Map<string, number>();
  let totalBtl = 0;
  let totalOmset = 0;
  let totalMargin = 0;

  dayTrx.forEach((t) => {
    totalOmset += Number(t.subtotal || t.total || 0);
    totalMargin += Number(t.margin || 0);

    (t.items || []).forEach((item) => {
      const rawName = String(item.name || item.sku || '').trim();
      const upperName = rawName.toUpperCase();

      if (upperName === 'PROMO 5RB' || upperName.includes('PROMO 5RB')) {
        return;
      }

      const qty = Number(item.qty) || 0;
      if (qty > 0 && !upperName.startsWith('PROMO:') && !upperName.startsWith('DISKON:') && (item.price === undefined || item.price >= 0)) {
        totalBtl += qty;
      }

      if (rawName) {
        productQtyMap.set(rawName, (productQtyMap.get(rawName) || 0) + qty);
      }
    });
  });

  const barisTeks: string[] = [];
  productQtyMap.forEach((qty, name) => {
    barisTeks.push(`${name}\t- ${qty}`);
  });
  barisTeks.sort((a, b) => b.length - a.length);

  const daftar = barisTeks.length > 0 ? barisTeks.join('\n') : '(Tidak ada transaksi)';
  const fmtNumber = (num: number) => new Intl.NumberFormat('en-US').format(Math.round(num));

  return [
    'REPORT HARIAN',
    formattedDateHeader,
    '',
    '----------------------------------',
    '',
    daftar,
    '',
    '-------------------------------',
    '',
    `QTY BTL : ${totalBtl}`,
    `OMSET : ${fmtNumber(totalOmset)}`,
    `CUAN : ${fmtNumber(totalMargin)}`,
  ].join('\n');
}

function computeCheckoutSnapshot(
  cart: CartItem[],
  manualDiscount: number,
  shippingFee: number
): { subtotal: number; discount: number; total: number; margin: number; totalQty: number } {
  const regularItems = cart.filter((i) => i.price >= 0 && !String(i.sku || '').toUpperCase().includes('PROMO'));
  const promoItems = cart.filter((i) => i.price < 0 || String(i.sku || '').toUpperCase().includes('PROMO'));

  const grossSubtotal = regularItems.reduce((sum, i) => sum + i.subtotal, 0);
  const promoDiscountsTotal = Math.abs(promoItems.reduce((sum, i) => sum + i.subtotal, 0));
  const combinedDiscount = manualDiscount + promoDiscountsTotal;
  const finalTotal = Math.max(
    0,
    (grossSubtotal > 0 ? grossSubtotal : cart.reduce((sum, i) => sum + i.subtotal, 0)) - combinedDiscount + shippingFee
  );
  const totalBottleQty = regularItems.reduce((sum, i) => sum + i.qty, 0);
  const totalMargin = Math.max(0, regularItems.reduce((sum, i) => sum + i.margin, 0) - combinedDiscount);

  return {
    subtotal: grossSubtotal > 0 ? grossSubtotal : cart.reduce((sum, i) => sum + i.subtotal, 0),
    discount: combinedDiscount,
    total: finalTotal,
    margin: totalMargin,
    totalQty: totalBottleQty > 0 ? totalBottleQty : cart.reduce((sum, i) => sum + i.qty, 0),
  };
}

async function run() {
  const storageMod = await import('../src/services/storageService');
  const { StorageService, formatRupiah, calculateFilteredBottleCount, normalizeDateToYmd, formatDateForGoogleSheet } = storageMod;

  console.log('=== 1. TEST FORMAT RUPIAH ===');
  assert.strictEqual(formatRupiah(0).replace(/\u00a0/g, ' '), 'Rp 0');
  assert.strictEqual(formatRupiah(75000).replace(/\u00a0/g, ' '), 'Rp 75.000');
  assert.strictEqual(formatRupiah(1250000).replace(/\u00a0/g, ' '), 'Rp 1.250.000');
  assert.strictEqual(formatRupiah(-5000).replace(/\u00a0/g, ' '), '-Rp 5.000');
  assert.strictEqual(formatRupiah('95000').replace(/\u00a0/g, ' '), 'Rp 95.000');
  console.log('✓ formatRupiah OK');

  console.log('=== 2. TEST CHECKOUT TOTAL, LABA & PROMO ===');
  const sampleCart: CartItem[] = [
    {
      productId: 'p-1',
      sku: 'AMER-01',
      name: 'Anggur Merah Gold 620ml',
      price: 75000,
      regularPrice: 75000,
      cost: 55000,
      qty: 2,
      subtotal: 150000,
      margin: 40000,
    },
    {
      productId: 'p-2',
      sku: 'BIR-01',
      name: 'Bintang Pilsener 620ml',
      price: 45000,
      regularPrice: 45000,
      cost: 34000,
      qty: 1,
      subtotal: 45000,
      margin: 11000,
    },
    {
      productId: 'promo-5rb',
      sku: 'PROMO 5RB',
      name: 'PROMO 5RB',
      price: -5000,
      regularPrice: -5000,
      cost: 0,
      qty: 2,
      subtotal: -10000,
      margin: -10000,
    },
  ];
  const checkoutRes = computeCheckoutSnapshot(sampleCart, 5000, 12000);
  assert.deepStrictEqual(checkoutRes, {
    subtotal: 195000,
    discount: 15000, // 5000 manual + 10000 (2x PROMO 5RB)
    total: 192000,   // 195000 - 15000 + 12000 ongkir
    margin: 36000,   // (40000 + 11000) - 15000
    totalQty: 3,     // 2 AMER + 1 BIR (promo excluded)
  });
  console.log('✓ Checkout total, margin, promo, & ongkir OK');

  console.log('=== 3. TEST DAILY SUMMARY & FILTERED BOTTLE COUNT ===');
  memoryStore.clear();
  StorageService.invalidateCache();
  const wibToday = formatDateForGoogleSheet(new Date(), false);
  const todayDdMmYyyy = wibToday.dateStr;
  const todayYmd = wibToday.ymd;

  const trxToday1: TransactionReceipt = {
    id: 'TRX-TEST-001',
    date: todayDdMmYyyy,
    transactionDate: `${todayDdMmYyyy} 14:10:00`,
    paymentMethod: 'CASH',
    items: [
      { productId: 'p-1', sku: 'AMER-01', name: 'Anggur Merah Gold', category: 'ANGGUR', qty: 2, price: 75000, cost: 55000, subtotal: 150000, total: 150000, margin: 40000 },
      { productId: 'p-2', sku: 'BIR-01', name: 'Bir Bintang 620ml', category: 'BIR', qty: 3, price: 45000, cost: 34000, subtotal: 135000, total: 135000, margin: 33000 },
      { productId: 'p-3', sku: 'MIN-01', name: 'Es Batu / Mixer', category: 'LAINNYA', qty: 2, price: 15000, cost: 8000, subtotal: 30000, total: 30000, margin: 14000 },
      { productId: 'promo-5rb', sku: 'PROMO 5RB', name: 'PROMO 5RB', category: 'PROMO', qty: 1, price: -5000, cost: 0, subtotal: -5000, total: -5000, margin: -5000 },
    ],
    subtotal: 315000,
    discount: 5000,
    total: 310000,
    margin: 82000,
    totalQty: 7,
    status: 'COMPLETED',
  };

  const trxToday2: TransactionReceipt = {
    id: 'TRX-TEST-002',
    date: todayDdMmYyyy,
    transactionDate: `${todayDdMmYyyy} 15:20:00`,
    paymentMethod: 'QRIS',
    items: [
      { productId: 'p-4', sku: 'SOJU-01', name: 'Soju Bae Original', category: 'SOJU', qty: 3, price: 95000, cost: 68000, subtotal: 285000, total: 285000, margin: 81000 },
    ],
    subtotal: 285000,
    discount: 0,
    total: 285000,
    margin: 81000,
    totalQty: 3,
    status: 'COMPLETED',
  };

  const savedList = StorageService.saveTransaction(trxToday1);
  StorageService.saveTransaction(trxToday2);
  void savedList;

  const summary = StorageService.getDailySummary();
  assert.strictEqual(summary.totalTransactions, 2);
  assert.strictEqual(summary.totalOmset, 595000);
  assert.strictEqual(summary.totalMargin, 158000);
  assert.strictEqual(summary.totalQty, 10); // 2 + 3 + 2 + 3 (promo excluded)
  assert.strictEqual(summary.filteredBottleQty, 5); // 2 AMER + 3 SOJU (BIR & <30rb & PROMO excluded)
  assert.strictEqual(summary.avgBasketSize, 297500);
  assert.strictEqual(summary.paymentBreakdown.CASH.total, 310000);
  assert.strictEqual(summary.paymentBreakdown.QRIS.total, 285000);
  assert.strictEqual(calculateFilteredBottleCount([trxToday1, trxToday2]), 5);
  console.log('✓ DailySummary & FilteredBottleCount OK');

  console.log('=== 4. TEST TEMPLATE WA REPORT ===');
  const savedTrxForWa = StorageService.getTransactions().map((t) => ({
    ...t,
    date: '17/11/2026',
    transactionDate: '17/11/2026 14:10:00',
  }));
  const waText = formatDailyWaReport('2026-11-17', savedTrxForWa, normalizeDateToYmd);

  const expectedWa = [
    'REPORT HARIAN',
    'Selasa, 17 November 2026',
    '',
    '----------------------------------',
    '',
    'Soju Bae Original\t- 3',
    'Anggur Merah Gold\t- 2',
    'Bir Bintang 620ml\t- 3',
    'Es Batu / Mixer\t- 2',
    '',
    '-------------------------------',
    '',
    'QTY BTL : 10',
    'OMSET : 600,000',
    'CUAN : 158,000',
  ].join('\n');
  assert.strictEqual(waText, expectedWa);
  console.log('✓ WA Report template exact match OK');

  console.log('=== 5. BENCHMARK DATASET SEMENTARA (500 SKU & 5.000 LOG PENJUALAN) ===');
  memoryStore.clear();
  StorageService.invalidateCache();
  const mockProducts: Product[] = Array.from({ length: 500 }, (_, i) => ({
    id: `prod-${i + 1}`,
    sku: `SKU-${String(i + 1).padStart(4, '0')}`,
    name: `Produk Uji ${i + 1}`,
    category: ['ANGGUR', 'BIR', 'SOJU', 'VODKA', 'WHISKY'][i % 5],
    price: 45000 + (i % 10) * 10000,
    redPrice: 42000 + (i % 10) * 10000,
    cost: 32000 + (i % 10) * 7000,
    stock: 20 + (i % 50),
    minStock: 5,
    totalSold: i % 30,
  }));

  const [wibYear, wibMonth, wibDay] = todayYmd.split('-').map(Number);
  const mockTransactions: TransactionReceipt[] = Array.from({ length: 5000 }, (_, i) => {
    const p = mockProducts[i % 500];
    const isToday = i < 50;
    const day = isToday ? wibDay : ((i % 28) + 1);
    const month = isToday ? wibMonth : ((i % 10) + 1);
    const year = wibYear;
    const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    const qty = (i % 3) + 1;
    const total = p.price * qty;
    const margin = (p.price - (p.cost || 0)) * qty;
    return {
      id: `TRX-BENCH-${i + 1}`,
      date: dateStr,
      transactionDate: `${dateStr} 12:00:00`,
      paymentMethod: (['CASH', 'QRIS', 'TRANSFER'] as const)[i % 3],
      items: [
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          qty,
          price: p.price,
          cost: p.cost,
          subtotal: total,
          total,
          margin,
        },
      ],
      subtotal: total,
      discount: 0,
      total,
      margin,
      totalQty: qty,
      status: 'COMPLETED',
    };
  });

  StorageService.saveProducts(mockProducts, 'LOCAL', 'Benchmark 500 SKU');
  StorageService.saveTransactions(mockTransactions, 'LOCAL', 'Benchmark 5.000 log');

  // Kosongkan cache untuk mengukur cold read vs warm cached read
  StorageService.invalidateCache();
  const tCold0 = performance.now();
  const coldProducts = StorageService.getProducts();
  const coldTrx = StorageService.getTransactions();
  const coldSummary = StorageService.getDailySummary();
  const tCold1 = performance.now();

  const tWarm0 = performance.now();
  const loadedProducts = StorageService.getProducts();
  const loadedTrx = StorageService.getTransactions();
  const benchSummary = StorageService.getDailySummary();
  const benchWa = formatDailyWaReport(todayYmd, loadedTrx, normalizeDateToYmd);
  const tWarm1 = performance.now();

  assert.strictEqual(coldProducts.length, 500);
  assert.strictEqual(coldTrx.length, 5000);
  assert.strictEqual(loadedProducts.length, 500);
  assert.strictEqual(loadedTrx.length, 5000);
  assert.strictEqual(benchSummary.totalOmset, coldSummary.totalOmset);
  assert.ok(benchSummary.totalTransactions >= 50);
  assert.ok(benchWa.includes('REPORT HARIAN'));

  // Uji invalidasi cache saat event `storage` dipicu
  assert.ok(storageEventListeners.length > 0, 'Listener event storage harus terpasang');
  mockStorage.setItem('ortukill_pos_products_v3', JSON.stringify(mockProducts.slice(0, 10)));
  storageEventListeners.forEach((cb) => cb({ key: 'ortukill_pos_products_v3' }));
  assert.strictEqual(StorageService.getProducts().length, 10);

  console.log(
    `✓ Benchmark 500 SKU + 5.000 log: cold=${(tCold1 - tCold0).toFixed(2)} ms, warm+WA=${(tWarm1 - tWarm0).toFixed(2)} ms (Omset hari ini: ${formatRupiah(benchSummary.totalOmset)})`
  );
  console.log('ALL CORE CALCULATION & BENCHMARK TESTS PASSED!');
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
