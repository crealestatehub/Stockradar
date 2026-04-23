import { NextRequest, NextResponse } from 'next/server';
import { searchSymbols } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const results = await searchSymbols(q);
  return NextResponse.json({ results });
}
