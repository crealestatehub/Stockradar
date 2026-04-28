import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  thumbnail: string | null;
}

const cache = new Map<string, { data: NewsItem[]; ts: number }>();
const TTL = 5 * 60 * 1000; // 5 min

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase();
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json({ news: hit.data, cachedAt: new Date(hit.ts).toISOString() });
  }

  try {
    const { data } = await axios.get('https://query2.finance.yahoo.com/v1/finance/search', {
      params: { q: symbol, quotesCount: 0, newsCount: 10, enableFuzzyQuery: false, lang: 'en-US' },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });

    const raw: any[] = data?.news ?? [];
    const news: NewsItem[] = raw.map(n => ({
      uuid: n.uuid,
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      publishedAt: n.providerPublishTime,
      thumbnail: n.thumbnail?.resolutions?.[0]?.url ?? null,
    }));

    cache.set(symbol, { data: news, ts: Date.now() });
    return NextResponse.json({ news, cachedAt: new Date().toISOString() });
  } catch {
    const stale = cache.get(symbol);
    if (stale) return NextResponse.json({ news: stale.data, cachedAt: new Date(stale.ts).toISOString(), stale: true });
    return NextResponse.json({ news: [], error: 'failed to fetch news' }, { status: 500 });
  }
}
