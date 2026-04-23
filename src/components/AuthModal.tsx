'use client';
import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function AuthModal() {
  const { authModal, setAuthModal, setUser } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>(authModal || 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!authModal) return null;

  const submit = async () => {
    setError('');
    if (!email || !password) { setError('Email y contraseña requeridos'); return; }
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'register' ? { email, password, name } : { email, password };
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error'); return; }
      setUser(data.user);
      setAuthModal(null);
    } catch { setError('Error de red'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) setAuthModal(null); }}>
      <div className="card w-full max-w-sm mx-4 p-6 animate-slide-up shadow-2xl border-[var(--border-strong)]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-[var(--text)]">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>
          <button onClick={() => setAuthModal(null)} className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-mono">Nombre (opcional)</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text)] outline-none focus:border-blue-500 transition-colors" />
            </div>
          )}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-mono">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              type="email" placeholder="trader@email.com"
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text)] outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-mono">Contraseña</label>
            <div className="relative">
              <input value={password} onChange={e => setPassword(e.target.value)}
                type={showPwd ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full h-9 px-3 pr-9 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text)] outline-none focus:border-blue-500 transition-colors" />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)]">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">{error}</div>
          )}

          <button onClick={submit} disabled={loading}
            className="w-full h-9 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors mt-1">
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          {mode === 'login' ? '¿Sin cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-blue-400 hover:underline font-medium">
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}
