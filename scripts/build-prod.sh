#!/bin/bash
# =============================================================================
# Build de Produção com Medição de Performance
# =============================================================================

set -e

echo "🚀 Iniciando build de produção..."
echo "📊 Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Medir tempo total
START_TIME=$(date +%s)

# Build (BuildKit já habilitado no daemon)
docker compose -f docker-compose.prod.yml.new build "$@"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Converter para minutos:segundos
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "✅ Build completo!"
echo "⏱️  Tempo total: ${MINUTES}m ${SECONDS}s"
echo ""

# Criar diretório de logs se não existir
mkdir -p logs

# Salvar histórico
echo "$(date '+%Y-%m-%d %H:%M:%S'),${DURATION}s,${MINUTES}m${SECONDS}s" >> logs/build-performance.log

# Mostrar tamanhos das imagens
echo "📦 Tamanho das imagens:"
docker images | grep "essencia-" | awk '{print $1 "\t\t" $7 " " $8}' || echo "Nenhuma imagem encontrada"

echo ""
echo "📈 Últimos 5 builds:"
tail -5 logs/build-performance.log 2>/dev/null || echo "Primeiro build registrado"
