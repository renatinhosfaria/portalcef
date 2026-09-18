#!/usr/bin/env bash
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

set -euo pipefail

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

TEMP_BACKUP=""
limpar_backup_temporario() {
    if [[ -n "$TEMP_BACKUP" ]]; then
        rm -f "$TEMP_BACKUP"
    fi
}
trap limpar_backup_temporario EXIT

echo "=============================================="
echo -e "${YELLOW}  Portal Essência Feliz - Migrations${NC}"
echo "=============================================="
echo ""
echo -e "Ambiente: ${YELLOW}${ENV}${NC}"
echo ""

COMPOSE_ENV_ARGS=()

# Selecionar compose file e container
case "$ENV" in
    dev)
        COMPOSE_FILE="docker-compose.dev.yml"
        CONTAINER="dev"
        ;;
    prod)
        COMPOSE_FILE="docker-compose.prod.yml"
        CONTAINER="api"
        # Sem --env-file o compose lê .env, que não tem DATABASE_URL.
        ENV_FILE=".env.docker"
        if [ ! -f "$ENV_FILE" ]; then
            echo -e "${RED}Erro: $ENV_FILE não encontrado${NC}"
            exit 1
        fi
        COMPOSE_ENV_ARGS=(--env-file "$ENV_FILE")
        ;;
    *)
        echo -e "${RED}Erro: Ambiente inválido '$ENV'${NC}"
        echo "Use: dev ou prod"
        exit 1
        ;;
esac

# Verificar se container está rodando
if ! docker compose -f "$COMPOSE_FILE" "${COMPOSE_ENV_ARGS[@]}" ps $CONTAINER | grep -q "Up"; then
    echo -e "${RED}Erro: Container '$CONTAINER' não está rodando${NC}"
    echo ""
    echo "Inicie os serviços primeiro:"
    echo "  docker compose -f $COMPOSE_FILE ${COMPOSE_ENV_ARGS[*]} up -d"
    echo ""
    exit 1
fi

get_postgres_container_env() {
    docker exec essencia-postgres printenv "$1" 2>/dev/null || true
}

# Backup antes de migrations (apenas em produção)
if [ "$ENV" = "prod" ]; then
    echo -e "${YELLOW}[1/3]${NC} Criando backup do banco..."

    DB_USER="${POSTGRES_USER:-$(get_postgres_container_env POSTGRES_USER)}"
    DB_NAME="${POSTGRES_DB:-$(get_postgres_container_env POSTGRES_DB)}"
    DB_USER="${DB_USER:-essencia}"
    DB_NAME="${DB_NAME:-essencia_db}"

    BACKUP_FILE="backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"
    BACKUP_DIR="$PROJECT_DIR/backup"
    umask 077
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
    TEMP_BACKUP="$(mktemp "$BACKUP_DIR/.${BACKUP_FILE}.tmp.XXXXXX")"
    chmod 600 "$TEMP_BACKUP"

    if ! docker exec essencia-postgres pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        > "$TEMP_BACKUP" 2>/dev/null; then
        echo -e "${RED}Erro: backup falhou com o usuário '$DB_USER'${NC}"
        echo "Migrations abortadas — nenhuma alteração foi feita no banco."
        exit 1
    fi

    if [ ! -s "$TEMP_BACKUP" ]; then
        echo -e "${RED}Erro: backup falhou (arquivo vazio) com o usuário '$DB_USER'${NC}"
        echo "Migrations abortadas — nenhuma alteração foi feita no banco."
        exit 1
    fi

    mv "$TEMP_BACKUP" "$BACKUP_DIR/$BACKUP_FILE"
    TEMP_BACKUP=""
    chmod 600 "$BACKUP_DIR/$BACKUP_FILE"

    echo -e "${GREEN}✓ Backup criado: backup/$BACKUP_FILE ($(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1))${NC}"
    echo ""

    echo -e "${YELLOW}[2/3]${NC} Executando migrations..."
else
    echo -e "${YELLOW}[1/2]${NC} Executando migrations..."
fi

# Executar migrations
if [ "$ENV" = "dev" ]; then
    docker compose -f "$COMPOSE_FILE" "${COMPOSE_ENV_ARGS[@]}" run --rm $CONTAINER pnpm db:migrate
else
    if docker compose -f "$COMPOSE_FILE" "${COMPOSE_ENV_ARGS[@]}" exec $CONTAINER sh -lc "command -v pnpm >/dev/null 2>&1"; then
        docker compose -f "$COMPOSE_FILE" "${COMPOSE_ENV_ARGS[@]}" exec $CONTAINER pnpm --filter @essencia/db migrate
    elif docker compose -f "$COMPOSE_FILE" "${COMPOSE_ENV_ARGS[@]}" exec $CONTAINER sh -lc "test -f /app/packages/db/dist/migrate.js"; then
        docker compose -f "$COMPOSE_FILE" "${COMPOSE_ENV_ARGS[@]}" exec $CONTAINER node /app/packages/db/dist/migrate.js
    else
        echo -e "${RED}Erro: não foi encontrado pnpm nem /app/packages/db/dist/migrate.js no container '$CONTAINER'${NC}"
        exit 1
    fi
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
    -U "${DB_USER:-${POSTGRES_USER:-essencia}}" \
    -d "${DB_NAME:-${POSTGRES_DB:-essencia_db}}" \
    -c "SELECT COUNT(*) as tabelas FROM information_schema.tables WHERE table_schema = 'public';" \
    2>/dev/null || echo "Verificação manual necessária"

echo ""
echo "=============================================="
echo -e "${GREEN}  Migrations concluídas!${NC}"
echo "=============================================="
echo ""
