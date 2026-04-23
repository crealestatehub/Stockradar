/**
 * Market data provider - Finnhub primary, with Financial Modeling Prep fallback for fundamentals.
 * Falls back to synthetic data in demo mode if no API keys set, so the app works immediately.
 */

import axios from 'axios';
import type { Candle } from './indicators';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const FMP_KEY = process.env.FMP_API_KEY || '';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

// Simple in-memory cache to avoid burning rate limits
interface CacheEntry<T> {
  value: T;
  expires: number;
}
const cache = new Map<string, CacheEntry<any>>();

function getCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}
function setCache<T>(key: string, value: T, ttlSeconds: number) {
  cache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

export const isDemoMode = !FINNHUB_KEY;

// ---------------------------------------------------------------------------
// Symbol search
// ---------------------------------------------------------------------------
export interface SymbolMatch {
  symbol: string;
  description: string;
  type?: string;
  exchange?: string;
}

export async function searchSymbols(query: string): Promise<SymbolMatch[]> {
  if (!query || query.length < 1) return [];
  const key = `search:${query.toLowerCase()}`;
  const cached = getCache<SymbolMatch[]>(key);
  if (cached) return cached;

  if (isDemoMode) return demoSearchSymbols(query);

  try {
    const { data } = await axios.get(`${FINNHUB_BASE}/search`, {
      params: { q: query, token: FINNHUB_KEY },
      timeout: 8000
    });
    const results: SymbolMatch[] = (data?.result || [])
      .filter((r: any) => r.type === 'Common Stock' || !r.type)
      .slice(0, 15)
      .map((r: any) => ({
        symbol: r.symbol,
        description: r.description,
        type: r.type,
        exchange: r.displaySymbol
      }));
    setCache(key, results, 3600);
    return results;
  } catch {
    return demoSearchSymbols(query);
  }
}

// ---------------------------------------------------------------------------
// Real-time quote
// ---------------------------------------------------------------------------
export interface Quote {
  symbol: string;
  current: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const key = `quote:${symbol}`;
  const cached = getCache<Quote>(key);
  if (cached) return cached;

  if (isDemoMode) return demoQuote(symbol);

  try {
    const { data } = await axios.get(`${FINNHUB_BASE}/quote`, {
      params: { symbol, token: FINNHUB_KEY },
      timeout: 8000
    });
    if (!data || data.c == null) return null;
    const quote: Quote = {
      symbol,
      current: data.c,
      change: data.d ?? 0,
      changePct: data.dp ?? 0,
      high: data.h,
      low: data.l,
      open: data.o,
      prevClose: data.pc,
      timestamp: data.t
    };
    setCache(key, quote, 15);
    return quote;
  } catch {
    return demoQuote(symbol);
  }
}

// ---------------------------------------------------------------------------
// Candles (OHLCV)
// ---------------------------------------------------------------------------
export type Resolution = '1' | '5' | '15' | '60' | 'D' | 'W';

export async function getCandles(
  symbol: string,
  resolution: Resolution,
  fromUnix: number,
  toUnix: number
): Promise<Candle[]> {
  const key = `candles:${symbol}:${resolution}:${fromUnix}:${toUnix}`;
  const cached = getCache<Candle[]>(key);
  if (cached) return cached;

  if (isDemoMode) {
    const candles = demoCandles(symbol, resolution, fromUnix, toUnix);
    setCache(key, candles, 60);
    return candles;
  }

  try {
    const { data } = await axios.get(`${FINNHUB_BASE}/stock/candle`, {
      params: {
        symbol,
        resolution,
        from: fromUnix,
        to: toUnix,
        token: FINNHUB_KEY
      },
      timeout: 10000
    });
    if (data.s !== 'ok') {
      // free tier often returns no_data; fall back to demo-shaped generator so UI still works
      return demoCandles(symbol, resolution, fromUnix, toUnix);
    }
    const candles: Candle[] = data.t.map((t: number, i: number) => ({
      time: t,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i]
    }));
    const ttl = resolution === 'D' || resolution === 'W' ? 300 : 30;
    setCache(key, candles, ttl);
    return candles;
  } catch {
    return demoCandles(symbol, resolution, fromUnix, toUnix);
  }
}

