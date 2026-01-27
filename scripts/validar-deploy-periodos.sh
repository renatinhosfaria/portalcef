#!/bin/bash
# scripts/validar-deploy-periodos.sh
# Validação pós-deploy da refatoração de períodos

set -e

echo "🔍 Validando deploy de períodos..."
echo ""

# Função para verificar endpoint
check_endpoint() {
  local url=$1
  local description=$2

  echo -n "   Testando $description... "

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "ERRO")

  if [ "$response" = "200" ] || [ "$response" = "401" ]; then
    echo "✅ OK ($response)"
    return 0
  else
    echo "❌ FALHA ($response)"
    return 1
  fi
}

# 1. Health check da API
echo "1️⃣ Health Check da API"
check_endpoint "https://www.portalcef.com.br/api/health" "Health endpoint"

# 2. Endpoints de períodos
echo ""
echo "2️⃣ Endpoints de Períodos"
check_endpoint "https://www.portalcef.com.br/api/plano-aula-periodo" "GET /plano-aula-periodo (requer auth)"

# 3. Verificar tabela no banco
echo ""
echo "3️⃣ Estrutura do Banco de Dados"
echo -n "   Verificando tabela plano_aula_periodo... "

table_exists=$(docker exec essencia-postgres psql -U essencia -d essencia_db \
  -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'plano_aula_periodo')")

if [ "$table_exists" = "t" ]; then
  echo "✅ Tabela existe"

  # Contar registros
  count=$(docker exec essencia-postgres psql -U essencia -d essencia_db \
    -tAc "SELECT COUNT(*) FROM plano_aula_periodo")
  echo "   📊 Períodos cadastrados: $count"
else
  echo "❌ Tabela não encontrada"
  exit 1
fi

# 4. Verificar logs de erro
echo ""
echo "4️⃣ Logs de Erro (últimas 10 linhas)"
docker compose -f docker-compose.prod.yml logs api --tail=10 2>&1 | grep -i error || echo "   ✅ Sem erros recentes"

echo ""
echo "🎯 Validação concluída!"
echo ""
echo "📋 Checklist Manual:"
echo "   [ ] Coordenadora consegue criar períodos"
echo "   [ ] Professora visualiza períodos da turma"
echo "   [ ] Validações de sobreposição funcionam"
echo "   [ ] Edição e exclusão funcionam corretamente"
echo ""
echo "⚠️  Se encontrar problemas, execute: ./scripts/rollback-periodos.sh"
