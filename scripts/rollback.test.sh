#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/scripts" "$TEST_DIR/bin"
cp "$ROOT_DIR/scripts/rollback.sh" "$TEST_DIR/scripts/"
cat > "$TEST_DIR/.env.docker" <<'ENV'
DATABASE_URL=postgresql://fixture:fixture@postgres:5432/fixture
ENV

cat > "$TEST_DIR/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$ROLLBACK_LOG"

case "$*" in
  *"image inspect essencia-api:abc1234"*)
    [[ "${IMAGE_PRESENT:-1}" == 1 ]]
    ;;
  *"compose"*" pull"*)
    [[ "${REGISTRY_MODE:-0}" == 1 ]]
    ;;
  *"compose"*" up -d"*)
    [[ "${ROLLBACK_UP_ALLOWED:-1}" == 1 ]]
    ;;
  *)
    exit 0
    ;;
esac
DOCKER
cat > "$TEST_DIR/scripts/health-check.sh" <<'HEALTH'
#!/usr/bin/env bash
printf 'health IMAGE_TAG=%s\n' "${IMAGE_TAG:-}" >> "$ROLLBACK_LOG"
HEALTH
chmod +x "$TEST_DIR/bin/docker" "$TEST_DIR/scripts/health-check.sh"

export PATH="$TEST_DIR/bin:$PATH"
export ROLLBACK_LOG="$TEST_DIR/rollback.log"
export ROLLBACK_ASSUME_YES=1
export ROLLBACK_HEALTH_DELAY_SECONDS=0

ROOT_TEST_SCRIPT="$TEST_DIR/scripts/rollback.sh"

: > "$ROLLBACK_LOG"
IMAGE_PRESENT=1 REGISTRY_MODE=0 bash "$ROOT_TEST_SCRIPT" --local abc1234 > "$TEST_DIR/local.out"
grep -Fq -- 'compose -f docker-compose.prod.yml --env-file .env.docker up -d --no-build --pull never' "$ROLLBACK_LOG"
grep -Fq -- 'health IMAGE_TAG=abc1234' "$ROLLBACK_LOG"
if grep -Fq -- ' pull' "$ROLLBACK_LOG"; then
  echo 'Falha: rollback local tentou baixar imagem.' >&2
  exit 1
fi
echo 'Rollback local sem registry passou.'

: > "$ROLLBACK_LOG"
if IMAGE_PRESENT=0 REGISTRY_MODE=0 bash "$ROOT_TEST_SCRIPT" --local abc1234 > "$TEST_DIR/missing.out" 2>&1; then
  echo 'Falha: rollback local aceitou imagem ausente.' >&2
  exit 1
fi
if grep -Fq -- ' up -d ' "$ROLLBACK_LOG"; then
  echo 'Falha: rollback subiu serviços sem imagem local.' >&2
  exit 1
fi
grep -Fq 'não encontrada localmente' "$TEST_DIR/missing.out"
echo 'Rollback local com imagem ausente abortou.'

: > "$ROLLBACK_LOG"
IMAGE_PRESENT=0 REGISTRY_MODE=1 bash "$ROOT_TEST_SCRIPT" --registry abc1234 > "$TEST_DIR/registry.out"
grep -Fq -- 'compose -f docker-compose.prod.yml --env-file .env.docker pull' "$ROLLBACK_LOG"
grep -Fq -- 'compose -f docker-compose.prod.yml --env-file .env.docker up -d --no-build --pull never' "$ROLLBACK_LOG"
echo 'Rollback via registry passou.'

echo 'Testes de rollback concluídos sem acessar produção.'
