import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || 'NVDA';
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
  const FMP_KEY     = process.env.FMP_API_KEY     || '';
  const now  = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24 * 365;

  const result: any = {
    finnhub_key_set: !!FINNHUB_KEY,
    fmp_key_set:     !!FMP_KEY,
    finnhub: null,
    fmp:     null,
  };

  // Test Finnhub candles
  try {
    const { data, status } = await axios.get('https://finnhub.io/api/v1/stock/candle', {
      params: { symbol, resolution: 'D', from, to: now, token: FINNHUB_KEY },
      timeout: 10000
    });
    result.finnhub = { httpStatus: status, s: data.s, candleCount: data.t?.length ?? 0, lastClose: data.c?.at(-1) ?? null };
  } catch (e: any) {
    result.finnhub = { error: e.message, httpStatus: e.response?.status, data: e.response?.data };
  }

  // Test FMP daily candles
  try {
    const fromDate = new Date(from * 1000).toISOString().split('T')[0];
    const toDate   = new Date(now  * 1000).toISOString().split('T')[0];
    const { data, status } = await axios.get(
      `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}`,
      { params: { from: fromDate, to: toDate, apikey: FMP_KEY }, timeout: 10000 }
    );
    const hist = data.historical ?? [];
    result.fmp = { httpStatus: status, candleCount: hist.length, lastClose: hist[0]?.adjClose ?? hist[0]?.close ?? null };
  } catch (e: any) {
    result.fmp = { error: e.message, httpStatus: e.response?.status, data: e.response?.data };
  }

  return NextResponse.json(result);
}
