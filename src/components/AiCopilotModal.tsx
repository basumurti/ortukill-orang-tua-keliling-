import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Package,
  Receipt,
  TrendingUp,
  DollarSign,
  RotateCcw,
  Bot,
  User,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Copilot Kasir"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/75 dark:bg-black/80 animate-in fade-in duration-150"
    >
      <div className="fixed inset-0 hidden sm:block" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 bg-white dark:bg-[#1B1B20] w-full sm:max-w-xl h-dvh sm:h-[650px] sm:max-h-[90dvh] sm:rounded-2xl shadow-2xl flex flex-col border-0 sm:border border-slate-200 dark:border-[#2B2B33] overflow-hidden text-[#0F172A] dark:text-[#F4F4F6] animate-in slide-in-from-bottom sm:zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-5 pt-safe py-3 bg-slate-50 dark:bg-[#16161A] text-[#0F172A] dark:text-[#F4F4F6] flex items-center justify-between border-b border-slate-200 dark:border-[#2B2B33] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] dark:bg-[#9333EA] flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold tracking-tight uppercase text-[#0F172A] dark:text-[#F4F4F6]">AI Copilot Kasir</h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">Asisten kasir & stok via suara/teks</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (speechEnabled) window.speechSynthesis?.cancel();
                setSpeechEnabled(!speechEnabled);
              }}
              aria-label={speechEnabled ? 'Senyapkan suara' : 'Aktifkan suara'}
              className={`min-w-[44px] min-h-[44px] rounded-full border flex items-center justify-center transition-colors active:scale-[0.97] cursor-pointer ${
                speechEnabled
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/35'
                  : 'text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#24242B] border-slate-200 dark:border-[#343440]'
              }`}
            >
              {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              aria-label="Mulai percakapan baru"
              className="min-w-[44px] min-h-[44px] rounded-full bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] transition-colors active:scale-[0.97] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup AI Copilot"
              className="min-w-[44px] min-h-[44px] rounded-full bg-white dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] transition-colors active:scale-[0.97] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 bg-[#F6F7F9] dark:bg-[#121215]">
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
                      ? 'bg-[#0F172A] dark:bg-[#24242B] dark:border dark:border-[#343440] text-white'
                      : 'bg-[#2563EB] dark:bg-[#9333EA] text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className="space-y-2 min-w-0">
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed ${
                      isUser
                        ? 'bg-[#2563EB] dark:bg-[#9333EA] text-white rounded-tr-xs'
                        : 'bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#2B2B33] text-[#0F172A] dark:text-[#F4F4F6] rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-line font-normal break-words">{msg.text}</div>

                    <div
                      className={`text-[10px] mt-1.5 flex items-center justify-between gap-2 font-mono ${
                        isUser ? 'text-blue-100 dark:text-purple-200' : 'text-slate-400 dark:text-zinc-500'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => speakText(msg.text)}
                          title="Putar suara"
                          className="text-slate-500 dark:text-zinc-400 hover:text-[#2563EB] dark:hover:text-[#C084FC] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Dengar</span>
                        </button>
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
                              className="bg-white dark:bg-[#1B1B20] border border-emerald-200 dark:border-emerald-500/35 rounded-2xl p-3.5 space-y-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    <Receipt className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                                      Struk Berhasil Dibuat
                                    </span>
                                    <p className="text-xs font-extrabold font-mono text-[#0F172A] dark:text-[#F4F4F6] truncate">#{r.id}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums shrink-0">
                                  {formatRupiah(r.total)}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-[#24242B] p-2.5 rounded-xl space-y-1 border border-slate-200 dark:border-[#343440]">
                                <div className="flex justify-between gap-2">
                                  <span>Pelanggan:</span>
                                  <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6]">{r.customerName || 'Umum'}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span>Metode Bayar:</span>
                                  <span className="font-bold text-[#0F172A] dark:text-[#F4F4F6]">{r.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="shrink-0">Item ({r.items.length}):</span>
                                  <span className="font-semibold text-[#0F172A] dark:text-[#F4F4F6] text-right">
                                    {r.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onViewReceipt(r)}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Buka Struk Kasir</span>
                              </button>
                            </div>
                          );
                        }

                        // Stok Ditambah Card
                        if (act.type === 'ADD_STOCK') {
                          const p = act.payload;
                          return (
                            <div
                              key={idx}
                              className="bg-white dark:bg-[#1B1B20] border border-amber-200 dark:border-amber-500/35 rounded-2xl p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                                      Stok Diperbarui
                                    </span>
                                    <p className="text-xs font-extrabold text-[#0F172A] dark:text-[#F4F4F6] truncate">{p.name}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-extrabold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/35 px-2.5 py-0.5 rounded-full font-mono shrink-0">
                                  +{p.addedQty} botol
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-300 pt-1.5 border-t border-slate-200 dark:border-[#2B2B33] font-mono">
                                <span>Stok Sebelumnya: {p.oldStock}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">Stok Baru: {p.newStock} botol</span>
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
                              className="bg-white dark:bg-[#1B1B20] border border-red-200 dark:border-red-500/35 rounded-2xl p-3 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">
                                  Pengeluaran Tercatat (Sheet LAIN-LAIN)
                                </span>
                                <span className="text-xs font-extrabold text-red-600 dark:text-red-400 font-mono tabular-nums shrink-0">
                                  -{formatRupiah(rec.amount)}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6]">{rec.description}</p>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
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
                              className="bg-white dark:bg-[#1B1B20] border border-slate-200 dark:border-[#2B2B33] rounded-2xl p-3 space-y-2"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0F172A] dark:text-[#F4F4F6] border-b pb-1.5 border-slate-200 dark:border-[#2B2B33]">
                                <TrendingUp className="w-4 h-4 text-[#2563EB] dark:text-[#C084FC]" />
                                <span>Ringkasan Penjualan Hari Ini</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-50 dark:bg-[#24242B] p-2 rounded-xl border border-slate-200 dark:border-[#343440]">
                                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-medium">Omset</span>
                                  <span className="font-extrabold text-[#0F172A] dark:text-[#F4F4F6] font-mono tabular-nums">{formatRupiah(s.totalOmset || 0)}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-[#24242B] p-2 rounded-xl border border-slate-200 dark:border-[#343440]">
                                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-medium">Margin Laba</span>
                                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">{formatRupiah(s.totalMargin || 0)}</span>
                                </div>
                              </div>
                              <div className="text-[10px] text-slate-600 dark:text-zinc-300 flex flex-col gap-1 px-0.5 pt-1 border-t border-slate-200 dark:border-[#2B2B33]">
                                <div className="flex justify-between">
                                  <span>Transaksi: {s.totalTransactions} struk</span>
                                  <span>Total: {s.totalBottles} botol</span>
                                </div>
                                {typeof s.filteredBottles === 'number' && (
                                  <div className="flex justify-between items-center font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 px-2 py-1 rounded-lg text-[10px]">
                                    <span>Botol Keluar (Excl. Bir/Promo/&lt;30k):</span>
                                    <span className="font-mono text-amber-700 dark:text-amber-400 font-extrabold">{s.filteredBottles} btl</span>
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
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-300 text-xs py-2.5 px-3.5 bg-white dark:bg-[#1B1B20] rounded-2xl w-fit border border-slate-200 dark:border-[#2B2B33]">
              <Loader2 className="w-4 h-4 animate-spin text-[#2563EB] dark:text-[#C084FC]" />
              <span className="font-semibold text-[#0F172A] dark:text-[#F4F4F6]">AI Copilot sedang menjalankan instruksi...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions Chips */}
        <div className="px-3 sm:px-4 py-2 bg-white dark:bg-[#1B1B20] border-t border-slate-200 dark:border-[#2B2B33] flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q.text)}
              className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6] bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] px-3 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer flex-shrink-0"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Voice Recognition Active Banner */}
        {isListening && (
          <div className="px-4 py-2 bg-[#2563EB] dark:bg-[#9333EA] text-white text-xs font-bold flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>Mendengarkan suara kasir... Silakan bicara</span>
            </div>
            <button
              type="button"
              onClick={toggleListening}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-full text-[10px] cursor-pointer"
            >
              Berhenti
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#1B1B20] border-t border-slate-200 dark:border-[#2B2B33] flex items-center gap-2 flex-shrink-0 pb-safe">
          {/* Microphone button */}
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'Berhenti mendengarkan' : 'Bicara dengan suara (Voice)'}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${
              isListening
                ? 'bg-red-600 text-white ring-4 ring-red-200 dark:ring-red-500/30 animate-bounce'
                : 'bg-slate-50 dark:bg-[#24242B] hover:bg-slate-100 dark:hover:bg-[#2E2E37] border border-slate-200 dark:border-[#343440] text-slate-600 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-[#F4F4F6]'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#2563EB] dark:text-[#C084FC]" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
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
            className="flex-1 min-w-0 bg-slate-50 dark:bg-[#24242B] border border-slate-200 dark:border-[#343440] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] dark:text-[#F4F4F6] placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#A855F7] focus:bg-white dark:focus:bg-[#1B1B20] transition-colors min-h-[44px]"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer flex-shrink-0 ${
              !input.trim() || isLoading
                ? 'bg-slate-200 dark:bg-[#24242B] text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                : 'bg-[#2563EB] dark:bg-[#9333EA] hover:bg-[#1D4ED8] dark:hover:bg-[#A855F7]'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

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
    </div>
  );
};
