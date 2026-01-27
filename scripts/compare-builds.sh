#!/bin/bash
# =============================================================================
# Comparar Performance de Builds
# =============================================================================

if [ ! -f logs/build-performance.log ]; then
    echo "❌ Nenhum histórico encontrado. Execute ./scripts/build-prod.sh primeiro."
    exit 1
fi

echo "📊 Histórico de Performance (últimos 10 builds):"
echo "================================================="
echo ""
printf "%-20s %-15s %-15s\n" "Data/Hora" "Segundos" "Tempo"
echo "-----------------------------------------------------------"

tail -10 logs/build-performance.log | while IFS=',' read -r timestamp seconds formatted; do
    printf "%-20s %-15s %-15s\n" "$timestamp" "$seconds" "$formatted"
done

echo ""
echo "📈 Estatísticas:"

# Calcular média (últimos 10 builds)
AVG=$(tail -10 logs/build-performance.log | cut -d',' -f2 | sed 's/s//' | awk '{sum+=$1; count++} END {if(count>0) print int(sum/count); else print 0}')
AVG_MIN=$((AVG / 60))
AVG_SEC=$((AVG % 60))

echo "Média (últimos 10): ${AVG_MIN}m ${AVG_SEC}s"

# Build mais rápido
FASTEST=$(cat logs/build-performance.log | cut -d',' -f2 | sed 's/s//' | sort -n | head -1)
FASTEST_MIN=$((FASTEST / 60))
FASTEST_SEC=$((FASTEST % 60))

echo "Mais rápido: ${FASTEST_MIN}m ${FASTEST_SEC}s"

# Build mais lento
SLOWEST=$(cat logs/build-performance.log | cut -d',' -f2 | sed 's/s//' | sort -n | tail -1)
SLOWEST_MIN=$((SLOWEST / 60))
SLOWEST_SEC=$((SLOWEST % 60))

echo "Mais lento: ${SLOWEST_MIN}m ${SLOWEST_SEC}s"
