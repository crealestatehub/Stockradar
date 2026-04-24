'use client';
import { useEffect, useRef, useState } from 'react';

interface TradeUpdate {
  price: number;
  volume: number;
  timestamp: number;
}

export function useRealtimeQuote(ticker: string) {
  const [trade, setTrade] = useState<TradeUpdate | null>(null);
  const [isLive, setIsLive] = useState(false);
  const wsRef    = useRef<WebSocket | null>(null);
  const tickerRef = useRef(ticker);
  tickerRef.current = ticker;

  useEffect(() => {
    let ws: WebSocket;
    let dead = false;

    async function connect() {
      try {
        const res = await fetch('/api/ws-token');
        const { token } = await res.json();
        if (!token || dead) return;

        ws = new WebSocket(`wss://ws.finnhub.io?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (dead) { ws.close(); return; }
          ws.send(JSON.stringify({ type: 'subscribe', symbol: tickerRef.current }));
          setIsLive(true);
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type !== 'trade' || !msg.data?.length) return;
            // Finnhub batches trades — take the most recent one
            const last = msg.data[msg.data.length - 1];
            setTrade({ price: last.p, volume: last.v, timestamp: last.t });
          } catch {}
        };

        ws.onerror = () => setIsLive(false);
        ws.onclose = () => setIsLive(false);
      } catch {
        setIsLive(false);
      }
    }

    connect();

    return () => {
      dead = true;
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol: tickerRef.current }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsLive(false);
      setTrade(null);
    };
  }, [ticker]); // reconnect on ticker change

  return { trade, isLive };
}
