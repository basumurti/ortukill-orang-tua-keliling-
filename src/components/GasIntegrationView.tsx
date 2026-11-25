import React, { useState, useEffect, useMemo } from 'react';
import { Button, Card, Chip, Input } from '@heroui/react';
import { 
  FileCode2, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  Terminal, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  HelpCircle,
  Database,
  ArrowDownCircle,
  Tag,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCheck,
  Star,
  Pencil,
  RotateCcw,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { generateEnhancedGoogleAppsScriptCode } from '../services/gasCodeGenerator';
import { GasApiService, GasDiagnosticResult, DEFAULT_GAS_WEBAPP_URL } from '../services/gasApiService';
import { StorageService } from '../services/storageService';
import { INITIAL_PRODUCTS } from '../data/initialData';

interface GasIntegrationViewProps {
  onSyncComplete?: () => void;
}

export const GasIntegrationView: React.FC<GasIntegrationViewProps> = ({ onSyncComplete }) => {
  const [copied, setCopied] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState('');
  const [primaryStoreUrl, setPrimaryStoreUrl] = useState<string>(GasApiService.getPrimaryStoreUrl());
  const [isEditingPrimary, setIsEditingPrimary] = useState<boolean>(false);
  const [primaryInputDraft, setPrimaryInputDraft] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fillingCategories, setFillingCategories] = useState(false);
  const [copiedCategories, setCopiedCategories] = useState(false);
  const [showCategoryTable, setShowCategoryTable] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('ALL');
  const [diagnostic, setDiagnostic] = useState<GasDiagnosticResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testingWriteDelete, setTestingWriteDelete] = useState(false);
  const [scriptVersion, setScriptVersion] = useState<{
    installedVersion?: string | null;
    expectedVersion?: string;
    upToDate?: boolean;
    message?: string;
  } | null>(null);
  const [checkingVersion, setCheckingVersion] = useState(false);

  const checkScriptVersion = async () => {
    setCheckingVersion(true);
    try {
      const res = await GasApiService.checkScriptVersion();
      setScriptVersion(res.success ? res : null);
    } finally {
      setCheckingVersion(false);
    }
  };

  useEffect(() => {
    checkScriptVersion();
  }, []);
  const [writeDeleteResult, setWriteDeleteResult] = useState<{
    success: boolean;
    message: string;
    stage?: string;
    testId?: string;
    writeResult?: any;
    deleteResult?: any;
  } | null>(null);

  const handleTestWriteDelete = async () => {
    const url = (webAppUrl || primaryStoreUrl || '').trim();
    if (!url) {
      setErrorMessage('Masukkan URL Web App terlebih dahulu.');
      return;
    }

    setTestingWriteDelete(true);
    setWriteDeleteResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await GasApiService.testWriteAndDeleteLogPenjualan(url);
      setWriteDeleteResult(res);
      if (res.success) {
        setSuccessMessage('✓ Sukses! Uji coba Tulis dan Hapus di LOG_PENJUALAN berhasil 100%. Baris uji coba telah dihapus bersih.');
      } else {
        setErrorMessage(res.message || 'Uji coba gagal pada tahap ' + (res.stage || 'proses'));
      }
    } catch (err: any) {
      setErrorMessage('Terjadi error saat uji coba: ' + err.message);
    } finally {
      setTestingWriteDelete(false);
    }
  };

  const scriptCode = generateEnhancedGoogleAppsScriptCode();

  const productsList = useMemo(() => {
    const stored = StorageService.getProducts();
    const list = stored && stored.length > 0 ? stored : INITIAL_PRODUCTS;
    return [...list].sort((a, b) => (a.rowNumber || 999) - (b.rowNumber || 999));
  }, []);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    productsList.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [productsList]);

  const filteredProducts = useMemo(() => {
    return productsList.filter(p => {
      const matchSearch = !categorySearch.trim() || 
        p.name.toLowerCase().includes(categorySearch.toLowerCase()) || 
        p.sku.toLowerCase().includes(categorySearch.toLowerCase()) ||
        p.category.toLowerCase().includes(categorySearch.toLowerCase());
      const matchCat = selectedCatFilter === 'ALL' || p.category === selectedCatFilter;
      return matchSearch && matchCat;
    });
  }, [productsList, categorySearch, selectedCatFilter]);

  const handleFillCategoriesInSheet = async () => {
    setFillingCategories(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await GasApiService.fillCategoriesInSheet();
      if (res.success) {
        setSuccessMessage(`Berhasil mengisi Kolom J di Spreadsheet! (${res.message || 'Kategori diperbarui'})`);
        await GasApiService.fetchAndSyncAll();
        if (onSyncComplete) onSyncComplete();
      } else {
        setErrorMessage(res.message || 'Gagal mengisi Kolom J. Pastikan Kode.gs terbaru sudah dideploy.');
      }
    } catch (err: any) {
      setErrorMessage('Terjadi error saat mengisi kategori: ' + err.message);
    } finally {
      setFillingCategories(false);
    }
  };

  const handleCopyColumnJValues = () => {
    const textLines = productsList.map(p => p.category || 'ANGGUR').join('\n');
    navigator.clipboard.writeText(textLines);
    setCopiedCategories(true);
    setTimeout(() => setCopiedCategories(false), 3000);
    setSuccessMessage('Daftar Kolom J berhasil disalin! Silakan buka Spreadsheet Anda, klik pada sel J71, lalu tekan Ctrl+V (atau Cmd+V).');
  };

  useEffect(() => {
    const initUrl = async () => {
      try {
        const status = await GasApiService.getStatus();
        const primary = status.primaryWebAppUrl || GasApiService.getPrimaryStoreUrl();
        const urlToUse = status.webAppUrl || primary;
        setPrimaryStoreUrl(primary);
        setWebAppUrl(urlToUse);
        testUrl(urlToUse);
      } catch {
        const primary = GasApiService.getPrimaryStoreUrl();
        const saved = GasApiService.getSavedWebAppUrl();
        setPrimaryStoreUrl(primary);
        setWebAppUrl(saved);
        testUrl(saved);
      }
    };
    initUrl();
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Jadikan URL yang sedang diketik sebagai URL Utama Toko baru
  const handleSetCurrentAsPrimary = async () => {
    if (!webAppUrl.trim()) {
      setErrorMessage('Silakan masukkan URL Web App terlebih dahulu.');
      return;
    }
    try {
      const clean = webAppUrl.trim();
      await GasApiService.setPrimaryStoreUrl(clean);
      setPrimaryStoreUrl(clean);
      setSuccessMessage('⭐ URL Utama Toko berhasil diubah dan disimpan permanen!');
      testUrl(clean);
    } catch (err: any) {
      setErrorMessage('Gagal menyimpan URL Utama Toko: ' + err.message);
    }
  };

  // Beralih kembali ke URL Utama Toko
  const handleUsePrimaryUrl = () => {
    const primary = primaryStoreUrl || GasApiService.getPrimaryStoreUrl();
    setWebAppUrl(primary);
    GasApiService.setSavedWebAppUrl(primary);
    testUrl(primary);
    setSuccessMessage('Berhasil beralih ke URL Utama Toko!');
  };

  // Buka editor inline URL Utama Toko
  const handleStartEditPrimary = () => {
    setPrimaryInputDraft(primaryStoreUrl);
    setIsEditingPrimary(true);
  };

  // Simpan perubahan URL Utama Toko dari editor inline
  const handleSaveEditedPrimary = async () => {
    if (!primaryInputDraft.trim()) {
      setErrorMessage('URL Utama Toko tidak boleh kosong.');
      return;
    }
    try {
      const clean = primaryInputDraft.trim();
      await GasApiService.setPrimaryStoreUrl(clean);
      setPrimaryStoreUrl(clean);
      setWebAppUrl(clean);
      setIsEditingPrimary(false);
      setSuccessMessage('⭐ URL Utama Toko berhasil diperbarui & disimpan permanen!');
      testUrl(clean);
    } catch (err: any) {
      setErrorMessage('Gagal memperbarui URL Utama Toko: ' + err.message);
    }
  };

  const testUrl = async (urlToTest: string) => {
    if (!urlToTest.trim()) return;
    setTesting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await GasApiService.testConnection(urlToTest.trim());
      setDiagnostic(res);
      if (res.success) {
        setSuccessMessage('Koneksi ke spreadsheet berhasil diverifikasi!');
      } else {
        setErrorMessage(res.message || 'Gagal terhubung ke Google Apps Script.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menguji URL.');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndTest = async () => {
    if (!webAppUrl.trim()) {
      setErrorMessage('Silakan masukkan URL Web App Google Apps Script.');
      return;
    }

    setTesting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await GasApiService.configureWebAppUrl(webAppUrl.trim());
      const res = await GasApiService.testConnection(webAppUrl.trim());
      setDiagnostic(res);
      if (res.success) {
        setSuccessMessage('URL berhasil disimpan permanen ke server & koneksi terverifikasi!');
      } else {
        setErrorMessage(res.message || 'URL disimpan, namun gagal merespons. Pastikan opsi hak akses Deployment adalah "Anyone".');
      }
    } catch (err: any) {
      setErrorMessage('Koneksi gagal: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handlePullAllData = async () => {
    if (!webAppUrl.trim()) {
      setErrorMessage('Masukkan URL Web App terlebih dahulu.');
      return;
    }

    setSyncing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await GasApiService.fetchAndSyncAll();
      if (res.success) {
        setSuccessMessage(`Berhasil menarik data! Memuat ${res.products?.length || 0} produk dan ${res.todayTransactions?.length || 0} transaksi hari ini.`);
        if (onSyncComplete) onSyncComplete();
      } else {
        setErrorMessage(res.message || 'Gagal memuat data dari Spreadsheet.');
      }
    } catch (err: any) {
      setErrorMessage('Sinkronisasi gagal: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);

  const handleCleanDuplicates = async () => {
    setCleaningDuplicates(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await GasApiService.cleanUpDuplicatesInSheet();
      if (res.success) {
        setSuccessMessage(res.message || 'Pembersihan duplikat selesai!');
        await GasApiService.fetchAndSyncAll();
        if (onSyncComplete) onSyncComplete();
      } else {
        setErrorMessage(res.message || 'Gagal membersihkan duplikat.');
      }
    } catch (err: any) {
      setErrorMessage('Error pembersihan duplikat: ' + err.message);
    } finally {
      setCleaningDuplicates(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24 text-[var(--foreground)] min-w-0">
      {/* Top Banner */}
      <Card className="bg-[var(--surface)] rounded-3xl p-4 sm:p-5 border border-[var(--border)] shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-[var(--foreground)] tracking-tight uppercase">
                Integrasi Google Spreadsheet
              </h2>
              <Chip
                size="sm"
                variant="soft"
                color={scriptVersion?.upToDate ? 'success' : 'warning'}
                className={`border ${
                  scriptVersion?.upToDate
                    ? 'bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border-[var(--success)]/30'
                    : 'bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border-[var(--warning)]/30'
                }`}
              >
                <Chip.Label className="text-[10px] font-bold">
                  {checkingVersion
                    ? 'Cek versi script…'
                    : scriptVersion
                    ? scriptVersion.upToDate
                      ? `Script ${scriptVersion.installedVersion} ✓ terbaru`
                      : `Script ${scriptVersion.installedVersion || '?'} — perlu diperbarui`
                    : 'Versi script tidak diketahui'}
                </Chip.Label>
              </Chip>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onPress={checkScriptVersion}
                isDisabled={checkingVersion}
                aria-label="Periksa ulang versi Apps Script yang terpasang"
                className="text-[11px] font-bold px-3 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-[var(--muted)] hover:text-[var(--foreground)] min-h-[36px]"
              >
                Cek ulang
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Sinkronisasi data real-time: Master Produk B70:H (Read-Only) & Log Penjualan B7:M (Harga Biasa)
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          onPress={handleCopyCode}
          id="btn-copy-gas-code"
          className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs font-bold whitespace-nowrap min-h-[44px] rounded-xl px-4 shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-[var(--success)] stroke-[3]" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Kode .gs Terbaru'}</span>
        </Button>
      </Card>

      {/* PERINGATAN: script di Google Sheets masih versi lama */}
      {scriptVersion && scriptVersion.upToDate === false && (
        <Card className="bg-[var(--warning-soft)] border border-[var(--warning)]/35 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 shadow-none gap-1.5">
          <div className="font-extrabold flex items-center gap-1.5 text-amber-900 dark:text-[var(--warning)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-[var(--warning)]" />
            <span>
              Script yang terpasang di Google Sheets masih{' '}
              <span className="font-black text-amber-800 dark:text-[var(--warning)]">
                {scriptVersion.installedVersion || 'versi lama'}
              </span>
              , sedangkan aplikasi ini memakai{' '}
              <span className="font-black text-emerald-700 dark:text-[var(--success)]">
                {scriptVersion.expectedVersion}
              </span>
              .
            </span>
          </div>
          <div className="leading-relaxed text-amber-800 dark:text-amber-200/90">
            Akibatnya tombol <strong className="text-amber-950 dark:text-amber-100">VOID / Hapus</strong> hanya{' '}
            <strong className="text-amber-950 dark:text-amber-100">menandai</strong> transaksi jadi{' '}
            <code className="bg-[var(--surface)] border border-[var(--warning)]/35 text-amber-800 dark:text-[var(--warning)] px-1.5 py-0.5 rounded font-mono">
              VOIDED-…
            </code>{' '}
            dan <strong className="text-amber-950 dark:text-amber-100">barisnya tetap ada</strong> di Google Sheets.
          </div>
          <div className="leading-relaxed text-amber-800 dark:text-amber-200/90">
            <strong className="text-amber-950 dark:text-amber-100">Cara memperbaiki:</strong> klik{' '}
            <strong className="text-amber-950 dark:text-amber-100">“Salin Kode .gs Terbaru”</strong> di atas → di editor Apps Script tekan{' '}
            <strong className="text-amber-950 dark:text-amber-100">Ctrl+A</strong> lalu{' '}
            <strong className="text-amber-950 dark:text-amber-100">Ctrl+V</strong> (timpa semua) →{' '}
            <strong className="text-amber-950 dark:text-amber-100">Simpan</strong> →{' '}
            <strong className="text-amber-950 dark:text-amber-100">Deploy → Manage deployments → ikon pensil → Version: “New version” → Deploy</strong>.
          </div>
          <div className="text-[11px] text-amber-800 dark:text-[var(--warning)]">
            Sesudah deploy, klik <strong className="text-amber-950 dark:text-amber-100">Cek ulang</strong> di atas — kalau sudah hijau, tombol VOID akan benar-benar menghapus barisnya.
          </div>
        </Card>
      )}

      {/* Unified Logic: Penulisan Bersih & Hapus/VOID Otomatis Tanpa Benturan */}
      <Card className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-none space-y-3 gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--success-soft)] border border-[var(--success)]/30 text-emerald-700 dark:text-[var(--success)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-[var(--foreground)] text-sm">
                  Sistem Terpadu: Penulisan Bersih & Penghapusan Otomatis (Anti-Benturan)
                </span>
                <Chip
                  size="sm"
                  variant="soft"
                  color="success"
                  className="bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border border-[var(--success)]/30"
                >
                  <Chip.Label className="text-[9px] font-black uppercase tracking-wider">Harmonis & Aktif</Chip.Label>
                </Chip>
              </div>
              <p className="text-[var(--muted)] text-xs mt-1 leading-relaxed">
                Logika penulisan dan penghapusan diatur secara sinkron agar tidak saling menghalangi:
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onPress={handleCleanDuplicates}
            isDisabled={cleaningDuplicates}
            aria-label="Bersihkan baris ganda yang tidak sengaja terinput di Google Sheets"
            className="bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border)] text-[var(--foreground)] text-xs font-bold rounded-xl whitespace-nowrap min-h-[44px] px-3.5 flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--muted)] ${cleaningDuplicates ? 'animate-spin' : ''}`} />
            <span>{cleaningDuplicates ? 'Membersihkan Duplikat...' : 'Bersihkan Duplikat di Sheets'}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] pt-2 border-t border-[var(--border)]">
          <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)]">
            <span className="font-bold text-emerald-700 dark:text-[var(--success)] block mb-0.5">
              ✓ 1. Saat Transaksi Kasir Dibuat (Write):
            </span>
            <span className="text-[var(--muted)] leading-normal">
              Dicatat langsung ke sheet <strong className="text-[var(--foreground)]">LOG_PENJUALAN</strong> (dan ongkir ke{' '}
              <strong className="text-[var(--foreground)]">LAIN-LAIN</strong>) sekali saja tanpa dobel.
            </span>
          </div>

          <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)]">
            <span className="font-bold text-red-700 dark:text-[var(--danger)] block mb-0.5">
              ✓ 2. Saat Transaksi Di-VOID / Dihapus (Delete):
            </span>
            <span className="text-[var(--muted)] leading-normal">
              Seluruh baris transaksi langsung <strong className="text-[var(--foreground)]">dihapus permanen (deleteRow)</strong> dari Google Sheets, dan kunci anti-duplikat langsung dilepas seketika.
            </span>
          </div>
        </div>
      </Card>

      {/* Test & Verify LOG_PENJUALAN Write & Delete Card */}
      <Card className="bg-[var(--surface)] rounded-2xl p-4 sm:p-5 border border-[var(--accent)]/35 shadow-none space-y-3 gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center font-black flex-shrink-0">
              🧪
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  Uji Coba Otomatis: Tulis & Hapus LOG_PENJUALAN
                </h3>
                <Chip
                  size="sm"
                  variant="soft"
                  color="success"
                  className="bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border border-[var(--success)]/30"
                >
                  <Chip.Label className="text-[10px] font-black uppercase">v3.5 Siap Diuji</Chip.Label>
                </Chip>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Menguji penulisan transaksi kasir ke <strong className="text-[var(--foreground)]">LOG_PENJUALAN</strong> dan langsung menghapusnya kembali untuk memastikan sistem 100% normal.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            onPress={handleTestWriteDelete}
            isDisabled={testingWriteDelete}
            className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs font-bold rounded-xl min-h-[44px] px-4 flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${testingWriteDelete ? 'animate-spin' : ''}`} />
            <span>{testingWriteDelete ? 'Menguji Tulis & Hapus...' : 'Jalankan Tes Tulis & Hapus Sekarang'}</span>
          </Button>
        </div>

        {/* Live Test Diagnostic Output */}
        {testingWriteDelete && (
          <div className="p-3.5 rounded-xl bg-[var(--warning-soft)] border border-[var(--warning)]/35 text-xs text-amber-800 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-[var(--warning)]">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-700 dark:text-[var(--warning)]" />
              <span>Sedang memproses pengujian pipeline Google Sheets...</span>
            </div>
            <ul className="text-[11px] text-amber-800 dark:text-amber-200/90 space-y-1 list-disc list-inside">
              <li>Tahap 1: Mengirim dummy transaksi ke sheet LOG_PENJUALAN via saveTransaction...</li>
              <li>Tahap 2: Menunggu konfirmasi nomor baris yang tercatat di Spreadsheet...</li>
              <li>Tahap 3: Menjalankan penghapusan otomatis (deleteRow) agar sheet tetap bersih...</li>
            </ul>
          </div>
        )}

        {writeDeleteResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2.5 ${
              writeDeleteResult.success
                ? 'bg-[var(--success-soft)] border-[var(--success)]/35 text-emerald-900 dark:text-emerald-200'
                : 'bg-[var(--danger-soft)] border-[var(--danger)]/35 text-red-900 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {writeDeleteResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-[var(--success)] flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-700 dark:text-[var(--danger)] flex-shrink-0" />
              )}
              <h4 className="font-extrabold text-xs sm:text-sm text-[var(--foreground)]">
                {writeDeleteResult.message}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-1">
                <span className="font-bold text-[var(--muted)] block">1. Status Penulisan (WRITE):</span>
                <span className="text-[var(--foreground)] font-semibold">
                  {writeDeleteResult.writeResult?.message ||
                    (writeDeleteResult.stage === 'WRITE' ? 'Gagal pada tahap penulisan' : 'Berhasil')}
                </span>
                {writeDeleteResult.writeResult?.startRow && (
                  <span className="block font-mono text-[10px] text-emerald-700 dark:text-[var(--success)] font-bold">
                    Tercatat di baris: {writeDeleteResult.writeResult.startRow}
                  </span>
                )}
              </div>

              <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-1">
                <span className="font-bold text-[var(--muted)] block">2. Status Penghapusan (DELETE):</span>
                <span className="text-[var(--foreground)] font-semibold">
                  {writeDeleteResult.deleteResult?.message ||
                    (writeDeleteResult.success ? 'Berhasil dihapus' : 'Belum selesai')}
                </span>
                {writeDeleteResult.deleteResult?.deletedSalesRows !== undefined && (
                  <span className="block font-mono text-[10px] text-emerald-700 dark:text-[var(--success)] font-bold">
                    Baris dihapus: {writeDeleteResult.deleteResult.deletedSalesRows} baris
                  </span>
                )}
              </div>
            </div>

            {writeDeleteResult.testId && (
              <p className="text-[10px] text-[var(--muted)] font-mono">
                ID Uji Coba: {writeDeleteResult.testId}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* URL Input & Quick Sync Controls */}
      <Card className="bg-[var(--surface)] rounded-2xl p-4 sm:p-5 border border-[var(--border)] shadow-none space-y-3 gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-extrabold text-[var(--foreground)]">
              Koneksi Web App Google Apps Script
            </h3>
          </div>
          {diagnostic?.success ? (
            <Chip
              size="sm"
              variant="soft"
              color="success"
              className="bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border border-[var(--success)]/30"
            >
              <Chip.Label className="text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                <span>TERHUBUNG</span>
              </Chip.Label>
            </Chip>
          ) : (
            <Chip
              size="sm"
              variant="soft"
              color="warning"
              className="bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border border-[var(--warning)]/30"
            >
              <Chip.Label className="text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                <span>Belum Terhubung</span>
              </Chip.Label>
            </Chip>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 fill-[var(--accent)]" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-[var(--foreground)]">URL Utama Toko:</span>
                <Chip
                  size="sm"
                  variant="soft"
                  color="success"
                  className="bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border border-[var(--success)]/30"
                >
                  <Chip.Label className="text-[10px] font-bold">Tersimpan Permanen</Chip.Label>
                </Chip>
              </div>
              <p className="text-[11px] font-mono text-[var(--muted)] truncate max-w-full sm:max-w-md mt-0.5" title={primaryStoreUrl}>
                {primaryStoreUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {webAppUrl.trim() !== primaryStoreUrl.trim() && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onPress={handleUsePrimaryUrl}
                aria-label="Gunakan URL Utama Toko saat ini"
                className="text-[11px] font-bold text-[var(--foreground)] bg-[var(--surface)] hover:bg-[var(--surface-tertiary)] border border-[var(--border)] px-3 rounded-xl min-h-[44px]"
              >
                <RotateCcw className="w-3 h-3 text-[var(--muted)]" />
                <span>Gunakan URL Utama</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onPress={handleSetCurrentAsPrimary}
              isDisabled={!webAppUrl.trim() || webAppUrl.trim() === primaryStoreUrl.trim()}
              aria-label="Jadikan URL yang diketik di bawah sebagai URL Utama Toko"
              className="text-[11px] font-bold text-[var(--accent)] bg-[var(--accent-soft)] hover:opacity-90 border border-[var(--accent)]/30 px-3 rounded-xl min-h-[44px]"
            >
              <Star className="w-3 h-3" />
              <span>Jadikan URL Utama</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onPress={handleStartEditPrimary}
              aria-label="Ketik atau paste URL Utama Toko baru"
              className="text-[11px] font-bold text-[var(--foreground)] bg-[var(--surface)] hover:bg-[var(--surface-tertiary)] border border-[var(--border)] px-3 rounded-xl min-h-[44px]"
            >
              <Pencil className="w-3 h-3 text-[var(--muted)]" />
              <span>Ubah URL Utama</span>
            </Button>
          </div>
        </div>

        {/* Panel input inline jika user klik "Ubah URL Utama" */}
        {isEditingPrimary && (
          <div className="p-3.5 bg-[var(--warning-soft)] border border-[var(--warning)]/35 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-[var(--warning)] flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-amber-700 dark:text-[var(--warning)]" />
                Masukkan URL Utama Toko yang Baru:
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onPress={() => setIsEditingPrimary(false)}
                className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] font-semibold px-2 min-h-[36px]"
              >
                Batal
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="url"
                fullWidth
                variant="secondary"
                value={primaryInputDraft}
                onChange={(e) => setPrimaryInputDraft(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-mono text-[var(--foreground)] min-h-[44px]"
              />
              <Button
                type="button"
                variant="primary"
                onPress={handleSaveEditedPrimary}
                className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs font-bold rounded-xl whitespace-nowrap min-h-[44px] px-4"
              >
                Simpan Sebagai URL Utama
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="url"
            fullWidth
            variant="secondary"
            value={webAppUrl}
            onChange={(e) => setWebAppUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
            className="flex-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs font-mono text-[var(--foreground)] min-h-[44px]"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onPress={handleSaveAndTest}
              isDisabled={testing}
              className="flex-1 sm:flex-initial bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border)] text-[var(--foreground)] text-xs font-bold rounded-xl min-h-[44px] px-3.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--muted)] ${testing ? 'animate-spin text-[var(--accent)]' : ''}`} />
              <span>{testing ? 'Menguji...' : 'Uji Koneksi'}</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              onPress={handlePullAllData}
              isDisabled={syncing || !webAppUrl.trim()}
              className="flex-1 sm:flex-initial bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs font-bold uppercase tracking-wider rounded-xl min-h-[44px] px-4"
            >
              <ArrowDownCircle className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
              <span>{syncing ? 'Menarik...' : 'Tarik Data'}</span>
            </Button>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--success-soft)] border border-[var(--success)]/35 text-emerald-800 dark:text-[var(--success)] text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-[var(--success)] flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/35 text-red-700 dark:text-[var(--danger)] text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-red-700 dark:text-[var(--danger)] flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Diagnostics Panel */}
        {diagnostic && diagnostic.success && (
          <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-3.5 space-y-2 mt-2">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[var(--accent)]" />
                Hasil Diagnostik Spreadsheet
              </span>
              <span className="text-[10px] text-[var(--muted)] font-medium">
                {diagnostic.timezone || 'Asia/Jakarta'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                <p className="text-[var(--muted)] text-[10px] uppercase font-bold">Sheet Produk</p>
                <p className="font-bold text-[var(--foreground)] mt-0.5 truncate">
                  {diagnostic.sheetsStatus?.productsSheetName || 'DASHBOARD_MUTASI_&_PROFIT'}
                </p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5 tabular-nums">
                  {diagnostic.sheetsStatus?.productsRowCount ? `${diagnostic.sheetsStatus.productsRowCount} baris` : 'Baris 71+'} (Read)
                </p>
              </div>

              <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                <p className="text-[var(--muted)] text-[10px] uppercase font-bold">Log Penjualan</p>
                <p className="font-bold text-[var(--foreground)] mt-0.5 truncate">
                  {diagnostic.sheetsStatus?.salesLogSheetName || 'LOG_PENJUALAN'}
                </p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5 tabular-nums">
                  {diagnostic.sheetsStatus?.salesLogRowCount ? `${diagnostic.sheetsStatus.salesLogRowCount} baris` : 'Baris 8+'} (Write)
                </p>
              </div>

              <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                <p className="text-[var(--muted)] text-[10px] uppercase font-bold">Barang Masuk</p>
                <p className="font-bold text-[var(--foreground)] mt-0.5 truncate">LOG_BARANG_MASUK</p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5 tabular-nums">
                  {diagnostic.sheetsStatus?.barangMasukRowCount ? `${diagnostic.sheetsStatus.barangMasukRowCount} baris` : 'Baris 5+'} (Write)
                </p>
              </div>

              <div className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                <p className="text-emerald-700 dark:text-[var(--success)] text-[10px] uppercase font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                  Sheet LAIN-LAIN
                </p>
                <p className="font-bold text-[var(--foreground)] mt-0.5 truncate">LAIN-LAIN</p>
                <p className="text-[10px] text-emerald-700 dark:text-[var(--success)] font-medium mt-0.5 tabular-nums">
                  {diagnostic.sheetsStatus?.pengeluaranLainRowCount ? `${diagnostic.sheetsStatus.pengeluaranLainRowCount} baris` : 'A4:F'} (Read & Write)
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Column J Category Assistant Card */}
      <Card className="bg-[var(--surface)] rounded-3xl p-4 sm:p-5 border border-[var(--border)] shadow-none space-y-4 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] tracking-tight">
                  Kategori Produk Kolom J (B70:J)
                </h3>
                <Chip
                  size="sm"
                  variant="soft"
                  color="success"
                  className="bg-[var(--success-soft)] text-emerald-700 dark:text-[var(--success)] border border-[var(--success)]/30"
                >
                  <Chip.Label className="text-[10px] font-bold">Sinkron Aktif</Chip.Label>
                </Chip>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Range{' '}
                <code className="bg-[var(--surface-secondary)] border border-[var(--border)] px-1.5 py-0.5 rounded font-mono text-[11px] text-[var(--foreground)] font-bold">
                  DASHBOARD_MUTASI_&_PROFIT B70:J
                </code>{' '}
                (Cell J70: Header KATEGORI, Cell J71+: Data Kategori).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onPress={handleCopyColumnJValues}
              aria-label="Salin semua kategori untuk langsung di-paste di sel J71 Google Sheets"
              className="bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border)] text-[var(--foreground)] text-xs font-bold rounded-xl min-h-[44px] px-3"
            >
              {copiedCategories ? <CheckCheck className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--muted)]" />}
              <span>{copiedCategories ? 'Tersalin!' : 'Salin Data Kolom J'}</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              onPress={handleFillCategoriesInSheet}
              isDisabled={fillingCategories || !webAppUrl.trim()}
              aria-label="Perintahkan Google Apps Script untuk mengisi Kolom J di Spreadsheet secara otomatis"
              className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-xs font-bold rounded-xl min-h-[44px] px-3.5"
            >
              <Sparkles className={`w-3.5 h-3.5 ${fillingCategories ? 'animate-spin' : ''}`} />
              <span>{fillingCategories ? 'Mengisi...' : '✨ Auto-Fill Kolom J di Sheets'}</span>
            </Button>
          </div>
        </div>

        {/* Informational guide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div className="p-3 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider block">Aturan Kolom J</span>
            <p className="text-xs text-[var(--muted)] font-medium mt-1 leading-snug">
              Jika Kolom J diisi di Google Sheets, sistem kasir akan langsung memakai kategori tersebut. Jika masih kosong, sistem menggunakan klasifikasi otomatis.
            </p>
          </div>

          <div className="p-3 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider block">Opsi 1: Klik 1 Tombol</span>
            <p className="text-xs text-[var(--muted)] font-medium mt-1 leading-snug">
              Klik <strong className="text-[var(--foreground)]">Auto-Fill Kolom J di Sheets</strong> di atas. Apps Script akan otomatis mengisi cell J70 ('KATEGORI') dan baris 71 ke bawah dengan kategori yang tepat.
            </p>
          </div>

          <div className="p-3 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider block">Opsi 2: Salin & Paste Manual</span>
            <p className="text-xs text-[var(--muted)] font-medium mt-1 leading-snug">
              Klik <strong className="text-[var(--foreground)]">Salin Data Kolom J</strong>, lalu buka Google Sheets, klik sel <strong className="text-[var(--foreground)]">J71</strong>, dan tekan <strong className="text-[var(--foreground)]">Ctrl + V</strong>.
            </p>
          </div>
        </div>

        {/* Toggle table preview */}
        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            onPress={() => setShowCategoryTable(!showCategoryTable)}
            className="text-xs font-bold text-[var(--foreground)] hover:text-[var(--accent)] px-2 min-h-[44px]"
          >
            <span>
              {showCategoryTable
                ? 'Sembunyikan Daftar Kategori Kolom J'
                : `Lihat Daftar Pemetaan Kategori Produk (${productsList.length} Item)`}
            </span>
            {showCategoryTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {showCategoryTable && (
            <div className="mt-3 space-y-3 border border-[var(--border)] rounded-2xl p-3 bg-[var(--surface-secondary)]">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none z-10" />
                  <Input
                    type="text"
                    fullWidth
                    variant="secondary"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Cari SKU, Nama, atau Kategori..."
                    className="pl-8 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs text-[var(--foreground)] min-h-[44px]"
                  />
                </div>

                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 w-full sm:w-auto max-w-full">
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedCatFilter === 'ALL' ? 'primary' : 'outline'}
                    onPress={() => setSelectedCatFilter('ALL')}
                    className={`rounded-lg text-[11px] font-bold whitespace-nowrap min-h-[40px] px-3 ${
                      selectedCatFilter === 'ALL'
                        ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    Semua ({productsList.length})
                  </Button>
                  {uniqueCategories.map((cat) => (
                    <Button
                      type="button"
                      size="sm"
                      key={cat}
                      variant={selectedCatFilter === cat ? 'primary' : 'outline'}
                      onPress={() => setSelectedCatFilter(cat)}
                      className={`rounded-lg text-[11px] font-bold whitespace-nowrap min-h-[40px] px-3 ${
                        selectedCatFilter === cat
                          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Mobile Card List (<640px) */}
              <div className="sm:hidden max-h-72 overflow-y-auto space-y-2">
                {filteredProducts.map((p, idx) => (
                  <div
                    key={p.id || p.sku || idx}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-[var(--foreground)] truncate">
                        #{p.rowNumber || 71 + idx} • {p.sku}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 shrink-0">
                        {p.category}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[var(--foreground)] break-words">
                      {p.name}
                    </p>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="px-4 py-6 text-center text-[var(--muted)] text-xs bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                    Tidak ditemukan produk yang cocok dengan pencarian.
                  </div>
                )}
              </div>

              {/* Desktop Table (>=640px) */}
              <div className="hidden sm:block max-h-72 overflow-y-auto overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <table className="w-full text-left text-xs min-w-[460px]">
                  <thead className="sticky top-0 bg-[var(--surface-secondary)] border-b border-[var(--border)] text-[var(--muted)] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5 w-16">Baris Sheet</th>
                      <th className="px-3 py-2.5 w-28">SKU</th>
                      <th className="px-3 py-2.5">Nama Produk</th>
                      <th className="px-3 py-2.5">Kategori Kolom J</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredProducts.map((p, idx) => (
                      <tr key={p.id || p.sku || idx} className="hover:bg-[var(--surface-secondary)] transition-colors">
                        <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted)] tabular-nums">
                          {p.rowNumber || 71 + idx}
                        </td>
                        <td className="px-3 py-2 font-mono text-[var(--foreground)] font-bold">
                          {p.sku}
                        </td>
                        <td className="px-3 py-2 text-[var(--foreground)] font-medium">
                          {p.name}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30">
                            {p.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-[var(--muted)] text-xs">
                          Tidak ditemukan produk yang cocok dengan pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 3 Step Deployment Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-none space-y-1.5 gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center text-xs font-bold">
              1
            </span>
            <h4 className="font-bold text-xs text-[var(--foreground)]">Buka Spreadsheet</h4>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Buka file Google Sheets ORTUKILL Anda. Klik menu <strong className="text-[var(--foreground)]">Ekstensi</strong> &gt;{' '}
            <strong className="text-[var(--foreground)]">Apps Script</strong>.
          </p>
        </Card>

        <Card className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-none space-y-1.5 gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center text-xs font-bold">
              2
            </span>
            <h4 className="font-bold text-xs text-[var(--foreground)]">Perbarui Kode.gs</h4>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Klik tombol "Salin Kode .gs Terbaru" di atas, ganti seluruh isi file{' '}
            <code className="text-[var(--foreground)] font-mono text-[10px] bg-[var(--surface-secondary)] border border-[var(--border)] px-1 py-0.5 rounded">
              Kode.gs
            </code>
            , lalu klik Simpan.
          </p>
        </Card>

        <Card className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-none space-y-1.5 gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center text-xs font-bold">
              3
            </span>
            <h4 className="font-bold text-xs text-[var(--foreground)]">Deployment Baru (Wajib Versi Baru)</h4>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Klik <strong className="text-[var(--foreground)]">Terapkan (Deploy)</strong> &gt;{' '}
            <strong className="text-[var(--foreground)]">Kelola penerapan (Manage deployments)</strong> &gt; Ikon pensil (Edit) &gt; Versi:{' '}
            <strong className="text-[var(--foreground)]">Versi baru (New version)</strong> &gt; Terapkan. Pastikan Akses:{' '}
            <strong className="text-[var(--foreground)]">Siapa saja (Anyone)</strong>.
          </p>
        </Card>
      </div>

      {/* Code Preview Box */}
      <Card className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-none overflow-hidden min-w-0 p-0 gap-0">
        <div className="px-4 py-3 bg-[var(--surface-secondary)] border-b border-[var(--border)] flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-2 min-w-0">
            <FileCode2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span className="truncate">Kode.gs (Google Apps Script Backend)</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onPress={handleCopyCode}
            className="text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)] px-2.5 min-h-[40px] shrink-0 rounded-lg"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin</span>
          </Button>
        </div>
        <pre className="p-4 text-[11px] font-mono text-[var(--foreground)] overflow-x-auto max-h-72 leading-relaxed bg-[var(--background)] select-all max-w-full">
          {scriptCode}
        </pre>
      </Card>
    </div>
  );
};
