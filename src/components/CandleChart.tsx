'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore, type Resolution } from '@/lib/store';

interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }
interface VwapPoint { time: number; vwap: number; upper1: number; lower1: number; upper2: number; lower2: number; }
interface PivotLevel { PP: number; R1: number; R2: number; R3: number; S1: number; S2: number; S3: number; }
interface Indicators {
  pivots: { daily?: PivotLevel | null; weekly?: PivotLevel | null; monthly?: PivotLevel | null };
  vwap: VwapPoint[] | null;
  supports: number[];
  resistances: number[];
  ema9: number[]; ema20: number[]; ema50: number[]; ema200: number[];
  rsi: number[]; macd: { macd: number[]; signal: number[]; histogram: number[] };
  priceChangePct5d: number;
}

const RESOLUTIONS: { label: string; value: Resolution }[] = [
  { label: '1m', value: '1' }, { label: '5m', value: '5' }, { label: '15m', value: '15' },
  { label: '1H', value: '60' }, { label: '1D', value: 'D' }, { label: '1W', value: 'W' }
];

export default function CandleChart() {
  const { ticker, resolution, setResolution, pivotType, indicators } = useStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const seriesRefs = useRef<Record<string, any>>({});
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indData, setIndData] = useState<Indicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/stock/candles?symbol=${ticker}&resolution=${resolution}&pivot=${pivotType}`, { signal });
      if (signal?.aborted) return;
      const data = await res.json();
      setCandles(data.candles || []);
      setIndData(data.indicators || null);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError('Error al cargar datos del gráfico');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [ticker, resolution, pivotType]);

  useEffect(() => {
    // Clear stale data immediately so the old chart doesn't linger
    setCandles([]);
    setIndData(null);
    if (chartInstance.current) {
      try { chartInstance.current.remove(); } catch {}
      chartInstance.current = null;
      seriesRefs.current = {};
    }
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => fetchData(), 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Build / rebuild chart
  useEffect(() => {
    if (typeof window === 'undefined' || candles.length === 0 || !chartRef.current) return;

    const setupChart = async () => {
      const { createChart, CrosshairMode, LineStyle } = await import('lightweight-charts');
      // Clean up existing
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
        seriesRefs.current = {};
      }

      const chart = createChart(chartRef.current!, {
        width: chartRef.current!.clientWidth,
        height: 420,
        layout: { background: { color: '#111722' }, textColor: '#8b96ad' },
        grid: { vertLines: { color: '#1a2234' }, horzLines: { color: '#1a2234' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#212a3b' },
        timeScale: { borderColor: '#212a3b', timeVisible: true, secondsVisible: false },
      });
      chartInstance.current = chart;

      // Candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#00d97e', downColor: '#ff4d4f',
        borderUpColor: '#00d97e', borderDownColor: '#ff4d4f',
        wickUpColor: '#00a862', wickDownColor: '#cc3d3f',
      });
      candleSeries.setData(candles.map(c => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })));
      seriesRefs.current.candle = candleSeries;

      // Volume histogram (below via price scale)
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        color: '#3b82f633',
      });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volSeries.setData(candles.map(c => ({
        time: c.time as any,
        value: c.volume,
        color: c.close >= c.open ? '#00d97e22' : '#ff4d4f22'
      })));
      seriesRefs.current.volume = volSeries;

      if (indData) {
        // VWAP
        if (indicators.showVWAP && indData.vwap && indData.vwap.length > 0) {
          const vwapSeries = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'VWAP' });
          vwapSeries.setData(indData.vwap.map(v => ({ time: v.time as any, value: v.vwap })));
          const vU1 = chart.addLineSeries({ color: '#06b6d420', lineWidth: 1, lineStyle: LineStyle.Dotted });
          vU1.setData(indData.vwap.map(v => ({ time: v.time as any, value: v.upper1 })));
          const vL1 = chart.addLineSeries({ color: '#06b6d420', lineWidth: 1, lineStyle: LineStyle.Dotted });
          vL1.setData(indData.vwap.map(v => ({ time: v.time as any, value: v.lower1 })));
          const vU2 = chart.addLineSeries({ color: '#06b6d412', lineWidth: 1, lineStyle: LineStyle.Dotted });
          vU2.setData(indData.vwap.map(v => ({ time: v.time as any, value: v.upper2 })));
          const vL2 = chart.addLineSeries({ color: '#06b6d412', lineWidth: 1, lineStyle: LineStyle.Dotted });
          vL2.setData(indData.vwap.map(v => ({ time: v.time as any, value: v.lower2 })));
        }

        // EMAs
        const addEMA = (key: string, vals: number[], color: string, title: string) => {
          if (!vals || vals.length === 0) return;
          const s = chart.addLineSeries({ color, lineWidth: 1, title });
          s.setData(candles.map((c, i) => ({ time: c.time as any, value: vals[i] ?? candles[i].close })));
          seriesRefs.current[key] = s;
        };
        if (indicators.showEMA9)   addEMA('ema9',   indData.ema9,   '#f59e0b', 'EMA9');
        if (indicators.showEMA20)  addEMA('ema20',  indData.ema20,  '#a855f7', 'EMA20');
        if (indicators.showEMA50)  addEMA('ema50',  indData.ema50,  '#3b82f6', 'EMA50');
        if (indicators.showEMA200) addEMA('ema200', indData.ema200, '#f97316', 'EMA200');

        // Pivot lines (horizontal price lines)
        if (indicators.showPivots && indData.pivots?.daily) {
          const pp = indData.pivots.daily;
          const addPPLine = (price: number, color: string, title: string) => {
            candleSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title });
          };
          addPPLine(pp.PP, '#8b96ad', 'PP');
          addPPLine(pp.R1, '#ff4d4f', 'R1');
          addPPLine(pp.R2, '#ff4d4f', 'R2');
          addPPLine(pp.R3, '#ff4d4f', 'R3');
          addPPLine(pp.S1, '#00d97e', 'S1');
          addPPLine(pp.S2, '#00d97e', 'S2');
          addPPLine(pp.S3, '#00d97e', 'S3');
        }

        // Support/Resistance lines
        if (indicators.showSR) {
          (indData.resistances || []).forEach((price, i) => {
            candleSeries.createPriceLine({ price, color: '#ff4d4f88', lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: `R${i + 1}` });
          });
          (indData.supports || []).forEach((price, i) => {
            candleSeries.createPriceLine({ price, color: '#00d97e88', lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: `S${i + 1}` });
          });
        }
      }

      chart.timeScale().fitContent();

      // Responsive resize
      const ro = new ResizeObserver(() => {
        if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
      });
      if (chartRef.current) ro.observe(chartRef.current);

      return () => { ro.disconnect(); chart.remove(); };
    };

    const cleanup = setupChart().catch(() => {});
    return () => { cleanup.then(fn => fn?.()).catch(() => {}); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, indData, indicators]);

  return (
    <div className="card p-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
        <div className="flex gap-1">
          {RESOLUTIONS.map(r => (
            <button
              key={r.value}
              onClick={() => setResolution(r.value)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                resolution === r.value
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={fetchData} className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors p-1 rounded" title="Actualizar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </div>

      {/* Chart area */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-elevated)]/80">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--text-dim)] font-mono">Cargando {ticker}...</span>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="h-[420px] flex items-center justify-center text-[var(--text-muted)] text-sm">{error}</div>
        )}
        <div ref={chartRef} id="chart-container" style={{ height: 420 }} />
      </div>
    </div>
  );
}
