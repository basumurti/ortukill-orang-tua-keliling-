import React, { useState, useEffect } from 'react';
import { Button, Chip, Input, Modal, Tabs } from '@heroui/react';
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
  ArrowRight,
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
    <>
      <Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Backdrop variant="opaque">
          <Modal.Container placement="auto" size="lg" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="Promo dan Voucher Kasir"
              className="relative p-0 gap-0 overflow-hidden bg-[var(--overlay)] text-[var(--overlay-foreground)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] w-full"
            >
              {/* Drag Handle Indicator on Mobile */}
              <div className="w-10 h-1 rounded-full bg-[var(--separator)] mx-auto mt-2.5 sm:hidden shrink-0" />

              {/* Header */}
              <Modal.Header className="px-4 sm:px-5 pt-2.5 sm:pt-4 pb-3.5 border-b border-[var(--border)] bg-[var(--surface-secondary)] flex-row items-center justify-between gap-2 shrink-0 pr-14">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Modal.Icon className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25 shrink-0">
                    <Gift className="w-5 h-5" />
                  </Modal.Icon>
                  <div className="min-w-0">
                    <Modal.Heading className="font-extrabold text-sm sm:text-base text-[var(--foreground)] leading-tight uppercase truncate">
                      Promo & Voucher Kasir
                    </Modal.Heading>
                    <p className="text-[11px] text-[var(--muted)]">
                      Subtotal Belanja:{' '}
                      <span className="font-mono font-bold text-[var(--foreground)] tabular-nums">
                        {formatRupiah(subtotal)}
                      </span>
                    </p>
                  </div>
                </div>
                <Modal.CloseTrigger
                  aria-label="Tutup modal promo"
                  className="min-w-[44px] min-h-[44px] top-2 end-2 rounded-full"
                />
              </Modal.Header>

              {/* Tab Selector + Scrollable Panels */}
              <Tabs
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(key as 'LIST' | 'CREATE')}
                variant="secondary"
                className="flex-1 min-h-0 flex flex-col overflow-hidden gap-0"
              >
                <div className="bg-[var(--surface)] px-4 sm:px-5 pt-1 shrink-0">
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Kategori Tab Promo" className="gap-3">
                      <Tabs.Tab id="LIST" className="min-h-[42px] px-2 text-xs font-bold gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        <span>Pilih Promo ({promos.length})</span>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="CREATE" className="min-h-[42px] px-2 text-xs font-bold gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Buat Promo Baru</span>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                </div>

                <Tabs.Panel
                  id="LIST"
                  className="!mt-0 flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 pb-safe"
                >
                  {/* Search & Active Promo Status */}
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none z-10" />
                      <Input
                        type="text"
                        fullWidth
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari promo atau kode voucher..."
                        className="pl-9 pr-10 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] min-h-[44px]"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Hapus pencarian promo"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {currentPromoCode && (
                      <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--success-soft)] border border-[var(--success)]/35 rounded-xl text-xs text-emerald-800 dark:text-[var(--success)]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Check className="w-4 h-4 shrink-0" />
                          <span className="truncate">
                            Promo Aktif: <strong className="font-mono">{currentPromoCode}</strong>
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="danger-soft"
                          onPress={() => {
                            onRemovePromo();
                            onClose();
                          }}
                          className="rounded-lg font-bold text-[11px] shrink-0"
                        >
                          Batalkan Promo
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Promo Cards List */}
                  <div className="space-y-2.5">
                    {filteredPromos.length === 0 ? (
                      <div className="text-center py-8 text-[var(--muted)]">
                        <Gift className="w-10 h-10 mx-auto stroke-1 opacity-50 mb-2" />
                        <p className="text-xs font-medium">Tidak ada promo yang sesuai</p>
                        <Button
                          size="sm"
                          variant="primary"
                          onPress={() => setActiveTab('CREATE')}
                          className="mt-3 rounded-xl text-xs font-semibold min-h-[40px]"
                        >
                          + Buat Promo Sekarang
                        </Button>
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
                                ? 'bg-[var(--accent-soft)]/50 border-[var(--accent)] ring-1 ring-[var(--accent)]'
                                : isEligible
                                ? 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]/60 hover:bg-[var(--surface-secondary)] cursor-pointer'
                                : 'bg-[var(--surface-secondary)] border-[var(--border)] opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Chip size="sm" variant="soft" color="accent" className="font-mono font-bold tracking-wide">
                                    <Chip.Label>{p.code}</Chip.Label>
                                  </Chip>
                                  <span className="font-bold text-xs sm:text-sm text-[var(--foreground)]">
                                    {p.name}
                                  </span>
                                </div>

                                <div className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1">
                                  {p.type === 'PERCENT' ? (
                                    <>
                                      <Percent className="w-3.5 h-3.5" />
                                      <span>
                                        Diskon {p.value}% (Potongan {formatRupiah(calculatedDisc)})
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>Potongan {formatRupiah(p.value)}</span>
                                    </>
                                  )}
                                </div>

                                {p.description && (
                                  <p className="text-[11px] text-[var(--muted)]">{p.description}</p>
                                )}

                                {/* Eligibility indicator */}
                                <div className="pt-1 text-[10px]">
                                  {minOrder > 0 ? (
                                    isEligible ? (
                                      <span className="text-emerald-700 dark:text-[var(--success)] font-medium flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Min. belanja {formatRupiah(minOrder)} (Terpenuhi)
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 dark:text-[var(--warning)] font-medium flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Min. belanja {formatRupiah(minOrder)} (Kurang{' '}
                                        {formatRupiah(minOrder - subtotal)})
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[var(--muted)]">Tanpa syarat minimal belanja</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {isCurrentlySelected ? (
                                  <Chip size="sm" variant="primary" color="success" className="font-bold">
                                    <Check className="w-3 h-3" />
                                    <Chip.Label>Terpasang</Chip.Label>
                                  </Chip>
                                ) : isEligible ? (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onPress={() => handleSelectPromo(p)}
                                    className="px-2.5 rounded-lg text-[11px] font-bold"
                                  >
                                    <span>Gunakan</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </Button>
                                ) : (
                                  <Chip size="sm" variant="soft" color="default">
                                    <Chip.Label>Belum Cukup</Chip.Label>
                                  </Chip>
                                )}

                                {/* Delete button */}
                                <button
                                  type="button"
                                  onClick={(e) => handleDeletePromo(p.id, e)}
                                  aria-label={`Hapus promo ${p.name}`}
                                  title="Hapus promo ini"
                                  className="min-w-[44px] min-h-[44px] text-[var(--muted)] hover:text-[var(--danger)] rounded-xl hover:bg-[var(--danger-soft)] flex items-center justify-center transition-colors active:scale-[0.97] cursor-pointer"
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
                  <div className="p-3 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] text-[11px] text-[var(--muted)] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[var(--foreground)]">
                      <Info className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Otomatis Terhubung ke Google Sheets</span>
                    </div>
                    <p>
                      Saat transaksi disimpan, promo akan dicatat otomatis di sheet{' '}
                      <strong className="text-[var(--foreground)]">LOG_PENJUALAN</strong> dengan SKU kode promo dan nilai
                      minus sehingga omset di spreadsheet 100% klop dengan uang kasir.
                    </p>
                  </div>
                </Tabs.Panel>

                <Tabs.Panel
                  id="CREATE"
                  className="!mt-0 flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 pb-safe"
                >
                  <form onSubmit={handleSaveNewPromo} className="space-y-3.5">
                    {formError && (
                      <div className="p-2.5 bg-[var(--danger-soft)] border border-[var(--danger)]/35 rounded-xl text-xs text-[var(--danger)] flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Kode Promo */}
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                        Kode Promo / Voucher <span className="text-[var(--danger)]">*</span>
                      </label>
                      <Input
                        type="text"
                        fullWidth
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                        placeholder="Contoh: PROMO-WEEKEND atau MEMBER-5"
                        className="px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-mono uppercase font-bold text-[var(--foreground)] placeholder:text-[var(--muted)] min-h-[44px]"
                        required
                      />
                      <p className="text-[10px] text-[var(--muted)] mt-1">
                        Kode ini akan tercatat di Kolom C (SKU) Google Sheets.
                      </p>
                    </div>

                    {/* Nama Promo */}
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                        Nama Promo <span className="text-[var(--danger)]">*</span>
                      </label>
                      <Input
                        type="text"
                        fullWidth
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Contoh: Potongan Spesial Akhir Pekan"
                        className="px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] min-h-[44px]"
                        required
                      />
                    </div>

                    {/* Tipe Diskon & Nilai */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                          Tipe Potongan
                        </label>
                        <select
                          value={newType}
                          onChange={(e) => setNewType(e.target.value as 'FIXED' | 'PERCENT')}
                          className="w-full px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] min-h-[44px]"
                        >
                          <option value="FIXED">Nominal Tetap (Rp)</option>
                          <option value="PERCENT">Persentase (%)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                          {newType === 'FIXED' ? 'Nilai Potongan (Rp)' : 'Persentase (%)'}{' '}
                          <span className="text-[var(--danger)]">*</span>
                        </label>
                        <Input
                          type="number"
                          fullWidth
                          min="1"
                          max={newType === 'PERCENT' ? 100 : 10000000}
                          step="1"
                          value={newValue}
                          onChange={(e) => setNewValue(Number(e.target.value) || 0)}
                          placeholder={newType === 'FIXED' ? '10000' : '10'}
                          className="px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-mono font-bold text-[var(--foreground)] min-h-[44px]"
                          required
                        />
                      </div>
                    </div>

                    {/* Minimal Belanja */}
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                        Syarat Minimal Belanja (Rp)
                      </label>
                      <Input
                        type="number"
                        fullWidth
                        min="0"
                        step="1"
                        value={newMinOrder === 0 ? '' : newMinOrder}
                        onChange={(e) => setNewMinOrder(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0 (Isi 0 jika tanpa syarat)"
                        className="px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted)] min-h-[44px]"
                      />
                      <p className="text-[10px] text-[var(--muted)] mt-1">
                        Kosongkan atau isi 0 jika promo berlaku untuk semua total belanja.
                      </p>
                    </div>

                    {/* Keterangan */}
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                        Keterangan / Deskripsi
                      </label>
                      <Input
                        type="text"
                        fullWidth
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Contoh: Khusus pembelian min. 2 botol bir"
                        className="px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] min-h-[44px]"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 flex gap-2">
                      <Button
                        variant="outline"
                        fullWidth
                        onPress={() => setActiveTab('LIST')}
                        className="flex-1 min-h-[44px] rounded-xl text-xs font-bold bg-[var(--surface)]"
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        fullWidth
                        className="flex-1 min-h-[44px] rounded-xl text-xs font-bold"
                      >
                        Simpan & Terapkan Promo
                      </Button>
                    </div>
                  </form>
                </Tabs.Panel>
              </Tabs>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

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
    </>
  );
};
