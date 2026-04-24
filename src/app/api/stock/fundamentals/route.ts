import { NextRequest, NextResponse } from 'next/server';
import { getFundamentals, getQuote, getCandles, getEarningsDate } from '@/lib/market';
import { computeSqueezeScore } from '@/lib/indicators';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase();
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const [fund, quote, earningsDate, daily] = await Promise.all([
    getFundamentals(symbol),
    getQuote(symbol),
    getEarningsDate(symbol),
    getCandles(symbol, 'D', now - 60 * 60 * 24 * 30, now)
  ]);

  let priceChangePct5d = 0;
  let relativeVolume   = 0;
  let floatRotation    = 0;

  if (daily.length >= 6) {
    const cur  = daily[daily.length - 1].close;
    const past = daily[daily.length - 6].close;
    priceChangePct5d = ((cur - past) / past) * 100;
  }
  if (daily.length >= 11) {
    const todayVol = daily[daily.length - 1].volume;
    const avg10    = daily.slice(-11, -1).reduce((a, b) => a + b.volume, 0) / 10;
    relativeVolume = avg10 > 0 ? todayVol / avg10 : 0;
    floatRotation  = fund.float && fund.float > 0 ? todayVol / fund.float : 0;
  }

  const squeeze = computeSqueezeScore({
    float: fund.float,
    shortInterestPct: fund.shortInterestPct,
    daysToCover: fund.daysToCover,
    relativeVolume,
    priceChangePct5d
  });

  return NextResponse.json({
    fundamentals: fund,
    quote,
    metrics: { priceChangePct5d, relativeVolume, floatRotation },
    earningsDate,
    squeeze
  });
}
