# Pembersihan Tuntas Transaksi VOIDED dari Memori Kasir & Google Sheets

Menyelesaikan kendala sisa data transaksi **`VOIDED-TRX-20261015-155539-190`** dengan pembersihan otomatis (auto-purge) dari memori browser (`localStorage`), blacklist multi-varian, dan memastikan baris di Google Sheets benar-benar terhapus fisik (`sheet.deleteRow`).

## User Review & Critical Decisions

> [!IMPORTANT]
> **Keputusan Berdasarkan Jawaban Klarifikasi Kasir:**
> 1. **Di Google Sheets**: Transaksi harus **hilang sepenuhnya** dari Google Sheets (`LOG_PENJUALAN` & `LAIN-LAIN`), bukan sekadar diganti teksnya menjadi VOIDED.
> 2. **Di Memori Layar Kasir**: Data `VOIDED-TRX` yang saat ini masih tersisa di layar kasir akan **dibersihkan dan dihapus permanen secara otomatis** saat aplikasi dimuat/disinkronkan.
> 3. **Blacklist Multi-Varian**: ID transaksi yang di-void akan didaftarkan ke blacklist dengan seluruh variasinya (`TRX-...`, `VOIDED-TRX-...`, `#TRX-...`) sehingga sinkronisasi berkala tidak akan pernah menariknya kembali.

---

## 1. Overview & Akar Masalah

Mengapa `VOIDED-TRX-20261015-155539-190` sebelumnya masih muncul di layar:
1. Di Google Sheets, baris tersebut sempat diberi awalan `VOIDED-` oleh versi skrip lama.
2. Filter memori kasir sebelumnya hanya memeriksa `!deletedSet.has(t.id)`. Karena yang tersimpan di blacklist adalah `TRX-20261015-155539-190` (tanpa prefix `VOIDED-`), transaksi `VOIDED-TRX-...` dianggap sebagai ID baru dan terus ditampilkan di baris pertama tabel kasir dengan status `DIBATALKAN`.
3. Solusinya adalah pembersihan otomatis (*self-healing auto-purge*) yang membersihkan semua transaksi berstatus `VOIDED` atau berawalan `VOIDED-` dari memori lokal dan memastikan baris di Google Sheets terhapus permanen.

---

## 2. User Experience & Visual Design

1. **Layar Kasir Bersih**: Transaksi `VOIDED-TRX-20261015-155539-190` akan langsung lenyap dari tabel saat pembaruan diterapkan.
2. **Tombol Hapus & Void Responsif**:
   - Menekan tombol **Hapus** atau **Void** akan langsung menghapus baris dari layar seketika.
   - Panggilan backend akan menghapus baris di Google Sheets dan merilis kunci transaksi.
3. **Pesan Konfirmasi**:
   - Toast hijau mengonfirmasi keberhasilan penghapusan data dan baris di Google Sheets.

---

## 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Auto-Purge Data VOIDED di Penyimpanan Lokal**
  - *Pendekatan*: Menambahkan fungsi `StorageService.purgeAllVoidedTransactions()` yang berjalan otomatis saat inisialisasi aplikasi.
  - *Alasan*: Menghilangkan data transaksi `VOIDED-` lama yang masih tertinggal di browser kasir tanpa perlu kasir membersihkan cache browser secara manual.
- **Keputusan 2: Penanganan Multi-Format di Blacklist (`markTransactionAsDeleted`)**
  - *Pendekatan*: Mendaftarkan `id`, `noHash`, `bareId` (tanpa `VOIDED-`), dan `VOIDED-${bareId}` sekaligus ke blacklist.
  - *Alasan*: Menutup celah di mana sinkronisasi Google Sheets mengimpor transaksi yang memiliki variasi awalan berbeda.
- **Keputusan 3: Penyelarasan Tombol Delete di Tabel Kasir**
  - *Pendekatan*: Jika kasir menekan tombol Trash/Hapus pada baris apa pun, sistem mencocokkan baik ID asli maupun ID berawalan `VOIDED-`.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App Boot & Refresh                              │
│                                                                        │
│  StorageService.purgeAllVoidedTransactions()                           │
│  ├─ 1. Baca localStorage['ortukill_pos_transactions_v2']               │
│  ├─ 2. Filter keluar SEMUA item berstatus 'VOIDED' / 'VOIDED-*'        │
│  ├─ 3. Daftarkan ID ke DELETED_TRX blacklist (semua varian)            │
│  └─ 4. Simpan kembali daftar bersih ke localStorage                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Tabel Transaksi Hari Ini                        │
│                                                                        │
│  TodayTransactionsView & SalesHistoryView                              │
│  ├─ Tampilan tabel bersih tanpa baris hantu VOIDED                     │
│  └─ Aksi Void/Hapus baru langsung membersihkan lokal & Google Sheets   │
└────────────────────────────────────────────────────────────────────────┘
```

### Rencana File yang Diperbarui:
1. **`src/services/storageService.ts`**:
   - Menambahkan `purgeAllVoidedTransactions()` untuk membersihkan sisa data `VOIDED-` otomatis.
   - Memperluas `markTransactionAsDeleted` untuk mencakup varian `VOIDED-` dan `#`.
   - Memperbarui `getTransactions()` agar menyaring varian `VOIDED-` dari blacklist.
   - Menjalankan `purgeAllVoidedTransactions()` pada inisialisasi awal.
2. **`src/App.tsx`**:
   - Memanggil `StorageService.purgeAllVoidedTransactions()` pada `useEffect` pemuatan data.
