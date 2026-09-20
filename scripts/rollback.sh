#!/usr/bin/env bash
# =============================================================================
# ROLLBACK - Reverter para versão anterior
# Portal Essência Feliz
# =============================================================================
#
# Uso: ./scripts/rollback.sh [--local|--registry] <tag>
#
# Exemplo:
#   ./scripts/rollback.sh --local abc1234     # Imagem já carregada no host
#   ./scripts/rollback.sh --registry v1.2.3   # Baixa imagem do registry
#
# =============================================================================

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOCKER_BIN="${DOCKER_BIN:-docker}"
MODE="local"
TAG=""

uso() {
    echo "Uso: $0 [--local|--registry] <tag>" >&2
    echo "  --local     usa somente imagens já presentes no host (padrão)" >&2
    echo "  --registry  executa pull antes de subir a tag escolhida" >&2
    exit 1
}

while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --local)
            MODE="local"
            ;;
        --registry)
            MODE="registry"
            ;;
        --help|-h)
            uso
            ;;
        -* )
            uso
            ;;
        *)
            if [[ -n "$TAG" ]]; then
                uso
            fi
            TAG="$1"
            ;;
    esac
    shift
done

if [[ -z "$TAG" ]]; then
    echo -e "${RED}Erro: Tag não especificada${NC}"
    exit 1
fi

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.docker"

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
HEALTH_CHECK_SCRIPT="${HEALTH_CHECK_SCRIPT:-$PROJECT_DIR/scripts/health-check.sh}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}Erro: $ENV_FILE não encontrado em $PROJECT_DIR${NC}" >&2
    exit 1
fi

if [[ ! "$TAG" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]]; then
    echo -e "${RED}Erro: tag inválida: $TAG${NC}" >&2
    exit 1
fi

if [[ ! -x "$HEALTH_CHECK_SCRIPT" ]]; then
    echo -e "${RED}Erro: health check não executável: $HEALTH_CHECK_SCRIPT${NC}" >&2
    exit 1
fi

COMPOSE=("$DOCKER_BIN" compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo "=============================================="
echo -e "${YELLOW}  Portal Essência Feliz - Rollback${NC}"
echo "=============================================="
echo ""
echo -e "Revertendo para: ${YELLOW}${TAG}${NC}"
echo ""

# Confirmação
if [[ "${ROLLBACK_ASSUME_YES:-0}" != "1" ]]; then
    read -r -p "Tem certeza que deseja fazer rollback? (s/N) " resposta
    echo ""

    if [[ ! "$resposta" =~ ^[Ss]$ ]]; then
        echo "Rollback cancelado."
        exit 0
    fi
fi

echo ""

export IMAGE_TAG="$TAG"

if [[ "$MODE" == "registry" ]]; then
    echo -e "${YELLOW}[1/3]${NC} Fazendo pull das imagens (tag: $TAG)..."
    if ! "${COMPOSE[@]}" pull; then
        echo -e "${RED}Erro: Não foi possível baixar imagens com tag '$TAG'${NC}" >&2
        echo "Verifique se a tag existe no registry." >&2
        exit 1
    fi
    echo -e "${GREEN}✓ Imagens baixadas${NC}"
else
    echo -e "${YELLOW}[1/3]${NC} Validando imagem local (tag: $TAG)..."
    if ! "$DOCKER_BIN" image inspect "essencia-api:$TAG" >/dev/null 2>&1; then
        echo -e "${RED}Erro: imagem essencia-api:$TAG não encontrada localmente.${NC}" >&2
        echo "Use --registry para baixar a versão escolhida." >&2
        exit 1
    fi
    echo -e "${GREEN}✓ Imagem local encontrada${NC}"
fi
echo ""

echo -e "${YELLOW}[2/3]${NC} Aplicando rollback..."
"${COMPOSE[@]}" up -d --no-build --pull never
echo -e "${GREEN}✓ Containers recriados${NC}"
echo ""

echo -e "${YELLOW}[3/3]${NC} Verificando health..."
sleep "${ROLLBACK_HEALTH_DELAY_SECONDS:-10}"

# Health check
"$HEALTH_CHECK_SCRIPT"

echo ""
echo "=============================================="
echo -e "${GREEN}  Rollback para $TAG concluído!${NC}"
echo "=============================================="
echo ""
