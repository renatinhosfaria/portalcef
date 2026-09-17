#!/usr/bin/env bash
# =============================================================================
# DEPLOY - Build e deploy local em produção com tag versionada
# Portal Essência Feliz
# =============================================================================
#
# Uso:
#   ./scripts/deploy.sh                 # sem migration
#   ./scripts/deploy.sh --migrar       # backup + migration antes do código novo
#   ./scripts/deploy.sh <tag>           # usa uma tag explícita
#   ./scripts/deploy.sh --migrar <tag>
#
# O script pressupõe que as imagens sejam construídas neste host. Para imagens
# de registry, a integração existente precisa ser alinhada (docs/DEPLOYMENT.md).
# =============================================================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.docker"
DOCKER_BIN="${DOCKER_BIN:-docker}"
PNPM_BIN="${PNPM_BIN:-pnpm}"
HEALTH_CHECK_SCRIPT="${HEALTH_CHECK_SCRIPT:-$PROJECT_DIR/scripts/health-check.sh}"
RUN_MIGRATIONS=0
RELEASE_TAG=""

uso() {
  echo "Uso: $0 [--migrar] [tag]" >&2
  exit 1
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --migrar)
      RUN_MIGRATIONS=1
      ;;
    --help|-h)
      uso
      ;;
    -*)
      uso
      ;;
    *)
      if [[ -n "$RELEASE_TAG" ]]; then
        uso
      fi
      RELEASE_TAG="$1"
      ;;
  esac
  shift
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Erro: $ENV_FILE não encontrado em $PROJECT_DIR" >&2
  exit 1
fi

if [[ -z "$RELEASE_TAG" ]]; then
  RELEASE_TAG="$(git rev-parse --short HEAD)"
fi

if [[ ! "$RELEASE_TAG" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]]; then
  echo "Erro: tag inválida: $RELEASE_TAG" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Erro: a árvore de trabalho contém alterações não commitadas." >&2
  echo "Faça commit antes do deploy para manter a tag e o rollback confiáveis." >&2
  exit 1
fi

if [[ ! -x "$HEALTH_CHECK_SCRIPT" ]]; then
  echo "Erro: health check não executável: $HEALTH_CHECK_SCRIPT" >&2
  exit 1
fi

COMPOSE=("$DOCKER_BIN" compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
export IMAGE_TAG="$RELEASE_TAG"

obter_ambiente_postgres() {
  "$DOCKER_BIN" exec essencia-postgres printenv "$1" 2>/dev/null || true
}

criar_backup() {
  local usuario banco arquivo
  usuario="$(obter_ambiente_postgres POSTGRES_USER)"
  banco="$(obter_ambiente_postgres POSTGRES_DB)"
  usuario="${usuario:-essencia_prod}"
  banco="${banco:-essencia_db}"
  arquivo="$PROJECT_DIR/backup/backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"

  umask 077
  mkdir -p "$PROJECT_DIR/backup"
  echo "Criando backup antes da migration..."
  if ! "$DOCKER_BIN" exec essencia-postgres pg_dump -U "$usuario" -d "$banco" > "$arquivo"; then
    rm -f "$arquivo"
    echo "Erro: pg_dump falhou; migration abortada." >&2
    exit 1
  fi
  if [[ ! -s "$arquivo" ]]; then
    rm -f "$arquivo"
    echo "Erro: backup vazio; migration abortada." >&2
    exit 1
  fi
  chmod 600 "$arquivo"
  echo "Backup criado: ${arquivo#$PROJECT_DIR/}"
}

echo "Deploy da versão: $RELEASE_TAG"
if [[ "$RUN_MIGRATIONS" -eq 1 ]]; then
  echo "Migrations: habilitadas"
else
  echo "Migrations: desabilitadas (use --migrar quando necessário)"
fi
echo ""

echo "[1/7] Executando lint..."
"$PNPM_BIN" turbo lint

echo "[2/7] Executando typecheck..."
"$PNPM_BIN" turbo typecheck

echo "[3/7] Construindo imagens..."
TAG="$RELEASE_TAG" "$DOCKER_BIN" buildx bake -f docker-bake.hcl --load

echo "[4/7] Construindo landing-mae do Compose..."
"${COMPOSE[@]}" build landing-mae

if [[ "$RUN_MIGRATIONS" -eq 1 ]]; then
  echo "[5/7] Preparando infraestrutura para migration..."
  "${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 180 postgres redis minio
  criar_backup
  echo "Executando migration da imagem $RELEASE_TAG..."
  "${COMPOSE[@]}" run --rm --no-deps --pull never api node /app/packages/db/dist/migrate.js
else
  echo "[5/7] Pulando migration (nenhuma solicitada)..."
fi

echo "[6/7] Subindo serviços da imagem $RELEASE_TAG..."
"${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 180

echo "[7/7] Verificando saúde dos serviços..."
"$HEALTH_CHECK_SCRIPT"
echo "Deploy concluído: $RELEASE_TAG"
