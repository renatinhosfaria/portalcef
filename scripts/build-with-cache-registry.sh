#!/bin/bash
# =============================================================================
# Docker Build with Remote Cache Registry
# Portal Essencia Feliz - Maximum Cache Efficiency
# =============================================================================
# This script uses a local Docker registry to cache build layers between builds.
# This can reduce build times by 50-70% on subsequent builds.
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REGISTRY_HOST=${REGISTRY_HOST:-localhost:5000}
IMAGE_NAME="essencia-monorepo"
CACHE_IMAGE="$REGISTRY_HOST/$IMAGE_NAME:buildcache"

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🚀 Build com Cache Remoto - Portal Essencia Feliz               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check if registry is running
echo "🔍 Verificando registry local..."
if ! curl -s http://$REGISTRY_HOST/v2/ > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Registry local não encontrado. Iniciando...${NC}"

  docker run -d \
    -p 5000:5000 \
    --restart=always \
    --name registry \
    -v registry_data:/var/lib/registry \
    registry:2

  # Wait for registry to be ready
  echo "⏳ Aguardando registry inicializar..."
  sleep 5

  echo -e "${GREEN}✅ Registry local iniciado em $REGISTRY_HOST${NC}"
else
  echo -e "${GREEN}✅ Registry local já está rodando${NC}"
fi
echo ""

# Step 2: Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "🏗️  BuildKit habilitado"
echo ""

# Step 3: Pull existing cache (if available)
echo "📥 Tentando buscar cache existente..."
if docker pull $CACHE_IMAGE 2>/dev/null; then
  echo -e "${GREEN}✅ Cache remoto encontrado e baixado${NC}"
else
  echo -e "${YELLOW}ℹ️  Nenhum cache remoto disponível (primeira build)${NC}"
fi
echo ""

# Step 4: Build with cache
echo "🏗️  Construindo imagem com cache remoto..."
echo -e "${BLUE}Cache: $CACHE_IMAGE${NC}"
echo ""

START_TIME=$(date +%s)

# Build using buildx for better cache support
docker buildx build \
  --file Dockerfile.prod \
  --target production \
  --tag essencia-prod:latest \
  --cache-from=$CACHE_IMAGE \
  --cache-to=type=registry,ref=$CACHE_IMAGE,mode=max \
  --load \
  .

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}✅ Build concluída em ${DURATION}s${NC}"
echo ""

# Step 5: Tag services for docker-compose
echo "🏷️  Criando tags para serviços..."

# All services use the same base image
docker tag essencia-prod:latest essencia-home:latest
docker tag essencia-prod:latest essencia-login:latest
docker tag essencia-prod:latest essencia-usuarios:latest
docker tag essencia-prod:latest essencia-escolas:latest
docker tag essencia-prod:latest essencia-turmas:latest
docker tag essencia-prod:latest essencia-planejamento:latest
docker tag essencia-prod:latest essencia-loja:latest
docker tag essencia-prod:latest essencia-loja-admin:latest
docker tag essencia-prod:latest essencia-calendario:latest
docker tag essencia-prod:latest essencia-api:latest

echo -e "${GREEN}✅ Tags criadas para todos os serviços${NC}"
echo ""

# Step 6: Summary
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  📊 Resumo                                                        ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "⏱️  Tempo de build: ${DURATION}s"
echo "🎯 Cache registry: $CACHE_IMAGE"
echo "💾 Imagem final: essencia-prod:latest"
echo ""
echo "🎁 Benefícios:"
echo "   • Cache persistente entre builds"
echo "   • Compartilhamento de camadas entre serviços"
echo "   • Builds incrementais muito mais rápidos"
echo ""

# Next steps
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🎯 Próximos Passos                                               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Deploy:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "Verificar cache:"
echo "  curl http://$REGISTRY_HOST/v2/$IMAGE_NAME/tags/list"
echo ""
echo "Limpar cache:"
echo "  docker exec registry bin/registry garbage-collect /etc/docker/registry/config.yml"
echo ""
