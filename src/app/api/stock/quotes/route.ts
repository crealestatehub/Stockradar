import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('symbols') ?? '';
  const tickers = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 25);
  if (!tickers.length) return NextResponse.json({ quotes: [] });

  const results = await Promise.allSettled(tickers.map(s => getQuote(s)));
  const quotes = results.map((r, i) => ({
    symbol: tickers[i],
    price: r.status === 'fulfilled' && r.value ? r.value.current : null,
    changePct: r.status === 'fulfilled' && r.value ? r.value.changePct : null,
  }));

  return NextResponse.json({ quotes });
}
