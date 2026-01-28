#!/bin/bash
# =============================================================================
# HEALTH CHECK - Verificação completa de saúde dos serviços
# Portal Essência Feliz
# =============================================================================
#
# Uso: ./scripts/health-check.sh
#
# Este script verifica:
# 1. Status dos containers Docker
# 2. Health checks internos
# 3. Endpoints externos (se acessíveis)
# 4. Recursos do sistema
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.prod.yml"

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=============================================="
echo -e "${BLUE}  Portal Essência Feliz - Health Check${NC}"
echo "=============================================="
echo ""

FAILED=0

# =============================================================================
# 1. STATUS DOS CONTAINERS
# =============================================================================

echo -e "${YELLOW}[1/4] Status dos Containers${NC}"
echo ""

docker compose -f $COMPOSE_FILE ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

echo ""

# Verificar se há containers não healthy
UNHEALTHY=$(docker compose -f $COMPOSE_FILE ps --format "{{.Name}}\t{{.Health}}" | grep -v healthy | grep -v "N/A" || true)

if [ -n "$UNHEALTHY" ]; then
    echo -e "${YELLOW}Containers com problemas:${NC}"
    echo "$UNHEALTHY"
    FAILED=1
fi

echo ""

# =============================================================================
# 2. HEALTH ENDPOINTS INTERNOS
# =============================================================================

echo -e "${YELLOW}[2/4] Health Endpoints Internos${NC}"
echo ""

# Função para testar endpoint interno
check_internal() {
    local name=$1
    local container=$2
    local port=$3
    local path=$4

    if docker exec "$container" curl -sf --max-time 5 "http://localhost:${port}${path}" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name (interno)"
    else
        echo -e "  ${RED}✗${NC} $name (interno)"
        FAILED=1
    fi
}

# Verificar endpoints internos
check_internal "API" "essencia-api" "3002" "/health"
check_internal "Worker" "essencia-worker" "3100" "/health"
check_internal "Home" "essencia-home" "3000" "/"
check_internal "Login" "essencia-login" "3003" "/login"
check_internal "Usuários" "essencia-usuarios" "3004" "/usuarios"
check_internal "Escolas" "essencia-escolas" "3005" "/escolas"
check_internal "Turmas" "essencia-turmas" "3006" "/turmas"
check_internal "Planejamento" "essencia-planejamento" "3007" "/planejamento"
check_internal "Calendário" "essencia-calendario" "3008" "/calendario"
check_internal "Loja" "essencia-loja" "3010" "/"
check_internal "Loja Admin" "essencia-loja-admin" "3011" "/loja-admin"
check_internal "Tarefas" "essencia-tarefas" "3012" "/tarefas"

echo ""

# =============================================================================
# 3. HEALTH ENDPOINTS EXTERNOS
# =============================================================================

echo -e "${YELLOW}[3/4] Health Endpoints Externos${NC}"
echo ""

# Função para testar endpoint externo
check_external() {
    local name=$1
    local url=$2

    if curl -sf --max-time 10 "$url" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name"
    else
        echo -e "  ${RED}✗${NC} $name"
        FAILED=1
    fi
}

# Verificar endpoints externos (se acessíveis)
if curl -sf --max-time 5 "https://www.portalcef.com.br/" > /dev/null 2>&1; then
    check_external "Home" "https://www.portalcef.com.br/"
    check_external "API Health" "https://www.portalcef.com.br/health"
    check_external "Login" "https://www.portalcef.com.br/login"
    check_external "Planejamento" "https://www.portalcef.com.br/planejamento"
    check_external "Loja" "https://loja.portalcef.com.br/"
else
    echo -e "  ${YELLOW}⚠ Endpoints externos não acessíveis (verificação local)${NC}"
fi

echo ""

# =============================================================================
# 4. RECURSOS DO SISTEMA
# =============================================================================

echo -e "${YELLOW}[4/4] Recursos do Sistema${NC}"
echo ""

# Uso de disco
echo "  Disco:"
df -h / | tail -1 | awk '{printf "    Usado: %s de %s (%s)\n", $3, $2, $5}'

# Uso de memória
echo ""
echo "  Memória:"
free -h | grep Mem | awk '{printf "    Usado: %s de %s\n", $3, $2}'

# Docker stats resumido
echo ""
echo "  Docker (top 5 por memória):"
docker stats --no-stream --format "    {{.Name}}: {{.MemUsage}}" | head -5

echo ""

# =============================================================================
# INFRAESTRUTURA
# =============================================================================

echo -e "${YELLOW}[Bônus] Infraestrutura${NC}"
echo ""

# PostgreSQL
echo -n "  PostgreSQL: "
if docker exec essencia-postgres pg_isready -U essencia > /dev/null 2>&1; then
    CONN=$(docker exec essencia-postgres psql -U essencia -d essencia_db -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs)
    echo -e "${GREEN}OK${NC} ($CONN conexões ativas)"
else
    echo -e "${RED}Erro${NC}"
    FAILED=1
fi

# Redis
echo -n "  Redis: "
if docker exec essencia-redis redis-cli ping > /dev/null 2>&1; then
    KEYS=$(docker exec essencia-redis redis-cli DBSIZE 2>/dev/null | awk '{print $2}')
    echo -e "${GREEN}OK${NC} ($KEYS keys)"
else
    echo -e "${RED}Erro${NC}"
    FAILED=1
fi

# MinIO
echo -n "  MinIO: "
if docker exec essencia-minio curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}Erro${NC}"
    FAILED=1
fi

echo ""
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}  Todos os serviços estão saudáveis!${NC}"
else
    echo -e "${RED}  Alguns serviços apresentam problemas${NC}"
fi

echo "=============================================="
echo ""

exit $FAILED
