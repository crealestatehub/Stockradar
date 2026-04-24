import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || 'NVDA';
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24 * 365; // 1 year

  if (!FINNHUB_KEY) {
    return NextResponse.json({ mode: 'demo', reason: 'no FINNHUB_API_KEY set' });
  }

  try {
    const { data, status } = await axios.get('https://finnhub.io/api/v1/stock/candle', {
      params: { symbol, resolution: 'D', from, to: now, token: FINNHUB_KEY },
      timeout: 10000
    });
    return NextResponse.json({
      mode: 'live',
      httpStatus: status,
      finnhubStatus: data.s,
      candleCount: data.t?.length ?? 0,
      firstDate: data.t?.[0] ? new Date(data.t[0] * 1000).toISOString() : null,
      lastDate: data.t?.at(-1) ? new Date(data.t.at(-1) * 1000).toISOString() : null,
      lastClose: data.c?.at(-1) ?? null,
      raw: data.s !== 'ok' ? data : undefined
    });
  } catch (e: any) {
    return NextResponse.json({
      mode: 'error',
      message: e.message,
      httpStatus: e.response?.status,
      data: e.response?.data
    });
  }
}
