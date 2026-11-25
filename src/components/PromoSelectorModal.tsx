import React, { useState, useEffect } from 'react';
import { 
  X, 
  Gift, 
  Tag, 
  Percent, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Info, 
  Sparkles,
  Search,
  ArrowRight
} from 'lucide-react';
import { PromoRule } from '../types';
import { StorageService, formatRupiah } from '../services/storageService';
import { useOverlayHistory } from '../utils/useOverlayHistory';
import { AppConfirmDialog } from './AppConfirmDialog';

interface PromoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  currentPromoCode?: string;
  onApplyPromo: (promo: PromoRule, calculatedDiscount: number) => void;
  onRemovePromo: () => void;
}

export const PromoSelectorModal: React.FC<PromoSelectorModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  currentPromoCode,
  onApplyPromo,
  onRemovePromo,
}) => {
  const [promos, setPromos] = useState<PromoRule[]>([]);
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');
  const [searchQuery, setSearchQuery] = useState('');

  // New promo form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [newValue, setNewValue] = useState<number>(10000);
  const [newMinOrder, setNewMinOrder] = useState<number>(0);
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [pendingDeletePromoId, setPendingDeletePromoId] = useState<string | null>(null);

  useOverlayHistory(isOpen, onClose, 'promo-selector-modal');

  const loadPromos = () => {
    const list = StorageService.getPromos();
    setPromos(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadPromos();
      setActiveTab('LIST');
      setSearchQuery('');
      setFormError('');
      setPendingDeletePromoId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const calculateDiscountValue = (promo: PromoRule, amount: number): number => {
    if (promo.type === 'PERCENT') {
      const pct = Math.min(100, Math.max(0, promo.value));
      return Math.round((amount * pct) / 100);
    }
    return Math.min(amount, promo.value);
  };

  const filteredPromos = promos.filter((p) => {
    if (!p.isActive && p.isActive !== undefined) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const handleSelectPromo = (promo: PromoRule) => {
    const min = promo.minOrder || 0;
    if (subtotal < min) return;

    const discountAmount = calculateDiscountValue(promo, subtotal);
    onApplyPromo(promo, discountAmount);
    onClose();
  };

  const handleSaveNewPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newCode.trim()) {
      setFormError('Kode promo wajib diisi (contoh: PROMO-WEEKEND)');
      return;
    }
    if (!newName.trim()) {
      setFormError('Nama promo wajib diisi');
      return;
    }
    if (newValue <= 0) {
      setFormError('Nilai potongan harus lebih besar dari 0');
      return;
    }
    if (newType === 'PERCENT' && newValue > 100) {
      setFormError('Diskon persen maksimal 100%');
      return;
    }

    const cleanCode = newCode.trim().toUpperCase().replace(/\s+/g, '-');
    const created: PromoRule = {
      id: 'promo-' + Date.now(),
      code: cleanCode,
      name: newName.trim(),
      type: newType,
      value: newValue,
      minOrder: newMinOrder > 0 ? newMinOrder : 0,
      description: newDescription.trim() || undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    StorageService.savePromo(created);
    loadPromos();
    setActiveTab('LIST');

    // Reset form
    setNewCode('');
    setNewName('');
    setNewValue(10000);
    setNewMinOrder(0);
    setNewDescription('');

    // If subtotal qualifies, auto-apply!
    if (subtotal >= created.minOrder!) {
      const disc = calculateDiscountValue(created, subtotal);
      onApplyPromo(created, disc);
      onClose();
    }
  };

  const handleDeletePromo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeletePromoId(id);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Promo dan Voucher Kasir"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 bg-white dark:bg-[#1B1B20] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 dark:border-[#2B2B33] max-w-lg w-full max-h-[92dvh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">

        {/* Header */}
        <div className="px-4 sm:px-5 pt-2.5 pb-3.5 border-b border-slate-200 dark:border-[#2B2B33] bg-slate-50 dark:bg-[#24242B] shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] border border-blue-200 dark:bg-purple-500/15 dark:text-[#C084FC] dark:border-purple-500/40 shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-[#0F172A] dark:text-[#F4F4F6] leading-tight uppercase truncate">Promo & Voucher Kasir</h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Subtotal Belanja: <span className="font-mono font-bold text-[#0F172A] dark:text-[#F4F4F6] tabular-nums">{formatRupiah(subtotal)}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal promo"
              className="min-w-[44px] min-h-[44px] -mr-1 text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] hover:bg-white dark:hover:bg-[#2E2E37] rounded-full flex items-center justify-center transition-colors active:scale-[0.97] cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-[#2B2B33] bg-white dark:bg-[#1B1B20] px-4 sm:px-5 pt-2 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[40px] ${
              activeTab === 'LIST'
                ? 'border-[#2563EB] text-[#2563EB] dark:border-[#A855F7] dark:text-[#C084FC]'
                : 'border-transparent text-slate-500 hover:text-[#0F172A] dark:text-zinc-400 dark:hover:text-[#F4F4F6]'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Pilih Promo ({promos.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CREATE')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[40px] ${
              activeTab === 'CREATE'
                ? 'border-[#2563EB] text-[#2563EB] dark:border-[#A855F7] dark:text-[#C084FC]'
                : 'border-transparent text-slate-500 hover:text-[#0F172A] dark:text-zinc-400 dark:hover:text-[#F4F4F6]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Promo Baru</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 pb-safe">
          {activeTab === 'LIST' && (
            <>
              {/* Search & Active Promo Status */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari promo atau kode voucher..."
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {currentPromoCode && (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-500/35 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">Promo Aktif: <strong className="font-mono text-emerald-950 dark:text-emerald-200">{currentPromoCode}</strong></span>
                    </div>
                    <button
                      onClick={() => {
                        onRemovePromo();
                        onClose();
                      }}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 font-bold text-[11px] underline cursor-pointer shrink-0 transition-colors"
                    >
                      Batalkan Promo
                    </button>
                  </div>
                )}
              </div>

              {/* Promo Cards List */}
              <div className="space-y-2.5">
                {filteredPromos.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-zinc-400">
                    <Gift className="w-10 h-10 mx-auto stroke-1 text-slate-300 dark:text-zinc-600 mb-2" />
                    <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Tidak ada promo yang sesuai</p>
                    <button
                      onClick={() => setActiveTab('CREATE')}
                      className="mt-3 px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white text-xs font-semibold rounded-xl cursor-pointer min-h-[40px]"
                    >
                      + Buat Promo Sekarang
                    </button>
                  </div>
                ) : (
                  filteredPromos.map((p) => {
                    const minOrder = p.minOrder || 0;
                    const isEligible = subtotal >= minOrder;
                    const isCurrentlySelected = currentPromoCode === p.code;
                    const calculatedDisc = calculateDiscountValue(p, subtotal);

                    return (
                      <div
                        key={p.id}
                        onClick={() => isEligible && handleSelectPromo(p)}
                        className={`group relative p-3.5 rounded-xl border transition-colors ${
                          isCurrentlySelected
                            ? 'bg-blue-50/70 border-[#2563EB] ring-1 ring-[#2563EB] dark:bg-purple-500/15 dark:border-[#A855F7] dark:ring-[#A855F7]'
                            : isEligible
                            ? 'bg-white border-slate-200 hover:border-[#2563EB]/60 hover:bg-slate-50 dark:bg-[#24242B] dark:border-[#343440] dark:hover:border-purple-500/50 dark:hover:bg-[#2E2E37] cursor-pointer'
                            : 'bg-slate-50 border-slate-200 dark:bg-[#16161A] dark:border-[#2B2B33] opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold tracking-wide bg-blue-50 text-[#2563EB] border border-blue-200 dark:bg-purple-500/15 dark:text-[#C084FC] dark:border-purple-500/40">
                                {p.code}
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6]">
                                {p.name}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-[#2563EB] dark:text-[#C084FC] flex items-center gap-1">
                              {p.type === 'PERCENT' ? (
                                <>
                                  <Percent className="w-3.5 h-3.5" />
                                  <span>Diskon {p.value}% (Potongan {formatRupiah(calculatedDisc)})</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Potongan {formatRupiah(p.value)}</span>
                                </>
                              )}
                            </div>

                            {p.description && (
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400">{p.description}</p>
                            )}

                            {/* Eligibility indicator */}
                            <div className="pt-1 text-[10px]">
                              {minOrder > 0 ? (
                                isEligible ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Min. belanja {formatRupiah(minOrder)} (Terpenuhi)
                                  </span>
                                ) : (
                                  <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Min. belanja {formatRupiah(minOrder)} (Kurang {formatRupiah(minOrder - subtotal)})
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-500">Tanpa syarat minimal belanja</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {isCurrentlySelected ? (
                              <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1">
                                <Check className="w-3 h-3" /> Terpasang
                              </span>
                            ) : isEligible ? (
                              <button
                                type="button"
                                onClick={() => handleSelectPromo(p)}
                                className="px-2.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>Gunakan</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 dark:bg-[#24242B] dark:text-zinc-400 dark:border-[#343440] text-[10px] font-medium rounded-md">
                                Belum Cukup
                              </span>
                            )}

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeletePromo(p.id, e)}
                              aria-label={`Hapus promo ${p.name}`}
                              title="Hapus promo ini"
                              className="min-w-[44px] min-h-[44px] text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/15 flex items-center justify-center transition-colors active:scale-[0.97] cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Google Sheets Explanation Note */}
              <div className="p-3 bg-slate-50 dark:bg-[#24242B] rounded-xl border border-slate-200 dark:border-[#343440] text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-[#F4F4F6]">
                  <Info className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#C084FC]" />
                  <span>Otomatis Terhubung ke Google Sheets</span>
                </div>
                <p>
                  Saat transaksi disimpan, promo akan dicatat otomatis di sheet <strong className="text-[#0F172A] dark:text-[#F4F4F6]">LOG_PENJUALAN</strong> dengan SKU kode promo dan nilai minus sehingga omset di spreadsheet 100% klop dengan uang kasir.
                </p>
              </div>
            </>
          )}

          {activeTab === 'CREATE' && (
            <form onSubmit={handleSaveNewPromo} className="space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 dark:bg-red-500/15 dark:border-red-500/35 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Kode Promo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Kode Promo / Voucher <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: PROMO-WEEKEND atau MEMBER-5"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm font-mono uppercase font-bold text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                  required
                />
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Kode ini akan tercatat di Kolom C (SKU) Google Sheets.</p>
              </div>

              {/* Nama Promo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Nama Promo <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Potongan Spesial Akhir Pekan"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                  required
                />
              </div>

              {/* Tipe Diskon & Nilai */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Tipe Potongan</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'FIXED' | 'PERCENT')}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                  >
                    <option value="FIXED">Nominal Tetap (Rp)</option>
                    <option value="PERCENT">Persentase (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    {newType === 'FIXED' ? 'Nilai Potongan (Rp)' : 'Persentase (%)'} <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={newType === 'PERCENT' ? 100 : 10000000}
                    step="1"
                    value={newValue}
                    onChange={(e) => setNewValue(Number(e.target.value) || 0)}
                    placeholder={newType === 'FIXED' ? '10000' : '10'}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm font-mono font-bold text-[#0F172A] dark:text-[#F4F4F6] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                    required
                  />
                </div>
              </div>

              {/* Minimal Belanja */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Syarat Minimal Belanja (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newMinOrder === 0 ? '' : newMinOrder}
                  onChange={(e) => setNewMinOrder(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0 (Isi 0 jika tanpa syarat)"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm font-mono text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                />
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Kosongkan atau isi 0 jika promo berlaku untuk semua total belanja.</p>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Keterangan / Deskripsi</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Contoh: Khusus pembelian min. 2 botol bir"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] min-h-[44px]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('LIST')}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-[#24242B] dark:hover:bg-[#2E2E37] dark:border-[#343440] dark:text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[44px]"
                >
                  Simpan & Terapkan Promo
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <AppConfirmDialog
        isOpen={pendingDeletePromoId !== null}
        title="Hapus Promo?"
        description="Promo ini akan dihapus dari daftar kasir di perangkat ini."
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
        onCancel={() => setPendingDeletePromoId(null)}
        onConfirm={() => {
          if (pendingDeletePromoId) {
            StorageService.deletePromo(pendingDeletePromoId);
            loadPromos();
          }
          setPendingDeletePromoId(null);
        }}
      />
    </div>
  );
};
