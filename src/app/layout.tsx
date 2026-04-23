import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StockRadar — Análisis Técnico Profesional',
  description: 'Plataforma de análisis técnico y fundamental de acciones: soportes, resistencias, pivot points, VWAP, market cap, float y short squeeze scoring.',
  keywords: 'trading, análisis técnico, pivot points, VWAP, short squeeze, acciones, stocks',
  authors: [{ name: 'StockRadar' }],
  themeColor: '#0a0e17',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
