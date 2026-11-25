import React, { useState } from 'react';
import {
  Store,
  TrendingUp,
  Package,
  MoreHorizontal,
  Wallet,
  Clock3,
  FileCode2,
  RotateCcw,
  X,
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
      {/* More Options Bottom Sheet Modal */}
      {isMoreMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu Lainnya"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150 p-0 sm:p-4"
        >
          <div
            className="fixed inset-0"
            onClick={() => setIsMoreMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl z-10 max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-150 text-[#0F172A] dark:text-[#F4F4F6]">
            {/* Fixed Header / Grab bar */}
            <div className="px-4 sm:px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="w-full flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">Menu Lainnya</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">Riwayat nota, tutup shift & koneksi Google Sheets</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(false)}
                  aria-label="Tutup menu"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full bg-white hover:bg-slate-100 border border-slate-200 dark:bg-[#1B1B20] dark:hover:bg-[#2E2E37] dark:border-[#343440] flex items-center justify-center text-slate-600 dark:text-zinc-300 transition-colors active:scale-[0.97] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Menu Items */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-2.5 pb-safe">
              {/* Theme Switch Row */}
              {onToggleDarkMode && (
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-purple-500/40 bg-slate-50 hover:bg-slate-100 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] transition-colors active:scale-[0.97] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isDarkMode
                          ? 'bg-[#9333EA] text-white'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">
                        {isDarkMode ? 'Mode Gelap Aktif' : 'Aktifkan Mode Gelap'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {isDarkMode ? 'Ketuk untuk ke Mode Terang' : 'Tampilan gelap nyaman di malam hari'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                      isDarkMode
                        ? 'bg-purple-500/20 text-[#C084FC] border border-purple-500/40'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isDarkMode ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}

              {onOpenAiCopilot && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenAiCopilot();
                  }}
                  className="w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-purple-500/40 dark:bg-purple-500/15 dark:hover:bg-purple-500/20 transition-colors active:scale-[0.97] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#2563EB] dark:bg-[#9333EA] text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">AI Copilot Kasir</p>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 truncate">Tambah stok, buat struk & cek omset</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC] shrink-0" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveTab('today');
                  setIsMoreMenuOpen(false);
                }}
                className={`w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-colors active:scale-[0.97] text-left cursor-pointer ${
                  activeTab === 'today'
                    ? 'bg-blue-50 border-blue-300 text-[#0F172A] dark:bg-purple-500/15 dark:border-purple-500/50 dark:text-[#F4F4F6]'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'today'
                        ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white'
                        : 'bg-white text-slate-700 border border-slate-200 dark:bg-[#1B1B20] dark:text-zinc-300 dark:border-[#343440]'
                    }`}
                  >
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">Riwayat Nota</p>
                      {todayCount > 0 && (
                        <span className="text-[10px] font-bold bg-blue-100 text-[#2563EB] dark:bg-purple-500/20 dark:text-[#C084FC] px-2 py-0.5 rounded-md num-tabular shrink-0">
                          {todayCount} Nota
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">Audit nota kasir & cetak ulang struk</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('shift');
                  setIsMoreMenuOpen(false);
                }}
                className={`w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-colors active:scale-[0.97] text-left cursor-pointer ${
                  activeTab === 'shift'
                    ? 'bg-blue-50 border-blue-300 text-[#0F172A] dark:bg-purple-500/15 dark:border-purple-500/50 dark:text-[#F4F4F6]'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'shift'
                        ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white'
                        : 'bg-white text-slate-700 border border-slate-200 dark:bg-[#1B1B20] dark:text-zinc-300 dark:border-[#343440]'
                    }`}
                  >
                    <Clock3 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">Tutup Shift Kasir</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">Rekap kas laci & pengeluaran shift</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('gas');
                  setIsMoreMenuOpen(false);
                }}
                className={`w-full min-h-[56px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-colors active:scale-[0.97] text-left cursor-pointer ${
                  activeTab === 'gas'
                    ? 'bg-blue-50 border-blue-300 text-[#0F172A] dark:bg-purple-500/15 dark:border-purple-500/50 dark:text-[#F4F4F6]'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'gas'
                        ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white'
                        : 'bg-white text-slate-700 border border-slate-200 dark:bg-[#1B1B20] dark:text-zinc-300 dark:border-[#343440]'
                    }`}
                  >
                    <FileCode2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] truncate">Integrasi Google Sheets</p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          isConnectedGas
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/15 dark:border-emerald-500/35'
                            : 'text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-500/15 dark:border-amber-500/35'
                        }`}
                      >
                        {isConnectedGas ? 'Terhubung' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">Koneksi Apps Script & sinkronisasi</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              </button>

              {/* Separated Red Zone at Bottom */}
              <div className="pt-3 mt-2 border-t border-red-200 dark:border-red-500/30">
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setShowResetConfirm(true);
                  }}
                  className="w-full min-h-[48px] flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:hover:bg-red-500/25 dark:text-red-400 transition-colors active:scale-[0.97] text-left text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>Reset Data Demo ke Bawaan Awal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        className="md:hidden fixed bottom-0 inset-x-0 z-40 no-print bg-white dark:bg-[#1B1B20] border-t border-slate-200 dark:border-[#2B2B33] pb-safe transition-colors duration-150"
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
                      ? 'bg-[#2563EB] text-white dark:bg-[#9333EA] dark:text-white'
                      : 'text-slate-500 group-hover:text-[#0F172A] dark:text-zinc-400 dark:group-hover:text-[#F4F4F6]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.25]' : 'stroke-[1.8]'}`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center bg-[#DC2626] text-white ring-2 ring-white dark:ring-[#1B1B20] num-tabular">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] mt-0.5 tracking-tight truncate max-w-full transition-colors ${
                    isActive ? 'text-[#2563EB] dark:text-[#C084FC] font-extrabold' : 'text-slate-500 dark:text-zinc-400 font-medium'
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
                  ? 'bg-[#2563EB] text-white dark:bg-[#9333EA] dark:text-white'
                  : 'text-slate-500 group-hover:text-[#0F172A] dark:text-zinc-400 dark:group-hover:text-[#F4F4F6]'
              }`}
            >
              <MoreHorizontal className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.25]' : 'stroke-[1.8]'}`} />
              {!isConnectedGas && (
                <span className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#1B1B20]" />
              )}
            </div>
            <span
              className={`text-[11px] mt-0.5 tracking-tight truncate max-w-full transition-colors ${
                isMoreActive ? 'text-[#2563EB] dark:text-[#C084FC] font-extrabold' : 'text-slate-500 dark:text-zinc-400 font-medium'
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
