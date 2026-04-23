/**
 * Technical analysis calculations
 * All formulas are documented below for reference.
 */

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PivotPoints {
  PP: number;
  R1: number;
  R2: number;
  R3: number;
  S1: number;
  S2: number;
  S3: number;
}

export type PivotType = 'classic' | 'fibonacci' | 'camarilla';

/**
 * CLASSIC PIVOT POINTS
 *   PP = (H + L + C) / 3
 *   R1 = 2*PP - L    S1 = 2*PP - H
 *   R2 = PP + (H-L)  S2 = PP - (H-L)
 *   R3 = H + 2*(PP-L) S3 = L - 2*(H-PP)
 */
export function classicPivots(h: number, l: number, c: number): PivotPoints {
  const PP = (h + l + c) / 3;
  const range = h - l;
  return {
    PP,
    R1: 2 * PP - l,
    S1: 2 * PP - h,
    R2: PP + range,
    S2: PP - range,
    R3: h + 2 * (PP - l),
    S3: l - 2 * (h - PP)
  };
}

/**
 * FIBONACCI PIVOT POINTS
 *   PP = (H + L + C) / 3
 *   R1 = PP + 0.382*(H-L)   S1 = PP - 0.382*(H-L)
 *   R2 = PP + 0.618*(H-L)   S2 = PP - 0.618*(H-L)
 *   R3 = PP + 1.000*(H-L)   S3 = PP - 1.000*(H-L)
 */
export function fibonacciPivots(h: number, l: number, c: number): PivotPoints {
  const PP = (h + l + c) / 3;
  const range = h - l;
  return {
    PP,
    R1: PP + 0.382 * range,
    S1: PP - 0.382 * range,
    R2: PP + 0.618 * range,
    S2: PP - 0.618 * range,
    R3: PP + range,
    S3: PP - range
  };
}

/**
 * CAMARILLA PIVOT POINTS
 *   PP = (H + L + C) / 3
 *   R1 = C + (H-L)*1.1/12   S1 = C - (H-L)*1.1/12
 *   R2 = C + (H-L)*1.1/6    S2 = C - (H-L)*1.1/6
 *   R3 = C + (H-L)*1.1/4    S3 = C - (H-L)*1.1/4
 */
export function camarillaPivots(h: number, l: number, c: number): PivotPoints {
  const PP = (h + l + c) / 3;
  const range = h - l;
  return {
    PP,
    R1: c + (range * 1.1) / 12,
    S1: c - (range * 1.1) / 12,
    R2: c + (range * 1.1) / 6,
    S2: c - (range * 1.1) / 6,
    R3: c + (range * 1.1) / 4,
    S3: c - (range * 1.1) / 4
  };
}

export function computePivots(
  h: number,
  l: number,
  c: number,
  type: PivotType = 'classic'
): PivotPoints {
  if (type === 'fibonacci') return fibonacciPivots(h, l, c);
  if (type === 'camarilla') return camarillaPivots(h, l, c);
  return classicPivots(h, l, c);
}

/**
 * VWAP - Volume Weighted Average Price
 *   VWAP = Σ(typical_price * volume) / Σ(volume)
 *   typical_price = (H + L + C) / 3
 * Returns: array of VWAP values + upper/lower bands at ±1σ and ±2σ
 */
export interface VwapPoint {
  time: number;
  vwap: number;
  upper1: number;
  lower1: number;
  upper2: number;
  lower2: number;
}

export function computeVWAP(candles: Candle[]): VwapPoint[] {
  let cumPV = 0;
  let cumV = 0;
  let cumVarPV = 0;
  const out: VwapPoint[] = [];

  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume;
    cumV += c.volume;
    const vwap = cumV > 0 ? cumPV / cumV : tp;

    // Running variance for std dev bands
    cumVarPV += Math.pow(tp - vwap, 2) * c.volume;
    const variance = cumV > 0 ? cumVarPV / cumV : 0;
    const sigma = Math.sqrt(variance);

    out.push({
      time: c.time,
      vwap,
      upper1: vwap + sigma,
      lower1: vwap - sigma,
      upper2: vwap + 2 * sigma,
      lower2: vwap - 2 * sigma
    });
  }
  return out;
}

/**
 * SUPPORT & RESISTANCE via pivot-high/pivot-low detection
 * A "pivot high" is a candle whose high is higher than its N neighbors on each side.
 * We then cluster nearby pivots into S/R levels and return the top 3 above and 3 below price.
 */
