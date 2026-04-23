import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ticker = req.nextUrl.searchParams.get('ticker');
  const analyses = await prisma.savedAnalysis.findMany({
    where: { userId: session.userId, ...(ticker ? { ticker: ticker.toUpperCase() } : {}) },
    orderBy: { capturedAt: 'desc' },
    take: 50
  });
  return NextResponse.json({ analyses });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { ticker, price, marketCap, float, shortInterest, daysToCover,
          relativeVolume, vwap, supports, resistances, pivotPoints,
          squeezeScore, squeezeAnalysis, notes } = body;
  if (!ticker || !price) return NextResponse.json({ error: 'ticker y price requeridos' }, { status: 400 });
  const analysis = await prisma.savedAnalysis.create({
    data: {
      userId: session.userId,
      ticker: ticker.toUpperCase(),
      price, marketCap, float, shortInterest, daysToCover,
      relativeVolume, vwap, supports, resistances, pivotPoints,
      squeezeScore, squeezeAnalysis, notes
    }
  });
  return NextResponse.json({ analysis });
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.savedAnalysis.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
