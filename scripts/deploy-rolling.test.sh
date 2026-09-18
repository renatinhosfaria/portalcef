#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/scripts" "$TEST_DIR/bin"
cp "$ROOT_DIR/scripts/deploy-rolling.sh" "$TEST_DIR/scripts/"
printf 'DATABASE_URL=postgresql://fixture:fixture@postgres:5432/fixture\n' > "$TEST_DIR/.env.docker"

cat > "$TEST_DIR/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$ROLLING_LOG"

case "$1" in
  pull|tag)
    exit 0
    ;;
  inspect)
    echo healthy
    exit 0
    ;;
  compose)
    exit 0
    ;;
  *)
    echo "Comando Docker inesperado: $*" >&2
    exit 2
    ;;
esac
DOCKER
chmod +x "$TEST_DIR/bin/docker"

export PATH="$TEST_DIR/bin:$PATH"
export ROLLING_LOG="$TEST_DIR/rolling.log"
export IMAGE_REGISTRY="registry.exemplo/portalcef"
export HEALTH_TIMEOUT=1

bash "$TEST_DIR/scripts/deploy-rolling.sh" abc1234 > "$TEST_DIR/output.log"

test "$(grep -c '^pull registry.exemplo/portalcef/' "$ROLLING_LOG")" -eq 15
grep -Fq 'pull registry.exemplo/portalcef/landing-mae:abc1234' "$ROLLING_LOG"
grep -Fq 'tag registry.exemplo/portalcef/api:abc1234 essencia-api:abc1234' "$ROLLING_LOG"
grep -Fq -- '--env-file .env.docker up -d --force-recreate --no-build --pull never --no-deps api' "$ROLLING_LOG"
while IFS= read -r linha; do
  case "$linha" in
    compose\ *)
      grep -Fq -- '--env-file .env.docker' <<< "$linha" || {
        echo "Falha: Compose sem --env-file: $linha" >&2
        exit 1
      }
      ;;
  esac
done < "$ROLLING_LOG"
if grep -Eq '^compose .* pull($| )' "$ROLLING_LOG"; then
  echo 'Falha: rolling usou pull do Compose em vez do registry explícito.' >&2
  exit 1
fi
if grep -Fq 'image prune' "$ROLLING_LOG"; then
  echo 'Falha: rolling removeu imagens de rollback.' >&2
  exit 1
fi
echo 'Rolling com registry, tag única e imagens preservadas passou.'

: > "$ROLLING_LOG"
if bash "$TEST_DIR/scripts/deploy-rolling.sh" > "$TEST_DIR/sem-tag.log" 2>&1; then
  echo 'Falha: rolling aceitou tag ausente.' >&2
  exit 1
fi
test ! -s "$ROLLING_LOG"
echo 'Validação de tag obrigatória passou.'
