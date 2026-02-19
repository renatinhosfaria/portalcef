#!/bin/bash
# =============================================================================
# MIGRATE - Executar migrations do banco de dados
# Portal Essência Feliz
# =============================================================================
#
# Uso: ./scripts/migrate.sh [ambiente]
#
# Ambientes:
#   dev   - Desenvolvimento (docker-compose.dev.yml)
#   prod  - Produção (docker-compose.prod.yml)
#
# Exemplos:
#   ./scripts/migrate.sh dev    # Migrations em dev
#   ./scripts/migrate.sh prod   # Migrations em produção
#   ./scripts/migrate.sh        # Padrão: produção
#
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Ambiente (padrão: prod)
ENV="${1:-prod}"

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=============================================="
echo -e "${YELLOW}  Portal Essência Feliz - Migrations${NC}"
echo "=============================================="
echo ""
echo -e "Ambiente: ${YELLOW}${ENV}${NC}"
echo ""

# Selecionar compose file e container
case "$ENV" in
    dev)
        COMPOSE_FILE="docker-compose.dev.yml"
        CONTAINER="dev"
        ;;
    prod)
        COMPOSE_FILE="docker-compose.prod.yml"
        CONTAINER="api"
        ;;
    *)
        echo -e "${RED}Erro: Ambiente inválido '$ENV'${NC}"
        echo "Use: dev ou prod"
        exit 1
        ;;
esac

# Verificar se container está rodando
if ! docker compose -f $COMPOSE_FILE ps $CONTAINER | grep -q "Up"; then
    echo -e "${RED}Erro: Container '$CONTAINER' não está rodando${NC}"
    echo ""
    echo "Inicie os serviços primeiro:"
    echo "  docker compose -f $COMPOSE_FILE up -d"
    echo ""
    exit 1
fi

# Backup antes de migrations (apenas em produção)
if [ "$ENV" = "prod" ]; then
    echo -e "${YELLOW}[1/3]${NC} Criando backup do banco..."

    BACKUP_FILE="backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"

    docker exec essencia-postgres pg_dump \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        > "$PROJECT_DIR/backup/$BACKUP_FILE" 2>/dev/null || {
            mkdir -p "$PROJECT_DIR/backup"
            docker exec essencia-postgres pg_dump \
                -U essencia \
                -d essencia_db \
                > "$PROJECT_DIR/backup/$BACKUP_FILE"
        }

    echo -e "${GREEN}✓ Backup criado: backup/$BACKUP_FILE${NC}"
    echo ""

    echo -e "${YELLOW}[2/3]${NC} Executando migrations..."
else
    echo -e "${YELLOW}[1/2]${NC} Executando migrations..."
fi

# Executar migrations
if [ "$ENV" = "dev" ]; then
    docker compose -f $COMPOSE_FILE run --rm $CONTAINER pnpm db:migrate
else
    docker compose -f $COMPOSE_FILE exec $CONTAINER pnpm --filter @essencia/db migrate
fi

echo -e "${GREEN}✓ Migrations executadas${NC}"
echo ""

# Verificar estado
if [ "$ENV" = "prod" ]; then
    echo -e "${YELLOW}[3/3]${NC} Verificando banco..."
else
    echo -e "${YELLOW}[2/2]${NC} Verificando banco..."
fi

# Verificar conexão
docker exec essencia-postgres psql \
    -U "${POSTGRES_USER:-essencia}" \
    -d "${POSTGRES_DB:-essencia_db}" \
    -c "SELECT COUNT(*) as tabelas FROM information_schema.tables WHERE table_schema = 'public';" \
    2>/dev/null || echo "Verificação manual necessária"

echo ""
echo "=============================================="
echo -e "${GREEN}  Migrations concluídas!${NC}"
echo "=============================================="
echo ""
