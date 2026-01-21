#!/bin/bash
# =============================================================================
# Docker Build Cache Status Checker
# Portal Essencia Feliz - Cache Monitoring Script
# =============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🚀 Docker Build Cache Status                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if BuildKit is enabled
echo "📦 BuildKit Status:"
if [[ "$DOCKER_BUILDKIT" == "1" ]] || docker version 2>/dev/null | grep -q "buildkit"; then
  echo "✅ BuildKit is ENABLED"
else
  echo "⚠️  BuildKit is DISABLED"
  echo "   Enable it with:"
  echo "   export DOCKER_BUILDKIT=1"
  echo "   export COMPOSE_DOCKER_CLI_BUILD=1"
fi
echo ""

# Check build cache size
echo "💾 Build Cache Size:"
docker system df | grep "Build Cache" || echo "No build cache found"
echo ""

# Check total Docker disk usage
echo "📊 Total Docker Disk Usage:"
docker system df
echo ""

# Check if cache is too large
CACHE_SIZE=$(docker system df -v 2>/dev/null | grep "Build Cache" | awk '{print $3}' | sed 's/GB//' || echo "0")
if (( $(echo "$CACHE_SIZE > 10" | bc -l 2>/dev/null || echo "0") )); then
  echo "⚠️  Warning: Build cache is larger than 10GB"
  echo "   Consider running: docker builder prune --keep-storage=5GB"
  echo ""
fi

# Check if production image exists
echo "🐳 Production Images:"
docker images | grep "essencia" | grep -v "<none>" || echo "No production images found"
echo ""

# Suggest next steps
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  💡 Next Steps                                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Build with cache (incremental):"
echo "  docker compose -f docker-compose.prod.yml build"
echo ""
echo "Build without cache (complete):"
echo "  docker compose -f docker-compose.prod.yml build --no-cache"
echo ""
echo "Clean cache:"
echo "  docker builder prune"
echo ""
echo "For more details, see: docs/DOCKER_CACHE.md"
