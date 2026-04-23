'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Resolution = '1' | '5' | '15' | '60' | 'D' | 'W';
export type PivotType = 'classic' | 'fibonacci' | 'camarilla';

export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  name?: string | null;
}

interface Indicators {
  showEMA9: boolean;
  showEMA20: boolean;
  showEMA50: boolean;
  showEMA200: boolean;
  showRSI: boolean;
  showMACD: boolean;
  showVWAP: boolean;
  showPivots: boolean;
  showSR: boolean;
}

interface AppState {
  // Auth
  user: User | null;
  setUser: (u: User | null) => void;

  // Selected ticker
  ticker: string;
  setTicker: (t: string) => void;

  // Chart settings
  resolution: Resolution;
  setResolution: (r: Resolution) => void;
  pivotType: PivotType;
  setPivotType: (p: PivotType) => void;
  indicators: Indicators;
  toggleIndicator: (key: keyof Indicators) => void;

  // Watchlist
  watchlist: WatchlistItem[];
  setWatchlist: (items: WatchlistItem[]) => void;
  addToWatchlist: (item: WatchlistItem) => void;
  removeFromWatchlist: (ticker: string) => void;

  // Recent tickers (local fallback if not authed)
  recentTickers: string[];
  addRecentTicker: (t: string) => void;

  // UI
  authModal: 'login' | 'register' | null;
  setAuthModal: (m: 'login' | 'register' | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),

      ticker: 'AAPL',
      setTicker: (ticker) => {
        set({ ticker });
        get().addRecentTicker(ticker);
      },

      resolution: 'D',
      setResolution: (resolution) => set({ resolution }),
      pivotType: 'classic',
      setPivotType: (pivotType) => set({ pivotType }),
      indicators: {
        showEMA9: false,
        showEMA20: true,
        showEMA50: true,
        showEMA200: false,
        showRSI: false,
        showMACD: false,
        showVWAP: true,
        showPivots: true,
        showSR: true
      },
      toggleIndicator: (key) =>
        set((s) => ({ indicators: { ...s.indicators, [key]: !s.indicators[key] } })),

      watchlist: [],
      setWatchlist: (watchlist) => set({ watchlist }),
      addToWatchlist: (item) =>
        set((s) => ({
          watchlist: s.watchlist.find((w) => w.ticker === item.ticker)
            ? s.watchlist
            : [item, ...s.watchlist]
        })),
      removeFromWatchlist: (ticker) =>
        set((s) => ({ watchlist: s.watchlist.filter((w) => w.ticker !== ticker) })),

      recentTickers: ['AAPL', 'TSLA', 'NVDA'],
      addRecentTicker: (t) =>
        set((s) => ({
          recentTickers: [t, ...s.recentTickers.filter((x) => x !== t)].slice(0, 10)
        })),

      authModal: null,
      setAuthModal: (authModal) => set({ authModal }),
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen })
    }),
    {
      name: 'stockradar-store',
      partialize: (s) => ({
        resolution: s.resolution,
        pivotType: s.pivotType,
        indicators: s.indicators,
        recentTickers: s.recentTickers,
        sidebarOpen: s.sidebarOpen
      })
    }
  )
);
