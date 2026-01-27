#!/bin/bash
# scripts/rollback-periodos.sh
# Rollback da refatoração de períodos

set -e

echo "⚠️  ROLLBACK: Refatoração de Períodos"
echo ""
echo "Este script irá:"
echo "  1. Parar os containers"
echo "  2. Restaurar o backup do banco"
echo "  3. Voltar o código para versão anterior"
echo "  4. Restart dos containers"
echo ""

read -p "Tem certeza que deseja continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Rollback cancelado"
  exit 0
fi

# 1. Encontrar último backup
echo ""
echo "📁 Buscando último backup..."
LATEST_BACKUP=$(ls -t ./backups/pre-migracao-periodos_*.sql 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ Nenhum backup encontrado!"
  echo "   Procure manualmente em ./backups/"
  exit 1
fi

echo "   Backup encontrado: $LATEST_BACKUP"

# 2. Parar containers
echo ""
echo "🛑 Parando containers..."
docker compose -f docker-compose.prod.yml down

# 3. Restaurar banco
echo ""
echo "🗄️  Restaurando banco de dados..."
docker compose -f docker-compose.prod.yml up -d postgres
sleep 5

cat "$LATEST_BACKUP" | docker exec -i essencia-postgres psql -U essencia -d essencia_db

echo "   ✅ Banco restaurado"

# 4. Voltar código
echo ""
echo "🔄 Voltando código..."

# Procurar commit antes da refatoração
ROLLBACK_COMMIT=$(git log --oneline --grep="refatoracao-plano-aula-periodos" -1 --format="%H^" 2>/dev/null)

if [ -z "$ROLLBACK_COMMIT" ]; then
  echo "⚠️  Commit de rollback não encontrado automaticamente"
  echo "   Por favor, execute manualmente: git checkout <commit-antes-da-refatoracao>"
  exit 1
fi

git checkout "$ROLLBACK_COMMIT"

# 5. Rebuild
echo ""
echo "🔨 Rebuild..."
pnpm install
pnpm turbo build

# 6. Restart containers
echo ""
echo "🚀 Restart dos containers..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "✅ Rollback concluído!"
echo ""
echo "📋 Verificações:"
echo "   1. Acesse: https://www.portalcef.com.br/api/health"
echo "   2. Teste funcionalidades básicas"
echo "   3. Verifique logs: docker compose -f docker-compose.prod.yml logs -f"