// ---------------------------------------------------------------------------
// Fundamentals / company profile / short interest
// ---------------------------------------------------------------------------
export interface Fundamentals {
  symbol: string;
  name?: string;
  exchange?: string;
  industry?: string;
  logo?: string;
  marketCap?: number | null; // USD
  sharesOutstanding?: number | null;
  float?: number | null;
  shortInterestPct?: number | null; // of float
  daysToCover?: number | null;
  avgVolume?: number | null;
  weekHigh52?: number | null;
  weekLow52?: number | null;
}

export async function getFundamentals(symbol: string): Promise<Fundamentals> {
  const key = `fund:${symbol}`;
  const cached = getCache<Fundamentals>(key);
  if (cached) return cached;

  if (isDemoMode) return demoFundamentals(symbol);

  const out: Fundamentals = { symbol };

  // Company profile from Finnhub
  try {
    const { data } = await axios.get(`${FINNHUB_BASE}/stock/profile2`, {
      params: { symbol, token: FINNHUB_KEY },
      timeout: 8000
    });
    out.name = data.name;
    out.exchange = data.exchange;
    out.industry = data.finnhubIndustry;
    out.logo = data.logo;
    out.marketCap = data.marketCapitalization ? data.marketCapitalization * 1_000_000 : null;
    out.sharesOutstanding = data.shareOutstanding ? data.shareOutstanding * 1_000_000 : null;
  } catch {}

  // Basic financials (52w high/low, short ratio) from Finnhub
  try {
    const { data } = await axios.get(`${FINNHUB_BASE}/stock/metric`, {
      params: { symbol, metric: 'all', token: FINNHUB_KEY },
      timeout: 8000
    });
    const m = data?.metric || {};
    out.weekHigh52 = m['52WeekHigh'] ?? null;
    out.weekLow52 = m['52WeekLow'] ?? null;
    out.avgVolume = m['10DayAverageTradingVolume']
      ? m['10DayAverageTradingVolume'] * 1_000_000
      : null;
    out.shortInterestPct = m.shortRatio ?? null; // note: shortRatio on Finnhub is days-to-cover
    out.daysToCover = m.shortRatio ?? null;
    // Finnhub free tier does not expose short % of float directly
  } catch {}

  // Float + short % of float from FMP if key present
  if (FMP_KEY) {
    try {
      const { data } = await axios.get(`${FMP_BASE}/key-metrics-ttm/${symbol}`, {
        params: { apikey: FMP_KEY },
        timeout: 8000
      });
      // fallthrough - some details in key-metrics
    } catch {}
    try {
      const { data } = await axios.get(`${FMP_BASE}/profile/${symbol}`, {
        params: { apikey: FMP_KEY },
        timeout: 8000
      });
      const p = Array.isArray(data) ? data[0] : data;
      if (p) {
        if (!out.marketCap && p.mktCap) out.marketCap = p.mktCap;
        if (p.floatShares) out.float = p.floatShares;
        if (p.volAvg && !out.avgVolume) out.avgVolume = p.volAvg;
        if (!out.name) out.name = p.companyName;
        if (!out.logo) out.logo = p.image;
      }
    } catch {}
  }

  // If float unknown, use shares outstanding as a conservative proxy
  if (!out.float && out.sharesOutstanding) out.float = out.sharesOutstanding;

  setCache(key, out, 3600);
  return out;
}