export interface SRLevels {
  supports: number[]; // sorted descending (closest to price first)
  resistances: number[]; // sorted ascending (closest to price first)
}

export function detectSupportResistance(
  candles: Candle[],
  currentPrice: number,
  lookback = 5,
  clusterThresholdPct = 0.005 // 0.5% of price
): SRLevels {
  if (candles.length < lookback * 2 + 1) {
    return { supports: [], resistances: [] };
  }

  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }
    if (isHigh) pivotHighs.push(c.high);
    if (isLow) pivotLows.push(c.low);
  }

  // Cluster nearby levels
  const threshold = currentPrice * clusterThresholdPct;
  const cluster = (vals: number[]): number[] => {
    if (vals.length === 0) return [];
    const sorted = [...vals].sort((a, b) => a - b);
    const clusters: number[][] = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
      const last = clusters[clusters.length - 1];
      if (sorted[i] - last[last.length - 1] <= threshold) {
        last.push(sorted[i]);
      } else {
        clusters.push([sorted[i]]);
      }
    }
    return clusters.map((cl) => cl.reduce((a, b) => a + b, 0) / cl.length);
  };

  const highClusters = cluster(pivotHighs);
  const lowClusters = cluster(pivotLows);

  // Resistances = clusters above current price, ascending
  const resistances = highClusters
    .filter((v) => v > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, 5);

  // Supports = clusters below current price, descending (closest first)
  const supports = lowClusters
    .filter((v) => v < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, 5);

  return { supports, resistances };
}

/**
 * EMA - Exponential Moving Average
 */
