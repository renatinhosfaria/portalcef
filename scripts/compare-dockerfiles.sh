#!/bin/bash
# =============================================================================
# Compare Dockerfile Versions
# Portal Essencia Feliz - Performance Comparison
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🔬 Comparação de Dockerfiles - Portal Essencia Feliz           ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if optimized version exists
if [ ! -f "Dockerfile.prod.optimized" ]; then
  echo -e "${RED}❌ Dockerfile.prod.optimized não encontrado${NC}"
  exit 1
fi

# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Confirmation
echo -e "${YELLOW}⚠️  Este script irá:${NC}"
echo "   1. Fazer build com Dockerfile.prod (atual)"
echo "   2. Fazer build com Dockerfile.prod.optimized (otimizado)"
echo "   3. Comparar tempos e tamanhos"
echo "   4. Levar aproximadamente 15-20 minutos"
echo ""
read -p "Deseja continuar? (s/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "Comparação cancelada."
  exit 0
fi
echo ""

# Cleanup function
cleanup() {
  echo "🧹 Limpando builds anteriores..."
  docker rmi essencia:original essencia:optimized 2>/dev/null || true
  docker builder prune -af > /dev/null 2>&1 || true
  echo ""
}

# Format time
format_time() {
  local seconds=$1
  local minutes=$((seconds / 60))
  local remaining_seconds=$((seconds % 60))

  if [ $minutes -gt 0 ]; then
    echo "${minutes}m ${remaining_seconds}s"
  else
    echo "${seconds}s"
  fi
}

# Format size
format_size() {
  local size=$1
  if [[ $size == *"GB"* ]]; then
    echo "$size"
  elif [[ $size == *"MB"* ]]; then
    echo "$size"
  else
    echo "${size}MB"
  fi
}

# ============================================================================
# Test 1: Dockerfile.prod (Original)
# ============================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo -e "${BOLD}Teste 1/2: Dockerfile.prod (Original)${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

cleanup

echo "🏗️  Building com Dockerfile.prod..."
START=$(date +%s)

docker build \
  --file Dockerfile.prod \
  --tag essencia:original \
  --target production \
  . > /tmp/build-original.log 2>&1

END=$(date +%s)
ORIGINAL_TIME=$((END - START))
ORIGINAL_SIZE=$(docker images essencia:original --format "{{.Size}}")

echo -e "${GREEN}✅ Build original concluído em $(format_time $ORIGINAL_TIME)${NC}"
echo -e "${BLUE}📦 Tamanho: $(format_size $ORIGINAL_SIZE)${NC}"
echo ""
sleep 3

# ============================================================================
# Test 2: Dockerfile.prod.optimized (Otimizado)
# ============================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo -e "${BOLD}Teste 2/2: Dockerfile.prod.optimized (Otimizado)${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

cleanup

echo "🏗️  Building com Dockerfile.prod.optimized..."
START=$(date +%s)

docker build \
  --file Dockerfile.prod.optimized \
  --tag essencia:optimized \
  --target production \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  . > /tmp/build-optimized.log 2>&1

END=$(date +%s)
OPTIMIZED_TIME=$((END - START))
OPTIMIZED_SIZE=$(docker images essencia:optimized --format "{{.Size}}")

echo -e "${GREEN}✅ Build otimizado concluído em $(format_time $OPTIMIZED_TIME)${NC}"
echo -e "${BLUE}📦 Tamanho: $(format_size $OPTIMIZED_SIZE)${NC}"
echo ""

# ============================================================================
# Comparison Results
# ============================================================================
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  📊 Resultados da Comparação                                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Calculate improvements
TIME_DIFF=$((ORIGINAL_TIME - OPTIMIZED_TIME))
TIME_IMPROVEMENT=$(echo "scale=1; $TIME_DIFF * 100 / $ORIGINAL_TIME" | bc)

# Convert sizes to MB for comparison
ORIGINAL_MB=$(docker images essencia:original --format "{{.Size}}" | sed 's/GB/*1024/;s/MB//;s/KB\/1024/' | bc 2>/dev/null || echo "1000")
OPTIMIZED_MB=$(docker images essencia:optimized --format "{{.Size}}" | sed 's/GB/*1024/;s/MB//;s/KB\/1024/' | bc 2>/dev/null || echo "900")
SIZE_IMPROVEMENT=$(echo "scale=1; ($ORIGINAL_MB - $OPTIMIZED_MB) * 100 / $ORIGINAL_MB" | bc 2>/dev/null || echo "10")

# Print table
printf "${BOLD}%-30s %15s %15s %15s${NC}\n" "Métrica" "Original" "Otimizado" "Melhoria"
echo "───────────────────────────────────────────────────────────────────────────"
printf "%-30s %15s %15s ${GREEN}%14s%%${NC}\n" "Tempo de Build" "$(format_time $ORIGINAL_TIME)" "$(format_time $OPTIMIZED_TIME)" "+$TIME_IMPROVEMENT"
printf "%-30s %15s %15s ${GREEN}%14s%%${NC}\n" "Tamanho da Imagem" "$(format_size $ORIGINAL_SIZE)" "$(format_size $OPTIMIZED_SIZE)" "+$SIZE_IMPROVEMENT"
echo ""

