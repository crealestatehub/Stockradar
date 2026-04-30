'use client';
import { useEffect, useCallback, useState, useRef } from 'react';
import { Star, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/lib/store';

interface MiniQuote { symbol: string; price: number | null; changePct: number | null }

export default function WatchlistSidebar() {
  const { user, watchlist, setWatchlist, removeFromWatchlist, ticker, setTicker, sidebarOpen, setSidebarOpen } = useStore();
  const [prices, setPrices] = useState<Record<string, MiniQuote>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadWatchlist = useCallback(async () => {
    if (!user) return;
    const res = await fetch('/api/watchlist');
    const data = await res.json();
    setWatchlist(data.items || []);
  }, [user, setWatchlist]);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  const fetchPrices = useCallback(async () => {
    if (!watchlist.length) return;
    const symbols = watchlist.map(w => w.ticker).join(',');
    try {
      const res = await fetch(`/api/stock/quotes?symbols=${symbols}`);
      const data = await res.json();
      const map: Record<string, MiniQuote> = {};
      for (const q of data.quotes ?? []) map[q.symbol] = q;
      setPrices(map);
    } catch {}
  }, [watchlist]);

  useEffect(() => {
    if (!watchlist.length || !sidebarOpen) return;
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchPrices, watchlist, sidebarOpen]);

  const remove = async (t: string) => {
    removeFromWatchlist(t);
    await fetch(`/api/watchlist?ticker=${t}`, { method: 'DELETE' });
  };

  const fmt = (n: number) => n >= 1000 ? n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n.toFixed(2);

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-12 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={[
        'flex flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden transition-all duration-300',
        'fixed top-12 bottom-0 left-0 z-40 w-52',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'md:relative md:top-auto md:bottom-auto md:z-auto md:translate-x-0 md:flex-shrink-0',
        sidebarOpen ? 'md:w-52' : 'md:w-10',
      ].join(' ')}>
        <div className="flex items-center justify-between px-2 py-3 border-b border-[var(--border)]">
          {sidebarOpen && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Star size={12} className="text-amber-400 flex-shrink-0" />
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] truncate">Watchlist</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors ml-auto flex-shrink-0 hidden md:flex"
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {sidebarOpen && (
          <div className="flex-1 overflow-y-auto py-1">
            {!user && (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">Inicia sesión para guardar tickers</p>
              </div>
            )}
            {watchlist.length === 0 && user && (
              <div className="px-3 py-4 text-center text-[10px] text-[var(--text-dim)]">Sin tickers guardados</div>
            )}
            {watchlist.map(item => {
              const q = prices[item.ticker];
              const positive = (q?.changePct ?? 0) >= 0;
              return (
                <div
                  key={item.ticker}
                  className={`group relative px-3 pt-2 pb-1.5 cursor-pointer transition-colors ${
                    ticker === item.ticker
                      ? 'bg-[var(--bg-hover)] border-r-2 border-blue-500'
                      : 'hover:bg-[var(--bg-hover)]'
                  }`}
                  onClick={() => {
                    setTicker(item.ticker);
                    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
                  }}
                >
                  {/* Row 1: ticker + delete */}
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-sm font-semibold leading-none ${
                      ticker === item.ticker ? 'text-blue-400' : 'text-[var(--text)]'
                    }`}>
                      {item.ticker}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(item.ticker); }}
                      className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-red-400 transition-all flex-shrink-0"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>

                  {/* Row 2: price + change */}
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] font-mono text-[var(--text-dim)]">
                      {q?.price != null ? `$${fmt(q.price)}` : <span className="opacity-40">—</span>}
                    </span>
                    {q?.changePct != null && (
                      <span className={`text-[10px] font-mono font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                        {positive ? '+' : ''}{q.changePct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
}
