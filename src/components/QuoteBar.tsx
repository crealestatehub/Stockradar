'use client';
import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Star, StarOff, Save } from 'lucide-react';
import { useStore } from '@/lib/store';

interface Quote {
  symbol: string; current: number; change: number; changePct: number;
  high: number; low: number; open: number; prevClose: number;
}

interface Props { onSaveAnalysis?: () => void }

export default function QuoteBar({ onSaveAnalysis }: Props) {
  const { ticker, user, watchlist, addToWatchlist, removeFromWatchlist, setAuthModal } = useStore();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  const isWatched = watchlist.some(w => w.ticker === ticker);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock/quote?symbol=${ticker}`);
      const data = await res.json();
      if (data.quote) setQuote(data.quote);
    } catch {} finally { setLoading(false); }
  }, [ticker]);

  useEffect(() => { setLoading(true); fetchQuote(); }, [fetchQuote]);
  useEffect(() => { const id = setInterval(fetchQuote, 15_000); return () => clearInterval(id); }, [fetchQuote]);

  const toggleWatchlist = async () => {
    if (!user) { setAuthModal('login'); return; }
    if (isWatched) {
      removeFromWatchlist(ticker);
      await fetch(`/api/watchlist?ticker=${ticker}`, { method: 'DELETE' });
    } else {
      addToWatchlist({ id: '', ticker, name: '' });
      await fetch('/api/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      });
    }
  };

  const positive = (quote?.changePct ?? 0) >= 0;
  const fmt = (n: number, dec = 2) => n?.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') ?? '—';

  if (loading) {
    return (
      <div className="flex items-center gap-4 px-1">
        <div className="skeleton h-8 w-24 rounded" />
        <div className="skeleton h-5 w-16 rounded" />
        <div className="skeleton h-4 w-32 rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 md:gap-5">
      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-[var(--text)]">${fmt(quote?.current ?? 0)}</span>
        <div className={`flex items-center gap-1 text-sm font-mono font-semibold ${positive ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
          {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {positive ? '+' : ''}{fmt(quote?.change ?? 0)} ({positive ? '+' : ''}{fmt(quote?.changePct ?? 0)}%)
        </div>
      </div>

      {/* OHLC */}
      <div className="hidden md:flex items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
        <span>O <span className="text-[var(--text)]">${fmt(quote?.open ?? 0)}</span></span>
        <span>H <span className="text-green-400">${fmt(quote?.high ?? 0)}</span></span>
        <span>L <span className="text-red-400">${fmt(quote?.low ?? 0)}</span></span>
        <span>C <span className="text-[var(--text)]">${fmt(quote?.prevClose ?? 0)}</span></span>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <span className="live-dot" />
        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Live</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          onClick={toggleWatchlist}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            isWatched
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              : 'border-[var(--border)] text-[var(--text-muted)] hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/10'
          }`}
        >
          {isWatched ? <Star size={12} fill="currentColor" /> : <StarOff size={12} />}
          {isWatched ? 'Guardado' : 'Watchlist'}
        </button>
        {onSaveAnalysis && user && (
          <button
            onClick={onSaveAnalysis}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-muted)] hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <Save size={12} /> Guardar análisis
          </button>
        )}
      </div>
    </div>
  );
}
