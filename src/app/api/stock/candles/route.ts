import { NextRequest, NextResponse } from 'next/server';
import { getCandles, type Resolution } from '@/lib/market';
import {
  computePivots,
  computeVWAP,
  detectSupportResistance,
  computeEMA,
  computeRSI,
  computeMACD,
  type PivotType
} from '@/lib/indicators';

export const dynamic = 'force-dynamic';

const VALID_RES: Resolution[] = ['1', '5', '15', '60', 'D', 'W'];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const symbol = params.get('symbol')?.toUpperCase();
  const resolution = (params.get('resolution') || 'D') as Resolution;
  const pivotType = (params.get('pivot') || 'classic') as PivotType;

  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  if (!VALID_RES.includes(resolution))
    return NextResponse.json({ error: 'invalid resolution' }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  // Scope the history window to the resolution
  const lookbackSeconds: Record<Resolution, number> = {
    '1': 60 * 60 * 24 * 5,       // 5 days of 1m
    '5': 60 * 60 * 24 * 10,      // 10 days of 5m
    '15': 60 * 60 * 24 * 30,     // 30 days of 15m
    '60': 60 * 60 * 24 * 90,     // 90 days of 1h
    D: 60 * 60 * 24 * 365 * 2,   // 2 years of daily
    W: 60 * 60 * 24 * 365 * 5    // 5 years of weekly
  };
  const from = now - lookbackSeconds[resolution];

  const candles = await getCandles(symbol, resolution, from, now);

  if (candles.length === 0) {
    return NextResponse.json({ candles: [], indicators: null });
  }

  const currentPrice = candles[candles.length - 1].close;

  // Daily candles are needed separately for day-level pivots if we're on intraday
  let dailyCandles = candles;
  if (resolution !== 'D' && resolution !== 'W') {
    const dailyFrom = now - 60 * 60 * 24 * 30;
    dailyCandles = await getCandles(symbol, 'D', dailyFrom, now);
  }

  // Pivots — daily / weekly / monthly
  const daily = dailyCandles.length >= 2 ? dailyCandles[dailyCandles.length - 2] : null;
  const weekly = aggregatePeriod(dailyCandles, 'week');
  const monthly = aggregatePeriod(dailyCandles, 'month');

  const pivots = {
    daily: daily ? computePivots(daily.high, daily.low, daily.close, pivotType) : null,
    weekly: weekly ? computePivots(weekly.high, weekly.low, weekly.close, pivotType) : null,
    monthly: monthly ? computePivots(monthly.high, monthly.low, monthly.close, pivotType) : null
  };

  // VWAP only makes sense for intraday — reset each day if intraday
  let vwapSeries = null;
  if (resolution === '1' || resolution === '5' || resolution === '15' || resolution === '60') {
    // Filter to today's session only
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayUnix = Math.floor(todayStart.getTime() / 1000);
    const todays = candles.filter((c) => c.time >= todayUnix);
    vwapSeries = computeVWAP(todays.length > 0 ? todays : candles.slice(-50));
  }

  // S/R from daily candles for stability
  const sr = detectSupportResistance(dailyCandles, currentPrice);

  // Price change over the last 5 daily sessions
  const priceChangePct5d =
    dailyCandles.length >= 6
      ? ((currentPrice - dailyCandles[dailyCandles.length - 6].close) /
          dailyCandles[dailyCandles.length - 6].close) *
        100
      : 0;

  // EMAs / RSI / MACD on closing prices (of the requested resolution)
  const closes = candles.map((c) => c.close);
  const ema9 = computeEMA(closes, 9);
  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const ema200 = computeEMA(closes, 200);
  const rsi = computeRSI(closes, 14);
  const macd = computeMACD(closes);

  return NextResponse.json({
    candles,
    indicators: {
      pivots,
      vwap: vwapSeries,
      supports: sr.supports,
      resistances: sr.resistances,
      priceChangePct5d,
      ema9,
      ema20,
      ema50,
      ema200,
      rsi,
      macd
    }
  });
}

function aggregatePeriod(daily: { time: number; open: number; high: number; low: number; close: number; volume: number }[], period: 'week' | 'month') {
  if (daily.length === 0) return null;
  // Just aggregate the previous completed period
  const last = daily[daily.length - 1];
  const lastDate = new Date(last.time * 1000);
  let startCutoff: Date;
  let endCutoff: Date;

  if (period === 'week') {
    // Previous Mon-Fri
    const d = new Date(lastDate);
    d.setDate(d.getDate() - d.getDay() - 6); // previous Monday
    startCutoff = new Date(d);
    endCutoff = new Date(d);
    endCutoff.setDate(endCutoff.getDate() + 4); // previous Friday
  } else {
    // Previous calendar month
    startCutoff = new Date(lastDate.getFullYear(), lastDate.getMonth() - 1, 1);
    endCutoff = new Date(lastDate.getFullYear(), lastDate.getMonth(), 0);
  }
  const startU = startCutoff.getTime() / 1000;
  const endU = endCutoff.getTime() / 1000 + 86400; // inclusive

  const slice = daily.filter((c) => c.time >= startU && c.time < endU);
  if (slice.length === 0) return null;
  return {
    high: Math.max(...slice.map((c) => c.high)),
    low: Math.min(...slice.map((c) => c.low)),
    close: slice[slice.length - 1].close
  };
}
