'use client';
import { useEffect, useState } from 'react';
import { History, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/lib/store';

interface Analysis {
  id: string; ticker: string; price: number; marketCap?: number | null;
  float?: number | null; shortInterest?: number | null; squeezeScore?: number | null;
  squeezeAnalysis?: string | null; notes?: string | null; capturedAt: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });

export default function AnalysisHistory() {
  const { user, ticker, setTicker } = useStore();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const res = await fetch('/api/analysis');
    const data = await res.json();
    setAnalyses(data.analyses || []);
    setLoading(false);
  };

  useEffect(() => { if (open && user) load(); }, [open, user]);

  const remove = async (id: string) => {
    await fetch(`/api/analysis?id=${id}`, { method: 'DELETE' });
    setAnalyses(a => a.filter(x => x.id !== id));
  };

  if (!user) return null;

  return (
    <div className="card">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors rounded-[10px]">
        <div className="flex items-center gap-2">
          <History size={14} className="text-[var(--text-muted)]" />
          <span className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)]">
            Análisis guardados {analyses.length > 0 && `(${analyses.length})`}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-[var(--text-dim)]" /> : <ChevronDown size={14} className="text-[var(--text-dim)]" />}
      </button>

      {open && (
        <div className="border-t border-[var(--border)] max-h-80 overflow-y-auto">
          {loading && <div className="p-4 text-center text-xs text-[var(--text-dim)]">Cargando...</div>}
          {!loading && analyses.length === 0 && (
            <div className="p-4 text-center text-xs text-[var(--text-dim)]">
              Aún no tienes análisis guardados.<br />Usa el botón "Guardar análisis" en cualquier ticker.
            </div>
          )}
          {analyses.map(a => (
            <div key={a.id} className="border-b border-[var(--border)]/50 last:border-0">
              <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--bg-hover)] cursor-pointer"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                <button onClick={(e) => { e.stopPropagation(); setTicker(a.ticker); }}
                  className="font-mono text-sm font-bold text-blue-400 hover:underline w-14 text-left flex-shrink-0">
                  {a.ticker}
                </button>
                <span className="font-mono text-xs text-[var(--text)]">${a.price.toFixed(2)}</span>
                {a.squeezeScore != null && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                    a.squeezeScore >= 60 ? 'bg-green-500/15 text-green-400' :
                    a.squeezeScore >= 35 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
                  }`}>
                    Score {a.squeezeScore}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-[var(--text-dim)] font-mono flex-shrink-0">{fmtDate(a.capturedAt)}</span>
                <button onClick={(e) => { e.stopPropagation(); remove(a.id); }}
                  className="text-[var(--text-dim)] hover:text-red-400 transition-colors ml-1">
                  <Trash2 size={11} />
                </button>
              </div>
              {expanded === a.id && (
                <div className="px-4 pb-3 text-xs text-[var(--text-muted)] space-y-1 bg-[var(--bg-surface)]">
                  {a.marketCap != null && <div>Market Cap: <span className="text-[var(--text)] font-mono">${(a.marketCap / 1e9).toFixed(2)}B</span></div>}
                  {a.float != null && <div>Float: <span className="text-[var(--text)] font-mono">{(a.float / 1e6).toFixed(2)}M</span></div>}
                  {a.shortInterest != null && <div>Short Interest: <span className="text-[var(--text)] font-mono">{a.shortInterest.toFixed(1)}%</span></div>}
                  {a.squeezeAnalysis && <div className="mt-1 leading-relaxed italic">{a.squeezeAnalysis}</div>}
                  {a.notes && <div className="mt-1 p-2 bg-[var(--bg-elevated)] rounded border border-[var(--border)]">{a.notes}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
