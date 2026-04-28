'use client';
import { useEffect, useState } from 'react';
import { Newspaper, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react';
import { useStore } from '@/lib/store';

interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  thumbnail: string | null;
}

function timeAgo(ts: number) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NewsPanel() {
  const { ticker } = useStore();
  const [open, setOpen] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/news?symbol=${ticker}`);
      const data = await res.json();
      setNews(data.news ?? []);
      setCachedAt(data.cachedAt ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchNews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, open]);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-[var(--text-muted)]" />
          <span className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)]">
            Noticias · {ticker}
          </span>
          {news.length > 0 && (
            <span className="text-[10px] font-mono text-[var(--text-dim)]">· {news.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); fetchNews(); }}
              className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-surface)] transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </span>
          )}
          {open
            ? <ChevronUp size={14} className="text-[var(--text-dim)]" />
            : <ChevronDown size={14} className="text-[var(--text-dim)]" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border)]">
          {loading && news.length === 0 ? (
            <div className="h-32 flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--text-dim)] font-mono">Cargando noticias…</span>
            </div>
          ) : news.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-xs text-[var(--text-dim)]">
              Sin noticias disponibles
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]/50">
              {news.map(item => (
                <a
                  key={item.uuid}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors group"
                >
                  {/* Thumbnail */}
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-14 h-10 object-cover rounded flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-14 h-10 rounded flex-shrink-0 bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">
                      <Newspaper size={14} className="text-[var(--text-dim)]" />
                    </div>
                  )}

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text)] leading-snug line-clamp-2 group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-mono text-[var(--text-dim)]">{item.publisher}</span>
                      <span className="text-[10px] text-[var(--text-dim)] opacity-50">·</span>
                      <span className="text-[10px] font-mono text-[var(--text-dim)]">{timeAgo(item.publishedAt)}</span>
                    </div>
                  </div>

                  <ExternalLink size={11} className="flex-shrink-0 text-[var(--text-dim)] opacity-0 group-hover:opacity-60 transition-opacity mt-0.5" />
                </a>
              ))}
            </div>
          )}

          {cachedAt && (
            <div className="px-4 py-1.5 border-t border-[var(--border)]/40 flex justify-end">
              <span className="text-[10px] font-mono text-[var(--text-dim)]">
                {new Date(cachedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
