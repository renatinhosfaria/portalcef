#!/bin/bash
# =============================================================================
# DEPLOY ROLLING - Atualização sequencial com health gate
# Portal Essência Feliz
# =============================================================================
#
# Uso: ./scripts/deploy-rolling.sh [tag]
#
# Atualiza um serviço por vez, aguardando o health check de cada um antes de
# seguir. Se a API falhar, aborta o deploy e os demais serviços permanecem na
# versão anterior.
#
# Não é zero downtime: cada serviço fica indisponível durante a sua própria
# recriação, já que roda em instância única. Para eliminar essa janela seria
# preciso subir a nova instância antes de remover a antiga.
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.docker"
TAG="${1:-latest}"
HEALTH_TIMEOUT=60

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Sem --env-file o compose lê .env, que não tem DATABASE_URL: a API sobe com a
# variável vazia e entra em loop de restart, derrubando tudo que depende dela.
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Erro: $ENV_FILE não encontrado em $PROJECT_DIR${NC}"
    exit 1
fi

COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo "=============================================="
echo -e "${BLUE}  Portal Essência Feliz - Rolling Deploy${NC}"
echo "=============================================="
echo ""
echo -e "Tag: ${YELLOW}${TAG}${NC}"
echo ""

# Exportar tag para docker-compose
export IMAGE_TAG="$TAG"

# Lista de serviços para deploy (ordem importa: API primeiro, depois apps)
SERVICES=(
    "api"
    "home"
    "login"
    "usuarios"
    "escolas"
    "turmas"
    "planejamento"
    "calendario"
    "eventos"
    "loja"
    "loja-admin"
    "tarefas"
    "suporte"
    "workflows"
)

# Função para verificar health de um container
check_health() {
    local service=$1
    local timeout=$2
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        local health=$(docker inspect --format='{{.State.Health.Status}}' "essencia-$service" 2>/dev/null || echo "unknown")

        if [ "$health" = "healthy" ]; then
            return 0
        fi

        sleep 2
        elapsed=$((elapsed + 2))
    done

    return 1
}

echo -e "${YELLOW}[1/4]${NC} Pulling novas imagens..."
"${COMPOSE[@]}" pull
echo -e "${GREEN}✓ Imagens baixadas${NC}"
echo ""

echo -e "${YELLOW}[2/4]${NC} Iniciando rolling update..."
echo ""

FAILED=0

for service in "${SERVICES[@]}"; do
    echo -e "${BLUE}→ Atualizando ${service}...${NC}"

    # Recrear container com nova imagem
    "${COMPOSE[@]}" up -d --force-recreate --no-deps "$service"

    # Aguardar health check
    echo "  Aguardando health check..."

    if check_health "$service" $HEALTH_TIMEOUT; then
        echo -e "  ${GREEN}✓ ${service} atualizado e healthy${NC}"
    else
        echo -e "  ${RED}✗ ${service} não passou no health check!${NC}"
        echo ""
        echo -e "${RED}Logs do serviço:${NC}"
        "${COMPOSE[@]}" logs --tail=30 "$service"
        FAILED=1

        # Para o deploy se API falhar
        if [ "$service" = "api" ]; then
            echo -e "${RED}API falhou - abortando deploy${NC}"
            exit 1
        fi
    fi

    echo ""
done

echo -e "${YELLOW}[3/4]${NC} Verificando estado final..."

# Verificar todos os serviços
echo ""
"${COMPOSE[@]}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"
echo ""

echo -e "${YELLOW}[4/4]${NC} Limpando imagens antigas..."
docker image prune -af --filter "until=24h" 2>/dev/null || true
echo -e "${GREEN}✓ Limpeza concluída${NC}"

echo ""
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}  Deploy concluído com sucesso!${NC}"
    echo "=============================================="
    echo ""
    echo "Verifique os endpoints:"
    echo "  - https://www.portalcef.com.br/api/health"
    echo "  - https://www.portalcef.com.br/"
    echo ""
else
    echo -e "${YELLOW}  Deploy concluído com avisos${NC}"
    echo "=============================================="
    echo ""
    echo -e "${YELLOW}Alguns serviços podem não estar healthy.${NC}"
    echo "Execute './scripts/health-check.sh' para diagnóstico."
    echo ""
    exit 1
fi
