#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$ROOT_DIR/docker-compose.dev.yml"
DOCKERFILE="$ROOT_DIR/docker/Dockerfile.dev"

for volume in essencia-dev-postgres-data essencia-dev-redis-data essencia-dev-minio-data; do
  grep -Fq "$volume" "$COMPOSE" || { echo "Volume ausente no Compose: $volume" >&2; exit 1; }
done

for volume in essencia-postgres-data essencia-redis-data essencia-minio-data; do
  if grep -Fq "$volume" "$COMPOSE"; then
    echo "Volume de produção ainda referenciado no Compose dev: $volume" >&2
    exit 1
  fi
done

for port in '3013:3013' '3015:3015'; do
  grep -Fq '"'"$port"'"' "$COMPOSE" || { echo "Porta ausente no Compose: $port" >&2; exit 1; }
done

grep -Fq 'COPY apps/suporte/package.json ./apps/suporte/' "$DOCKERFILE"
grep -Fq 'COPY apps/workflows/package.json ./apps/workflows/' "$DOCKERFILE"
grep -Fq '3013' "$DOCKERFILE"
grep -Fq '3015' "$DOCKERFILE"

echo 'Configuração dev de volumes, portas e manifests passou.'
