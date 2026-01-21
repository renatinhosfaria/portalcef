#!/bin/bash
# =============================================================================
# Optimized Docker Build Script
# Portal Essencia Feliz - Maximum Performance Build
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🚀 Build Otimizado - Portal Essencia Feliz                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if BuildKit is enabled
if [[ "$DOCKER_BUILDKIT" != "1" ]]; then
  echo -e "${YELLOW}⚠️  Habilitando BuildKit para melhor performance...${NC}"
  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1
fi

# Parse arguments
BUILD_MODE=${1:-full}  # full, incremental, or service name
NO_CACHE=${2:-false}

echo -e "${GREEN}📦 Modo de Build: $BUILD_MODE${NC}"
echo ""

# Pre-flight checks
echo "🔍 Verificações pré-build..."

# Check cache size
CACHE_SIZE=$(docker system df 2>/dev/null | grep "Build Cache" | awk '{print $3}' | sed 's/[A-Za-z]//g' || echo "0")
if (( $(echo "$CACHE_SIZE > 10" | bc -l 2>/dev/null || echo "0") )); then
  echo -e "${YELLOW}⚠️  Cache muito grande (${CACHE_SIZE}GB). Recomendado limpar.${NC}"
  echo "   docker builder prune --keep-storage=5GB"
  echo ""
fi

# Check disk space
DISK_AVAILABLE=$(df -h / | awk 'NR==2 {print $4}' | sed 's/G//')
if (( $(echo "$DISK_AVAILABLE < 10" | bc -l 2>/dev/null || echo "0") )); then
  echo -e "${RED}❌ Espaço em disco insuficiente (<10GB disponível)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Verificações concluídas${NC}"
echo ""

# Build based on mode
case $BUILD_MODE in
  full)
    echo "🏗️  Build completo (todos os serviços em paralelo)..."
    START_TIME=$(date +%s)

    if [[ "$NO_CACHE" == "true" ]]; then
      docker compose -f docker-compose.prod.yml build --no-cache --parallel
    else
      docker compose -f docker-compose.prod.yml build --parallel
    fi

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo ""
    echo -e "${GREEN}✅ Build completo em ${DURATION}s${NC}"
    ;;

  incremental)
    echo "🔄 Build incremental (apenas serviços alterados)..."

    # Detect changed services based on git diff
    CHANGED_SERVICES=""

    # Check each app directory
    for app in apps/*/; do
      app_name=$(basename "$app")
      if git diff --quiet HEAD -- "$app" 2>/dev/null; then
        continue
      else
        CHANGED_SERVICES="$CHANGED_SERVICES $app_name"
      fi
    done

    # Check API
    if ! git diff --quiet HEAD -- services/api/ 2>/dev/null; then
      CHANGED_SERVICES="$CHANGED_SERVICES api"
    fi

    if [[ -z "$CHANGED_SERVICES" ]]; then
      echo -e "${YELLOW}ℹ️  Nenhuma alteração detectada. Pulando build.${NC}"
      exit 0
    fi

    echo -e "${GREEN}📦 Serviços alterados:$CHANGED_SERVICES${NC}"
    echo ""

    START_TIME=$(date +%s)
    docker compose -f docker-compose.prod.yml build --parallel $CHANGED_SERVICES
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    echo ""
    echo -e "${GREEN}✅ Build incremental em ${DURATION}s${NC}"
    ;;

  *)
    # Single service build
    echo "🎯 Build do serviço: $BUILD_MODE"

    START_TIME=$(date +%s)
    docker compose -f docker-compose.prod.yml build $BUILD_MODE
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    echo ""
    echo -e "${GREEN}✅ Serviço '$BUILD_MODE' construído em ${DURATION}s${NC}"
    ;;
esac

# Post-build summary
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  📊 Resumo do Build                                               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Show image sizes
echo "🐳 Tamanhos das imagens:"
docker images | grep -E "essencia|REPOSITORY" | head -10
echo ""

# Show cache status
echo "💾 Status do cache:"
docker system df | grep -E "Build Cache|TYPE"
echo ""

# Next steps
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🎯 Próximos Passos                                               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Deploy:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "Ver logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "Health check:"
echo "  ./scripts/health-check.sh"
echo ""
