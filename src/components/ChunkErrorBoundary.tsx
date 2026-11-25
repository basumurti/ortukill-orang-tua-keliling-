import React from 'react';
import { AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';

interface ChunkErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  compact?: boolean;
  resetKey?: string | number;
  onRetry?: () => void;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ChunkErrorBoundary extends React.Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  constructor(props: ChunkErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: unknown): ChunkErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : 'Gagal memuat tampilan. Periksa koneksi internet Anda.';
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidUpdate(prevProps: ChunkErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80">
            <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-[#2B2B33] bg-white dark:bg-[#1B1B20] p-6 pb-safe shadow-xl text-center">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto mb-3 sm:hidden" />
              <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F4F4F6] mb-1">
                {this.props.title || 'Gagal memuat komponen'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 break-words">
                {this.state.errorMessage}
              </p>
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-blue-700 dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Coba lagi</span>
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="rounded-2xl border border-slate-200 dark:border-[#2B2B33] bg-white dark:bg-[#1B1B20] p-6 sm:p-8 text-center max-w-md mx-auto my-6 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F4F4F6] mb-1">
            {this.props.title || 'Gagal memuat halaman'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5 break-words">
            {this.state.errorMessage}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-blue-700 dark:bg-[#9333EA] dark:hover:bg-[#A855F7] text-white text-xs font-bold transition-colors active:scale-[0.97] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Coba lagi</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ViewLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Memuat tampilan...' }) => (
  <div className="space-y-4 max-w-7xl mx-auto" aria-busy="true" aria-label={label}>
    <div className="rounded-2xl border border-slate-200 dark:border-[#2B2B33] bg-white dark:bg-[#1B1B20] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-4 w-40 rounded-lg bg-slate-200 dark:bg-[#24242B] animate-pulse" />
          <div className="h-3 w-56 max-w-full rounded-md bg-slate-100 dark:bg-[#2E2E37] animate-pulse" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-slate-200 dark:bg-[#24242B] animate-pulse shrink-0" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-[#24242B] animate-pulse" />
        ))}
      </div>
    </div>
    <div className="rounded-2xl border border-slate-200 dark:border-[#2B2B33] bg-white dark:bg-[#1B1B20] p-4 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 pb-1">
        <Loader2 className="w-4 h-4 animate-spin text-[#2563EB] dark:text-[#C084FC]" />
        <span>{label}</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-[#24242B] animate-pulse" />
      ))}
    </div>
  </div>
);

export const ModalLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Menyiapkan tampilan...' }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/80">
    <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-[#2B2B33] bg-white dark:bg-[#1B1B20] p-5 pb-safe space-y-4 shadow-xl">
      <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 mx-auto sm:hidden" />
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#2563EB] dark:text-[#C084FC] shrink-0" />
        <span className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F6]">{label}</span>
      </div>
      <div className="h-32 rounded-xl bg-slate-100 dark:bg-[#24242B] animate-pulse" />
    </div>
  </div>
);
