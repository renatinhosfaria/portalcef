#!/bin/bash
# =============================================================================
# RESTART SEGURO - OnlyOffice Document Server
# Portal Essência Feliz
# =============================================================================
#
# Uso: ./scripts/restart-onlyoffice.sh
#
# Este script faz um restart seguro do OnlyOffice, garantindo que:
# 1. Sessões de edição ativas são salvas antes do shutdown
# 2. O container é reiniciado e verificado via healthcheck
#
# IMPORTANTE: Sempre use este script ao invés de `docker restart` diretamente.
# Um restart abrupto pode causar perda de edições em andamento.
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.prod.yml"
CONTAINER="essencia-onlyoffice"

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=============================================="
echo -e "${YELLOW}  OnlyOffice - Restart Seguro${NC}"
echo "=============================================="
echo ""

# Verificar se o container está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo -e "${RED}Container ${CONTAINER} não está rodando.${NC}"
    echo "Iniciando diretamente..."
    docker compose -f $COMPOSE_FILE up -d onlyoffice
    exit 0
fi

# 1. Preparar para shutdown (salva sessões ativas)
echo -e "${YELLOW}[1/4] Preparando para shutdown (salvando sessões ativas)...${NC}"
if docker exec "$CONTAINER" documentserver-prepare4shutdown.sh 2>/dev/null; then
    echo -e "${GREEN}  ✓ Sessões notificadas para salvar${NC}"
else
    echo -e "${YELLOW}  ⚠ Comando prepare4shutdown falhou (container pode estar em estado ruim)${NC}"
fi

# 2. Aguardar sessões serem salvas
echo -e "${YELLOW}[2/4] Aguardando finalização das sessões (30s)...${NC}"
sleep 30
echo -e "${GREEN}  ✓ Tempo de espera concluído${NC}"

# 3. Reiniciar container
echo -e "${YELLOW}[3/4] Reiniciando container...${NC}"
docker compose -f $COMPOSE_FILE restart onlyoffice
echo -e "${GREEN}  ✓ Container reiniciado${NC}"

# 4. Aguardar healthcheck
echo -e "${YELLOW}[4/4] Aguardando healthcheck (pode levar até 90s)...${NC}"
ATTEMPTS=0
MAX_ATTEMPTS=18  # 18 * 5s = 90s

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    if docker exec "$CONTAINER" curl -sf http://localhost/healthcheck > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ OnlyOffice está saudável!${NC}"

        # Aplicar tuning do conversor (reduz processos para economizar RAM)
        if [ -f "$PROJECT_DIR/config/onlyoffice-local.json" ]; then
            echo -e "${YELLOW}  Aplicando tuning do conversor...${NC}"
            docker cp "$PROJECT_DIR/config/onlyoffice-local.json" "$CONTAINER":/tmp/tuning.json
            docker exec "$CONTAINER" bash -c '
                if command -v jq &>/dev/null; then
                    jq -s ".[0] * .[1]" /etc/onlyoffice/documentserver/local.json /tmp/tuning.json > /tmp/merged.json && \
                    mv /tmp/merged.json /etc/onlyoffice/documentserver/local.json && \
                    supervisorctl restart ds:converter > /dev/null 2>&1 && \
                    echo "  OK"
                fi
                rm -f /tmp/tuning.json
            '
        fi

        echo ""
        echo "=============================================="
        echo -e "${GREEN}  Restart concluído com sucesso${NC}"
        echo "=============================================="
        exit 0
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    sleep 5
done

echo -e "${RED}  ✗ OnlyOffice não respondeu ao healthcheck após 90s${NC}"
echo -e "${YELLOW}  Verifique os logs: docker logs ${CONTAINER}${NC}"
echo ""
echo "=============================================="
echo -e "${RED}  Restart com problema - verificar logs${NC}"
echo "=============================================="
exit 1
