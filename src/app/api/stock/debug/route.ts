import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || 'NVDA';
  const now  = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24 * 365;

  // Test Yahoo Finance (no key needed)
  let yahoo: any = null;
  try {
    const { data } = await axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      params: { interval: '1d', period1: from, period2: now, includeAdjustedClose: true },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.adjclose?.[0]?.adjclose ?? result?.indicators?.quote?.[0]?.close ?? [];
    yahoo = { ok: timestamps.length > 0, candleCount: timestamps.length, lastClose: closes.at(-1) ?? null };
  } catch (e: any) {
    yahoo = { error: e.message, httpStatus: e.response?.status };
  }

  return NextResponse.json({
    symbol,
    yahoo,
    finnhub_key_set: !!process.env.FINNHUB_API_KEY,
    fmp_key_set:     !!process.env.FMP_API_KEY,
  });
}
