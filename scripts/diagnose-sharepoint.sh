#!/bin/bash
# Script de diagnóstico - Políticas de compartilhamento do SharePoint

set -e

echo "🔍 Script de Diagnóstico SharePoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar se está no diretório correto
if [ ! -f "pnpm-lock.yaml" ]; then
    echo "❌ Erro: Execute este script no root do projeto"
    echo "   Comando correto: ./scripts/diagnose-sharepoint.sh"
    exit 1
fi

# Verificar se .env.docker ou .env existe
if [ ! -f ".env.docker" ] && [ ! -f ".env" ]; then
    echo "❌ Erro: .env.docker ou .env não encontrado"
    exit 1
fi

echo "✓ Configuração encontrada"
echo ""

# Executar diagnóstico
cd services/api
npx ts-node ../../scripts/diagnose-sharepoint-sharing.ts

echo ""
echo "✅ Diagnóstico concluído"
