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

// ── Volume Profile ────────────────────────────────────────────────────────────
function drawVolumeProfile(
  candleSeries: any,
  candles: Candle[],
  container: HTMLDivElement,
  chartHeight: number
) {
  const BUCKETS    = 60;
  const BAR_MAX_PX = 90;
  const PRICE_AXIS = 58; // approximate width of right price scale

  // Remove old canvas
  container.querySelectorAll('.vp-canvas').forEach(el => el.remove());

  if (!candles.length) return;

  // Build volume buckets by price level
  const minP = Math.min(...candles.map(c => c.low));
  const maxP = Math.max(...candles.map(c => c.high));
  if (maxP <= minP) return;

  const bucketSize = (maxP - minP) / BUCKETS;
  const volumes    = new Array(BUCKETS).fill(0);

  for (const c of candles) {
    for (let i = 0; i < BUCKETS; i++) {
      const bLow  = minP + i * bucketSize;
      const bHigh = bLow + bucketSize;
      const overlap = Math.max(0, Math.min(c.high, bHigh) - Math.max(c.low, bLow));
      if (overlap > 0) volumes[i] += c.volume * (overlap / Math.max(c.high - c.low, 0.001));
    }
  }

  const maxVol  = Math.max(...volumes);
  const totalVol = volumes.reduce((a, b) => a + b, 0);

  // Point of Control (highest volume bucket)
  const pocIdx = volumes.indexOf(maxVol);

  // Value Area (68% of volume around POC)
  let vaVol = volumes[pocIdx];
  const vaSet = new Set([pocIdx]);
  let hi = pocIdx, lo = pocIdx;
  while (vaVol < totalVol * 0.68 && (hi < BUCKETS - 1 || lo > 0)) {
    const upVol = hi + 1 < BUCKETS ? volumes[hi + 1] : 0;
    const dnVol = lo - 1 >= 0     ? volumes[lo - 1] : 0;
    if (upVol >= dnVol && hi + 1 < BUCKETS) { hi++; vaSet.add(hi); vaVol += upVol; }
    else if (lo - 1 >= 0)                    { lo--; vaSet.add(lo); vaVol += dnVol; }
    else break;
  }

  // Create canvas
  const canvas       = document.createElement('canvas');
  canvas.className   = 'vp-canvas';
  canvas.width       = BAR_MAX_PX;
  canvas.height      = chartHeight;
  canvas.style.cssText = `position:absolute;top:0;left:0;pointer-events:none;z-index:4;`;
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, BAR_MAX_PX, chartHeight);

  for (let i = 0; i < BUCKETS; i++) {
    if (volumes[i] === 0) continue;
    const yTop = candleSeries.priceToCoordinate(minP + (i + 1) * bucketSize);
    const yBot = candleSeries.priceToCoordinate(minP + i       * bucketSize);
    if (yTop === null || yBot === null) continue;

    const barH = Math.max(1, Math.round(yBot - yTop));
    const barW = Math.round((volumes[i] / maxVol) * BAR_MAX_PX);

    ctx.fillStyle =
      i === pocIdx  ? 'rgba(251,191,36,0.85)'   // amber  — POC
      : vaSet.has(i) ? 'rgba(139,92,246,0.55)'  // purple — value area
                     : 'rgba(34,197,94,0.40)';  // green  — outside VA

    ctx.fillRect(0, Math.round(yTop), barW, barH);
  }
}

