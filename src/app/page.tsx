'use client';
import { useEffect, useRef, useState } from 'react';
import { BarChart2, User, LogOut, LogIn, AlertCircle, X, Star } from 'lucide-react';
import { useStore } from '@/lib/store';
import SearchBar from '@/components/SearchBar';
import CandleChart from '@/components/CandleChart';
import QuoteBar from '@/components/QuoteBar';
import FundamentalsPanel from '@/components/FundamentalsPanel';
import IndicatorPanel from '@/components/IndicatorPanel';
import WatchlistSidebar from '@/components/WatchlistSidebar';
import AuthModal from '@/components/AuthModal';
import AnalysisHistory from '@/components/AnalysisHistory';

interface FundSnapshot {
  fundamentals: any; metrics: any; squeeze: any; quote?: any;
}

export default function Dashboard() {
  const { user, setUser, setAuthModal, authModal, ticker, sidebarOpen, setSidebarOpen } = useStore();
  const [fundSnapshot, setFundSnapshot] = useState<FundSnapshot | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertCond, setAlertCond] = useState('above');
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Check demo mode
  useEffect(() => {
    fetch('/api/stock/quote?symbol=AAPL')
      .then(r => r.json())
      .then(d => {
        // If price is a "round" seeded number, we're likely in demo
        setIsDemoMode(false);
      }).catch(() => {});
    // Simple heuristic: check for demo by checking the header
    fetch('/api/stock/search?q=AAPL').then(r => {
      setIsDemoMode(!process.env.NEXT_PUBLIC_HAS_API_KEY);
    });
  }, []);

  // Load session on mount
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user);
    }).catch(() => {});
  }, [setUser]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const saveAnalysis = async () => {
    if (!user || !fundSnapshot) return;
    const { fundamentals: f, metrics: m, squeeze: sq, quote: q } = fundSnapshot;
    const price = q?.current ?? 0;
    const body = {
      ticker, price,
      marketCap: f.marketCap,
      float: f.float,
      shortInterest: f.shortInterestPct,
      daysToCover: f.daysToCover,
      relativeVolume: m.relativeVolume,
      squeezeScore: sq.score,
      squeezeAnalysis: sq.analysis
    };
    const res = await fetch('/api/analysis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      setSaveMsg('✓ Análisis guardado');
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const sendAlert = async () => {
    if (!user || !alertPrice) return;
    await fetch('/api/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker })
    });
    setSaveMsg(`✓ Alerta configurada en $${alertPrice}`);
    setTimeout(() => setSaveMsg(''), 3000);
    setAlertOpen(false);
    setAlertPrice('');
    // Browser notification
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          new Notification(`Alerta en ${ticker}`, {
            body: `Te avisaremos cuando ${ticker} ${alertCond === 'above' ? 'supere' : 'caiga por debajo de'} $${alertPrice}`,
            icon: '/favicon.ico'
          });
        }
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] overflow-hidden">
      {/* ─── TOPBAR ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 h-12 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <BarChart2 size={18} className="text-blue-400" />
          <span className="font-display font-bold text-sm text-[var(--text)] hidden sm:block tracking-tight">
            Stock<span className="text-blue-400">Radar</span>
          </span>
        </div>

        <div className="w-px h-5 bg-[var(--border)] flex-shrink-0" />

        {/* Ticker badge */}
        <span className="font-mono font-bold text-sm text-[var(--text)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--border)] flex-shrink-0 hidden sm:inline">
          {ticker}
        </span>

        {/* Mobile watchlist toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-amber-500/30 hover:bg-amber-500/10 transition-colors flex-shrink-0"
          title="Watchlist"
        >
          <Star size={13} className={sidebarOpen ? 'text-amber-400' : 'text-[var(--text-muted)]'} />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-sm">
          <SearchBar />
        </div>

        {/* Demo badge */}
        {isDemoMode && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30">
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">Modo Demo</span>
          </div>
        )}

        {saveMsg && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/30 text-xs text-green-400 font-mono animate-fade-in">
            {saveMsg}
          </div>
        )}

        {/* Alert button */}
        <button
          onClick={() => setAlertOpen(!alertOpen)}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all text-xs"
        >
          <AlertCircle size={12} />
          <span className="hidden md:block">Alerta</span>
        </button>

        {/* User */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                <User size={11} className="text-blue-400" />
              </div>
              <span className="hidden md:block text-xs text-[var(--text-muted)] max-w-[100px] truncate">{user.email}</span>
              <button onClick={logout} title="Cerrar sesión"
                className="text-[var(--text-dim)] hover:text-red-400 transition-colors ml-0.5">
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => setAuthModal('login')}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors">
              <LogIn size={12} /> Entrar
            </button>
          )}
        </div>
      </header>

      {/* ─── ALERT DROPDOWN ─────────────────────────────────────── */}
      {alertOpen && (
        <div className="absolute top-12 right-4 z-40 w-64 card shadow-2xl border-[var(--border-strong)] p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--text)]">Configurar alerta · {ticker}</span>
            <button onClick={() => setAlertOpen(false)} className="text-[var(--text-dim)] hover:text-[var(--text)]"><X size={14} /></button>
          </div>
          <div className="space-y-2">
            <select value={alertCond} onChange={e => setAlertCond(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-xs text-[var(--text)] outline-none">
              <option value="above">Precio sube por encima de</option>
              <option value="below">Precio cae por debajo de</option>
            </select>
            <input value={alertPrice} onChange={e => setAlertPrice(e.target.value)}
              type="number" step="0.01" placeholder="Precio objetivo ej. 185.50"
              className="w-full h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-xs text-[var(--text)] outline-none focus:border-blue-500 font-mono" />
            {!user && <p className="text-[10px] text-amber-400">Inicia sesión para guardar alertas</p>}
            <button onClick={user ? sendAlert : () => { setAlertOpen(false); setAuthModal('login'); }}
              className="w-full h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors">
              {user ? 'Activar alerta' : 'Iniciar sesión'}
            </button>
          </div>
        </div>
      )}

      {/* ─── MAIN AREA ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Watchlist Sidebar */}
        <WatchlistSidebar />

        {/* Center: chart + quote + panels */}
        <main className="flex-1 flex flex-col overflow-auto">
          <div className="flex-1 p-3 space-y-3 min-w-0">
            {/* Quote bar */}
            <div className="card px-4 py-3">
              <QuoteBar onSaveAnalysis={user ? saveAnalysis : undefined} />
            </div>

            {/* Candlestick chart */}
            <CandleChart />

            {/* Analysis history (collapsible) */}
            <AnalysisHistory />

            {/* Fundamentals + Indicators below chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <FundamentalsPanel onSave={setFundSnapshot} />
              <IndicatorPanel />
            </div>

            {/* Disclaimer */}
            <div className="text-[10px] text-[var(--text-dim)] text-center leading-relaxed pb-2">
              ⚠️ <strong>Disclaimer:</strong> StockRadar es una herramienta informativa. No constituye asesoría financiera ni recomendación de inversión.
              Los datos pueden tener retraso. Invierte bajo tu propio riesgo.
            </div>
          </div>
        </main>
      </div>

      {/* Auth modal */}
      <AuthModal />
    </div>
  );
}
