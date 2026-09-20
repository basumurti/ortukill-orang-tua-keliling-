import React, { useState, useEffect } from 'react';
import { 
  RefreshCw,
  Store,
  Wifi,
  WifiOff,
  Sparkles
} from 'lucide-react';
import { BrandConfig } from '../types';
import { formatRupiah } from '../services/storageService';

interface HeaderProps {
  activeTab: 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas';
  setActiveTab: (tab: 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas') => void;
  brand: BrandConfig;
  todayCount: number;
  todayOmset: number;
  todayMargin: number;
  isConnectedGas: boolean;
  isSyncing: boolean;
  lastSynced: string | null;
  onSyncData: () => void;
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  brand,
  todayCount,
  todayOmset,
  todayMargin,
  isConnectedGas,
  isSyncing,
  lastSynced,
  onSyncData,
}) => {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#EEF1F6]/90 backdrop-blur-md pt-2 pb-1.5 px-3 sm:px-6 select-none no-print">
      <div className="max-w-7xl mx-auto bg-white/95 rounded-[22px] px-4 py-2.5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] border border-white flex items-center justify-between gap-3">
        {/* Left: Brand Identity & Shift Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF643D] via-[#FF5E36] to-[#FFA07A] flex items-center justify-center text-white font-black text-lg shadow-[0_4px_12px_rgba(255,94,54,0.3)] flex-shrink-0">
            O
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight leading-tight truncate">
                {brand.NAME}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF5E36] bg-[#FFF2ED] border border-[#FF5E36]/20 px-2 py-0.5 rounded-full">
                POS
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-stone-500">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-100" />
                <span>Shift Aktif</span>
              </span>
              <span className="text-stone-300">•</span>
              <span className="font-mono text-stone-400 font-medium">{currentTime} WIB</span>
            </div>
          </div>
        </div>

        {/* Right: Honest Connection Pill & Sync Button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status Badge */}
          <button
            onClick={() => setActiveTab('gas')}
            title={isConnectedGas ? 'Google Sheets Terhubung' : 'Mode Offline / Klik untuk hubungkan Sheets'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
              isConnectedGas
                ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-700 hover:bg-emerald-100'
                : 'bg-stone-100/90 border-stone-200 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {isConnectedGas ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden xs:inline text-[11px]">Sheets Terhubung</span>
                <span className="xs:hidden text-[11px]">Online</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="hidden xs:inline text-[11px]">Offline / Lokal</span>
                <span className="xs:hidden text-[11px]">Offline</span>
              </>
            )}
          </button>

          {/* Sync / Refresh Button */}
          <button
            onClick={onSyncData}
            disabled={isSyncing}
            aria-label="Sinkronisasi Data"
            title={isConnectedGas ? 'Tarik Data Terbaru' : 'Hubungkan ke Spreadsheet'}
            className={`w-10 h-10 sm:w-auto sm:px-3.5 sm:py-2 rounded-full flex items-center justify-center gap-1.5 text-xs font-bold border transition-all cursor-pointer shadow-xs ${
              isSyncing
                ? 'bg-[#FFF2ED] text-[#FF5E36] border-[#FF5E36]/30 cursor-wait'
                : 'bg-[#1E232D] hover:bg-black text-white border-transparent active:scale-95'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#FF5E36]' : 'text-white'}`} />
            <span className="hidden md:inline">
              {isSyncing ? 'Sinkron...' : isConnectedGas ? 'Sinkron' : 'Hubungkan'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