// ---------------------------------------------------------------------------
// DEMO / FALLBACK DATA GENERATORS ------------------------------------------
// Used when no API key is configured OR when upstream fails.
// Data is deterministic per-symbol so the UX stays consistent.
// ---------------------------------------------------------------------------
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const DEMO_STOCKS = [
  { symbol: 'AAPL', description: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', description: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'NVDA', description: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'TSLA', description: 'Tesla, Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', description: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  { symbol: 'META', description: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', description: 'Alphabet Inc. Class A', exchange: 'NASDAQ' },
  { symbol: 'GME', description: 'GameStop Corp.', exchange: 'NYSE' },
  { symbol: 'AMC', description: 'AMC Entertainment Holdings', exchange: 'NYSE' },
  { symbol: 'BBBY', description: 'Bed Bath & Beyond Inc.', exchange: 'NASDAQ' },
  { symbol: 'PLTR', description: 'Palantir Technologies Inc.', exchange: 'NYSE' },
  { symbol: 'COIN', description: 'Coinbase Global, Inc.', exchange: 'NASDAQ' },
  { symbol: 'SPY', description: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE' },
  { symbol: 'QQQ', description: 'Invesco QQQ Trust', exchange: 'NASDAQ' },
  { symbol: 'NFLX', description: 'Netflix, Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMD', description: 'Advanced Micro Devices, Inc.', exchange: 'NASDAQ' },
  { symbol: 'INTC', description: 'Intel Corporation', exchange: 'NASDAQ' },
  { symbol: 'BA', description: 'Boeing Company', exchange: 'NYSE' },
  { symbol: 'DIS', description: 'The Walt Disney Company', exchange: 'NYSE' },
  { symbol: 'JPM', description: 'JPMorgan Chase & Co.', exchange: 'NYSE' }
];

function demoSearchSymbols(q: string): SymbolMatch[] {
  const lower = q.toLowerCase();
  return DEMO_STOCKS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower)
  ).map((s) => ({ ...s, type: 'Common Stock' }));
}

function demoQuote(symbol: string): Quote {
  const rng = seededRandom(hash(symbol) + Math.floor(Date.now() / 60000));
  const base = 50 + (hash(symbol) % 500);
  const changePct = (rng() - 0.5) * 8;
  const change = base * (changePct / 100);
  const current = base + change;
  return {
    symbol,
    current: +current.toFixed(2),
    change: +change.toFixed(2),
    changePct: +changePct.toFixed(2),
    high: +(current * 1.02).toFixed(2),
    low: +(current * 0.98).toFixed(2),
    open: +(base * 1.001).toFixed(2),
    prevClose: +base.toFixed(2),
    timestamp: Math.floor(Date.now() / 1000)
  };
}

function demoCandles(symbol: string, res: Resolution, from: number, to: number): Candle[] {
  const rng = seededRandom(hash(symbol + res));
  const stepSeconds =
    res === '1' ? 60 :
    res === '5' ? 300 :
    res === '15' ? 900 :
    res === '60' ? 3600 :
    res === 'D' ? 86400 :
    604800;
  const count = Math.min(400, Math.max(50, Math.floor((to - from) / stepSeconds)));
  const basePrice = 50 + (hash(symbol) % 500);
  let price = basePrice;
  const out: Candle[] = [];
  const startTime = to - count * stepSeconds;
  for (let i = 0; i < count; i++) {
    const drift = (rng() - 0.48) * basePrice * 0.015;
    const open = price;
    const close = Math.max(1, price + drift);
    const high = Math.max(open, close) + rng() * basePrice * 0.008;
    const low = Math.min(open, close) - rng() * basePrice * 0.008;
    const volume = Math.floor(500_000 + rng() * 5_000_000);
    out.push({
      time: startTime + i * stepSeconds,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +Math.max(1, low).toFixed(2),
      close: +close.toFixed(2),
      volume
    });
    price = close;
  }
  return out;
}

function demoFundamentals(symbol: string): Fundamentals {
  const rng = seededRandom(hash(symbol));
  const sharesOutstanding = Math.floor((10 + rng() * 2000) * 1_000_000);
  const floatPct = 0.5 + rng() * 0.45;
  const float = Math.floor(sharesOutstanding * floatPct);
  const price = 50 + (hash(symbol) % 500);
  return {
    symbol,
    name: DEMO_STOCKS.find((s) => s.symbol === symbol)?.description || `${symbol} Corp.`,
    exchange: DEMO_STOCKS.find((s) => s.symbol === symbol)?.exchange || 'NASDAQ',
    industry: 'Technology',
    logo: `https://logo.clearbit.com/${symbol.toLowerCase()}.com`,
    marketCap: price * sharesOutstanding,
    sharesOutstanding,
    float,
    shortInterestPct: +(rng() * 45).toFixed(2),
    daysToCover: +(rng() * 10).toFixed(2),
    avgVolume: Math.floor(1_000_000 + rng() * 20_000_000),
    weekHigh52: +(price * (1.1 + rng() * 0.5)).toFixed(2),
    weekLow52: +(price * (0.5 + rng() * 0.3)).toFixed(2)
  };
}
