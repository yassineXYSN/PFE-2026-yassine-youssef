#!/bin/bash
set -e

echo "🚀 Starting NextHire AI"
echo "========================"
echo ""

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ Missing $ENV_FILE — copy .env.example and fill in your values${NC}"
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

APP_DOMAIN="${APP_DOMAIN:-nexthire.itc4d.com}"
API_DOMAIN="${API_DOMAIN:-api-nexthire.itc4d.com}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://$APP_DOMAIN}"

# ── Step 1: MariaDB ────────────────────────────────────────────────────────────
echo -e "${YELLOW}Step 1: Starting MariaDB...${NC}"

docker volume create nexthire-mariadb-data 2>/dev/null && echo "✅ Volume created" || echo "ℹ️  Volume exists"

docker stop nexthire-db 2>/dev/null || true
docker rm   nexthire-db 2>/dev/null || true

docker run -d \
  --name nexthire-db \
  --restart always \
  --network traefik \
  -e MYSQL_ROOT_PASSWORD="$DB_ROOT_PASSWORD" \
  -e MYSQL_USER="$DB_USER" \
  -e MYSQL_PASSWORD="$DB_PASSWORD" \
  -e MYSQL_DATABASE="$DB_NAME" \
  -v nexthire-mariadb-data:/var/lib/mysql \
  -v "$PROJECT_DIR/docs/schema.sql:/docker-entrypoint-initdb.d/schema.sql:ro" \
  --health-cmd="healthcheck.sh --connect --innodb_initialized" \
  --health-interval=10s \
  --health-timeout=5s \
  --health-retries=5 \
  mariadb:11

echo "⏳ Waiting for MariaDB to be healthy..."
ATTEMPT=0
while [ $ATTEMPT -lt 30 ]; do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' nexthire-db 2>/dev/null || echo "starting")
  if [ "$HEALTH" = "healthy" ]; then
    echo "✅ MariaDB is healthy"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  echo "   Waiting... ($ATTEMPT/30)"
  sleep 2
done

if [ $ATTEMPT -eq 30 ]; then
  echo -e "${RED}❌ MariaDB failed to become healthy${NC}"
  exit 1
fi

# ── Step 2: Backend ────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 2: Building NextHire backend...${NC}"

docker build -t nexthire-backend -f "$PROJECT_DIR/backend/Dockerfile" "$PROJECT_DIR"
echo "✅ Backend image built"

docker stop nexthire-backend 2>/dev/null || true
docker rm   nexthire-backend 2>/dev/null || true

docker run -d \
  --name nexthire-backend \
  --restart always \
  --network traefik \
  -e DB_HOST=nexthire-db \
  -e DB_PORT=3306 \
  -e DB_USER="$DB_USER" \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e DB_NAME="$DB_NAME" \
  -e SECRET_KEY="$SECRET_KEY" \
  -e ALLOWED_ORIGINS="$ALLOWED_ORIGINS" \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.nexthire-backend.rule=Host(\`$API_DOMAIN\`)" \
  -l "traefik.http.routers.nexthire-backend.entrypoints=websecure" \
  -l "traefik.http.routers.nexthire-backend.tls.certresolver=letsencrypt" \
  -l "traefik.http.services.nexthire-backend.loadbalancer.server.port=8000" \
  nexthire-backend

echo "✅ Backend started"

# ── Step 3: Frontend ───────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 3: Building NextHire frontend...${NC}"

docker build -t nexthire-frontend \
  --build-arg VITE_API_URL="https://$API_DOMAIN" \
  "$PROJECT_DIR/frontend"

echo "✅ Frontend image built"

docker stop nexthire-frontend 2>/dev/null || true
docker rm   nexthire-frontend 2>/dev/null || true

docker run -d \
  --name nexthire-frontend \
  --restart always \
  --network traefik \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.nexthire-frontend.rule=Host(\`$APP_DOMAIN\`)" \
  -l "traefik.http.routers.nexthire-frontend.entrypoints=websecure" \
  -l "traefik.http.routers.nexthire-frontend.tls.certresolver=letsencrypt" \
  -l "traefik.http.services.nexthire-frontend.loadbalancer.server.port=80" \
  nexthire-frontend

echo "✅ Frontend started"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 NextHire AI is up!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "🌐 URLs:"
echo "   https://$APP_DOMAIN          — App"
echo "   https://$API_DOMAIN          — API"
echo "   https://$API_DOMAIN/docs     — Swagger UI"
echo ""
echo "📝 Logs:"
echo "   docker logs -f nexthire-db"
echo "   docker logs -f nexthire-backend"
echo "   docker logs -f nexthire-frontend"
echo ""
