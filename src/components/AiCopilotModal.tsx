import React, { useState, useEffect, useRef } from 'react';
import { Button, Chip, Input, Modal } from '@heroui/react';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Package,
  Receipt,
  TrendingUp,
  RotateCcw,
  Bot,
  User,
  ExternalLink,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { Product, TransactionReceipt } from '../types';
import { formatRupiah } from '../services/storageService';
import { useOverlayHistory } from '../utils/useOverlayHistory';
import { AppConfirmDialog } from './AppConfirmDialog';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actions?: Array<{
    type: string;
    payload: any;
    result: any;
  }>;
}

interface AiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  todayTransactions: TransactionReceipt[];
  cashierName?: string;
  brand: any;
  onExecuteAction: (action: { type: string; payload: any; result: any }) => void;
  onViewReceipt: (receipt: TransactionReceipt) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AiCopilotModal: React.FC<AiCopilotModalProps> = ({
  isOpen,
  onClose,
  products,
  todayTransactions,
  cashierName = 'Kasir',
  brand,
  onExecuteAction,
  onViewReceipt,
  onShowToast,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useOverlayHistory(isOpen, onClose, 'ai-copilot-modal');
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Halo Kak ${cashierName}! 👋 Saya **AI Copilot Kasir ${brand.NAME || 'ORTUKILL'}**.\n\nSaya bisa membantu Anda mengoperasikan kasir:\n• **Menambah stok produk** (misal: *"Tambah stok Anggur Merah 10 botol"*)\n• **Membuatkan struk penjualan** (misal: *"Buat struk 2 Amer pelanggan Budi bayar Cash"*)\n• **Mengecek stok menipis atau harga**\n• **Laporan omset & penjualan hari ini**\n• **Mencatat pengeluaran operasional**\n\nKetik pesan atau tekan tombol mikrofon untuk berbicara! 🎙️`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [isOpen, messages]);

  // Speech Recognition Setup (Web Speech API)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'id-ID';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setInput(transcript);

        if (event.results[0].isFinal) {
          setIsListening(false);
          if (transcript.trim()) {
            handleSendMessage(transcript.trim());
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [products, todayTransactions]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      const msg = 'Browser Anda tidak mendukung pengenalan suara. Silakan gunakan Google Chrome.';
      if (onShowToast) {
        onShowToast(msg, 'info');
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'assistant',
            text: msg,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Recognition start failed:', err);
      }
    }
  };

  // Text-to-Speech (TTS)
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window) || !speechEnabled) return;

    try {
      window.speechSynthesis.cancel();
      // Clean markdown tags for natural speech
      const clean = text
        .replace(/\*\*/g, '')
        .replace(/•/g, '')
        .replace(/#/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/[-_]/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'id-ID';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      // Select Indonesian voice if available
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang.startsWith('id') || v.lang.includes('ID'));
      if (idVoice) utterance.voice = idVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
      setIsSpeaking(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: AiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.text,
      }));

      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          context: {
            products,
            todayTransactions,
            cashierName,
          },
        }),
      });

      const data = await res.json();
      const replyText = data.reply || 'Saya telah memproses permintaan Anda.';
      const actions = data.executedActions || [];

      const assistantMsg: AiMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        actions,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Execute all actions locally on POS state
      if (actions && Array.isArray(actions)) {
        for (const act of actions) {
          onExecuteAction(act);
        }
      }

      // Read aloud if speech enabled
      if (speechEnabled) {
        speakText(replyText);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ Maaf, terjadi kendala saat memproses: ${err?.message || 'Gagal menghubungi server AI'}.`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: '📊 Omset Hari Ini', text: 'Berapa total omset dan penjualan kasir hari ini?' },
    { label: '📦 Cek Stok Menipis', text: 'Cek produk apa saja yang sisa stoknya menipis di bawah 10 botol' },
    { label: '➕ Tambah Stok Amer', text: 'Tambah stok Anggur Merah 12 botol' },
    { label: '🧾 Buat Struk 2 Amer', text: 'Buatkan struk 2 botol Anggur Merah bayar Cash pelanggan Mas Doni' },
    { label: '💸 Catat Pengeluaran', text: 'Catat pengeluaran beli es batu kristal Rp 15.000 bayar CASH' },
  ];

  return (
    <>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        variant="opaque"
      >
          <Modal.Container placement="auto" size="lg" className="p-0 sm:p-4">
            <Modal.Dialog
              aria-label="AI Copilot Kasir"
              className="relative p-0 gap-0 bg-[var(--overlay)] text-[var(--overlay-foreground)] w-full sm:max-w-xl h-dvh sm:h-[650px] sm:max-h-[90dvh] rounded-none sm:rounded-2xl shadow-2xl flex flex-col border-0 sm:border border-[var(--border)] overflow-hidden"
            >
              <Modal.CloseTrigger
                aria-label="Tutup AI Copilot"
                className="top-2.5 end-3 min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              />

              {/* Header */}
              <Modal.Header className="px-4 sm:px-5 pt-safe py-3 pr-16 bg-[var(--surface-secondary)] text-[var(--foreground)] flex flex-row items-center justify-between gap-2 border-b border-[var(--border)] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <Modal.Heading className="text-sm font-extrabold tracking-tight uppercase text-[var(--foreground)]">
                      AI Copilot Kasir
                    </Modal.Heading>
                    <p className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-[var(--success)] shrink-0" />
                      <span className="truncate">Asisten kasir & stok via suara/teks</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    isIconOnly
                    variant="outline"
                    onPress={() => {
                      if (speechEnabled) window.speechSynthesis?.cancel();
                      setSpeechEnabled(!speechEnabled);
                    }}
                    aria-label={speechEnabled ? 'Senyapkan suara' : 'Aktifkan suara'}
                    className={`min-w-[44px] min-h-[44px] rounded-full border ${
                      speechEnabled
                        ? 'text-amber-700 dark:text-[var(--warning)] bg-[var(--warning-soft)] border-[var(--warning)]/35'
                        : 'text-[var(--muted)] bg-[var(--surface)] border-[var(--border)]'
                    }`}
                  >
                    {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>

                  <Button
                    type="button"
                    isIconOnly
                    variant="outline"
                    onPress={() => setShowClearConfirm(true)}
                    aria-label="Mulai percakapan baru"
                    className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </Modal.Header>

              {/* Messages Body */}
              <Modal.Body className="!mt-0 flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 bg-[var(--background)]">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          isUser
                            ? 'bg-[var(--surface-tertiary)] border border-[var(--border)] text-[var(--foreground)]'
                            : 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                        }`}
                      >
                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>

                      {/* Message Bubble */}
                      <div className="space-y-2 min-w-0">
                        <div
                          className={`p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed ${
                            isUser
                              ? 'bg-[var(--accent)] text-[var(--accent-foreground)] rounded-tr-xs'
                              : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-tl-xs'
                          }`}
                        >
                          <div className="whitespace-pre-line font-normal break-words">{msg.text}</div>

                          <div
                            className={`text-[10px] mt-1.5 flex items-center justify-between gap-2 font-mono ${
                              isUser ? 'text-[var(--accent-foreground)]/80' : 'text-[var(--muted)]'
                            }`}
                          >
                            <span>{msg.timestamp}</span>
                            {!isUser && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onPress={() => speakText(msg.text)}
                                aria-label="Putar suara"
                                className="h-auto min-h-[28px] px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:text-[var(--accent)] rounded-md"
                              >
                                <Volume2 className="w-3 h-3" />
                                <span>Dengar</span>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Render Action Cards */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="space-y-2">
                            {msg.actions.map((act, idx) => {
                              // Struk Dibuat Card
                              if (act.type === 'CREATE_SALE_RECEIPT' && act.payload?.receipt) {
                                const r = act.payload.receipt;
                                return (
                                  <div
                                    key={idx}
                                    className="bg-[var(--surface)] border border-[var(--success)]/35 rounded-2xl p-3.5 space-y-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-[var(--success-soft)] border border-[var(--success)]/35 text-emerald-700 dark:text-[var(--success)] flex items-center justify-center shrink-0">
                                          <Receipt className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-[10px] font-bold text-emerald-700 dark:text-[var(--success)] uppercase tracking-wider block">
                                            Struk Berhasil Dibuat
                                          </span>
                                          <p className="text-xs font-extrabold font-mono text-[var(--foreground)] truncate">#{r.id}</p>
                                        </div>
                                      </div>
                                      <span className="text-xs font-extrabold text-emerald-700 dark:text-[var(--success)] font-mono tabular-nums shrink-0">
                                        {formatRupiah(r.total)}
                                      </span>
                                    </div>

                                    <div className="text-[11px] text-[var(--muted)] bg-[var(--surface-secondary)] p-2.5 rounded-xl space-y-1 border border-[var(--border)]">
                                      <div className="flex justify-between gap-2">
                                        <span>Pelanggan:</span>
                                        <span className="font-bold text-[var(--foreground)]">{r.customerName || 'Umum'}</span>
                                      </div>
                                      <div className="flex justify-between gap-2">
                                        <span>Metode Bayar:</span>
                                        <span className="font-bold text-[var(--foreground)]">{r.paymentMethod}</span>
                                      </div>
                                      <div className="flex justify-between gap-2">
                                        <span className="shrink-0">Item ({r.items.length}):</span>
                                        <span className="font-semibold text-[var(--foreground)] text-right">
                                          {r.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')}
                                        </span>
                                      </div>
                                    </div>

                                    <Button
                                      type="button"
                                      fullWidth
                                      variant="primary"
                                      onPress={() => onViewReceipt(r)}
                                      className="bg-[var(--success)] text-[var(--success-foreground)] hover:opacity-90 rounded-xl text-xs font-bold min-h-[44px]"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Buka Struk Kasir</span>
                                    </Button>
                                  </div>
                                );
                              }

                              // Stok Ditambah Card
                              if (act.type === 'ADD_STOCK') {
                                const p = act.payload;
                                return (
                                  <div
                                    key={idx}
                                    className="bg-[var(--surface)] border border-[var(--warning)]/35 rounded-2xl p-3 space-y-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-[var(--warning-soft)] border border-[var(--warning)]/35 text-amber-700 dark:text-[var(--warning)] flex items-center justify-center shrink-0">
                                          <Package className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-[10px] font-bold text-amber-700 dark:text-[var(--warning)] uppercase tracking-wider block">
                                            Stok Diperbarui
                                          </span>
                                          <p className="text-xs font-extrabold text-[var(--foreground)] truncate">{p.name}</p>
                                        </div>
                                      </div>
                                      <Chip
                                        size="sm"
                                        variant="soft"
                                        color="warning"
                                        className="bg-[var(--warning-soft)] text-amber-700 dark:text-[var(--warning)] border border-[var(--warning)]/35 shrink-0"
                                      >
                                        <Chip.Label className="text-xs font-extrabold font-mono">+{p.addedQty} botol</Chip.Label>
                                      </Chip>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1.5 border-t border-[var(--border)] font-mono">
                                      <span>Stok Sebelumnya: {p.oldStock}</span>
                                      <ArrowRight className="w-3 h-3 text-[var(--muted)]" />
                                      <span className="font-bold text-emerald-700 dark:text-[var(--success)]">Stok Baru: {p.newStock} botol</span>
                                    </div>
                                  </div>
                                );
                              }

                              // Pengeluaran Dicatat Card
                              if (act.type === 'RECORD_EXPENSE') {
                                const rec = act.payload.record;
                                return (
                                  <div
                                    key={idx}
                                    className="bg-[var(--surface)] border border-[var(--danger)]/35 rounded-2xl p-3 space-y-1"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-bold text-red-700 dark:text-[var(--danger)] uppercase">
                                        Pengeluaran Tercatat (Sheet LAIN-LAIN)
                                      </span>
                                      <span className="text-xs font-extrabold text-red-700 dark:text-[var(--danger)] font-mono tabular-nums shrink-0">
                                        -{formatRupiah(rec.amount)}
                                      </span>
                                    </div>
                                    <p className="text-xs font-bold text-[var(--foreground)]">{rec.description}</p>
                                    <p className="text-[10px] text-[var(--muted)]">
                                      Dibayar via: {rec.paymentMethod} • Oleh: {rec.cashier}
                                    </p>
                                  </div>
                                );
                              }

                              // Sales Summary Card
                              if (act.type === 'SALES_SUMMARY') {
                                const s = act.payload;
                                return (
                                  <div
                                    key={idx}
                                    className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 space-y-2"
                                  >
                                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--foreground)] border-b pb-1.5 border-[var(--border)]">
                                      <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
                                      <span>Ringkasan Penjualan Hari Ini</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="bg-[var(--surface-secondary)] p-2 rounded-xl border border-[var(--border)]">
                                        <span className="text-[10px] text-[var(--muted)] block font-medium">Omset</span>
                                        <span className="font-extrabold text-[var(--foreground)] font-mono tabular-nums">
                                          {formatRupiah(s.totalOmset || 0)}
                                        </span>
                                      </div>
                                      <div className="bg-[var(--surface-secondary)] p-2 rounded-xl border border-[var(--border)]">
                                        <span className="text-[10px] text-[var(--muted)] block font-medium">Margin Laba</span>
                                        <span className="font-extrabold text-emerald-700 dark:text-[var(--success)] font-mono tabular-nums">
                                          {formatRupiah(s.totalMargin || 0)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-[var(--muted)] flex flex-col gap-1 px-0.5 pt-1 border-t border-[var(--border)]">
                                      <div className="flex justify-between">
                                        <span>Transaksi: {s.totalTransactions} struk</span>
                                        <span>Total: {s.totalBottles} botol</span>
                                      </div>
                                      {typeof s.filteredBottles === 'number' && (
                                        <div className="flex justify-between items-center font-bold text-amber-800 dark:text-[var(--warning)] bg-[var(--warning-soft)] border border-[var(--warning)]/35 px-2 py-1 rounded-lg text-[10px]">
                                          <span>Botol Keluar (Excl. Bir/Promo/&lt;30k):</span>
                                          <span className="font-mono text-amber-700 dark:text-[var(--warning)] font-extrabold">
                                            {s.filteredBottles} btl
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              return null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-center gap-2.5 text-[var(--muted)] text-xs py-2.5 px-3.5 bg-[var(--surface)] rounded-2xl w-fit border border-[var(--border)]">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                    <span className="font-semibold text-[var(--foreground)]">AI Copilot sedang menjalankan instruksi...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </Modal.Body>

              {/* Quick Suggestions Chips */}
              <div className="px-3 sm:px-4 py-2 bg-[var(--surface)] border-t border-[var(--border)] flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
                {quickPrompts.map((q, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    size="sm"
                    variant="outline"
                    onPress={() => handleSendMessage(q.text)}
                    className="text-[11px] font-semibold text-[var(--foreground)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border)] px-3 rounded-full whitespace-nowrap flex-shrink-0 min-h-[38px]"
                  >
                    {q.label}
                  </Button>
                ))}
              </div>

              {/* Voice Recognition Active Banner */}
              {isListening && (
                <div className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-bold flex items-center justify-between animate-pulse shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-foreground)] animate-ping" />
                    <span>Mendengarkan suara kasir... Silakan bicara</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onPress={toggleListening}
                    className="bg-white/20 hover:bg-white/30 text-[var(--accent-foreground)] px-3 rounded-full text-[11px] min-h-[36px]"
                  >
                    Berhenti
                  </Button>
                </div>
              )}

              {/* Input Bar */}
              <div className="p-3 sm:p-4 bg-[var(--surface)] border-t border-[var(--border)] flex items-center gap-2 flex-shrink-0 pb-safe">
                {/* Microphone button */}
                <Button
                  type="button"
                  isIconOnly
                  variant={isListening ? 'danger' : 'outline'}
                  onPress={toggleListening}
                  aria-label={isListening ? 'Berhenti mendengarkan' : 'Bicara dengan suara (Voice)'}
                  className={`min-w-[44px] min-h-[44px] rounded-xl flex-shrink-0 ${
                    isListening
                      ? 'bg-[var(--danger)] text-[var(--danger-foreground)] ring-4 ring-[var(--danger)]/25 animate-bounce'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border)] text-[var(--accent)]'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>

                {/* Text Input */}
                <Input
                  type="text"
                  fullWidth
                  variant="secondary"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={isListening ? 'Sedang mendengarkan ucapan...' : 'Ketik perintah atau bicara...'}
                  disabled={isLoading}
                  className="flex-1 min-w-0 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl px-3.5 text-xs sm:text-sm text-[var(--foreground)] min-h-[44px]"
                />

                {/* Send Button */}
                <Button
                  type="button"
                  isIconOnly
                  variant="primary"
                  onPress={() => handleSendMessage()}
                  isDisabled={!input.trim() || isLoading}
                  aria-label="Kirim pesan"
                  className="min-w-[44px] min-h-[44px] rounded-xl flex-shrink-0 bg-[var(--accent)] text-[var(--accent-foreground)]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

      <AppConfirmDialog
        isOpen={showClearConfirm}
        title="Bersihkan Percakapan AI?"
        description="Riwayat obrolan di jendela AI Copilot saat ini akan dihapus."
        confirmLabel="Ya, Bersihkan"
        cancelLabel="Batal"
        variant="warning"
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setShowClearConfirm(false);
          setMessages([
            {
              id: 'new-start',
              role: 'assistant',
              text: 'Percakapan telah dibersihkan. Ada yang bisa saya bantu sekarang?',
              timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }}
      />
    </>
  );
};
