#!/bin/bash
# =============================================================================
# ROLLBACK - Reverter para versão anterior
# Portal Essência Feliz
# =============================================================================
#
# Uso: ./scripts/rollback.sh <tag>
#
# Exemplo:
#   ./scripts/rollback.sh abc1234     # Rollback para commit específico
#   ./scripts/rollback.sh v1.2.3      # Rollback para tag específica
#
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar argumento
if [ -z "$1" ]; then
    echo -e "${RED}Erro: Tag não especificada${NC}"
    echo ""
    echo "Uso: ./scripts/rollback.sh <tag>"
    echo ""
    echo "Exemplos:"
    echo "  ./scripts/rollback.sh abc1234   # Commit hash"
    echo "  ./scripts/rollback.sh v1.2.3    # Versão"
    echo ""
    echo "Para ver tags disponíveis:"
    echo "  docker images | grep portalcef"
    echo ""
    exit 1
fi

TAG="$1"
COMPOSE_FILE="docker-compose.prod.yml"

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=============================================="
echo -e "${YELLOW}  Portal Essência Feliz - Rollback${NC}"
echo "=============================================="
echo ""
echo -e "Revertendo para: ${YELLOW}${TAG}${NC}"
echo ""

# Confirmação
read -p "Tem certeza que deseja fazer rollback? (s/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Rollback cancelado."
    exit 0
fi

echo ""

# Exportar tag
export IMAGE_TAG="$TAG"

echo -e "${YELLOW}[1/3]${NC} Fazendo pull das imagens (tag: $TAG)..."
docker compose -f $COMPOSE_FILE pull || {
    echo -e "${RED}Erro: Não foi possível baixar imagens com tag '$TAG'${NC}"
    echo "Verifique se a tag existe no registry."
    exit 1
}
echo -e "${GREEN}✓ Imagens baixadas${NC}"
echo ""

echo -e "${YELLOW}[2/3]${NC} Aplicando rollback..."
docker compose -f $COMPOSE_FILE up -d
echo -e "${GREEN}✓ Containers recriados${NC}"
echo ""

echo -e "${YELLOW}[3/3]${NC} Verificando health..."
sleep 10

# Health check
./scripts/health-check.sh

echo ""
echo "=============================================="
echo -e "${GREEN}  Rollback para $TAG concluído!${NC}"
echo "=============================================="
echo ""
