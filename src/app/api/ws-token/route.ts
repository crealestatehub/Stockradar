import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Returns the Finnhub key so the client can open a WebSocket directly.
// This is intentional — Finnhub free keys are rate-limited per IP anyway.
export async function GET() {
  return NextResponse.json({ token: process.env.FINNHUB_API_KEY || '' });
}
