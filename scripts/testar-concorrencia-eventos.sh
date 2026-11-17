#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Banco descartável, sem rede/volumes/credenciais dos serviços de produção.
container_teste="essencia-eventos-teste-$$"
trap 'docker rm -f "$container_teste" >/dev/null 2>&1 || true' EXIT
pnpm --filter @essencia/db build
pnpm --filter @essencia/shared build
docker run --rm -d --name "$container_teste" --memory=256m --cpus=1 \
  --tmpfs /var/lib/postgresql/data -p 127.0.0.1::5432 \
  -e POSTGRES_USER=teste -e POSTGRES_PASSWORD=teste_descartavel -e POSTGRES_DB=eventos_teste postgres:16-alpine >/dev/null
for tentativa in {1..30}; do
  if docker exec "$container_teste" pg_isready -h 127.0.0.1 -U teste -d eventos_teste >/dev/null 2>&1; then break; fi
  sleep 1
done
porta_teste="$(docker port "$container_teste" 5432/tcp | sed 's/.*://')"
export DATABASE_URL="postgresql://teste:teste_descartavel@127.0.0.1:${porta_teste}/eventos_teste"
export EVENTOS_BANCO_TESTE=1
export EVENTOS_QR_SECRET=segredo-exclusivo-de-testes
# Aplica as migrations reais do módulo sobre dependências mínimas descartáveis.
node services/api/test/preparar-banco-eventos.cjs
pnpm --filter @essencia/api exec jest --config jest.eventos-integracao.config.js --runInBand "$@"
