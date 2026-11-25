import React, { useState } from 'react';
import { Button, Card, Chip, Input, TextArea } from '@heroui/react';
import { 
  Wallet, 
  Printer, 
  Clock,
  ArrowDownCircle,
  FileCheck,
  Plus
} from 'lucide-react';
import { ShiftRecord, BrandConfig } from '../types';
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
    <div className="space-y-4 max-w-7xl mx-auto pb-24 text-[var(--foreground)]">
      {/* Top Header Card */}
      <Card className="bg-[var(--surface)] rounded-2xl p-4 sm:p-5 gap-3 border border-[var(--border)] shadow-none flex flex-col sm:flex-row sm:items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-[var(--foreground)]">
                Rekap &amp; Tutup Shift Kasir
              </h2>
              <Chip
                size="sm"
                variant="soft"
                color={currentShift.status === 'OPEN' ? 'success' : 'default'}
                className="font-bold border border-[var(--border)]"
              >
                <Chip.Label>{currentShift.status === 'OPEN' ? 'Shift Aktif' : 'Shift Ditutup'}</Chip.Label>
              </Chip>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
              Kasir: <strong className="text-[var(--foreground)]">{currentShift.cashierName}</strong> • Sejak {currentShift.startTime}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onPress={handlePrintShiftReport}
          className="rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] border-[var(--border)] text-xs font-semibold min-h-[44px] w-full sm:w-auto px-4"
        >
          <Printer className="w-4 h-4 text-[var(--accent)]" />
          <span>Cetak Laporan Shift</span>
        </Button>
      </Card>

      {currentShift.status === 'OPEN' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Drawer Status & Petty Cash (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Cash Drawer Reconciliation Grid */}
            <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-3 border border-[var(--border)] shadow-none">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Kalkulasi Uang Tunai di Laci
                </span>
                <Chip size="sm" variant="soft" color="accent" className="font-bold border border-[var(--accent)]/25">
                  <Chip.Label>Sistem Kasir</Chip.Label>
                </Chip>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--muted)] font-semibold block uppercase">Modal Awal</span>
                  <p className="font-extrabold text-[var(--foreground)] mt-1 tabular-nums font-mono">{formatRupiah(currentShift.startingCash)}</p>
                </div>

                <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--muted)] font-semibold block uppercase">Penjualan Tunai</span>
                  <p className="font-extrabold text-emerald-700 dark:text-[var(--success)] mt-1 tabular-nums font-mono">+{formatRupiah(todayCashSales)}</p>
                </div>

                <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--muted)] font-semibold block uppercase">Kas Keluar</span>
                  <p className="font-extrabold text-[var(--danger)] mt-1 tabular-nums font-mono">-{formatRupiah(totalExpenses)}</p>
                </div>

                <div className="bg-[var(--success-soft)] p-3 rounded-xl border border-[var(--success)]/35">
                  <span className="text-[10px] text-emerald-700 dark:text-[var(--success)] font-bold block uppercase">Target Laci</span>
                  <p className="font-extrabold text-emerald-700 dark:text-[var(--success)] mt-1 tabular-nums font-mono">{formatRupiah(expectedCashInDrawer)}</p>
                </div>
              </div>
            </Card>

            {/* Non-Cash Channels Info */}
            <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2.5 border border-[var(--border)] shadow-none">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                Penerimaan Non-Tunai (Rekening / QRIS)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl flex items-center justify-between gap-2">
                  <span className="text-[var(--muted)] font-medium">QRIS Merchant:</span>
                  <span className="font-extrabold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono">{formatRupiah(todayQrisSales)}</span>
                </div>
                <div className="p-3 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl flex items-center justify-between gap-2">
                  <span className="text-[var(--muted)] font-medium">Transfer Bank:</span>
                  <span className="font-extrabold text-[var(--accent)] tabular-nums font-mono">{formatRupiah(todayTransferSales)}</span>
                </div>
              </div>
            </Card>

            {/* Petty Cash / Operational Expense */}
            <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-3 border border-[var(--border)] shadow-none">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-[var(--danger)]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                    Pengeluaran Operasional / Kas Keluar
                  </h4>
                </div>
                <span className="text-xs font-bold text-[var(--danger)] tabular-nums font-mono">
                  Total: -{formatRupiah(totalExpenses)}
                </span>
              </div>

              {/* Add Expense Form */}
              <form onSubmit={handleAddExpenseSubmit} className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  variant="secondary"
                  placeholder="Keterangan (Es Batu, Aqua Galon, Plastik)..."
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)] min-h-[44px]"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    variant="secondary"
                    placeholder="Nominal Rp"
                    value={expenseAmount ? String(expenseAmount) : ''}
                    onChange={(e) => setExpenseAmount(Number(e.target.value) || 0)}
                    className="flex-1 sm:w-36 px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-semibold text-[var(--foreground)] min-h-[44px] tabular-nums font-mono"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 min-h-[44px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat</span>
                  </Button>
                </div>
              </form>

              {/* Expense History List */}
              <div className="space-y-2 pt-1">
                {(currentShift.expenses || []).length === 0 ? (
                  <p className="text-xs text-[var(--muted)] italic py-2">
                    Belum ada pengeluaran kas tercatat pada shift ini.
                  </p>
                ) : (
                  currentShift.expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between gap-2 p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-[var(--muted)] font-mono shrink-0">{exp.time}</span>
                        <span className="font-semibold text-[var(--foreground)] truncate">{exp.description}</span>
                      </div>
                      <span className="font-bold text-[var(--danger)] tabular-nums font-mono shrink-0">-{formatRupiah(exp.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Close Shift Form (5 cols) */}
          <div className="lg:col-span-5">
            <Card className="bg-[var(--surface)] rounded-2xl p-4 sm:p-5 gap-4 border border-[var(--border)] shadow-none">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  Form Tutup Shift &amp; Serah Terima
                </h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Hitung fisik uang kas lembaran &amp; koin di laci
                </p>
              </div>

              {/* Count Input Box */}
              <div className="p-3.5 bg-[var(--surface-secondary)] rounded-2xl space-y-2.5 border border-[var(--border)]">
                <div className="flex justify-between text-xs text-[var(--muted)]">
                  <span>Target Kas Sistem:</span>
                  <span className="font-extrabold text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(expectedCashInDrawer)}</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Fisik Uang Terhitung (Actual Cash):
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    fullWidth
                    value={actualCashCounted ? String(actualCashCounted) : ''}
                    onChange={(e) => setActualCashCounted(Number(e.target.value) || 0)}
                    placeholder="Masukkan jumlah fisik uang..."
                    className="w-full px-3.5 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--foreground)] tabular-nums font-mono min-h-[44px]"
                  />
                </div>

                {/* Discrepancy indicator */}
                <div className="pt-2 border-t border-[var(--border)] flex justify-between items-center text-xs gap-2">
                  <span className="text-[var(--muted)] font-medium">Status Selisih:</span>
                  <span className={`font-extrabold tabular-nums font-mono ${
                    difference === 0
                      ? 'text-emerald-700 dark:text-[var(--success)]'
                      : difference > 0
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--danger)]'
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                  Catatan untuk Shift Berikutnya:
                </label>
                <TextArea
                  rows={3}
                  fullWidth
                  variant="secondary"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Contoh: Sisa koin Rp 500 aman, es batu sisa 1 termos..."
                  className="w-full p-3 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)]"
                />
              </div>

              <Button
                variant="primary"
                fullWidth
                onPress={handleCloseShiftSubmit}
                className="w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider min-h-[48px]"
              >
                Tutup Shift &amp; Simpan Laporan
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        /* Open New Shift Card */
        <Card className="bg-[var(--surface)] rounded-2xl p-5 sm:p-6 gap-4 max-w-md mx-auto text-center border border-[var(--border)] shadow-none">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 flex items-center justify-center mx-auto">
            <FileCheck className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-extrabold text-[var(--foreground)]">Shift Kasir Telah Ditutup</h3>
            <p className="text-xs text-[var(--muted)] mt-1">
              Buka shift kasir baru untuk memulai transaksi berikutnya
            </p>
          </div>

          <div className="text-left space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase text-[var(--muted)] mb-1">
                Nama Kasir Bertugas:
              </label>
              <Input
                type="text"
                fullWidth
                variant="secondary"
                value={newCashier}
                onChange={(e) => setNewCashier(e.target.value)}
                className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[var(--muted)] mb-1">
                Modal Awal di Laci:
              </label>
              <Input
                type="number"
                min={0}
                step={1}
                fullWidth
                variant="secondary"
                value={String(newStartingCash)}
                onChange={(e) => setNewStartingCash(Number(e.target.value) || 0)}
                className="w-full p-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl font-bold text-[var(--foreground)] tabular-nums font-mono min-h-[44px]"
              />
            </div>

            <Button
              variant="primary"
              fullWidth
              onPress={() => onStartNewShift(newStartingCash, newCashier)}
              className="w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider mt-2 min-h-[48px]"
            >
              Buka Shift Baru ({formatRupiah(newStartingCash)})
            </Button>
          </div>
        </Card>
      )}

      {/* Historic Closed Shifts */}
      {shiftHistory.length > 0 && (
        <Card className="bg-[var(--surface)] rounded-2xl p-4 gap-2.5 border border-[var(--border)] shadow-none">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Riwayat Shift Sebelumnya ({shiftHistory.length})
          </h3>
          <div className="space-y-2">
            {shiftHistory.slice(0, 5).map((sh) => (
              <div
                key={sh.id}
                className="p-3 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2.5"
              >
                <div>
                  <span className="font-bold text-[var(--foreground)]">{sh.cashierName}</span>
                  <p className="text-[10px] text-[var(--muted)] mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{sh.startTime} — {sh.endTime || 'Selesai'}</span>
                  </p>
                </div>

                <div className="grid grid-cols-3 sm:flex items-center gap-3 sm:gap-5 text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Kas Masuk</span>
                    <span className="font-bold text-emerald-700 dark:text-[var(--success)] tabular-nums font-mono">{formatRupiah(sh.cashSales)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Fisik Dihitung</span>
                    <span className="font-bold text-[var(--foreground)] tabular-nums font-mono">{formatRupiah(sh.actualCash || 0)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Selisih</span>
                    <span className={`font-bold tabular-nums font-mono ${
                      (sh.difference || 0) === 0 ? 'text-emerald-700 dark:text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}>
                      {formatRupiah(sh.difference || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
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
