import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  const quote = await getQuote(symbol.toUpperCase());
  if (!quote) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ quote });
}
