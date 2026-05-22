#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
LOG_FILE="$TMP_DIR/docker.log"
OUTPUT_FILE="$TMP_DIR/output.log"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat > "$TMP_DIR/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "$DOCKER_FAKE_LOG"

case "$*" in
  "compose -f docker-compose.prod.yml ps api")
    echo "api Up"
    exit 0
    ;;
  "exec essencia-postgres printenv POSTGRES_USER")
    echo "essencia_prod"
    exit 0
    ;;
  "exec essencia-postgres printenv POSTGRES_DB")
    echo "essencia_db"
    exit 0
    ;;
  *"exec essencia-postgres pg_dump -U essencia_prod -d essencia_db"*)
    echo "-- backup fake"
    exit 0
    ;;
  *"exec essencia-postgres pg_dump"*)
    echo "pg_dump recebeu credenciais incorretas" >&2
    exit 1
    ;;
  *"compose -f docker-compose.prod.yml exec api sh -lc command -v pnpm"*)
    exit 1
    ;;
  *"compose -f docker-compose.prod.yml exec api sh -lc test -f /app/packages/db/dist/migrate.js"*)
    exit 0
    ;;
  "compose -f docker-compose.prod.yml exec api node /app/packages/db/dist/migrate.js")
    echo "migration via node"
    exit 0
    ;;
  *"compose -f docker-compose.prod.yml exec api pnpm"*)
    echo "pnpm não existe no runtime" >&2
    exit 127
    ;;
  *"exec essencia-postgres psql -U essencia_prod -d essencia_db"*)
    echo " tabelas "
    echo "--------"
    echo "     42"
    exit 0
    ;;
esac

echo "Comando docker falso não esperado: $*" >&2
exit 2
FAKE_DOCKER

chmod +x "$TMP_DIR/docker"

PATH="$TMP_DIR:$PATH" DOCKER_FAKE_LOG="$LOG_FILE" \
  bash "$ROOT_DIR/scripts/migrate.sh" prod > "$OUTPUT_FILE"

grep -q "exec essencia-postgres printenv POSTGRES_USER" "$LOG_FILE"
grep -q "exec essencia-postgres pg_dump -U essencia_prod -d essencia_db" "$LOG_FILE"
grep -q "compose -f docker-compose.prod.yml exec api node /app/packages/db/dist/migrate.js" "$LOG_FILE"
grep -q "Migrations concluídas" "$OUTPUT_FILE"

echo "Teste do scripts/migrate.sh passou."
