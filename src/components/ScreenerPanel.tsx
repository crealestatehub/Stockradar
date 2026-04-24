'use client';
import { useEffect, useState, useMemo } from 'react';
import { SlidersHorizontal, RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { useStore } from '@/lib/store';

interface ScreenerItem {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  float: number | null;
  shortInterestPct: number | null;
  daysToCover: number | null;
  rvol: number;
  marketCap: number | null;
  squeezeScore: number;
  squeezeBand: 'low' | 'medium' | 'high';
  squeezeColor: 'red' | 'amber' | 'green';
}

type SortKey = 'squeezeScore' | 'price' | 'changePct' | 'float' | 'shortInterestPct' | 'daysToCover' | 'rvol';
type FilterBand = 'all' | 'high' | 'medium' | 'low';

const BAND_STYLES: Record<string, string> = {
  green: 'bg-green-500/10 border-green-500/30 text-green-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  red:   'bg-red-500/10   border-red-500/30   text-red-400',
};
const BAND_LABEL: Record<string, string> = { high: 'ALTO', medium: 'MEDIO', low: 'BAJO' };

const fmtFloat = (n: number | null) => {
  if (n == null) return '—';
  const m = n / 1e6;
  return m >= 1000 ? `${(m / 1000).toFixed(1)}B` : `${m.toFixed(1)}M`;
};

export default function ScreenerPanel() {
  const { setTicker } = useStore();
  const [open, setOpen]       = useState(true);
  const [items, setItems]     = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [filter, setFilter]   = useState<FilterBand>('all');
  const [sort, setSort]       = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'squeezeScore', dir: 'desc',
  });

  const fetchData = async (force = false) => {
    setLoading(true);
    try {
      const res  = await fetch(force ? '/api/screener?refresh=1' : '/api/screener');
      const data = await res.json();
      setItems(data.items ?? []);
      setCachedAt(data.cachedAt ?? null);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !fetched) fetchData();
  }, [open, fetched]);

  const counts = useMemo(() => ({
    all:    items.length,
    high:   items.filter(i => i.squeezeBand === 'high').length,
    medium: items.filter(i => i.squeezeBand === 'medium').length,
    low:    items.filter(i => i.squeezeBand === 'low').length,
  }), [items]);

  const filtered = useMemo(() => {
    const base = filter === 'all' ? items : items.filter(i => i.squeezeBand === filter);
    return [...base].sort((a, b) => {
      const av = (a[sort.key] as number) ?? -1;
      const bv = (b[sort.key] as number) ?? -1;
      return sort.dir === 'desc' ? bv - av : av - bv;
    });
  }, [items, filter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key
      ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' }
      : { key, dir: 'desc' });

  const filterBtns: { key: FilterBand; label: string; active: string }[] = [
    { key: 'all',    label: 'Todos', active: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
    { key: 'high',   label: 'Alto',  active: 'bg-green-500/20 border-green-500/40 text-green-400' },
    { key: 'medium', label: 'Medio', active: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
    { key: 'low',    label: 'Bajo',  active: 'bg-red-500/20 border-red-500/40 text-red-400' },
  ];

  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => toggleSort(col)}
      className="px-3 py-2.5 text-right text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] cursor-pointer hover:text-[var(--text)] select-none whitespace-nowrap"
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {sort.key === col
          ? sort.dir === 'desc' ? <ChevronDown size={9} /> : <ChevronUp size={9} />
          : <span className="w-[9px]" />}
      </span>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      {/* ── Toggle header ────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-[var(--text-muted)]" />
          <span className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)]">
            Short Squeeze Screener
          </span>
          {items.length > 0 && (
            <span className="text-[10px] font-mono text-[var(--text-dim)]">· {items.length} tickers</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); fetchData(true); }}
              className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-surface)] transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-[var(--text-dim)]" /> : <ChevronDown size={14} className="text-[var(--text-dim)]" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border)]">

          {/* ── Filter bar ─────────────────────────────────────── */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]/60 flex-wrap">
            {filterBtns.map(fb => (
              <button
                key={fb.key}
                onClick={() => setFilter(fb.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                  filter === fb.key
                    ? fb.active
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {fb.label}
                <span className="ml-1 opacity-60 font-mono">{counts[fb.key]}</span>
              </button>
            ))}
            {cachedAt && (
              <span className="ml-auto text-[10px] font-mono text-[var(--text-dim)] hidden sm:block">
                {new Date(cachedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* ── Table ──────────────────────────────────────────── */}
          {loading && items.length === 0 ? (
            <div className="h-40 flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--text-dim)] font-mono">Analizando mercado…</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-[460px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                      <th className="px-3 py-2.5 text-left text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] w-7">#</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Ticker</th>
                      <SortTh col="price"            label="Precio" />
                      <SortTh col="changePct"        label="Chg%" />
                      <SortTh col="float"            label="Float" />
                      <SortTh col="shortInterestPct" label="Short%" />
                      <SortTh col="daysToCover"      label="DTC" />
                      <SortTh col="rvol"             label="RVOL" />
                      <SortTh col="squeezeScore"     label="Score" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr
                        key={item.ticker}
                        onClick={() => setTicker(item.ticker)}
                        className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group"
                      >
                        <td className="px-3 py-2 text-[11px] font-mono text-[var(--text-dim)]">{idx + 1}</td>

                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-1 h-5 rounded-full flex-shrink-0 ${
                              item.squeezeColor === 'green' ? 'bg-green-500' :
                              item.squeezeColor === 'amber' ? 'bg-amber-500' : 'bg-red-500/40'
                            }`} />
                            <div>
                              <div className="font-mono font-bold text-xs text-[var(--text)] group-hover:text-blue-400 transition-colors leading-none">
                                {item.ticker}
                              </div>
                              <div className="text-[10px] text-[var(--text-dim)] truncate max-w-[110px] mt-0.5">{item.name}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-2 text-right font-mono text-xs text-[var(--text)]">
                          ${item.price < 1 ? item.price.toFixed(4) : item.price.toFixed(2)}
                        </td>

                        <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${item.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          <span className="inline-flex items-center gap-0.5 justify-end">
                            {item.changePct >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                            {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                          </span>
                        </td>

                        <td className="px-3 py-2 text-right font-mono text-xs text-[var(--text-muted)]">
                          {fmtFloat(item.float)}
                        </td>

                        <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${
                          item.shortInterestPct != null && item.shortInterestPct > 20 ? 'text-red-400' : 'text-[var(--text-muted)]'
                        }`}>
                          {item.shortInterestPct != null ? `${item.shortInterestPct.toFixed(1)}%` : '—'}
                        </td>

                        <td className={`px-3 py-2 text-right font-mono text-xs ${
                          item.daysToCover != null && item.daysToCover > 5 ? 'text-amber-400 font-semibold' : 'text-[var(--text-muted)]'
                        }`}>
                          {item.daysToCover != null ? item.daysToCover.toFixed(1) : '—'}
                        </td>

                        <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${
                          item.rvol > 2 ? 'text-green-400' : 'text-[var(--text-muted)]'
                        }`}>
                          {item.rvol > 0 ? `${item.rvol.toFixed(2)}x` : '—'}
                        </td>

                        <td className="px-3 py-2 text-right">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-mono font-bold ${BAND_STYLES[item.squeezeColor]}`}>
                            {item.squeezeScore}
                            <span className="text-[9px] opacity-70">{BAND_LABEL[item.squeezeBand]}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filtered.length === 0 && !loading && (
                  <div className="h-24 flex items-center justify-center text-[var(--text-dim)] text-xs">
                    Sin resultados para este filtro
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
