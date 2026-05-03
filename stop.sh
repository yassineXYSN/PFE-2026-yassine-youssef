#!/bin/bash

echo "🛑 Stopping NextHire AI"
echo "========================"

docker stop nexthire-backend nexthire-frontend 2>/dev/null || true
docker rm   nexthire-backend nexthire-frontend 2>/dev/null || true

echo ""
echo "✅ NextHire AI stopped"
echo ""
