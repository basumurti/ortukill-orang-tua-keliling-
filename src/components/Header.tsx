import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Sparkles,
  Store,
  Package,
  TrendingUp,
  Wallet,
  Receipt,
  Clock3,
  FileSpreadsheet,
  Moon,
  Sun,
  MoreVertical,
  RotateCcw,
  X,
  CheckCircle2,
  AlertCircle,
  WifiOff,
} from 'lucide-react';
import { BrandConfig, LastUpdateInfo } from '../types';
import { useOverlayHistory } from '../utils/useOverlayHistory';
import { AppConfirmDialog } from './AppConfirmDialog';

type TabType = 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas' | 'finance';

export type SyncHealthStatus = 'connected' | 'syncing' | 'error' | 'offline';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  brand: BrandConfig;
  todayCount: number;
  todayOmset: number;
  todayMargin: number;
  isConnectedGas: boolean;
  isSyncing: boolean;
  syncStatus?: SyncHealthStatus;
  lastSynced: string | null;
  lastUpdateInfo?: LastUpdateInfo | null;
  onSyncData: () => void;
  onResetData: () => void;
  onOpenAiCopilot?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const HeaderClock: React.FC = React.memo(() => {
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  useEffect(() => {
    const update = () => {
      const next = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setCurrentTime((prev) => (prev === next ? prev : next));
    };
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, []);

  return <span className="num-tabular">{currentTime} WIB</span>;
});

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  brand,
  todayCount,
  isConnectedGas,
  isSyncing,
  syncStatus,
  lastSynced,
  lastUpdateInfo,
  onSyncData,
  onResetData,
  onOpenAiCopilot,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useOverlayHistory(isHeaderMenuOpen, () => setIsHeaderMenuOpen(false), 'header-menu');

  const resolvedSyncStatus: SyncHealthStatus = syncStatus
    ? syncStatus
    : isSyncing
    ? 'syncing'
    : isConnectedGas
    ? 'connected'
    : 'error';

  const statusDotClass =
    resolvedSyncStatus === 'syncing'
      ? 'bg-amber-400'
      : resolvedSyncStatus === 'connected'
      ? 'bg-emerald-500'
      : 'bg-red-500';

  const syncAriaLabel =
    resolvedSyncStatus === 'syncing'
      ? 'Sedang menyinkronkan Google Sheets'
      : resolvedSyncStatus === 'connected'
      ? 'Google Sheets terhubung, ketuk untuk sinkron'
      : resolvedSyncStatus === 'offline'
      ? 'Mode offline, ketuk untuk coba sinkron lagi'
      : 'Sinkronisasi gagal, ketuk untuk coba lagi';

  const desktopNavItems: Array<{
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'pos', label: 'Kasir', icon: Store },
    { id: 'stock', label: 'Stok', icon: Package },
    { id: 'history', label: 'Laporan', icon: TrendingUp },
    { id: 'finance', label: 'Buku Kas', icon: Wallet },
    { id: 'today', label: 'Nota', icon: Receipt, badge: todayCount > 0 ? todayCount : undefined },
    { id: 'shift', label: 'Shift', icon: Clock3 },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-white dark:bg-[#1B1B20] border-b border-slate-200 dark:border-[#2B2B33] select-none no-print pt-safe transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3 min-w-0">
          {/* Left: Brand Identity ("O" + Truncated Name + Shift & WIB Clock) */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-initial">
            <div className="w-9 h-9 rounded-xl bg-[#0F172A] dark:bg-[#9333EA] flex items-center justify-center text-white font-extrabold text-sm tracking-tight shrink-0 transition-colors">
              O
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-[15px] font-bold text-[#0F172A] dark:text-[#F4F4F6] tracking-tight leading-none truncate">
                {brand.NAME}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1 leading-none truncate">
                <span className="font-medium text-emerald-600 dark:text-emerald-400 shrink-0">Shift Aktif</span>
                <span aria-hidden="true">·</span>
                <HeaderClock />
              </p>
            </div>
          </div>

          {/* Center: Desktop Navigation Tabs (hidden on mobile < 768px) */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-[#24242B] p-1 rounded-xl border border-slate-200 dark:border-[#343440] overflow-x-auto no-scrollbar min-w-0"
          >
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-[0.97] cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[36px] ${
                    isActive
                      ? 'bg-white text-[#2563EB] shadow-xs border border-slate-200 dark:bg-[#1B1B20] dark:text-[#C084FC] dark:border-purple-500/45'
                      : 'text-slate-600 hover:text-[#0F172A] hover:bg-white/60 dark:text-zinc-400 dark:hover:text-[#F4F4F6] dark:hover:bg-[#2E2E37]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full num-tabular ${
                        isActive
                          ? 'bg-blue-50 text-[#2563EB] dark:bg-purple-500/20 dark:text-[#C084FC]'
                          : 'bg-slate-200 text-slate-700 dark:bg-[#2E2E37] dark:text-zinc-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: 2 clean 44px icon controls on mobile (Sync + Menu ⋮), compact adaptive labels on desktop */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 1. Sync Button with small status indicator dot */}
            <button
              type="button"
              onClick={onSyncData}
              disabled={isSyncing}
              aria-label={syncAriaLabel}
              title={
                lastSynced
                  ? `Terakhir sinkron ${lastSynced} WIB • Klik untuk muat ulang`
                  : syncAriaLabel
              }
              className={`relative min-h-[44px] min-w-[44px] px-2.5 lg:px-3.5 py-1.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer whitespace-nowrap disabled:opacity-75 ${
                resolvedSyncStatus === 'syncing'
                  ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/40 dark:text-amber-300 cursor-wait'
                  : resolvedSyncStatus === 'error' || resolvedSyncStatus === 'offline'
                  ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/20'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6]'
              }`}
            >
              <span className="relative flex items-center justify-center">
                <RefreshCw
                  className={`w-4 h-4 ${
                    isSyncing ? 'animate-spin text-amber-600 dark:text-amber-300' : ''
                  }`}
                />
                <span
                  aria-hidden="true"
                  className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#1B1B20] ${statusDotClass}`}
                />
              </span>
              <span className="hidden lg:inline">
                {resolvedSyncStatus === 'syncing'
                  ? 'Menyinkron...'
                  : resolvedSyncStatus === 'connected'
                  ? 'Sinkron'
                  : 'Coba lagi'}
              </span>
            </button>

            {/* AI Copilot quick button on xl desktop only */}
            {onOpenAiCopilot && (
              <button
                onClick={onOpenAiCopilot}
                type="button"
                aria-label="Buka AI Copilot Kasir"
                title="AI Copilot Kasir"
                className="hidden xl:flex min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6] items-center justify-center gap-1.5 text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC]" />
                <span>AI Kasir</span>
              </button>
            )}

            {/* 2. Menu ⋮ Button (Dark mode, AI Kasir, Sheets Info, Shift/Clock, Reset Data Demo) */}
            <button
              type="button"
              id="btn-header-menu"
              onClick={() => setIsHeaderMenuOpen(true)}
              aria-label="Menu lainnya"
              title="Menu pengaturan & info"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0F172A] dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-[#F4F4F6] flex items-center justify-center transition-colors active:scale-[0.97] cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu ⋮ Sheet / Modal */}
      {isHeaderMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu Pengaturan Header"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
        >
          <div
            className="fixed inset-0"
            onClick={() => setIsHeaderMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
            {/* Fixed Top */}
            <div className="px-4 sm:px-5 pt-2.5 pb-3 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F4F4F6] truncate">
                    {brand.NAME}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                    <span>Shift Aktif</span>
                    <span aria-hidden="true">·</span>
                    <HeaderClock />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHeaderMenuOpen(false)}
                  aria-label="Tutup menu"
                  className="min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center text-slate-500 hover:text-[#0F172A] hover:bg-white dark:text-zinc-400 dark:hover:text-[#F4F4F6] dark:hover:bg-[#2E2E37] transition-colors active:scale-[0.97] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-2.5 pb-safe">
              {/* Sync Status Detail Card */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440] bg-slate-50 dark:bg-[#24242B] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {resolvedSyncStatus === 'connected' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : resolvedSyncStatus === 'syncing' ? (
                      <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
                    ) : resolvedSyncStatus === 'offline' ? (
                      <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold truncate">
                      {resolvedSyncStatus === 'connected'
                        ? 'Google Sheets Terhubung'
                        : resolvedSyncStatus === 'syncing'
                        ? 'Menyinkronkan Google Sheets...'
                        : resolvedSyncStatus === 'offline'
                        ? 'Perangkat Offline'
                        : 'Sinkronisasi Sheets Gagal'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSyncData();
                      setIsHeaderMenuOpen(false);
                    }}
                    disabled={isSyncing}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {resolvedSyncStatus === 'error' ? 'Coba lagi' : 'Sinkron'}
                  </button>
                </div>
                {(lastSynced || lastUpdateInfo?.formatted) && (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 break-words">
                    {lastSynced
                      ? `Sinkron terakhir: ${lastSynced} WIB`
                      : `Pembaruan terakhir: ${lastUpdateInfo?.formatted}`}
                  </p>
                )}
              </div>

              {/* Theme Toggle */}
              {onToggleDarkMode && (
                <button
                  type="button"
                  id="btn-toggle-dark-mode"
                  onClick={onToggleDarkMode}
                  className="w-full min-h-[52px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440] bg-white hover:bg-slate-50 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] transition-colors active:scale-[0.97] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isDarkMode
                          ? 'bg-[#9333EA] text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold truncate">
                        {isDarkMode ? 'Mode Gelap Aktif' : 'Mode Terang Aktif'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        Ketuk untuk ganti tampilan tema
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                      isDarkMode
                        ? 'bg-purple-500/20 text-[#C084FC] border border-purple-500/40'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {isDarkMode ? 'Gelap' : 'Terang'}
                  </span>
                </button>
              )}

              {/* AI Copilot */}
              {onOpenAiCopilot && (
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    onOpenAiCopilot();
                  }}
                  className="w-full min-h-[52px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440] bg-white hover:bg-slate-50 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] transition-colors active:scale-[0.97] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-200 dark:bg-purple-500/15 dark:text-[#C084FC] dark:border-purple-500/40 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold truncate">AI Copilot Kasir</p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        Bantuan suara & teks cepat
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Google Sheets Settings */}
              <button
                type="button"
                onClick={() => {
                  setIsHeaderMenuOpen(false);
                  setActiveTab('gas');
                }}
                className="w-full min-h-[52px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-[#343440] bg-white hover:bg-slate-50 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] transition-colors active:scale-[0.97] text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#1B1B20] dark:text-zinc-300 dark:border-[#343440] flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold truncate">Pengaturan Google Sheets</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      URL Web App, diagnotik & Kode.gs
                    </p>
                  </div>
                </div>
              </button>

              {/* Separated Red Section at the very bottom: Reset Data Demo */}
              <div className="pt-3 mt-2 border-t border-red-200 dark:border-red-500/30">
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
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

      {/* App Confirm Dialog untuk Reset Data Demo */}
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
    </>
  );
};