export function computeEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let ema = values[0];
  for (let i = 0; i < values.length; i++) {
    ema = i === 0 ? values[0] : values[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

/**
 * RSI - Relative Strength Index (14 period default)
 */
export function computeRSI(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(50);
  if (values.length < period + 1) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  }
  return out;
}

/**
 * MACD - Moving Average Convergence Divergence
 * macd = EMA12 - EMA26, signal = EMA9(macd), histogram = macd - signal
 */
export function computeMACD(values: number[]) {
  const ema12 = computeEMA(values, 12);
  const ema26 = computeEMA(values, 26);
  const macd = values.map((_, i) => ema12[i] - ema26[i]);
  const signal = computeEMA(macd, 9);
  const histogram = macd.map((v, i) => v - signal[i]);
  return { macd, signal, histogram };
}

/**
 * SHORT SQUEEZE POTENTIAL SCORE (0-100)
 *
 * Weighted model based on public short-squeeze research:
 *  - Float size (25 pts): small float = more squeeze-able
 *  - Short Interest % of float (30 pts): the core metric
 *  - Days to Cover (20 pts): how long for shorts to exit
 *  - Relative Volume (15 pts): current interest/momentum
 *  - Recent price momentum (10 pts): uptick catalyst
 *
 * Each sub-score is normalized to [0,1] then weighted.
 */
export interface SqueezeInputs {
  float?: number | null; // in shares
  shortInterestPct?: number | null; // percent of float, e.g. 25 means 25%
  daysToCover?: number | null;
  relativeVolume?: number | null; // rvol vs avg
  priceChangePct5d?: number | null; // 5-day % change
}

export interface SqueezeResult {
  score: number; // 0-100
  band: 'low' | 'medium' | 'high';
  color: 'red' | 'amber' | 'green';
  breakdown: {
    float: number;
    shortInterest: number;
    daysToCover: number;
    rvol: number;
    momentum: number;
  };
  analysis: string;
}

export function computeSqueezeScore(inputs: SqueezeInputs): SqueezeResult {
  const reasons: string[] = [];

  // --- Float score (25 pts) -------------------------------------------------
  // <5M: 25, 5-20M: 18, 20-50M: 10, 50-100M: 5, >100M: 0
  let floatScore = 0;
  if (inputs.float != null) {
    const mShares = inputs.float / 1_000_000;
    if (mShares < 5) {
      floatScore = 25;
      reasons.push(`Float extremadamente bajo (${mShares.toFixed(1)}M)`);
    } else if (mShares < 20) {
      floatScore = 18;
      reasons.push(`Float bajo (${mShares.toFixed(1)}M)`);
    } else if (mShares < 50) floatScore = 10;
    else if (mShares < 100) floatScore = 5;
  }

  // --- Short Interest score (30 pts) ---------------------------------------
  // >40%: 30, 25-40%: 25, 15-25%: 18, 10-15%: 10, 5-10%: 5, <5%: 0
  let siScore = 0;
  if (inputs.shortInterestPct != null) {
    const si = inputs.shortInterestPct;
    if (si > 40) {
      siScore = 30;
      reasons.push(`Short Interest extremo (${si.toFixed(1)}%)`);
    } else if (si > 25) {
      siScore = 25;
      reasons.push(`Short Interest muy alto (${si.toFixed(1)}%)`);
    } else if (si > 15) {
      siScore = 18;
      reasons.push(`Short Interest alto (${si.toFixed(1)}%)`);
    } else if (si > 10) siScore = 10;
    else if (si > 5) siScore = 5;
  }

  // --- Days to Cover score (20 pts) ----------------------------------------
  // >7: 20, 5-7: 16, 3-5: 12, 2-3: 6, <2: 0
  let dtcScore = 0;
  if (inputs.daysToCover != null) {
    const dtc = inputs.daysToCover;
    if (dtc > 7) {
      dtcScore = 20;
      reasons.push(`Days-to-Cover muy alto (${dtc.toFixed(1)})`);
    } else if (dtc > 5) {
      dtcScore = 16;
      reasons.push(`Days-to-Cover alto (${dtc.toFixed(1)})`);
    } else if (dtc > 3) {
      dtcScore = 12;
      reasons.push(`Days-to-Cover elevado (${dtc.toFixed(1)})`);
    } else if (dtc > 2) dtcScore = 6;
  }

  // --- Relative Volume score (15 pts) --------------------------------------
  // >5x: 15, 3-5x: 12, 2-3x: 8, 1.5-2x: 4, <1.5x: 0
  let rvolScore = 0;
  if (inputs.relativeVolume != null) {
    const rv = inputs.relativeVolume;
    if (rv > 5) {
      rvolScore = 15;
      reasons.push(`RVOL masivo (${rv.toFixed(2)}x)`);
    } else if (rv > 3) {
      rvolScore = 12;
      reasons.push(`RVOL muy alto (${rv.toFixed(2)}x)`);
    } else if (rv > 2) {
      rvolScore = 8;
      reasons.push(`RVOL alto (${rv.toFixed(2)}x)`);
    } else if (rv > 1.5) rvolScore = 4;
  }

  // --- Momentum score (10 pts) ---------------------------------------------
  // >20%: 10, 10-20%: 7, 5-10%: 4, 0-5%: 1, negative: 0
  let momScore = 0;
  if (inputs.priceChangePct5d != null) {
    const m = inputs.priceChangePct5d;
    if (m > 20) {
      momScore = 10;
      reasons.push(`Momentum fuerte (+${m.toFixed(1)}% en 5d)`);
    } else if (m > 10) {
      momScore = 7;
      reasons.push(`Momentum positivo (+${m.toFixed(1)}% en 5d)`);
    } else if (m > 5) momScore = 4;
    else if (m > 0) momScore = 1;
  }

  const score = Math.round(floatScore + siScore + dtcScore + rvolScore + momScore);

  let band: 'low' | 'medium' | 'high';
  let color: 'red' | 'amber' | 'green';
  if (score >= 60) {
    band = 'high';
    color = 'green';
  } else if (score >= 35) {
    band = 'medium';
    color = 'amber';
  } else {
    band = 'low';
    color = 'red';
  }

  let analysis = '';
  if (band === 'high') {
    analysis = `Alto potencial de short squeeze. ${reasons.join('. ')}.`;
  } else if (band === 'medium') {
    analysis =
      reasons.length > 0
        ? `Potencial moderado. ${reasons.join('. ')}. Se requieren catalizadores adicionales.`
        : 'Potencial moderado. Datos limitados — monitoriza short interest y volumen.';
  } else {
    analysis =
      'Potencial bajo de short squeeze en este momento. Ninguno de los factores clave (float bajo, short interest alto, DTC alto, RVOL alto) está presente de forma significativa.';
  }

  return {
    score,
    band,
    color,
    breakdown: {
      float: floatScore,
      shortInterest: siScore,
      daysToCover: dtcScore,
      rvol: rvolScore,
      momentum: momScore
    },
    analysis
  };
}

/**
 * Extract the previous completed session's H/L/C from a list of daily candles
 * Used to compute the day's pivot points.
 */
export function getPreviousSessionHLC(dailyCandles: Candle[]): { h: number; l: number; c: number } | null {
  if (dailyCandles.length < 2) return null;
  const prev = dailyCandles[dailyCandles.length - 2];
  return { h: prev.high, l: prev.low, c: prev.close };
}
