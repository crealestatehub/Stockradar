# 📈 StockRadar

Plataforma web de análisis técnico y fundamental de acciones, orientada a day traders y swing traders. Dark mode terminal style, análisis en tiempo real con datos guardados en PostgreSQL.

![Demo](https://img.shields.io/badge/Status-Production%20Ready-00d97e?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Railway-336791?style=flat-square&logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)

## ✨ Características

- **Gráfico de velas interactivo** (lightweight-charts) con timeframes: 1m, 5m, 15m, 1H, 1D, 1W
- **Pivot Points** — Clásico, Fibonacci y Camarilla (diario, semanal, mensual)
- **VWAP** con bandas de desviación estándar ±1σ y ±2σ
- **Soportes y resistencias** calculados automáticamente por pivot-high/low clustering
- **EMAs** 9 / 20 / 50 / 200 · **RSI 14** · **MACD (12,26,9)**
- **Panel fundamental**: Market Cap, Float, Shares Outstanding, Short Interest %, Days to Cover, RVOL, rango 52 semanas
- **Short Squeeze Score (0–100)** con semáforo verde/ámbar/rojo y análisis textual
- **Watchlist** personalizable guardada en PostgreSQL
- **Historial de análisis** — guarda snapshots de cualquier acción para revisarlos después
- **Alertas de precio** con notificaciones push del navegador
- **Autenticación JWT** (login / registro)
- **Modo Demo** — funciona sin API keys con datos sintéticos

---

## 🚀 Setup local

### 1. Clonar y instalar

```bash
git clone https://github.com/TU_USUARIO/stock-analyzer.git
cd stock-analyzer
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/stockradar"
JWT_SECRET="genera-con-openssl-rand-hex-32"

# Opcional — sin estas keys la app corre en Modo Demo
FINNHUB_API_KEY="tu_key_de_finnhub"
FMP_API_KEY="tu_key_de_fmp"
```

#### Obtener API Keys gratuitas

| Proveedor | URL | Límites gratuitos |
|-----------|-----|-------------------|
| Finnhub | https://finnhub.io/register | 60 req/min · datos con 15 min delay |
| Financial Modeling Prep | https://financialmodelingprep.com/register | 250 req/día · float + fundamentales |

> **Tip:** La app funciona sin API keys en **Modo Demo** con datos sintéticos. Perfecta para explorar la interfaz.

### 3. Base de datos

Con PostgreSQL local:
```bash
# Crear DB
createdb stockradar

# Aplicar schema
npx prisma db push

# Opcional: abrir Prisma Studio
npx prisma studio
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
# → http://localhost:3000
```

---

## 🚂 Deploy en Railway (recomendado)

### Paso 1 — Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit — StockRadar"
git remote add origin https://github.com/TU_USUARIO/stock-analyzer.git
git push -u origin main
```

### Paso 2 — Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app) y crea una cuenta.
2. Click **"New Project"** → **"Deploy from GitHub repo"** → selecciona tu repo.
3. Railway detecta automáticamente el `Dockerfile`.

### Paso 3 — Agregar PostgreSQL

En tu proyecto de Railway:
1. Click **"New Service"** → **"PostgreSQL"**.
2. Railway genera automáticamente la variable `DATABASE_URL` y la comparte con tu servicio web. ✅

### Paso 4 — Variables de entorno en Railway

En tu servicio web → tab **Variables**, agrega:

```
JWT_SECRET          = (genera con: openssl rand -hex 32)
FINNHUB_API_KEY     = (opcional, de finnhub.io)
FMP_API_KEY         = (opcional, de financialmodelingprep.com)
```

> `DATABASE_URL` ya está configurada automáticamente por Railway.

### Paso 5 — Deploy

Railway hace el build automáticamente al hacer push a `main`. El `docker-entrypoint.sh` corre `prisma migrate deploy` antes de iniciar, así las migraciones de BD son automáticas.

### Paso 6 — Dominio

En Railway → Settings → Domains → **Generate Domain**. Obtienes una URL tipo `stock-radar-production.up.railway.app`.

---

## 📁 Estructura del proyecto

```
stock-analyzer/
├── prisma/
│   └── schema.prisma          # Modelos: User, Watchlist, SearchHistory, Alert, SavedAnalysis
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # login, register, logout, me
│   │   │   ├── stock/         # quote, search, candles, fundamentals
│   │   │   ├── watchlist/     # CRUD watchlist
│   │   │   ├── history/       # historial de búsquedas
│   │   │   ├── analysis/      # análisis guardados (CRUD)
│   │   │   └── health/        # health check para Railway
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx           # Dashboard principal
│   ├── components/
│   │   ├── SearchBar.tsx      # Búsqueda con autocompletado
│   │   ├── CandleChart.tsx    # Gráfico de velas + indicadores
│   │   ├── QuoteBar.tsx       # Cotización en tiempo real
│   │   ├── FundamentalsPanel.tsx  # Market cap, float, squeeze score
│   │   ├── IndicatorPanel.tsx # Toggle indicadores
│   │   ├── WatchlistSidebar.tsx
│   │   ├── AuthModal.tsx
│   │   └── AnalysisHistory.tsx
│   └── lib/
│       ├── indicators.ts      # Todos los cálculos técnicos
│       ├── market.ts          # Cliente Finnhub + FMP + demo fallback
│       ├── auth.ts            # JWT + bcrypt
│       ├── prisma.ts          # Prisma client singleton
│       └── store.ts           # Estado global (Zustand)
├── Dockerfile
├── docker-entrypoint.sh
├── railway.toml
└── .env.example
```

---

## 🧮 Fórmulas técnicas implementadas

### Pivot Points — Clásico
```
PP = (High + Low + Close) / 3
R1 = 2·PP − Low       S1 = 2·PP − High
R2 = PP + (High−Low)  S2 = PP − (High−Low)
R3 = High + 2·(PP−Low) S3 = Low − 2·(High−PP)
```

### Pivot Points — Fibonacci
```
PP = (H + L + C) / 3
R1 = PP + 0.382·(H−L)  S1 = PP − 0.382·(H−L)
R2 = PP + 0.618·(H−L)  S2 = PP − 0.618·(H−L)
R3 = PP + 1.000·(H−L)  S3 = PP − 1.000·(H−L)
```

### Pivot Points — Camarilla
```
PP = (H + L + C) / 3
R1 = C + (H−L)·1.1/12   S1 = C − (H−L)·1.1/12
R2 = C + (H−L)·1.1/6    S2 = C − (H−L)·1.1/6
R3 = C + (H−L)·1.1/4    S3 = C − (H−L)·1.1/4
```

### VWAP con bandas
```
TP_i = (High_i + Low_i + Close_i) / 3
VWAP = Σ(TP_i · Vol_i) / Σ(Vol_i)
σ    = √[ Σ(TP_i − VWAP)² · Vol_i / Σ(Vol_i) ]
Upper1 = VWAP + 1σ   Lower1 = VWAP − 1σ
Upper2 = VWAP + 2σ   Lower2 = VWAP − 2σ
```

### Short Squeeze Score (0–100)
| Factor | Peso | Condición máxima |
|--------|------|------------------|
| Float bajo | 25 pts | < 5M acciones |
| Short Interest | 30 pts | > 40% del float |
| Days to Cover | 20 pts | > 7 días |
| RVOL | 15 pts | > 5x promedio |
| Momentum 5D | 10 pts | > 20% en 5 días |

**Score ≥ 60** → 🟢 Alto potencial de squeeze  
**Score 35–59** → 🟡 Potencial moderado  
**Score < 35** → 🔴 Potencial bajo

---

## 🛠️ Comandos útiles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build
npm start

# Base de datos
npx prisma studio          # GUI visual de la BD
npx prisma db push         # Aplicar schema sin migraciones
npx prisma migrate dev     # Crear migración en desarrollo
npx prisma migrate deploy  # Aplicar migraciones en producción

# Docker local
docker build -t stockradar .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="secret" \
  stockradar
```

---

## ⚠️ Disclaimer

StockRadar es una herramienta **estrictamente informativa**. Los datos, análisis, indicadores y el Short Squeeze Score **no constituyen asesoría financiera, recomendación de compra o venta, ni consejo de inversión** de ningún tipo. Los datos de mercado pueden tener retraso. Opera bajo tu propio riesgo y criterio. El autor no se hace responsable de pérdidas derivadas del uso de esta herramienta.

---

## 📜 Licencia

MIT — libre de usar, modificar y distribuir.
