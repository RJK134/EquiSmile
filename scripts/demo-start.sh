#!/usr/bin/env bash
set -euo pipefail

echo "🐴 EquiSmile — Demo Mode Startup"
echo "================================="
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "📋 Creating .env with demo defaults..."
  cat > .env << 'EOF'
DEMO_MODE=true
POSTGRES_USER=equismile
POSTGRES_PASSWORD=equismile_dev
POSTGRES_DB=equismile
DATABASE_URL=postgresql://equismile:equismile_dev@postgres:5432/equismile
NEXT_PUBLIC_APP_URL=http://localhost
NEXT_PUBLIC_DEFAULT_LOCALE=en
HOME_BASE_LAT=46.4553
HOME_BASE_LNG=6.8561
HOME_BASE_ADDRESS=Blonay, Switzerland
EOF
else
  echo "📋 Using existing .env file"
fi

echo ""
echo "🐳 Building and starting services..."
echo "   This may take 2-3 minutes on first run."
echo ""

docker compose up --build -d

echo ""
echo "⏳ Waiting for database migrations and demo seed..."
# Wait for migrator to complete
timeout=120
while docker compose ps migrator 2>/dev/null | grep -q "running\|Up"; do
  sleep 2
  timeout=$((timeout - 2))
  if [ $timeout -le 0 ]; then
    echo "❌ Migration timed out. Check logs: docker compose logs migrator"
    exit 1
  fi
done

# Check migrator exit code
if ! docker compose ps migrator 2>/dev/null | grep -q "Exited (0)"; then
  echo "❌ Migration failed. Check logs: docker compose logs migrator"
  exit 1
fi

echo ""
echo "⏳ Waiting for app to be ready..."
timeout=90
until wget -q --spider http://localhost/api/health 2>/dev/null || curl -sf http://localhost/api/health > /dev/null 2>&1; do
  sleep 3
  timeout=$((timeout - 3))
  if [ $timeout -le 0 ]; then
    echo "⚠️  App may still be starting. Check: docker compose logs app"
    break
  fi
done

echo ""
echo "✅ EquiSmile is ready!"
echo ""
echo "   🌐 App:           http://localhost"
echo "   🎮 Demo Panel:    http://localhost/en/demo"
echo "   🇫🇷 French:        http://localhost/fr"
echo "   ⚙️  n8n:           http://localhost:5678"
echo ""
echo "   Demo data: 8 customers, 20 horses, 12 enquiries"
echo "   Use the Demo Panel to simulate WhatsApp/Email workflows"
echo ""
echo "   To stop: docker compose down"
echo "   To reset: docker compose down -v && ./scripts/demo-start.sh"
