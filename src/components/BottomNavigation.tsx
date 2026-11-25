import React, { useState } from 'react';
import { Button, Chip, Drawer, Separator } from '@heroui/react';
import {
  Store,
  TrendingUp,
  Package,
  MoreHorizontal,
  Wallet,
  Clock3,
  FileCode2,
  RotateCcw,
  ChevronRight,
  Receipt,
  Sparkles,
  Moon,
  Sun,
} from 'lucide-react';
import { useOverlayHistory } from '../utils/useOverlayHistory';
import { AppConfirmDialog } from './AppConfirmDialog';

interface BottomNavigationProps {
  activeTab: 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas' | 'finance';
  setActiveTab: (tab: 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas' | 'finance') => void;
  todayCount: number;
  cartCount: number;
  isConnectedGas: boolean;
  onResetData: () => void;
  onOpenAiCopilot?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  setActiveTab,
  todayCount,
  cartCount,
  isConnectedGas,
  onResetData,
  onOpenAiCopilot,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useOverlayHistory(isMoreMenuOpen, () => setIsMoreMenuOpen(false), 'bottom-more-menu');

  const isMoreActive = activeTab === 'today' || activeTab === 'shift' || activeTab === 'gas';

  const navItems = [
    {
      id: 'pos' as const,
      label: 'Kasir',
      icon: Store,
      badge: cartCount > 0 ? `${cartCount}` : null,
    },
    {
      id: 'stock' as const,
      label: 'Stok',
      icon: Package,
      badge: null,
    },
    {
      id: 'history' as const,
      label: 'Laporan',
      icon: TrendingUp,
      badge: null,
    },
    {
      id: 'finance' as const,
      label: 'Buku Kas',
      title: 'Arus Kas & Buku Kas Pengeluaran',
      icon: Wallet,
      badge: null,
    },
  ];

  return (
    <>
      {/* More Options Bottom Sheet Drawer */}
      <Drawer
        isOpen={isMoreMenuOpen}
        onOpenChange={(open) => {
          if (!open) setIsMoreMenuOpen(false);
        }}
      >
        <Drawer.Backdrop variant="opaque">
          <Drawer.Content placement="bottom">
            <Drawer.Dialog
              aria-label="Menu Lainnya"
              className="relative p-0 gap-0 w-full max-w-lg mx-auto bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] overflow-hidden"
            >
              <Drawer.Handle className="pt-2.5 pb-1 sm:hidden" />

              {/* Fixed Header */}
              <Drawer.Header className="px-4 sm:px-5 pt-2 sm:pt-4 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                <div className="min-w-0">
                  <Drawer.Heading className="text-base font-bold text-[var(--foreground)] truncate">
                    Menu Lainnya
                  </Drawer.Heading>
                  <p className="text-xs text-[var(--muted)] truncate">
                    Riwayat nota, tutup shift & koneksi Google Sheets
                  </p>
                </div>
                <Drawer.CloseTrigger
                  aria-label="Tutup menu"
                  className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                />
              </Drawer.Header>

              {/* Scrollable Menu Items */}
              <Drawer.Body className="!mt-0 p-4 sm:p-5 space-y-2.5 pb-safe">
                {/* Theme Switch Row */}
                {onToggleDarkMode && (
                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] transition-colors active:scale-[0.98] text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isDarkMode
                            ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                            : 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]'
                        }`}
                      >
                        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--foreground)] truncate">
                          {isDarkMode ? 'Mode Gelap Aktif' : 'Aktifkan Mode Gelap'}
                        </p>
                        <p className="text-xs text-[var(--muted)] truncate">
                          {isDarkMode ? 'Ketuk untuk ke Mode Terang' : 'Tampilan gelap nyaman di malam hari'}
                        </p>
                      </div>
                    </div>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={isDarkMode ? 'accent' : 'default'}
                      className="font-bold shrink-0"
                    >
                      <Chip.Label>{isDarkMode ? 'ON' : 'OFF'}</Chip.Label>
                    </Chip>
                  </button>
                )}

                {onOpenAiCopilot && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenAiCopilot();
                    }}
                    className="w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] hover:opacity-95 transition-opacity active:scale-[0.98] text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--foreground)] truncate">
                          AI Copilot Kasir
                        </p>
                        <p className="text-xs text-[var(--muted)] truncate">
                          Tambah stok, buat struk & cek omset
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('today');
                    setIsMoreMenuOpen(false);
                  }}
                  className={`w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-colors active:scale-[0.98] text-left cursor-pointer ${
                    activeTab === 'today'
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--foreground)]'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border-[var(--border)] text-[var(--foreground)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        activeTab === 'today'
                          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                          : 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]'
                      }`}
                    >
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[var(--foreground)] truncate">
                          Riwayat Nota
                        </p>
                        {todayCount > 0 && (
                          <Chip size="sm" variant="soft" color="accent" className="num-tabular font-bold shrink-0">
                            <Chip.Label>{todayCount} Nota</Chip.Label>
                          </Chip>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)] truncate">
                        Audit nota kasir & cetak ulang struk
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('shift');
                    setIsMoreMenuOpen(false);
                  }}
                  className={`w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-colors active:scale-[0.98] text-left cursor-pointer ${
                    activeTab === 'shift'
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--foreground)]'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border-[var(--border)] text-[var(--foreground)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        activeTab === 'shift'
                          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                          : 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]'
                      }`}
                    >
                      <Clock3 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--foreground)] truncate">
                        Tutup Shift Kasir
                      </p>
                      <p className="text-xs text-[var(--muted)] truncate">
                        Rekap kas laci & pengeluaran shift
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('gas');
                    setIsMoreMenuOpen(false);
                  }}
                  className={`w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-colors active:scale-[0.98] text-left cursor-pointer ${
                    activeTab === 'gas'
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--foreground)]'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border-[var(--border)] text-[var(--foreground)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        activeTab === 'gas'
                          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                          : 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]'
                      }`}
                    >
                      <FileCode2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-[var(--foreground)] truncate">
                          Integrasi Google Sheets
                        </p>
                        <Chip
                          size="sm"
                          variant="soft"
                          color={isConnectedGas ? 'success' : 'warning'}
                          className="font-semibold"
                        >
                          <Chip.Label>{isConnectedGas ? 'Terhubung' : 'Offline'}</Chip.Label>
                        </Chip>
                      </div>
                      <p className="text-xs text-[var(--muted)] truncate">
                        Koneksi Apps Script & sinkronisasi
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
                </button>

                {/* Separated Red Zone at Bottom */}
                <div className="pt-2 space-y-2.5">
                  <Separator />
                  <Button
                    variant="danger-soft"
                    fullWidth
                    onPress={() => {
                      setIsMoreMenuOpen(false);
                      setShowResetConfirm(true);
                    }}
                    className="min-h-[48px] justify-start px-3.5 rounded-xl text-xs font-bold border border-[var(--danger)]/25"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Reset Data Demo ke Bawaan Awal</span>
                  </Button>
                </div>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <AppConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Data Demo?"
        description="Data transaksi dan produk lokal akan dikembalikan ke setelan awal demo. Data yang sudah tersimpan di Google Sheets tidak terhapus."
        confirmLabel="Ya, Reset Data"
        cancelLabel="Batal"
        variant="danger"
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          setShowResetConfirm(false);
          onResetData();
        }}
      />

      {/* Docked Mobile Bottom Navigation Bar (5 items, >=56px, safe-area) */}
      <nav
        aria-label="Navigasi Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 no-print bg-[var(--surface)] border-t border-[var(--border)] pb-safe transition-colors duration-150"
      >
        <div className="max-w-lg mx-auto px-1.5 pt-1 flex items-center justify-around gap-1 min-h-[56px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                id={`bottom-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                title={item.title || item.label}
                className="flex-1 min-w-0 min-h-[52px] flex flex-col items-center justify-center py-1 relative transition-colors active:scale-[0.97] cursor-pointer group select-none"
              >
                <div
                  className={`relative px-3.5 py-1 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                      : 'text-[var(--muted)] group-hover:text-[var(--foreground)]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.25]' : 'stroke-[1.8]'}`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 leading-none rounded-full min-w-[18px] text-center bg-[var(--danger)] text-[var(--danger-foreground)] ring-2 ring-[var(--surface)] num-tabular">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] mt-0.5 tracking-tight truncate max-w-full transition-colors ${
                    isActive ? 'text-[var(--accent)] font-extrabold' : 'text-[var(--muted)] font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* 5th Tab: Lainnya */}
          <button
            type="button"
            id="bottom-nav-more"
            onClick={() => setIsMoreMenuOpen(true)}
            className="flex-1 min-w-0 min-h-[52px] flex flex-col items-center justify-center py-1 relative transition-colors active:scale-[0.97] cursor-pointer group select-none"
          >
            <div
              className={`relative px-3.5 py-1 rounded-xl transition-colors ${
                isMoreActive
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-[var(--muted)] group-hover:text-[var(--foreground)]'
              }`}
            >
              <MoreHorizontal className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.25]' : 'stroke-[1.8]'}`} />
              {!isConnectedGas && (
                <span className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-[var(--warning)] ring-2 ring-[var(--surface)]" />
              )}
            </div>
            <span
              className={`text-[11px] mt-0.5 tracking-tight truncate max-w-full transition-colors ${
                isMoreActive ? 'text-[var(--accent)] font-extrabold' : 'text-[var(--muted)] font-medium'
              }`}
            >
              Lainnya
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
