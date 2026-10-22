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
}) => {
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
      alert('Browser Anda tidak mendukung pengenalan suara (Speech Recognition). Silakan gunakan Google Chrome.');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-xl h-[88vh] sm:h-[650px] rounded-t-[28px] sm:rounded-[32px] shadow-2xl flex flex-col border border-stone-200/90 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-stone-900 via-[#1E232D] to-stone-900 text-white flex items-center justify-between border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF643D] to-[#FF5E36] flex items-center justify-center text-white shadow-md shadow-[#FF5E36]/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold tracking-tight">AI Copilot Kasir</h3>
                <span className="text-[10px] font-bold bg-[#FF5E36] text-white px-2 py-0.5 rounded-full">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-[11px] text-stone-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Siap mengoperasikan POS & stok via suara/teks</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Voice Readout */}
            <button
              type="button"
              onClick={() => {
                if (speechEnabled) window.speechSynthesis?.cancel();
                setSpeechEnabled(!speechEnabled);
              }}
              title={speechEnabled ? 'Suara aktif (klik untuk senyapkan)' : 'Suara nonaktif (klik untuk aktifkan)'}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                speechEnabled ? 'text-amber-400 bg-white/10 hover:bg-white/20' : 'text-stone-400 hover:text-white'
              }`}
            >
              {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Clear conversation */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Bersihkan riwayat percakapan AI?')) {
                  setMessages([
                    {
                      id: 'new-start',
                      role: 'assistant',
                      text: 'Percakapan telah dibersihkan. Ada yang bisa saya bantu sekarang?',
                      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    },
                  ]);
                }
              }}
              title="Mulai percakapan baru"
              className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF8F5]/80">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-stone-900 text-white'
                      : 'bg-gradient-to-br from-[#FF5E36] to-amber-500 text-white shadow-xs'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className="space-y-2">
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                      isUser
                        ? 'bg-stone-900 text-white rounded-tr-xs'
                        : 'bg-white border border-stone-200/90 text-stone-800 rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-line font-normal">{msg.text}</div>

                    <div
                      className={`text-[10px] mt-1.5 flex items-center justify-between gap-2 font-mono ${
                        isUser ? 'text-stone-400' : 'text-stone-400'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => speakText(msg.text)}
                          title="Putar suara"
                          className="hover:text-[#FF5E36] transition-colors cursor-pointer flex items-center gap-1"
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
                              className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300/80 rounded-2xl p-3.5 shadow-xs space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                                    <Receipt className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                                      Struk Berhasil Dibuat
                                    </span>
                                    <p className="text-xs font-black font-mono text-emerald-950">#{r.id}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-black text-emerald-800 font-mono">
                                  {formatRupiah(r.total)}
                                </span>
                              </div>

                              <div className="text-[11px] text-stone-600 bg-white/70 p-2 rounded-xl space-y-1 border border-emerald-100">
                                <div className="flex justify-between">
                                  <span>Pelanggan:</span>
                                  <span className="font-bold text-stone-800">{r.customerName || 'Umum'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Metode Bayar:</span>
                                  <span className="font-bold text-stone-800">{r.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Item ({r.items.length}):</span>
                                  <span className="font-semibold text-stone-700">
                                    {r.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onViewReceipt(r)}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-98"
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
                              className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300/80 rounded-2xl p-3 shadow-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-xl bg-[#FF5E36] text-white flex items-center justify-center">
                                    <Package className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                                      Stok Diperbarui
                                    </span>
                                    <p className="text-xs font-black text-stone-900">{p.name}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-black bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full font-mono">
                                  +{p.addedQty} botol
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-stone-600 pt-1 border-t border-amber-200/60 font-mono">
                                <span>Stok Sebelumnya: {p.oldStock}</span>
                                <ArrowRight className="w-3 h-3 text-stone-400" />
                                <span className="font-bold text-emerald-700">Stok Baru: {p.newStock} botol</span>
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
                              className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-300/80 rounded-2xl p-3 shadow-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-rose-700 uppercase">
                                  Pengeluaran Tercatat (Sheet LAIN-LAIN)
                                </span>
                                <span className="text-xs font-black text-rose-700 font-mono">
                                  -{formatRupiah(rec.amount)}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-stone-800">{rec.description}</p>
                              <p className="text-[10px] text-stone-500">
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
                              className="bg-white border border-stone-200/90 rounded-2xl p-3 shadow-xs space-y-2"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-extrabold text-stone-900 border-b pb-1.5 border-stone-100">
                                <TrendingUp className="w-4 h-4 text-[#FF5E36]" />
                                <span>Ringkasan Penjualan Hari Ini</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-stone-50 p-2 rounded-xl">
                                  <span className="text-[10px] text-stone-400 block font-medium">Omset</span>
                                  <span className="font-black text-stone-900 font-mono">{formatRupiah(s.totalOmset || 0)}</span>
                                </div>
                                <div className="bg-stone-50 p-2 rounded-xl">
                                  <span className="text-[10px] text-stone-400 block font-medium">Margin Laba</span>
                                  <span className="font-black text-emerald-700 font-mono">{formatRupiah(s.totalMargin || 0)}</span>
                                </div>
                              </div>
                              <div className="text-[10px] text-stone-500 flex flex-col gap-1 px-1 pt-1 border-t border-stone-100">
                                <div className="flex justify-between">
                                  <span>Transaksi: {s.totalTransactions} struk</span>
                                  <span>Total: {s.totalBottles} botol</span>
                                </div>
                                {typeof s.filteredBottles === 'number' && (
                                  <div className="flex justify-between items-center font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-lg text-[10px]">
                                    <span>Botol Keluar (Excl. Bir/Promo/&lt;30k):</span>
                                    <span className="font-mono text-amber-900 font-extrabold">{s.filteredBottles} btl</span>
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
            <div className="flex items-center gap-2.5 text-stone-500 text-xs py-2 px-3 bg-white rounded-2xl w-fit border border-stone-200 shadow-2xs">
              <Loader2 className="w-4 h-4 animate-spin text-[#FF5E36]" />
              <span className="font-semibold">AI Copilot sedang menjalankan instruksi...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions Chips */}
        <div className="px-4 py-2 bg-white border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q.text)}
              className="text-[11px] font-bold text-stone-700 hover:text-[#FF5E36] bg-stone-100 hover:bg-[#FFF2ED] border border-stone-200 hover:border-[#FF5E36]/30 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer flex-shrink-0 active:scale-95"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Voice Recognition Active Banner */}
        {isListening && (
          <div className="px-4 py-2 bg-gradient-to-r from-[#FF5E36] to-amber-500 text-white text-xs font-bold flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>Mendengarkan suara kasir... Silakan bicara</span>
            </div>
            <button
              type="button"
              onClick={toggleListening}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-0.5 rounded-full text-[10px]"
            >
              Berhenti
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-stone-200/80 flex items-center gap-2 flex-shrink-0">
          {/* Microphone button */}
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'Berhenti mendengarkan' : 'Bicara dengan suara (Voice)'}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 shadow-xs ${
              isListening
                ? 'bg-rose-600 text-white ring-4 ring-rose-200 animate-bounce'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#FF5E36]" />}
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
            placeholder={isListening ? 'Sedang mendengarkan ucapan...' : 'Ketik perintah atau bicara (misal: "tambah stok amer 10")'}
            disabled={isLoading}
            className="flex-1 bg-stone-100/80 border border-stone-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36] focus:border-transparent transition-all"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all cursor-pointer flex-shrink-0 shadow-md ${
              !input.trim() || isLoading
                ? 'bg-stone-300 cursor-not-allowed shadow-none'
                : 'bg-[#FF5E36] hover:bg-[#e04f29] active:scale-95 shadow-[#FF5E36]/30'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
