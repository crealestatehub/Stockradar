'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart2, ArrowLeft, RefreshCw,
  TrendingUp, TrendingDown, ChevronUp, ChevronDown,
} from 'lucide-react';
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

export default function ScreenerPage() {
  const router = useRouter();
  const { setTicker } = useStore();
  const [items, setItems]     = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [total, setTotal]     = useState(0);
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
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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
    setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });

  const analyze = (ticker: string) => {
    setTicker(ticker);
    router.push('/');
  };

  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => toggleSort(col)}
      className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] cursor-pointer hover:text-[var(--text)] select-none whitespace-nowrap"
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {sort.key === col
          ? sort.dir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />
          : <span className="w-[10px]" />}
      </span>
    </th>
  );

  const filterBtns: { key: FilterBand; label: string; active: string }[] = [
    { key: 'all',    label: 'Todos', active: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
    { key: 'high',   label: 'Alto',  active: 'bg-green-500/20 border-green-500/40 text-green-400' },
    { key: 'medium', label: 'Medio', active: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
    { key: 'low',    label: 'Bajo',  active: 'bg-red-500/20 border-red-500/40 text-red-400' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-12 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex-shrink-0">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-xs flex-shrink-0"
        >
          <ArrowLeft size={13} /> Volver
        </button>
        <div className="w-px h-5 bg-[var(--border)]" />
        <BarChart2 size={16} className="text-blue-400 flex-shrink-0" />
        <span className="font-display font-bold text-sm text-[var(--text)]">
          Stock<span className="text-blue-400">Radar</span>
          <span className="text-[var(--text-muted)] font-normal ml-2 hidden sm:inline">· Screener</span>
        </span>

        <div className="flex-1" />

        {cachedAt && !loading && (
          <span className="hidden md:block text-[10px] font-mono text-[var(--text-dim)]">
            {new Date(cachedAt).toLocaleTimeString()} · caché 15 min
          </span>
        )}

        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-all text-xs disabled:opacity-40 flex-shrink-0"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 space-y-4">

          {/* Title + filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display font-bold text-lg text-[var(--text)]">Short Squeeze Screener</h1>
              <p className="text-xs text-[var(--text-muted)]">
                {loading && items.length === 0
                  ? `Analizando ${total || '~50'} tickers…`
                  : `${items.length} tickers · ordenado por potencial de squeeze`}
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {filterBtns.map(fb => (
                <button
                  key={fb.key}
                  onClick={() => setFilter(fb.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filter === fb.key
                      ? fb.active
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {fb.label}
                  <span className="ml-1.5 opacity-60 font-mono">{counts[fb.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            {loading && items.length === 0 ? (
              <div className="h-72 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-[var(--text-dim)] font-mono">Analizando mercado…</span>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                      <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] w-8">#</th>
                      <th className="px-3 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Ticker</th>
                      <SortTh col="price"           label="Precio" />
                      <SortTh col="changePct"       label="Chg%" />
                      <SortTh col="float"           label="Float" />
                      <SortTh col="shortInterestPct" label="Short%" />
                      <SortTh col="daysToCover"     label="DTC" />
                      <SortTh col="rvol"            label="RVOL" />
                      <SortTh col="squeezeScore"    label="Score" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr
                        key={item.ticker}
                        onClick={() => analyze(item.ticker)}
                        className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group"
                      >
                        {/* Rank */}
                        <td className="px-3 py-2.5 text-[11px] font-mono text-[var(--text-dim)]">{idx + 1}</td>

                        {/* Ticker + name */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${
                              item.squeezeColor === 'green' ? 'bg-green-500' :
                              item.squeezeColor === 'amber' ? 'bg-amber-500' : 'bg-red-500/50'
                            }`} />
                            <div>
                              <div className="font-mono font-bold text-sm text-[var(--text)] group-hover:text-blue-400 transition-colors leading-none">
                                {item.ticker}
                              </div>
                              <div className="text-[10px] text-[var(--text-dim)] truncate max-w-[130px] mt-0.5">{item.name}</div>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="px-3 py-2.5 text-right font-mono text-sm text-[var(--text)]">
                          ${item.price < 1 ? item.price.toFixed(4) : item.price.toFixed(2)}
                        </td>

                        {/* Chg% */}
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${item.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          <span className="inline-flex items-center gap-0.5 justify-end">
                            {item.changePct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Float */}
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--text-muted)]">
                          {fmtFloat(item.float)}
                        </td>

                        {/* Short % */}
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${
                          item.shortInterestPct != null && item.shortInterestPct > 20
                            ? 'text-red-400' : 'text-[var(--text-muted)]'
                        }`}>
                          {item.shortInterestPct != null ? `${item.shortInterestPct.toFixed(1)}%` : '—'}
                        </td>

                        {/* DTC */}
                        <td className={`px-3 py-2.5 text-right font-mono text-xs ${
                          item.daysToCover != null && item.daysToCover > 5
                            ? 'text-amber-400 font-semibold' : 'text-[var(--text-muted)]'
                        }`}>
                          {item.daysToCover != null ? item.daysToCover.toFixed(1) : '—'}
                        </td>

                        {/* RVOL */}
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${
                          item.rvol > 2 ? 'text-green-400' : 'text-[var(--text-muted)]'
                        }`}>
                          {item.rvol > 0 ? `${item.rvol.toFixed(2)}x` : '—'}
                        </td>

                        {/* Score */}
                        <td className="px-3 py-2.5 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-bold ${BAND_STYLES[item.squeezeColor]}`}>
                            {item.squeezeScore}
                            <span className="text-[9px] opacity-70">{BAND_LABEL[item.squeezeBand]}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filtered.length === 0 && !loading && (
                  <div className="h-32 flex items-center justify-center text-[var(--text-dim)] text-sm">
                    Sin resultados para este filtro
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="text-[10px] text-[var(--text-dim)] leading-relaxed space-y-0.5">
            <p>
              <strong className="text-[var(--text-muted)]">Float</strong> — acciones disponibles al trading público ·{' '}
              <strong className="text-[var(--text-muted)]">Short%</strong> — porcentaje del float en posición corta ·{' '}
              <strong className="text-[var(--text-muted)]">DTC</strong> — días para cubrir posiciones cortas ·{' '}
              <strong className="text-[var(--text-muted)]">RVOL</strong> — volumen vs media 10D ·{' '}
              <strong className="text-[var(--text-muted)]">Score</strong> — puntuación de squeeze 0-100.
            </p>
            <p>Haz clic en cualquier fila para analizar ese ticker. Datos actualizados cada 15 minutos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