export default function CandleChart() {
  const { ticker, resolution, setResolution, pivotType, indicators } = useStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const seriesRefs = useRef<Record<string, any>>({});
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const ohlcvRef = useRef<HTMLDivElement>(null);
  const chartGenRef = useRef(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indData, setIndData] = useState<Indicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLabels, setTimeLabels] = useState<{ x: number; text: string }[]>([]);
  const [chartH] = useState(() => {
    if (typeof window === 'undefined') return 420;
    if (window.innerWidth < 768) return 280;
    if (window.innerWidth >= 1280) return 480;
    return 420;
  });

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/stock/candles?symbol=${ticker}&resolution=${resolution}&pivot=${pivotType}`, { signal, cache: 'no-store' });
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
        height: chartH,
        layout: { background: { color: '#111722' }, textColor: '#8b96ad' },
        grid: { vertLines: { color: '#1a2234' }, horzLines: { color: '#1a2234' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#212a3b' },
        timeScale: { borderColor: '#212a3b', visible: false, minBarSpacing: 3 },
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

      // ── OHLCV crosshair readout ───────────────────────────────────
      const fmtP = (n: number) => n < 1 ? n.toFixed(4) : n.toFixed(2);
      const fmtV = (n: number) => {
        if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
        if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
        if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
        return String(Math.round(n));
      };
      chart.subscribeCrosshairMove((param) => {
        const el = ohlcvRef.current;
        if (!el) return;
        if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
          el.style.opacity = '0';
          return;
        }
        const bar = param.seriesData.get(candleSeries) as any;
        const volBar = param.seriesData.get(volSeries) as any;
        if (!bar) { el.style.opacity = '0'; return; }

        const { open, high, low, close } = bar;
        const upC = '#00d97e', dnC = '#ff4d4f', lblC = '#4d6070', mutC = '#8b96ad';
        const dirC = close >= open ? upC : dnC;
        const vol = volBar?.value ?? 0;

        // Bar timestamp → UTC date/time string
        const t = param.time as number;
        const d = new Date(t * 1000);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        const dateStr = resolution === 'D' || resolution === 'W'
          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' })
          : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${hh}:${mm}`;

        const s = (lbl: string, val: string, vc: string, ml = 8) =>
          `<span style="color:${lblC};margin-left:${ml}px">${lbl}</span><span style="color:${vc};margin-left:3px">${val}</span>`;

        el.innerHTML =
          `<span style="color:#3a4f62;margin-right:6px;font-size:10px">${dateStr}</span>` +
          s('O', fmtP(open),  dirC, 0) +
          s('H', fmtP(high),  upC) +
          s('L', fmtP(low),   dnC) +
          s('C', fmtP(close), dirC) +
          s('Vol', fmtV(vol), mutC);
        el.style.opacity = '1';
      });

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

      // ── RSI sub-chart ────────────────────────────────────────────
      let rsiChart: any = null;
      if (indicators.showRSI && indData?.rsi?.length && rsiRef.current) {
        rsiChart = createChart(rsiRef.current, {
          width: rsiRef.current.clientWidth,
          height: 120,
          layout: { background: { color: '#111722' }, textColor: '#8b96ad' },
          grid: { vertLines: { color: '#1a2234' }, horzLines: { color: '#1a2234' } },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: '#212a3b' },
          timeScale: { borderColor: '#212a3b', visible: false },
        });
        const rsiSeries = rsiChart.addLineSeries({ color: '#e879f9', lineWidth: 1, priceFormat: { type: 'price', precision: 1 } });
        const rsiData = candles
          .map((c, i) => ({ time: c.time as any, value: indData.rsi[i] }))
          .filter(d => typeof d.value === 'number' && isFinite(d.value) && d.value > 0 && d.value <= 100);
        rsiSeries.setData(rsiData);
        rsiSeries.createPriceLine({ price: 70, color: '#ff4d4f80', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' });
        rsiSeries.createPriceLine({ price: 30, color: '#00d97e80', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' });
        rsiSeries.createPriceLine({ price: 50, color: '#8b96ad30', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      }

      // ── MACD sub-chart ───────────────────────────────────────────
      let macdChart: any = null;
      if (indicators.showMACD && indData?.macd?.macd?.length && macdRef.current) {
        macdChart = createChart(macdRef.current, {
          width: macdRef.current.clientWidth,
          height: 120,
          layout: { background: { color: '#111722' }, textColor: '#8b96ad' },
          grid: { vertLines: { color: '#1a2234' }, horzLines: { color: '#1a2234' } },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: '#212a3b' },
          timeScale: { borderColor: '#212a3b', visible: false },
        });
        const histSeries = macdChart.addHistogramSeries({ color: '#26a69a', priceFormat: { type: 'price', precision: 4 } });
        histSeries.setData(
          candles
            .map((c, i) => ({ time: c.time as any, value: indData.macd.histogram[i] ?? 0, color: (indData.macd.histogram[i] ?? 0) >= 0 ? '#00d97e55' : '#ff4d4f55' }))
            .filter(d => isFinite(d.value))
        );
        const macdLine = macdChart.addLineSeries({ color: '#06b6d4', lineWidth: 1, title: 'MACD' });
        macdLine.setData(
          candles
            .map((c, i) => ({ time: c.time as any, value: indData.macd.macd[i] }))
            .filter(d => typeof d.value === 'number' && isFinite(d.value))
        );
        const signalLine = macdChart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'Signal' });
        signalLine.setData(
          candles
            .map((c, i) => ({ time: c.time as any, value: indData.macd.signal[i] }))
            .filter(d => typeof d.value === 'number' && isFinite(d.value))
        );
      }

      // ── Sync time scales (main → sub-charts, bidirectional) ──────
      const subCharts = [rsiChart, macdChart].filter(Boolean);
      let syncing = false;
      const syncFrom = (source: any, range: any) => {
        if (syncing || range === null) return;
        syncing = true;
        [chart, ...subCharts].forEach(c => { if (c !== source) c.timeScale().setVisibleLogicalRange(range); });
        syncing = false;
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(r => syncFrom(chart, r));
      subCharts.forEach(sub => sub.timeScale().subscribeVisibleLogicalRangeChange((r: any) => syncFrom(sub, r)));

      // ── Custom time axis labels (React state — avoids innerHTML wipe on re-render)
      const gen = ++chartGenRef.current;
      const updateTimeAxis = () => {
        try {
          const chartEl = chartRef.current;
          if (!chartEl || !candles.length) return;

          const logRange = chart.timeScale().getVisibleLogicalRange();
          if (!logRange) return;

          const fromIdx = Math.max(0, Math.floor(logRange.from));
          const toIdx   = Math.min(candles.length - 1, Math.ceil(logRange.to));
          if (fromIdx >= toIdx) return;

          const plotW   = chartEl.clientWidth - 65;
          const barSpan = logRange.to - logRange.from;
          const barW    = plotW / barSpan;

          const isIntra = ['1', '5', '15', '60'].includes(resolution);
          const targetLabels = Math.max(4, Math.floor(plotW / 90));
          const step = Math.max(1, Math.round((toIdx - fromIdx + 1) / targetLabels));

          const labels: { x: number; text: string }[] = [];
          for (let i = fromIdx; i <= toIdx; i += step) {
            const c = candles[i];
            if (!c) continue;
            const x = Math.round((i - logRange.from) * barW + barW / 2);
            if (x < 20 || x > plotW - 20) continue;

            const d = new Date(c.time * 1000);
            let text: string;
            if (isIntra) {
              text = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
            } else {
              text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
              const spanSec = (candles[toIdx]?.time ?? 0) - (candles[fromIdx]?.time ?? 0);
              if (spanSec > 180 * 86400) text += ` '${String(d.getUTCFullYear()).slice(2)}`;
            }
            labels.push({ x, text });
          }
          // Only update if this chart instance is still current
          if (labels.length > 0 && chartGenRef.current === gen) setTimeLabels(labels);
        } catch {}
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(() => updateTimeAxis());

      // Volume Profile overlay
      const redrawVP = () => {
        if (indicators.showVolumeProfile && chartRef.current)
          drawVolumeProfile(candleSeries, candles, chartRef.current, chartH);
        else
          chartRef.current?.querySelectorAll('.vp-canvas').forEach(el => el.remove());
      };
      redrawVP();
      chart.timeScale().subscribeVisibleLogicalRangeChange(redrawVP);
      // Trigger coordinate resolution BEFORE setting the view so the VP canvas
      // is positioned correctly and nothing resets bar-spacing afterwards.
      chart.priceScale('right').applyOptions({});

      // ── Set initial view — deferred via rAF so it runs after all internal
      // lightweight-charts initialization (layout, price-scale, VP canvas) is done.
      // Placed last so nothing can override the bar spacing we set.
      // For intraday: explicit barSpacing guarantees tick labels always render
      // (fitContent compresses 200-400 bars to <3 px, suppressing all labels).
      const rafId = requestAnimationFrame(() => {
        const TARGET: Partial<Record<string, number>> = { '1': 120, '5': 96, '15': 64, '60': 48 };
        const target = TARGET[resolution];
        if (target && chartRef.current) {
          const usable = Math.max(200, chartRef.current.clientWidth - 65);
          const bs = Math.max(6, usable / target);
          chart.timeScale().applyOptions({ barSpacing: bs });
          // scrollToRealTime() scrolls to system clock which may be days ahead of
          // the last market close — all bars end up off-screen to the left.
          // Instead pin the last `target` bars to the right edge explicitly.
          const from = Math.max(0, candles.length - target);
          const to   = candles.length - 0.5;
          chart.timeScale().setVisibleLogicalRange({ from, to });
        } else {
          chart.timeScale().fitContent();
        }
        // Double rAF then 300 ms fallback — ensures layout is settled before
        // querying timeToCoordinate() regardless of browser paint timing.
        requestAnimationFrame(() => {
          updateTimeAxis();
          setTimeout(updateTimeAxis, 300);
        });
      });

      // Responsive resize
      const ro = new ResizeObserver(() => {
        if (chartRef.current) {
          chart.applyOptions({ width: chartRef.current.clientWidth });
          redrawVP();
          requestAnimationFrame(updateTimeAxis);
        }
        if (rsiRef.current && rsiChart) rsiChart.applyOptions({ width: rsiRef.current.clientWidth });
        if (macdRef.current && macdChart) macdChart.applyOptions({ width: macdRef.current.clientWidth });
      });
      if (chartRef.current) ro.observe(chartRef.current);

      return () => { cancelAnimationFrame(rafId); ro.disconnect(); try { chart.remove(); } catch {} rsiChart?.remove(); macdChart?.remove(); };
    };

    const cleanup = setupChart().catch(() => {});
    return () => { cleanup.then(fn => fn?.()).catch(() => {}); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, indData, indicators]);

  return (
    <div className="card p-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center px-4 py-2.5 border-b border-[var(--border)] gap-2">
        {/* Resolution buttons */}
        <div className="flex gap-1 flex-shrink-0">
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

        {/* OHLCV crosshair readout — populated via ref, no re-renders */}
        <div
          ref={ohlcvRef}
          className="flex-1 hidden md:block text-[11px] font-mono overflow-hidden whitespace-nowrap transition-opacity duration-100"
          style={{ opacity: 0 }}
        />

        {/* Refresh */}
        <button onClick={() => fetchData()} className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors p-1 rounded flex-shrink-0 ml-auto" title="Actualizar">
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
          <div style={{ height: chartH }} className="flex items-center justify-center text-[var(--text-muted)] text-sm">{error}</div>
        )}
        <div ref={chartRef} id="chart-container" style={{ height: chartH }} />
      </div>

      {/* Custom time axis — rendered via React state, never wiped by reconciliation */}
      <div
        className="relative border-t border-[var(--border)]"
        style={{ height: 26, background: '#111722', overflow: 'hidden' }}
      >
        {timeLabels.map((lbl, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: lbl.x,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              fontSize: 10,
              lineHeight: '26px',
              color: '#8b96ad',
              fontFamily: "'JetBrains Mono', monospace",
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {lbl.text}
          </span>
        ))}
      </div>

      {/* RSI sub-chart */}
      {indicators.showRSI && (
        <div className="border-t border-[var(--border)] relative bg-[#111722]">
          <span className="absolute top-1.5 left-14 text-[10px] font-mono text-[var(--text-dim)] z-10 pointer-events-none select-none">RSI 14</span>
          <div ref={rsiRef} style={{ height: 120 }} />
        </div>
      )}

      {/* MACD sub-chart */}
      {indicators.showMACD && (
        <div className="border-t border-[var(--border)] relative bg-[#111722]">
          <span className="absolute top-1.5 left-14 text-[10px] font-mono text-[var(--text-dim)] z-10 pointer-events-none select-none">MACD (12,26,9)</span>
          <div ref={macdRef} style={{ height: 120 }} />
        </div>
      )}
    </div>
  );
}
