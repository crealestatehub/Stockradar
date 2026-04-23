'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Clock, Star, X } from 'lucide-react';
import { useStore } from '@/lib/store';

interface Match { symbol: string; description: string }

export default function SearchBar() {
  const { ticker, setTicker, recentTickers, watchlist } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length >= 1) {
      debounceRef.current = setTimeout(() => search(query), 280);
    } else {
      setResults([]);
    }
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (symbol: string) => {
    setTicker(symbol);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
    // Record in history API
    fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: symbol }) }).catch(() => {});
  };

  const showDropdown = open && (results.length > 0 || query.length === 0);
  const quickItems = query.length === 0 ? [
    ...watchlist.slice(0, 5).map(w => ({ symbol: w.ticker, description: w.name || '', source: 'watchlist' })),
    ...recentTickers.filter(t => !watchlist.find(w => w.ticker === t)).slice(0, 5).map(t => ({ symbol: t, description: '', source: 'recent' }))
  ] : [];

  return (
    <div ref={containerRef} className="relative w-full max-w-xs md:max-w-sm lg:max-w-md">
      <div className={`flex items-center gap-2 px-3 h-9 rounded-lg border transition-all ${
        open ? 'border-blue-500 bg-[var(--bg-surface)]' : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]'
      }`}>
        <Search size={14} className="text-[var(--text-dim)] flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value.toUpperCase()); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={ticker || 'Buscar ticker...'}
          className="flex-1 bg-transparent text-[var(--text)] text-sm font-mono placeholder:text-[var(--text-dim)] outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className="text-[var(--text-dim)] hover:text-[var(--text)]">
            <X size={13} />
          </button>
        )}
        {loading && <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 card py-1 shadow-2xl border-[var(--border-strong)] max-h-72 overflow-y-auto animate-fade-in">
          {query.length === 0 && quickItems.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">
                Recientes y watchlist
              </div>
              {quickItems.map(item => (
                <button
                  key={item.symbol}
                  onClick={() => select(item.symbol)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left"
                >
                  {item.source === 'watchlist'
                    ? <Star size={12} className="text-amber-400 flex-shrink-0" />
                    : <Clock size={12} className="text-[var(--text-dim)] flex-shrink-0" />
                  }
                  <span className="font-mono text-sm font-medium text-[var(--text)]">{item.symbol}</span>
                  {item.description && (
                    <span className="text-xs text-[var(--text-muted)] truncate">{item.description}</span>
                  )}
                </button>
              ))}
            </>
          )}
          {results.length > 0 && (
            <>
              {query.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">
                  Resultados
                </div>
              )}
              {results.map(r => (
                <button
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left"
                >
                  <span className="font-mono text-sm font-semibold text-[var(--text)] w-16 flex-shrink-0">{r.symbol}</span>
                  <span className="text-xs text-[var(--text-muted)] truncate">{r.description}</span>
                </button>
              ))}
            </>
          )}
          {query.length > 0 && results.length === 0 && !loading && (
            <div className="px-3 py-4 text-sm text-[var(--text-dim)] text-center">Sin resultados para "{query}"</div>
          )}
        </div>
      )}
    </div>
  );
}
