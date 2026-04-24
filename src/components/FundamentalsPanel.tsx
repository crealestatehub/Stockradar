'use client';
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Info } from 'lucide-react';

interface FundData {
  fundamentals: {
    name?: string; exchange?: string; industry?: string; logo?: string;
    marketCap?: number; sharesOutstanding?: number; float?: number;
    shortInterestPct?: number; daysToCover?: number; avgVolume?: number;
    weekHigh52?: number; weekLow52?: number;
  };
  metrics: { priceChangePct5d: number; relativeVolume: number; floatRotation: number };
  earningsDate?: string | null;
  squeeze: {
    score: number; band: string; color: 'red' | 'amber' | 'green';
    breakdown: { float: number; shortInterest: number; daysToCover: number; rvol: number; momentum: number };
    analysis: string;
  };
  quote?: { current: number };
}

const fmtCompact = (n?: number | null) => {
  if (n == null) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtShares = (n?: number | null) => {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${n}`;
};

const BAND_STYLES = {
  green: 'bg-green-500/10 border-green-500/30 text-green-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  red: 'bg-red-500/10 border-red-500/30 text-red-400'
};
const BAND_LABEL = { high: 'ALTO', medium: 'MEDIO', low: 'BAJO' };

export default function FundamentalsPanel({ onSave }: { onSave?: (data: FundData) => void }) {
  const { ticker } = useStore();
  const [data, setData] = useState<FundData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/fundamentals?symbol=${ticker}`);
      const json = await res.json();
      setData(json);
      onSave?.(json);
    } catch {} finally { setLoading(false); }
  }, [ticker]);

  useEffect(() => { setLoading(true); setData(null); fetch_(); }, [fetch_]);

  const Row = ({ label, value, tip, colored }: { label: string; value: string; tip?: string; colored?: 'pos' | 'neg' }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-[var(--border)]/50 last:border-0 group">
      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
        {label}
        {tip && <span className="tooltip hidden group-hover:inline" data-tip={tip}><Info size={10} className="text-[var(--text-dim)]" /></span>}
      </div>
      <span className={`font-mono text-xs font-semibold ${colored === 'pos' ? 'text-green-400' : colored === 'neg' ? 'text-red-400' : 'text-[var(--text)]'}`}>
        {value}
      </span>
    </div>
  );

  if (loading) return (
    <div className="card p-4 space-y-2">
      {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-5 rounded w-full" />)}
    </div>
  );

  if (!data) return null;
  const { fundamentals: f, metrics: m, squeeze: sq, earningsDate } = data;

  // Earnings countdown
  const earningsDaysAway = earningsDate
    ? Math.round((new Date(earningsDate).getTime() - Date.now()) / 86400000)
    : null;
  const earningsLabel = earningsDate
    ? `${earningsDate} (${earningsDaysAway === 0 ? 'hoy' : earningsDaysAway === 1 ? 'mañana' : `en ${earningsDaysAway}d`})`
    : '—';

  const squeezeColor = sq.color;
  const scoreArc = Math.min(100, sq.score);

  return (
    <div className="space-y-3">
      {/* Company header */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-3">
          {f.logo && (
            <img src={f.logo} alt={f.name} className="w-8 h-8 rounded object-contain bg-white/5 p-0.5"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          <div>
            <div className="font-display font-semibold text-sm text-[var(--text)]">{f.name || ticker}</div>
            <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">{f.exchange} · {f.industry}</div>
          </div>
        </div>
        <Row label="Market Cap" value={fmtCompact(f.marketCap)} tip="Capitalización bursátil total" />
        <Row label="Acciones en circulación" value={fmtShares(f.sharesOutstanding)} />
        <Row label="Float" value={fmtShares(f.float)} tip="Acciones disponibles para trading público" />
        <Row label="Vol. promedio 10D" value={fmtShares(f.avgVolume)} />
        <Row label="RVOL (Relative Volume)" value={m.relativeVolume > 0 ? `${m.relativeVolume.toFixed(2)}x` : '—'}
          colored={m.relativeVolume > 2 ? 'pos' : undefined} />
        <Row label="Float Rotation" value={m.floatRotation > 0 ? `${m.floatRotation.toFixed(2)}x` : '—'}
          tip="Veces que el float completo se ha negociado hoy"
          colored={m.floatRotation >= 1 ? 'pos' : undefined} />
        <Row label="Short Interest" value={f.shortInterestPct != null ? `${f.shortInterestPct.toFixed(1)}%` : '—'}
          tip="% del float en posición corta" colored={f.shortInterestPct != null && f.shortInterestPct > 20 ? 'neg' : undefined} />
        <Row label="Days to Cover" value={f.daysToCover != null ? `${f.daysToCover.toFixed(1)}` : '—'}
          tip="Días necesarios para que los cortos cierren posición" />
        <Row label="Cambio 5D" value={m.priceChangePct5d !== 0 ? `${m.priceChangePct5d >= 0 ? '+' : ''}${m.priceChangePct5d.toFixed(2)}%` : '—'}
          colored={m.priceChangePct5d > 0 ? 'pos' : m.priceChangePct5d < 0 ? 'neg' : undefined} />
        <Row label="Máximo 52 semanas" value={f.weekHigh52 != null ? `$${f.weekHigh52.toFixed(2)}` : '—'} />
        <Row label="Mínimo 52 semanas" value={f.weekLow52 != null ? `$${f.weekLow52.toFixed(2)}` : '—'} />
        <Row label="Próx. Earnings" value={earningsLabel}
          tip="Fecha de reporte de resultados — riesgo de squeeze para cortos"
          colored={earningsDaysAway != null && earningsDaysAway <= 7 ? 'neg' : undefined} />
      </div>

      {/* Short Squeeze Score */}
      <div className={`card p-4 border ${BAND_STYLES[squeezeColor]}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-widest font-semibold">Short Squeeze Potential</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${BAND_STYLES[squeezeColor]}`}>
            {BAND_LABEL[sq.band as keyof typeof BAND_LABEL]}
          </span>
        </div>

        {/* Score gauge */}
        <div className="flex items-center gap-4 mb-3">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#212a3b" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9155" fill="none"
                stroke={squeezeColor === 'green' ? '#00d97e' : squeezeColor === 'amber' ? '#ffb020' : '#ff4d4f'}
                strokeWidth="3" strokeDasharray={`${scoreArc} ${100 - scoreArc}`}
                strokeLinecap="round" className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-sm font-bold text-[var(--text)]">{sq.score}</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{sq.analysis}</p>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-1.5">
          {[
            { label: 'Float', val: sq.breakdown.float, max: 25 },
            { label: 'Short Interest', val: sq.breakdown.shortInterest, max: 30 },
            { label: 'Days to Cover', val: sq.breakdown.daysToCover, max: 20 },
            { label: 'RVOL', val: sq.breakdown.rvol, max: 15 },
            { label: 'Momentum', val: sq.breakdown.momentum, max: 10 },
          ].map(({ label, val, max }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-dim)] w-24 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(val / max) * 100}%`,
                    background: squeezeColor === 'green' ? '#00d97e' : squeezeColor === 'amber' ? '#ffb020' : '#ff4d4f'
                  }} />
              </div>
              <span className="text-[10px] font-mono text-[var(--text-dim)] w-8 text-right">{val}/{max}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
