#!/bin/bash

echo "🛑 Stopping NextHire AI"
echo "========================"

docker stop nexthire-frontend nexthire-backend nexthire-db 2>/dev/null || true
docker rm   nexthire-frontend nexthire-backend nexthire-db 2>/dev/null || true

echo ""
echo "✅ NextHire AI stopped"
echo "⚠️  Data volume preserved. To delete: docker volume rm nexthire-pgdata"
echo ""
