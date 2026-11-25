import React, { useState } from 'react';
import { 
  Wallet, 
  Printer, 
  Receipt, 
  Banknote, 
  Clock,
  ArrowDownCircle,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus
} from 'lucide-react';
import { ShiftRecord, CashExpense, BrandConfig } from '../types';
import { formatRupiah } from '../services/storageService';
import { AppConfirmDialog } from './AppConfirmDialog';

interface ShiftClosingViewProps {
  currentShift: ShiftRecord;
  shiftHistory: ShiftRecord[];
  todayCashSales: number;
  todayQrisSales: number;
  todayTransferSales: number;
  brand: BrandConfig;
  onAddExpense: (description: string, amount: number) => void;
  onCloseShift: (actualCash: number, notes: string) => void;
  onStartNewShift: (startingCash: number, cashierName: string) => void;
}

export const ShiftClosingView: React.FC<ShiftClosingViewProps> = ({
  currentShift,
  shiftHistory,
  todayCashSales,
  todayQrisSales,
  todayTransferSales,
  brand,
  onAddExpense,
  onCloseShift,
  onStartNewShift,
}) => {
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);

  const [actualCashCounted, setActualCashCounted] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');

  const [newCashier, setNewCashier] = useState('Kasir Kediri');
  const [newStartingCash, setNewStartingCash] = useState<number>(100000);
  const [showZeroCashConfirm, setShowZeroCashConfirm] = useState(false);

  const totalExpenses = (currentShift.expenses || []).reduce((sum, e) => sum + e.amount, 0);
  const expectedCashInDrawer = currentShift.startingCash + todayCashSales - totalExpenses;
  const difference = actualCashCounted - expectedCashInDrawer;

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || expenseAmount <= 0) return;
    onAddExpense(expenseDesc.trim(), expenseAmount);
    setExpenseDesc('');
    setExpenseAmount(0);
  };

  const handleCloseShiftSubmit = () => {
    if (actualCashCounted <= 0) {
      setShowZeroCashConfirm(true);
      return;
    }
    onCloseShift(actualCashCounted, closingNotes);
  };

  const handlePrintShiftReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24 text-[#0F172A] dark:text-[#F4F4F6]">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/40 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-[#0F172A] dark:text-[#F4F4F6]">
                Rekap & Tutup Shift Kasir
              </h2>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                currentShift.status === 'OPEN'
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/35'
                  : 'bg-slate-100 dark:bg-[#24242B] text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-[#343440]'
              }`}>
                {currentShift.status === 'OPEN' ? 'Shift Aktif' : 'Shift Ditutup'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              Kasir: <strong className="text-[#0F172A] dark:text-[#F4F4F6]">{currentShift.cashierName}</strong> • Sejak {currentShift.startTime}
            </p>
          </div>
        </div>

        <button
          onClick={handlePrintShiftReport}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] text-[#0F172A] dark:text-[#F4F4F6] border border-slate-200 dark:border-[#343440] text-xs font-semibold transition-colors cursor-pointer min-h-[44px] w-full sm:w-auto"
        >
          <Printer className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC]" />
          <span>Cetak Laporan Shift</span>
        </button>
      </div>

      {currentShift.status === 'OPEN' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Drawer Status & Petty Cash (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Cash Drawer Reconciliation Grid */}
            <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Kalkulasi Uang Tunai di Laci
                </span>
                <span className="text-[10px] bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/40 px-2.5 py-0.5 rounded-full font-bold">
                  Sistem Kasir
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440]">
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold block uppercase">Modal Awal</span>
                  <p className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] mt-1 tabular-nums font-mono">{formatRupiah(currentShift.startingCash)}</p>
                </div>

                <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440]">
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold block uppercase">Penjualan Tunai</span>
                  <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums font-mono">+{formatRupiah(todayCashSales)}</p>
                </div>

                <div className="bg-slate-50 dark:bg-[#24242B] p-3 rounded-xl border border-slate-200 dark:border-[#343440]">
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold block uppercase">Kas Keluar</span>
                  <p className="font-extrabold text-red-600 dark:text-red-400 mt-1 tabular-nums font-mono">-{formatRupiah(totalExpenses)}</p>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-500/15 p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/35">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block uppercase">Target Laci</span>
                  <p className="font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums font-mono">{formatRupiah(expectedCashInDrawer)}</p>
                </div>
              </div>
            </div>

            {/* Non-Cash Channels Info */}
            <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                Penerimaan Non-Tunai (Rekening / QRIS)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-zinc-300 font-medium">QRIS Merchant:</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums font-mono">{formatRupiah(todayQrisSales)}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-zinc-300 font-medium">Transfer Bank:</span>
                  <span className="font-extrabold text-[#2563EB] dark:text-[#C084FC] tabular-nums font-mono">{formatRupiah(todayTransferSales)}</span>
                </div>
              </div>
            </div>

            {/* Petty Cash / Operational Expense */}
            <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    Pengeluaran Operasional / Kas Keluar
                  </h4>
                </div>
                <span className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums font-mono">
                  Total: -{formatRupiah(totalExpenses)}
                </span>
              </div>

              {/* Add Expense Form */}
              <form onSubmit={handleAddExpenseSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Keterangan (Es Batu, Aqua Galon, Plastik)..."
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Nominal Rp"
                    value={expenseAmount || ''}
                    onChange={(e) => setExpenseAmount(Number(e.target.value) || 0)}
                    className="flex-1 sm:w-36 px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px] tabular-nums font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-[#2563EB] dark:bg-[#9333EA] hover:bg-[#1D4ED8] dark:hover:bg-[#A855F7] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 shrink-0 min-h-[44px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat</span>
                  </button>
                </div>
              </form>

              {/* Expense History List */}
              <div className="space-y-2 pt-1">
                {(currentShift.expenses || []).length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-2">
                    Belum ada pengeluaran kas tercatat pada shift ini.
                  </p>
                ) : (
                  currentShift.expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono shrink-0">{exp.time}</span>
                        <span className="font-semibold text-[#0F172A] dark:text-[#F4F4F6] truncate">{exp.description}</span>
                      </div>
                      <span className="font-bold text-red-600 dark:text-red-400 tabular-nums font-mono shrink-0">-{formatRupiah(exp.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Close Shift Form (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#2B2B33] space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6]">
                  Form Tutup Shift & Serah Terima
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Hitung fisik uang kas lembaran & koin di laci
                </p>
              </div>

              {/* Count Input Box */}
              <div className="p-3.5 bg-slate-50 dark:bg-[#24242B] rounded-2xl space-y-2.5 border border-slate-200 dark:border-[#343440]">
                <div className="flex justify-between text-xs text-slate-600 dark:text-zinc-300">
                  <span>Target Kas Sistem:</span>
                  <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(expectedCashInDrawer)}</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-1.5">
                    Fisik Uang Terhitung (Actual Cash):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={actualCashCounted || ''}
                    onChange={(e) => setActualCashCounted(Number(e.target.value) || 0)}
                    placeholder="Masukkan jumlah fisik uang..."
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#343440] rounded-xl text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] tabular-nums font-mono min-h-[44px]"
                  />
                </div>

                {/* Discrepancy indicator */}
                <div className="pt-2 border-t border-slate-200 dark:border-[#343440] flex justify-between items-center text-xs gap-2">
                  <span className="text-slate-600 dark:text-zinc-300 font-medium">Status Selisih:</span>
                  <span className={`font-extrabold tabular-nums font-mono ${
                    difference === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : difference > 0
                      ? 'text-[#2563EB] dark:text-[#C084FC]'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {difference === 0
                      ? 'KLOP / SESUAI (Rp 0)'
                      : difference > 0
                      ? `SURPLUS +${formatRupiah(difference)}`
                      : `MINUS -${formatRupiah(Math.abs(difference))}`}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-1.5">
                  Catatan untuk Shift Berikutnya:
                </label>
                <textarea
                  rows={3}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Contoh: Sisa koin Rp 500 aman, es batu sisa 1 termos..."
                  className="w-full p-3 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20]"
                />
              </div>

              <button
                onClick={handleCloseShiftSubmit}
                className="w-full py-3.5 rounded-xl bg-[#2563EB] dark:bg-[#9333EA] hover:bg-[#1D4ED8] dark:hover:bg-[#A855F7] dark:shadow-[0_0_16px_rgba(168,85,247,0.3)] text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer min-h-[48px]"
              >
                Tutup Shift & Simpan Laporan
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Open New Shift Card */
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-5 sm:p-6 max-w-md mx-auto text-center space-y-4 border border-slate-200 dark:border-[#2B2B33]">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-purple-500/15 text-[#2563EB] dark:text-[#C084FC] border border-blue-200 dark:border-purple-500/40 flex items-center justify-center mx-auto">
            <FileCheck className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-extrabold text-[#0F172A] dark:text-[#F4F4F6]">Shift Kasir Telah Ditutup</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Buka shift kasir baru untuk memulai transaksi berikutnya
            </p>
          </div>

          <div className="text-left space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-zinc-300 mb-1">
                Nama Kasir Bertugas:
              </label>
              <input
                type="text"
                value={newCashier}
                onChange={(e) => setNewCashier(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-zinc-300 mb-1">
                Modal Awal di Laci:
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={newStartingCash}
                onChange={(e) => setNewStartingCash(Number(e.target.value) || 0)}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] tabular-nums font-mono min-h-[44px]"
              />
            </div>

            <button
              onClick={() => onStartNewShift(newStartingCash, newCashier)}
              className="w-full py-3.5 rounded-xl bg-[#2563EB] dark:bg-[#9333EA] hover:bg-[#1D4ED8] dark:hover:bg-[#A855F7] dark:shadow-[0_0_16px_rgba(168,85,247,0.3)] text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer mt-2 min-h-[48px]"
            >
              Buka Shift Baru ({formatRupiah(newStartingCash)})
            </button>
          </div>
        </div>
      )}

      {/* Historic Closed Shifts */}
      {shiftHistory.length > 0 && (
        <div className="bg-white dark:bg-[#1B1B20] rounded-2xl p-4 border border-slate-200 dark:border-[#2B2B33] space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Riwayat Shift Sebelumnya ({shiftHistory.length})
          </h3>
          <div className="space-y-2">
            {shiftHistory.slice(0, 5).map((sh) => (
              <div
                key={sh.id}
                className="p-3 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2.5"
              >
                <div>
                  <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6]">{sh.cashierName}</span>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    {sh.startTime} — {sh.endTime || 'Selesai'}
                  </p>
                </div>

                <div className="grid grid-cols-3 sm:flex items-center gap-3 sm:gap-5 text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-[#343440]">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Kas Masuk</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">{formatRupiah(sh.cashSales)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Fisik Dihitung</span>
                    <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums font-mono">{formatRupiah(sh.actualCash || 0)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Selisih</span>
                    <span className={`font-bold tabular-nums font-mono ${
                      (sh.difference || 0) === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatRupiah(sh.difference || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AppConfirmDialog
        isOpen={showZeroCashConfirm}
        title="Fisik Uang Kas Rp 0?"
        description="Fisik uang kas terhitung masih Rp 0. Yakin ingin menutup shift dan menyimpan laporan dengan nominal Rp 0?"
        confirmLabel="Ya, Tutup Shift"
        cancelLabel="Batal"
        variant="warning"
        onCancel={() => setShowZeroCashConfirm(false)}
        onConfirm={() => {
          setShowZeroCashConfirm(false);
          onCloseShift(actualCashCounted, closingNotes);
        }}
      />
    </div>
  );
};
