#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
CREATED_ENV_FILE=0

# migrate.sh prod aborta se .env.docker não existir. O arquivo é gitignored,
# então em clone limpo (e em CI) ele não está presente.
if [ ! -f "$ROOT_DIR/.env.docker" ]; then
  printf 'DATABASE_URL=postgresql://fake:fake@postgres:5432/fake\n' > "$ROOT_DIR/.env.docker"
  CREATED_ENV_FILE=1
fi

cleanup() {
  rm -rf "$TMP_DIR"
  [ "$CREATED_ENV_FILE" -eq 1 ] && rm -f "$ROOT_DIR/.env.docker"
  return 0
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# Cenário 1: caminho feliz — backup válido, migration via node
# -----------------------------------------------------------------------------
LOG_FILE="$TMP_DIR/docker.log"
OUTPUT_FILE="$TMP_DIR/output.log"

cat > "$TMP_DIR/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "$DOCKER_FAKE_LOG"

case "$*" in
  "compose -f docker-compose.prod.yml --env-file .env.docker ps api")
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
  *"--env-file .env.docker exec api sh -lc command -v pnpm"*)
    exit 1
    ;;
  *"--env-file .env.docker exec api sh -lc test -f /app/packages/db/dist/migrate.js"*)
    exit 0
    ;;
  "compose -f docker-compose.prod.yml --env-file .env.docker exec api node /app/packages/db/dist/migrate.js")
    echo "migration via node"
    exit 0
    ;;
  *"--env-file .env.docker exec api pnpm"*)
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
grep -q "exec api node /app/packages/db/dist/migrate.js" "$LOG_FILE"
grep -q "Migrations concluídas" "$OUTPUT_FILE"

# Regressão: toda chamada ao compose precisa levar --env-file. Sem isso o
# compose lê .env (sem DATABASE_URL) e a API sobe quebrada.
while IFS= read -r linha; do
  case "$linha" in
    compose\ *)
      case "$linha" in
        *"--env-file .env.docker"*) ;;
        *)
          echo "Chamada ao compose sem --env-file: $linha" >&2
          exit 1
          ;;
      esac
      ;;
  esac
done < "$LOG_FILE"

echo "Cenário 1 (caminho feliz) passou."

# -----------------------------------------------------------------------------
# Cenário 2: pg_dump falha e produz arquivo vazio — migration deve abortar
# -----------------------------------------------------------------------------
LOG_FILE_2="$TMP_DIR/docker2.log"
OUTPUT_FILE_2="$TMP_DIR/output2.log"

cat > "$TMP_DIR/docker" <<'FAKE_DOCKER_VAZIO'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "$DOCKER_FAKE_LOG"

case "$*" in
  "compose -f docker-compose.prod.yml --env-file .env.docker ps api")
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
  *"exec essencia-postgres pg_dump"*)
    echo 'FATAL: role does not exist' >&2
    exit 1
    ;;
esac

echo "Comando inesperado no cenário de backup vazio: $*" >&2
exit 2
FAKE_DOCKER_VAZIO

chmod +x "$TMP_DIR/docker"

set +e
PATH="$TMP_DIR:$PATH" DOCKER_FAKE_LOG="$LOG_FILE_2" \
  bash "$ROOT_DIR/scripts/migrate.sh" prod > "$OUTPUT_FILE_2" 2>&1
STATUS=$?
set -e

if [ "$STATUS" -eq 0 ]; then
  echo "Falha: migrate.sh deveria abortar quando o backup sai vazio." >&2
  exit 1
fi

if grep -q "migrate.js" "$LOG_FILE_2"; then
  echo "Falha: migration rodou apesar do backup vazio." >&2
  exit 1
fi

grep -q "backup falhou" "$OUTPUT_FILE_2"

echo "Cenário 2 (backup vazio aborta) passou."
echo "Teste do scripts/migrate.sh passou."
