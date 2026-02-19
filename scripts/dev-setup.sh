#!/bin/bash
# =============================================================================
# DEV SETUP - Configuração inicial do ambiente de desenvolvimento
# Portal Essência Feliz
# =============================================================================
#
# Uso: ./scripts/dev-setup.sh
#
# Este script:
# 1. Cria volumes necessários para desenvolvimento
# 2. Sobe a infraestrutura (postgres, redis, minio)
# 3. Instala dependências
# 4. Roda migrations
# =============================================================================

set -e

echo "=============================================="
echo "  Portal Essência Feliz - Dev Setup"
echo "=============================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${YELLOW}[1/6]${NC} Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Erro: Docker não está instalado${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}Erro: Docker daemon não está rodando${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker OK${NC}"

echo ""
echo -e "${YELLOW}[2/6]${NC} Criando volumes de dados (se não existirem)..."

# Volumes de dados (persistentes)
docker volume create essencia-postgres-data 2>/dev/null || echo "  Volume essencia-postgres-data já existe"
docker volume create essencia-redis-data 2>/dev/null || echo "  Volume essencia-redis-data já existe"
docker volume create essencia-minio-data 2>/dev/null || echo "  Volume essencia-minio-data já existe"

# Volumes de desenvolvimento
docker volume create essencia-node-modules-dev 2>/dev/null || echo "  Volume essencia-node-modules-dev já existe"
docker volume create essencia-turbo-cache-dev 2>/dev/null || echo "  Volume essencia-turbo-cache-dev já existe"
docker volume create essencia-pnpm-store-dev 2>/dev/null || echo "  Volume essencia-pnpm-store-dev já existe"

echo -e "${GREEN}✓ Volumes criados${NC}"

echo ""
echo -e "${YELLOW}[3/6]${NC} Subindo infraestrutura (postgres, redis, minio)..."
docker compose -f docker-compose.dev.yml up -d postgres redis minio

# Aguardar serviços ficarem healthy
echo "  Aguardando serviços ficarem prontos..."
sleep 5

# Verificar health
for service in postgres redis minio; do
    if docker compose -f docker-compose.dev.yml ps $service | grep -q "healthy"; then
        echo -e "  ${GREEN}✓ $service healthy${NC}"
    else
        echo -e "  ${YELLOW}⏳ Aguardando $service...${NC}"
        sleep 5
    fi
done

echo -e "${GREEN}✓ Infraestrutura rodando${NC}"

echo ""
echo -e "${YELLOW}[4/6]${NC} Construindo imagem de desenvolvimento..."
docker compose -f docker-compose.dev.yml build dev

echo -e "${GREEN}✓ Imagem construída${NC}"

echo ""
echo -e "${YELLOW}[5/6]${NC} Instalando dependências..."
docker compose -f docker-compose.dev.yml run --rm dev pnpm install

echo -e "${GREEN}✓ Dependências instaladas${NC}"

echo ""
echo -e "${YELLOW}[6/6]${NC} Rodando migrations..."
docker compose -f docker-compose.dev.yml run --rm dev pnpm db:migrate

echo -e "${GREEN}✓ Migrations aplicadas${NC}"

echo ""
echo "=============================================="
echo -e "${GREEN}  Setup completo!${NC}"
echo "=============================================="
echo ""
echo "Para iniciar o desenvolvimento, execute:"
echo ""
echo -e "  ${YELLOW}docker compose -f docker-compose.dev.yml up dev${NC}"
echo ""
echo "Ou para rodar em background:"
echo ""
echo -e "  ${YELLOW}docker compose -f docker-compose.dev.yml up -d dev${NC}"
echo ""
echo "Apps disponíveis em:"
echo "  - Home:        http://localhost:3000"
echo "  - API:         http://localhost:3001"
echo "  - Login:       http://localhost:3003"
echo "  - Usuários:    http://localhost:3004"
echo "  - Escolas:     http://localhost:3005"
echo "  - Turmas:      http://localhost:3006"
echo "  - Planejamento: http://localhost:3007"
echo "  - Calendário:  http://localhost:3008"
echo "  - Loja:        http://localhost:3010"
echo "  - Loja Admin:  http://localhost:3011"
echo "  - Tarefas:     http://localhost:3012"
echo ""
