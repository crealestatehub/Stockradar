import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ items: [] });
  const raw = await prisma.searchHistory.findMany({
    where: { userId: session.userId },
    orderBy: { searchedAt: 'desc' },
    take: 50
  });
  // Deduplicate – keep only the most recent entry per ticker
  const seen = new Set<string>();
  const items = raw.filter((r: (typeof raw)[number]) => {
    if (seen.has(r.ticker)) return false;
    seen.add(r.ticker);
    return true;
  }).slice(0, 10);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ ok: true }); // silently no-op for guests
  const { ticker } = await req.json();
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  await prisma.searchHistory.create({
    data: { userId: session.userId, ticker: ticker.toUpperCase() }
  });
  return NextResponse.json({ ok: true });
}
