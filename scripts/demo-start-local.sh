#!/usr/bin/env bash
set -euo pipefail

echo "🐴 EquiSmile — Local Demo Mode"
echo "==============================="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required."; exit 1; }

# Start postgres
echo "🐳 Starting PostgreSQL..."
docker compose up -d postgres
sleep 5

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🗄️  Running database migrations..."
DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile npx prisma migrate deploy

# Seed demo data
echo "🌱 Seeding demo data..."
DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile npx tsx prisma/seed-demo.ts

# Start dev server
echo ""
echo "✅ Starting EquiSmile in demo mode..."
echo ""
echo "   🌐 App:           http://localhost:3000"
echo "   🎮 Demo Panel:    http://localhost:3000/en/demo"
echo "   🇫🇷 French:        http://localhost:3000/fr"
echo ""

DEMO_MODE=true DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile npm run dev
