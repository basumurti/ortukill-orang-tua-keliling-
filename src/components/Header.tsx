import React, { useState, useEffect } from 'react';
import { Button, Chip, Modal, Separator } from '@heroui/react';
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
  CheckCircle2,
  AlertCircle,
  WifiOff,
} from 'lucide-react';
import { BrandConfig, LastUpdateInfo } from '../types';
import { useOverlayHistory } from '../utils/useOverlayHistory';
import { AppConfirmDialog } from './AppConfirmDialog';
import { AnimatedTabPill } from './ui/motion/MotionPrimitives';

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
      ? 'bg-[var(--warning)]'
      : resolvedSyncStatus === 'connected'
      ? 'bg-[var(--success)]'
      : 'bg-[var(--danger)]';

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
      <header className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)] select-none no-print pt-safe transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3 min-w-0">
          {/* Left: Brand Identity ("O" + Truncated Name + Shift & WIB Clock) */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-initial">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-extrabold text-sm tracking-tight shrink-0 transition-colors">
              O
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-[15px] font-bold text-[var(--foreground)] tracking-tight leading-none truncate">
                {brand.NAME}
              </h1>
              <p className="text-[11px] text-[var(--muted)] mt-1 flex items-center gap-1 leading-none truncate">
                <span className="font-semibold text-emerald-600 dark:text-[var(--success)] shrink-0">
                  Shift Aktif
                </span>
                <span aria-hidden="true">·</span>
                <HeaderClock />
              </p>
            </div>
          </div>

          {/* Center: Desktop Navigation Tabs (hidden on mobile < 768px) */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-1 bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto no-scrollbar min-w-0"
          >
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Button
                  key={item.id}
                  size="sm"
                  variant="ghost"
                  onPress={() => setActiveTab(item.id)}
                  className={`relative px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[36px] h-9 ${
                    isActive
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {isActive && (
                    <AnimatedTabPill
                      layoutId="header-desktop-nav-pill"
                      className="absolute inset-0 rounded-lg bg-[var(--surface)] border border-[var(--accent)]/35 shadow-xs pointer-events-none"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full num-tabular leading-none ${
                          isActive
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                            : 'bg-[var(--default)] text-[var(--default-foreground)]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                </Button>
              );
            })}
          </nav>

          {/* Right: 2 clean 44px icon controls on mobile (Sync + Menu ⋮), compact adaptive labels on desktop */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 1. Sync Button with small status indicator dot */}
            <Button
              variant="outline"
              onPress={onSyncData}
              isDisabled={isSyncing}
              aria-label={syncAriaLabel}
              className={`relative min-h-[44px] min-w-[44px] px-2.5 lg:px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                resolvedSyncStatus === 'syncing'
                  ? 'bg-[var(--warning-soft)] border-[var(--warning)]/40 text-[var(--warning-soft-foreground)] cursor-wait'
                  : resolvedSyncStatus === 'error' || resolvedSyncStatus === 'offline'
                  ? 'bg-[var(--danger-soft)] border-[var(--danger)]/40 text-[var(--danger)]'
                  : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)]'
              }`}
            >
              <span className="relative flex items-center justify-center">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span
                  aria-hidden="true"
                  className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--surface)] ${statusDotClass}`}
                />
              </span>
              <span className="hidden lg:inline">
                {resolvedSyncStatus === 'syncing'
                  ? 'Menyinkron...'
                  : resolvedSyncStatus === 'connected'
                  ? 'Sinkron'
                  : 'Coba lagi'}
              </span>
            </Button>

            {/* AI Copilot quick button on xl desktop only */}
            {onOpenAiCopilot && (
              <Button
                variant="outline"
                onPress={onOpenAiCopilot}
                aria-label="Buka AI Copilot Kasir"
                className="hidden xl:inline-flex min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)] text-xs font-bold whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                <span>AI Kasir</span>
              </Button>
            )}

            {/* 2. Menu ⋮ Button (Dark mode, AI Kasir, Sheets Info, Shift/Clock, Reset Data Demo) */}
            <Button
              isIconOnly
              variant="outline"
              id="btn-header-menu"
              onPress={() => setIsHeaderMenuOpen(true)}
              aria-label="Menu lainnya"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)]"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Menu ⋮ Sheet / Modal */}
      <Modal.Backdrop
        isOpen={isHeaderMenuOpen}
        onOpenChange={(open) => {
          if (!open) setIsHeaderMenuOpen(false);
        }}
        variant="opaque"
      >
          <Modal.Container placement="auto" size="sm" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="Menu Pengaturan Header"
              className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full"
            >
              {/* Drag Handle Indicator on Mobile */}
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />

              {/* Fixed Top */}
              <Modal.Header className="px-4 sm:px-5 pt-2.5 sm:pt-4 pb-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                <div className="min-w-0">
                  <Modal.Heading className="text-sm font-extrabold text-[var(--foreground)] truncate">
                    {brand.NAME}
                  </Modal.Heading>
                  <p className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5 truncate">
                    <span>Shift Aktif</span>
                    <span aria-hidden="true">·</span>
                    <HeaderClock />
                  </p>
                </div>
                <Modal.CloseTrigger
                  aria-label="Tutup menu"
                  className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                />
              </Modal.Header>

              {/* Scrollable Body */}
              <Modal.Body className="!mt-0 p-4 space-y-2.5 pb-safe">
                {/* Sync Status Detail Card */}
                <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {resolvedSyncStatus === 'connected' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[var(--success)] shrink-0" />
                      ) : resolvedSyncStatus === 'syncing' ? (
                        <RefreshCw className="w-4 h-4 text-amber-600 dark:text-[var(--warning)] animate-spin shrink-0" />
                      ) : resolvedSyncStatus === 'offline' ? (
                        <WifiOff className="w-4 h-4 text-amber-600 dark:text-[var(--warning)] shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />
                      )}
                      <span className="text-xs font-bold text-[var(--foreground)] truncate">
                        {resolvedSyncStatus === 'connected'
                          ? 'Google Sheets Terhubung'
                          : resolvedSyncStatus === 'syncing'
                          ? 'Menyinkronkan Google Sheets...'
                          : resolvedSyncStatus === 'offline'
                          ? 'Perangkat Offline'
                          : 'Sinkronisasi Sheets Gagal'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      isDisabled={isSyncing}
                      onPress={() => {
                        onSyncData();
                        setIsHeaderMenuOpen(false);
                      }}
                      className="min-h-[38px] px-3 rounded-xl text-xs font-bold shrink-0"
                    >
                      {resolvedSyncStatus === 'error' ? 'Coba lagi' : 'Sinkron'}
                    </Button>
                  </div>
                  {(lastSynced || lastUpdateInfo?.formatted) && (
                    <p className="text-[11px] text-[var(--muted)] break-words">
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
                    className="w-full min-h-[52px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] transition-colors active:scale-[0.98] text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isDarkMode
                            ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                            : 'bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border)]'
                        }`}
                      >
                        {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] truncate">
                          {isDarkMode ? 'Mode Gelap Aktif' : 'Mode Terang Aktif'}
                        </p>
                        <p className="text-[11px] text-[var(--muted)] truncate">
                          Ketuk untuk ganti tampilan tema
                        </p>
                      </div>
                    </div>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={isDarkMode ? 'accent' : 'default'}
                      className="font-bold shrink-0"
                    >
                      <Chip.Label>{isDarkMode ? 'Gelap' : 'Terang'}</Chip.Label>
                    </Chip>
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
                    className="w-full min-h-[52px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] transition-colors active:scale-[0.98] text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] truncate">
                          AI Copilot Kasir
                        </p>
                        <p className="text-[11px] text-[var(--muted)] truncate">
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
                  className="w-full min-h-[52px] flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] transition-colors active:scale-[0.98] text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border)] flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] truncate">
                        Pengaturan Google Sheets
                      </p>
                      <p className="text-[11px] text-[var(--muted)] truncate">
                        URL Web App, diagnostik & Kode.gs
                      </p>
                    </div>
                  </div>
                </button>

                {/* Separated Red Section at the very bottom: Reset Data Demo */}
                <div className="pt-2 space-y-2.5">
                  <Separator />
                  <Button
                    variant="danger-soft"
                    fullWidth
                    onPress={() => {
                      setIsHeaderMenuOpen(false);
                      setShowResetConfirm(true);
                    }}
                    className="min-h-[48px] justify-start px-3.5 rounded-xl text-xs font-bold border border-[var(--danger)]/25"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Reset Data Demo ke Bawaan Awal</span>
                  </Button>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

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
