import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { computeSqueezeScore } from '@/lib/indicators';

export const dynamic = 'force-dynamic';

const TICKERS = [
  // Classic meme / squeeze
  'GME', 'AMC', 'BB', 'NOK',
  // EV / clean energy (heavily shorted)
  'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'NKLA', 'SPCE', 'WKHS', 'FFIE', 'MULN',
  // Fintech / growth
  'MSTR', 'COIN', 'HOOD', 'AFRM', 'UPST', 'SOFI', 'OPEN', 'UWMC',
  // Crypto mining
  'MARA', 'RIOT', 'BITF', 'HUT', 'CLSK',
  // High-short-interest tech / growth
  'PLTR', 'BYND', 'SNAP', 'LYFT', 'RBLX', 'TSLA',
  // Biotech
  'HIMS', 'NVAX', 'BLNK', 'SNDL', 'SAVA',
  // AI / quantum
  'BBAI', 'SMCI', 'IONQ', 'QBTS', 'RGTI',
  // SPAC / mobility
  'DJT', 'ACHR', 'JOBY', 'EVGO', 'CHPT',
  // Others
  'ATER', 'MAXN', 'CLOV',
];

interface ScreenerItem {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  float: number | null;
  shortInterestPct: number | null;
  daysToCover: number | null;
  rvol: number;
  marketCap: number | null;
  squeezeScore: number;
  squeezeBand: 'low' | 'medium' | 'high';
  squeezeColor: 'red' | 'amber' | 'green';
}

let screenerCache: { data: ScreenerItem[]; ts: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';

  if (!forceRefresh && screenerCache && Date.now() - screenerCache.ts < CACHE_TTL) {
    return NextResponse.json({
      items: screenerCache.data,
      cachedAt: new Date(screenerCache.ts).toISOString(),
      total: TICKERS.length,
    });
  }

  try {
    const { data } = await axios.get('https://query2.finance.yahoo.com/v7/finance/quote', {
      params: { symbols: TICKERS.join(',') },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 20000,
    });

    const quotes: any[] = data?.quoteResponse?.result ?? [];

    const items: ScreenerItem[] = quotes
      .filter(q => q.regularMarketPrice > 0)
      .map(q => {
        const todayVol = q.regularMarketVolume ?? 0;
        const avgVol = q.averageDailyVolume10Day ?? 0;
        const rvol = avgVol > 0 ? todayVol / avgVol : 0;
        const shortInterestPct =
          q.shortPercentOfFloat != null ? q.shortPercentOfFloat * 100 : null;

        const squeeze = computeSqueezeScore({
          float: q.floatShares ?? null,
          shortInterestPct,
          daysToCover: q.shortRatio ?? null,
          relativeVolume: rvol,
          priceChangePct5d: null,
        });

        return {
          ticker: q.symbol,
          name: q.shortName ?? q.symbol,
          price: q.regularMarketPrice ?? 0,
          changePct: q.regularMarketChangePercent ?? 0,
          float: q.floatShares ?? null,
          shortInterestPct,
          daysToCover: q.shortRatio ?? null,
          rvol,
          marketCap: q.marketCap ?? null,
          squeezeScore: squeeze.score,
          squeezeBand: squeeze.band,
          squeezeColor: squeeze.color,
        };
      })
      .sort((a, b) => b.squeezeScore - a.squeezeScore);

    screenerCache = { data: items, ts: Date.now() };
    return NextResponse.json({
      items,
      cachedAt: new Date().toISOString(),
      total: TICKERS.length,
    });
  } catch (e: any) {
    if (screenerCache) {
      return NextResponse.json({
        items: screenerCache.data,
        cachedAt: new Date(screenerCache.ts).toISOString(),
        total: TICKERS.length,
        stale: true,
      });
    }
    return NextResponse.json({ error: 'Error al obtener datos', items: [], total: 0 }, { status: 500 });
  }
}