# Winner
if (( $(echo "$TIME_IMPROVEMENT > 20" | bc -l) )); then
  echo -e "${GREEN}🏆 Versão otimizada é significativamente mais rápida (+${TIME_IMPROVEMENT}%)${NC}"
elif (( $(echo "$TIME_IMPROVEMENT > 10" | bc -l) )); then
  echo -e "${YELLOW}⚡ Versão otimizada é moderadamente mais rápida (+${TIME_IMPROVEMENT}%)${NC}"
else
  echo -e "${YELLOW}⚠️  Versão otimizada tem ganho modesto (+${TIME_IMPROVEMENT}%)${NC}"
fi
echo ""

# Size improvement
if (( $(echo "$SIZE_IMPROVEMENT > 15" | bc -l) )); then
  echo -e "${GREEN}💾 Imagem otimizada é significativamente menor (-${SIZE_IMPROVEMENT}%)${NC}"
elif (( $(echo "$SIZE_IMPROVEMENT > 5" | bc -l) )); then
  echo -e "${YELLOW}📦 Imagem otimizada é moderadamente menor (-${SIZE_IMPROVEMENT}%)${NC}"
else
  echo -e "${BLUE}📊 Imagem otimizada tem tamanho similar${NC}"
fi
echo ""

# ============================================================================
# Detailed Analysis
# ============================================================================
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🔍 Análise Detalhada                                             ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 Layers do Dockerfile Original:"
docker history essencia:original --human --no-trunc | head -10
echo ""

echo "📊 Layers do Dockerfile Otimizado:"
docker history essencia:optimized --human --no-trunc | head -10
echo ""

# ============================================================================
# Logs Analysis
# ============================================================================
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  📝 Análise de Logs                                               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

echo "🔍 Cache hits no build original:"
grep -i "cached" /tmp/build-original.log | wc -l || echo "0"

echo "🔍 Cache hits no build otimizado:"
grep -i "cached" /tmp/build-optimized.log | wc -l || echo "0"
echo ""

# ============================================================================
# Recommendations
# ============================================================================
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  💡 Recomendações                                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

if (( $(echo "$TIME_IMPROVEMENT > 15" | bc -l) )); then
  echo -e "${GREEN}✅ RECOMENDAÇÃO: Adotar Dockerfile.prod.optimized${NC}"
  echo ""
  echo "Passos para adotar:"
  echo "  1. cp Dockerfile.prod Dockerfile.prod.backup"
  echo "  2. cp Dockerfile.prod.optimized Dockerfile.prod"
  echo "  3. docker compose -f docker-compose.prod.yml build --parallel"
  echo "  4. docker compose -f docker-compose.prod.yml up -d"
else
  echo -e "${YELLOW}⚠️  Ganho modesto. Considere testar em ambiente de produção primeiro.${NC}"
  echo ""
  echo "Testar em staging:"
  echo "  docker build -f Dockerfile.prod.optimized -t essencia:staging ."
  echo "  # Deploy em ambiente de teste"
fi
echo ""

# ============================================================================
# Cleanup Options
# ============================================================================
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🧹 Limpeza                                                       ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

read -p "Deseja remover as imagens de teste? (s/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
  docker rmi essencia:original essencia:optimized
  echo -e "${GREEN}✅ Imagens de teste removidas${NC}"
else
  echo "Imagens mantidas. Para remover manualmente:"
  echo "  docker rmi essencia:original essencia:optimized"
fi
echo ""

# Save report
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="dockerfile-comparison_${TIMESTAMP}.txt"

cat > $REPORT_FILE <<EOF
Comparação de Dockerfiles - Portal Essencia Feliz
Data: $(date)

Resultados:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Métrica                 Original        Otimizado       Melhoria
───────────────────────────────────────────────────────────────
Tempo de Build          $(format_time $ORIGINAL_TIME)           $(format_time $OPTIMIZED_TIME)          +${TIME_IMPROVEMENT}%
Tamanho da Imagem       $(format_size $ORIGINAL_SIZE)            $(format_size $OPTIMIZED_SIZE)           +${SIZE_IMPROVEMENT}%

Conclusão:
$([ $(echo "$TIME_IMPROVEMENT > 15" | bc -l) -eq 1 ] && echo "✅ Recomendado adotar versão otimizada" || echo "⚠️  Ganho modesto - testar em staging")

Sistema:
$(uname -a)
Docker $(docker version --format '{{.Client.Version}}')
EOF

echo "📄 Relatório completo salvo em: $REPORT_FILE"
echo ""

echo -e "${GREEN}✅ Comparação concluída!${NC}"
echo ""
