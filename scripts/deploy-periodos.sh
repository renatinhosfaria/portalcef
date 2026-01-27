#!/bin/bash
# scripts/deploy-periodos.sh
# Script de deploy da refatoração de períodos

set -e

echo "🚀 Iniciando deploy da refatoração de períodos..."
echo ""

# 1. Criar backup
echo "📦 Passo 1/5: Criando backup..."
./scripts/backup-pre-migracao-periodos.sh

# 2. Pull das mudanças
echo ""
echo "📥 Passo 2/5: Atualizando código..."
git pull origin main

# 3. Instalar dependências
echo ""
echo "📚 Passo 3/5: Instalando dependências..."
pnpm install

# 4. Build dos pacotes
echo ""
echo "🔨 Passo 4/5: Build dos pacotes..."
pnpm turbo build

# 5. Rodar migrations
echo ""
echo "🗄️  Passo 5/5: Aplicando migrations..."
./scripts/migrate.sh

echo ""
echo "✅ Deploy concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Execute: ./scripts/validar-deploy-periodos.sh"
echo "   2. Teste as funcionalidades no ambiente"
echo "   3. Se houver problemas: ./scripts/rollback-periodos.sh"
