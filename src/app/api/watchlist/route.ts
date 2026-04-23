import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await prisma.watchlist.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ticker, name, notes } = await req.json();
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  const item = await prisma.watchlist.upsert({
    where: { userId_ticker: { userId: session.userId, ticker: ticker.toUpperCase() } },
    update: { name, notes },
    create: { userId: session.userId, ticker: ticker.toUpperCase(), name, notes }
  });
  // Record in history
  await prisma.searchHistory.create({
    data: { userId: session.userId, ticker: ticker.toUpperCase() }
  });
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  await prisma.watchlist.deleteMany({
    where: { userId: session.userId, ticker }
  });
  return NextResponse.json({ ok: true });
}
