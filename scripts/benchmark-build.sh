#!/bin/bash
# =============================================================================
# Build Performance Benchmark
# Portal Essencia Feliz - Compare Build Methods
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
echo "║  📊 Benchmark de Performance - Build Docker                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Results array
declare -A RESULTS

# Ensure BuildKit is enabled
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Function to format time
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

# Function to clean build artifacts
clean_build() {
  echo "🧹 Limpando artefatos de build anteriores..."
  docker compose -f docker-compose.prod.yml down --rmi all --volumes 2>/dev/null || true
  docker builder prune -af > /dev/null 2>&1 || true
  echo ""
}

# Confirmation
echo -e "${YELLOW}⚠️  ATENÇÃO: Este benchmark irá:${NC}"
echo "   1. Limpar todas as imagens e cache existentes"
echo "   2. Executar 3 métodos de build diferentes"
echo "   3. Levar aproximadamente 20-30 minutos"
echo ""
read -p "Deseja continuar? (s/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "Benchmark cancelado."
  exit 0
fi
echo ""

# ============================================================================
# Test 1: Build Padrão (sem otimizações)
# ============================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo -e "${BOLD}Teste 1/3: Build Padrão (baseline)${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

clean_build

echo "🏗️  Executando build padrão..."
START=$(date +%s)

docker compose -f docker-compose.prod.yml build > /dev/null 2>&1

END=$(date +%s)
DURATION=$((END - START))
RESULTS["standard"]=$DURATION

echo -e "${GREEN}✅ Concluído em $(format_time $DURATION)${NC}"
echo ""
sleep 5

# ============================================================================
# Test 2: Build Paralelo
# ============================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo -e "${BOLD}Teste 2/3: Build Paralelo${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

clean_build

echo "🏗️  Executando build paralelo..."
START=$(date +%s)

docker compose -f docker-compose.prod.yml build --parallel > /dev/null 2>&1

END=$(date +%s)
DURATION=$((END - START))
RESULTS["parallel"]=$DURATION

echo -e "${GREEN}✅ Concluído em $(format_time $DURATION)${NC}"
echo ""
sleep 5

# ============================================================================
# Test 3: Build com Cache (rebuild simulation)
# ============================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo -e "${BOLD}Teste 3/3: Rebuild com Cache${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Don't clean - test cache effectiveness
echo "🏗️  Executando rebuild com cache existente..."
START=$(date +%s)

docker compose -f docker-compose.prod.yml build --parallel > /dev/null 2>&1

END=$(date +%s)
DURATION=$((END - START))
RESULTS["cached"]=$DURATION

echo -e "${GREEN}✅ Concluído em $(format_time $DURATION)${NC}"
echo ""

# ============================================================================
# Results Summary
# ============================================================================
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  📊 Resultados do Benchmark                                       ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Calculate improvements
STANDARD=${RESULTS["standard"]}
PARALLEL=${RESULTS["parallel"]}
CACHED=${RESULTS["cached"]}

PARALLEL_IMPROVEMENT=$(echo "scale=1; ($STANDARD - $PARALLEL) * 100 / $STANDARD" | bc)
CACHED_IMPROVEMENT=$(echo "scale=1; ($STANDARD - $CACHED) * 100 / $STANDARD" | bc)

# Print table
printf "${BOLD}%-30s %15s %15s${NC}\n" "Método" "Tempo" "Ganho"
echo "───────────────────────────────────────────────────────────────────"
printf "%-30s %15s %15s\n" "Build Padrão (baseline)" "$(format_time $STANDARD)" "-"
printf "%-30s %15s ${GREEN}%14s%%${NC}\n" "Build Paralelo" "$(format_time $PARALLEL)" "+$PARALLEL_IMPROVEMENT"
printf "%-30s %15s ${GREEN}%14s%%${NC}\n" "Rebuild com Cache" "$(format_time $CACHED)" "+$CACHED_IMPROVEMENT"
echo ""

# Winner
if [ $CACHED -lt $PARALLEL ]; then
  WINNER="Rebuild com Cache"
  WINNER_TIME=$(format_time $CACHED)
else
  WINNER="Build Paralelo"
  WINNER_TIME=$(format_time $PARALLEL)
fi

echo "🏆 Método mais rápido: $WINNER ($WINNER_TIME)"
echo ""

# Recommendations
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  💡 Recomendações                                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

if (( $(echo "$PARALLEL_IMPROVEMENT > 30" | bc -l) )); then
  echo -e "${GREEN}✅ Build paralelo trouxe ganho significativo (+${PARALLEL_IMPROVEMENT}%)${NC}"
  echo "   Recomendado usar sempre: docker compose build --parallel"
else
  echo -e "${YELLOW}⚠️  Build paralelo trouxe ganho modesto (+${PARALLEL_IMPROVEMENT}%)${NC}"
  echo "   Verifique configuração de CPU/memória do Docker"
fi
echo ""

if (( $(echo "$CACHED_IMPROVEMENT > 60" | bc -l) )); then
  echo -e "${GREEN}✅ Cache está muito eficiente (+${CACHED_IMPROVEMENT}%)${NC}"
  echo "   Continue usando builds incrementais quando possível"
else
  echo -e "${YELLOW}⚠️  Cache pode ser melhorado (+${CACHED_IMPROVEMENT}%)${NC}"
  echo "   Considere usar registry local para cache persistente"
fi
echo ""

# System info
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🖥️  Informações do Sistema                                       ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

echo "CPU:"
grep -m 1 'model name' /proc/cpuinfo | cut -d':' -f2 | xargs
echo ""

echo "Memória:"
free -h | grep Mem | awk '{print "  Total: " $2 "  |  Disponível: " $7}'
echo ""

echo "Docker:"
docker version --format '  Client: {{.Client.Version}}  |  Server: {{.Server.Version}}'
echo ""

echo "BuildKit:"
if [[ "$DOCKER_BUILDKIT" == "1" ]]; then
  echo "  ✅ Habilitado"
else
  echo "  ❌ Desabilitado"
fi
echo ""

# Save results
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="benchmark_${TIMESTAMP}.txt"

cat > $REPORT_FILE <<EOF
Benchmark de Build - Portal Essencia Feliz
Data: $(date)

Resultados:
- Build Padrão:     $(format_time $STANDARD)
- Build Paralelo:   $(format_time $PARALLEL) (+$PARALLEL_IMPROVEMENT%)
- Rebuild Cached:   $(format_time $CACHED) (+$CACHED_IMPROVEMENT%)

Sistema:
$(grep -m 1 'model name' /proc/cpuinfo | cut -d':' -f2)
$(free -h | grep Mem)
Docker $(docker version --format '{{.Client.Version}}')
EOF

echo "📄 Relatório salvo em: $REPORT_FILE"
echo ""
