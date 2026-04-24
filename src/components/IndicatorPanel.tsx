'use client';
import { useStore, type PivotType } from '@/lib/store';

const PIVOT_TYPES: { label: string; value: PivotType }[] = [
  { label: 'Clásico', value: 'classic' },
  { label: 'Fibonacci', value: 'fibonacci' },
  { label: 'Camarilla', value: 'camarilla' }
];

const INDICATORS = [
  { key: 'showVWAP' as const, label: 'VWAP', color: '#06b6d4', desc: 'Volume Weighted Average Price + bandas ±1σ ±2σ' },
  { key: 'showPivots' as const, label: 'Pivots', color: '#8b96ad', desc: 'Pivot Points PP/R1-3/S1-3' },
  { key: 'showSR' as const, label: 'S/R', color: '#a855f7', desc: 'Soportes y Resistencias detectados automáticamente' },
  { key: 'showEMA9' as const, label: 'EMA 9', color: '#f59e0b', desc: 'Media Móvil Exponencial 9 períodos' },
  { key: 'showEMA20' as const, label: 'EMA 20', color: '#a855f7', desc: 'Media Móvil Exponencial 20 períodos' },
  { key: 'showEMA50' as const, label: 'EMA 50', color: '#3b82f6', desc: 'Media Móvil Exponencial 50 períodos' },
  { key: 'showEMA200' as const, label: 'EMA 200', color: '#f97316', desc: 'Media Móvil Exponencial 200 períodos' },
  { key: 'showRSI' as const, label: 'RSI 14', color: '#e879f9', desc: 'Relative Strength Index (14 períodos)' },
  { key: 'showMACD' as const, label: 'MACD', color: '#34d399', desc: 'MACD (12,26,9) — Moving Average Convergence Divergence' },
  { key: 'showVolumeProfile' as const, label: 'Vol. Profile', color: '#a78bfa', desc: 'Volume Profile: distribución de volumen por nivel de precio (POC + Value Area)' }
];

export default function IndicatorPanel() {
  const { indicators, toggleIndicator, pivotType, setPivotType } = useStore();

  return (
    <div className="card p-4">
      <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-dim)] mb-3">Indicadores</h3>

      <div className="space-y-1.5 mb-4">
        {INDICATORS.map(ind => (
          <button
            key={ind.key}
            onClick={() => toggleIndicator(ind.key)}
            title={ind.desc}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
              indicators[ind.key]
                ? 'border-transparent'
                : 'border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
            }`}
            style={indicators[ind.key] ? {
              backgroundColor: `${ind.color}18`,
              borderColor: `${ind.color}40`,
              color: ind.color
            } : {}}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: indicators[ind.key] ? ind.color : 'var(--text-dim)' }} />
            <span className="font-medium">{ind.label}</span>
            <span className="ml-auto text-[10px] opacity-60">{indicators[ind.key] ? 'ON' : 'OFF'}</span>
          </button>
        ))}
      </div>

      {/* Pivot type selector */}
      {indicators.showPivots && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-2">Tipo de Pivot</div>
          <div className="flex gap-1">
            {PIVOT_TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => setPivotType(pt.value)}
                className={`flex-1 py-1 text-[11px] rounded font-mono transition-colors border ${
                  pivotType === pt.value
                    ? 'bg-[var(--border-strong)] border-[var(--border-strong)] text-[var(--text)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
