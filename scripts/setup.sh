#!/bin/bash
# StockRadar - Quick setup script
set -e

echo "🚀 StockRadar Setup"
echo "=================="

# Check node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi
echo "✅ Node $(node -v)"

# Install deps
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup .env
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "📝 Created .env.local — edit it with your settings"
else
    echo "ℹ️  .env.local already exists"
fi

# Generate JWT secret hint
echo ""
echo "💡 Generate a JWT secret with:"
echo "   openssl rand -hex 32"
echo ""
echo "🔑 API Keys (optional — app works in Demo mode without them):"
echo "   Finnhub:  https://finnhub.io/register"
echo "   FMP:      https://financialmodelingprep.com/register"
echo ""

# Setup DB
echo "🗄️  Setting up database..."
npx prisma generate
npx prisma db push

echo ""
echo "✅ Setup complete!"
echo "   Run: npm run dev"
echo "   Open: http://localhost:3000"
