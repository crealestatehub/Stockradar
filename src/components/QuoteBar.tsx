'use client';
import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Star, StarOff, Save } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useRealtimeQuote } from '@/hooks/useRealtimeQuote';

interface Quote {
  symbol: string; current: number; change: number; changePct: number;
  high: number; low: number; open: number; prevClose: number;
}

interface Props { onSaveAnalysis?: () => void }

function getMarketStatus() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());

  const hour    = parseInt(parts.find(p => p.type === 'hour')?.value    ?? '0') % 24;
  const minute  = parseInt(parts.find(p => p.type === 'minute')?.value  ?? '0');
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const mins    = hour * 60 + minute;
  const weekend = weekday === 'Sat' || weekday === 'Sun';

  if (!weekend && mins >= 9 * 60 + 30 && mins < 16 * 60)
    return { label: 'Mercado Abierto', dot: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-500/10 border-green-500/25'  };
  if (!weekend && mins >= 4 * 60 && mins < 9 * 60 + 30)
    return { label: 'Pre-market',      dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25'  };
  if (!weekend && mins >= 16 * 60 && mins < 20 * 60)
    return { label: 'After-hours',     dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25'  };
  return       { label: 'Mercado Cerrado', dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25'      };
}

export default function QuoteBar({ onSaveAnalysis }: Props) {
  const { ticker, user, watchlist, addToWatchlist, removeFromWatchlist, setAuthModal } = useStore();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState(getMarketStatus);

  const isWatched = watchlist.some(w => w.ticker === ticker);
  const { trade, isLive } = useRealtimeQuote(ticker);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock/quote?symbol=${ticker}`);
      const data = await res.json();
      if (data.quote) setQuote(data.quote);
    } catch {} finally { setLoading(false); }
  }, [ticker]);

  useEffect(() => { setLoading(true); fetchQuote(); }, [fetchQuote]);
  useEffect(() => { const id = setInterval(fetchQuote, 15_000); return () => clearInterval(id); }, [fetchQuote]);

  // Refresh market status every minute
  useEffect(() => {
    const id = setInterval(() => setMarket(getMarketStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  const livePrice     = trade?.price ?? quote?.current ?? 0;
  const baseClose     = quote?.prevClose ?? 0;
  const liveChange    = baseClose > 0 ? livePrice - baseClose : (quote?.change ?? 0);
  const liveChangePct = baseClose > 0 ? (liveChange / baseClose) * 100 : (quote?.changePct ?? 0);

  const positive = liveChangePct >= 0;
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
        <span className="font-mono text-2xl font-bold text-[var(--text)]">
          ${fmt(livePrice)}
        </span>
        <div className={`flex items-center gap-1 text-sm font-mono font-semibold ${positive ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
          {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {positive ? '+' : ''}{fmt(liveChange)} ({positive ? '+' : ''}{fmt(liveChangePct)}%)
        </div>
      </div>

      {/* OHLC */}
      <div className="hidden md:flex items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
        <span>O <span className="text-[var(--text)]">${fmt(quote?.open ?? 0)}</span></span>
        <span>H <span className="text-green-400">${fmt(quote?.high ?? 0)}</span></span>
        <span>L <span className="text-red-400">${fmt(quote?.low ?? 0)}</span></span>
        <span>C <span className="text-[var(--text)]">${fmt(quote?.prevClose ?? 0)}</span></span>
      </div>

      {/* Live WS indicator */}
      <div className="flex items-center gap-1.5">
        <span className={`live-dot ${isLive ? '' : 'opacity-40'}`} />
        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
          {isLive ? 'WS Live' : 'Live'}
        </span>
      </div>

      {/* Market status */}
      <div className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider ${market.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${market.dot}`} />
        <span className={market.text}>{market.label}</span>
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
          <span className="hidden sm:inline">{isWatched ? 'Guardado' : 'Watchlist'}</span>
        </button>
        {onSaveAnalysis && user && (
          <button
            onClick={onSaveAnalysis}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-muted)] hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <Save size={12} /><span className="hidden sm:inline"> Guardar análisis</span>
          </button>
        )}
      </div>
    </div>
  );
}
