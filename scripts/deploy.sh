#!/usr/bin/env bash
# =============================================================================
# DEPLOY - Build e deploy local em produção com tag versionada
# Portal Essência Feliz
# =============================================================================
#
# Uso:
#   ./scripts/deploy.sh                 # sem migration
#   ./scripts/deploy.sh --migrar       # backup + migration antes do código novo
#   ./scripts/deploy.sh --completo     # reconstrói todas as imagens
#   ./scripts/deploy.sh <tag>           # usa uma tag explícita
#   ./scripts/deploy.sh --migrar <tag>
#
# Build seletivo: o script compara o commit atual com a versão em produção e
# reconstrói só as apps alteradas. As demais recebem a tag nova apontando para
# a mesma imagem já em produção. Qualquer alteração fora de apps/, services/api/,
# landing-mae-por-inteiro/ e de arquivos que não entram nas imagens (docs,
# scripts, .github, *.md na raiz) força o build completo.
#
# Limpeza: após o health check, remove as imagens de versões que não estão
# entre as 3 últimas publicadas (.deploy/historico) e limita o cache de build.
#
# O script pressupõe que as imagens sejam construídas neste host. Para imagens
# de registry, a integração existente precisa ser alinhada (docs/DEPLOYMENT.md).
# =============================================================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.docker"
DOCKER_BIN="${DOCKER_BIN:-docker}"
PNPM_BIN="${PNPM_BIN:-pnpm}"
HEALTH_CHECK_SCRIPT="${HEALTH_CHECK_SCRIPT:-$PROJECT_DIR/scripts/health-check.sh}"
HISTORICO_DEPLOY="$PROJECT_DIR/.deploy/historico"
VERSOES_MANTIDAS=3
LIMITE_CACHE_BUILD="${LIMITE_CACHE_BUILD:-20GB}"
RUN_MIGRATIONS=0
BUILD_COMPLETO=0
RELEASE_TAG=""

# Alvos do grupo "default" do docker-bake.hcl (apps + services).
ALVOS=(
  home login usuarios escolas turmas planejamento calendario eventos
  eventos-admin loja loja-admin tarefas suporte workflows landing-mae api
)

uso() {
  echo "Uso: $0 [--migrar] [--completo] [tag]" >&2
  exit 1
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --migrar)
      RUN_MIGRATIONS=1
      ;;
    --completo)
      BUILD_COMPLETO=1
      ;;
    --help|-h)
      uso
      ;;
    -*)
      uso
      ;;
    *)
      if [[ -n "$RELEASE_TAG" ]]; then
        uso
      fi
      RELEASE_TAG="$1"
      ;;
  esac
  shift
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Erro: $ENV_FILE não encontrado em $PROJECT_DIR" >&2
  exit 1
fi

if [[ -z "$RELEASE_TAG" ]]; then
  RELEASE_TAG="$(git rev-parse --short HEAD)"
fi

if [[ ! "$RELEASE_TAG" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]]; then
  echo "Erro: tag inválida: $RELEASE_TAG" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Erro: a árvore de trabalho contém alterações não commitadas." >&2
  echo "Faça commit antes do deploy para manter a tag e o rollback confiáveis." >&2
  exit 1
fi

if [[ ! -x "$HEALTH_CHECK_SCRIPT" ]]; then
  echo "Erro: health check não executável: $HEALTH_CHECK_SCRIPT" >&2
  exit 1
fi

COMPOSE=("$DOCKER_BIN" compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
export IMAGE_TAG="$RELEASE_TAG"

obter_ambiente_postgres() {
  "$DOCKER_BIN" exec essencia-postgres printenv "$1" 2>/dev/null || true
}

criar_backup() {
  local usuario banco arquivo
  usuario="$(obter_ambiente_postgres POSTGRES_USER)"
  banco="$(obter_ambiente_postgres POSTGRES_DB)"
  usuario="${usuario:-essencia_prod}"
  banco="${banco:-essencia_db}"
  arquivo="$PROJECT_DIR/backup/backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"

  umask 077
  mkdir -p "$PROJECT_DIR/backup"
  echo "Criando backup antes da migration..."
  if ! "$DOCKER_BIN" exec essencia-postgres pg_dump -U "$usuario" -d "$banco" > "$arquivo"; then
    rm -f "$arquivo"
    echo "Erro: pg_dump falhou; migration abortada." >&2
    exit 1
  fi
  if [[ ! -s "$arquivo" ]]; then
    rm -f "$arquivo"
    echo "Erro: backup vazio; migration abortada." >&2
    exit 1
  fi
  chmod 600 "$arquivo"
  echo "Backup criado: ${arquivo#$PROJECT_DIR/}"
}

eh_alvo() {
  local candidato="$1" alvo
  for alvo in "${ALVOS[@]}"; do
    [[ "$alvo" == "$candidato" ]] && return 0
  done
  return 1
}

# Preenche ALVOS_BUILD (reconstruir), ALVOS_REAPROVEITAR (só nova tag) e
# TAG_BASE (versão em produção). Na dúvida, sempre volta para o build completo.
calcular_alvos() {
  ALVOS_BUILD=("${ALVOS[@]}")
  ALVOS_REAPROVEITAR=()
  TAG_BASE=""
  MOTIVO_COMPLETO=""

  if [[ "$BUILD_COMPLETO" -eq 1 ]]; then
    MOTIVO_COMPLETO="solicitado com --completo"
    return
  fi

  local base alvo arquivo nome
  base="$("$DOCKER_BIN" inspect --format '{{.Config.Image}}' essencia-api 2>/dev/null | sed -n 's/^essencia-api://p' || true)"
  if [[ -z "$base" || "$base" == latest ]]; then
    MOTIVO_COMPLETO="versão em produção desconhecida"
    return
  fi
  if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
    MOTIVO_COMPLETO="commit $base não encontrado no repositório"
    return
  fi
  for alvo in "${ALVOS[@]}"; do
    if ! "$DOCKER_BIN" image inspect "essencia-$alvo:$base" > /dev/null 2>&1; then
      MOTIVO_COMPLETO="imagem essencia-$alvo:$base ausente"
      return
    fi
  done

  local -A alterados=()
  while IFS= read -r arquivo; do
    [[ -z "$arquivo" ]] && continue
    case "$arquivo" in
      docs/*|scripts/*|.github/*|.agent/*|.context/*|.claude/*|.superpowers/*|.gitignore|docker-compose.dev.yml)
        ;;
      apps/*/*)
        nome="${arquivo#apps/}"
        nome="${nome%%/*}"
        if ! eh_alvo "$nome"; then
          MOTIVO_COMPLETO="alteração em $arquivo"
          return
        fi
        alterados[$nome]=1
        ;;
      services/api/*)
        alterados[api]=1
        ;;
      landing-mae-por-inteiro/*|docker-compose.prod.yml)
        alterados[landing-mae]=1
        ;;
      *)
        if [[ "$arquivo" != */* && "$arquivo" == *.md ]]; then
          continue
        fi
        MOTIVO_COMPLETO="alteração em $arquivo"
        return
        ;;
    esac
  done < <(git diff --name-only "$base" HEAD)

  TAG_BASE="$base"
  ALVOS_BUILD=()
  for alvo in "${ALVOS[@]}"; do
    if [[ -n "${alterados[$alvo]:-}" ]]; then
      ALVOS_BUILD+=("$alvo")
    else
      ALVOS_REAPROVEITAR+=("$alvo")
    fi
  done
}

registrar_e_limpar() {
  local ultima=""
  mkdir -p "$(dirname "$HISTORICO_DEPLOY")"
  [[ -f "$HISTORICO_DEPLOY" ]] && ultima="$(tail -n 1 "$HISTORICO_DEPLOY")"
  if [[ "$ultima" != "$RELEASE_TAG" ]]; then
    echo "$RELEASE_TAG" >> "$HISTORICO_DEPLOY"
  fi

  local -A manter=([latest]=1)
  local versao total=0
  while IFS= read -r versao; do
    [[ -z "$versao" || -n "${manter[$versao]:-}" ]] && continue
    manter[$versao]=1
    total=$((total + 1))
    [[ "$total" -ge "$VERSOES_MANTIDAS" ]] && break
  done < <(tac "$HISTORICO_DEPLOY")

  if [[ "$total" -lt "$VERSOES_MANTIDAS" ]]; then
    echo "Histórico com menos de $VERSOES_MANTIDAS versões; nenhuma imagem removida."
  else
    local imagem repositorio tag remover=()
    while IFS= read -r imagem; do
      repositorio="${imagem%:*}"
      tag="${imagem##*:}"
      [[ "$repositorio" == essencia-* ]] || continue
      eh_alvo "${repositorio#essencia-}" || continue
      [[ "$tag" == "<none>" || -n "${manter[$tag]:-}" ]] && continue
      remover+=("$imagem")
    done < <("$DOCKER_BIN" images --format '{{.Repository}}:{{.Tag}}')
    if [[ "${#remover[@]}" -gt 0 ]]; then
      echo "Removendo ${#remover[@]} imagens de versões antigas..."
      "$DOCKER_BIN" rmi "${remover[@]}" > /dev/null \
        || echo "Aviso: algumas imagens antigas não puderam ser removidas." >&2
    fi
    "$DOCKER_BIN" image prune -f > /dev/null \
      || echo "Aviso: falha ao remover imagens órfãs." >&2
  fi

  "$DOCKER_BIN" builder prune -f --max-used-space "$LIMITE_CACHE_BUILD" > /dev/null \
    || echo "Aviso: falha ao limitar o cache de build." >&2
}

eh_alvo_build() {
  local alvo
  for alvo in "${ALVOS_BUILD[@]}"; do
    [[ "$alvo" == "$1" ]] && return 0
  done
  return 1
}

calcular_alvos
FILTRO_TURBO=()
if [[ -n "$TAG_BASE" ]]; then
  FILTRO_TURBO=("--filter=...[$TAG_BASE]")
fi

echo "Deploy da versão: $RELEASE_TAG"
if [[ -n "$TAG_BASE" ]]; then
  echo "Build seletivo a partir de $TAG_BASE: ${ALVOS_BUILD[*]:-nenhuma imagem}"
else
  echo "Build completo: $MOTIVO_COMPLETO"
fi
if [[ "$RUN_MIGRATIONS" -eq 1 ]]; then
  echo "Migrations: habilitadas"
else
  echo "Migrations: desabilitadas (use --migrar quando necessário)"
fi
echo ""

echo "[1/8] Executando lint..."
"$PNPM_BIN" turbo lint "${FILTRO_TURBO[@]}"

echo "[2/8] Executando typecheck..."
"$PNPM_BIN" turbo typecheck "${FILTRO_TURBO[@]}"

echo "[3/8] Executando testes..."
"$PNPM_BIN" turbo test --concurrency=1 "${FILTRO_TURBO[@]}"

echo "[4/8] Construindo imagens..."
if [[ -z "$TAG_BASE" ]]; then
  TAG="$RELEASE_TAG" PUBLISH=false "$DOCKER_BIN" buildx bake -f docker-bake.hcl --load
elif [[ "${#ALVOS_BUILD[@]}" -gt 0 ]]; then
  TAG="$RELEASE_TAG" PUBLISH=false "$DOCKER_BIN" buildx bake -f docker-bake.hcl --load "${ALVOS_BUILD[@]}"
else
  echo "Nenhuma imagem precisa ser reconstruída."
fi
for alvo in "${ALVOS_REAPROVEITAR[@]}"; do
  "$DOCKER_BIN" tag "essencia-$alvo:$TAG_BASE" "essencia-$alvo:$RELEASE_TAG"
  "$DOCKER_BIN" tag "essencia-$alvo:$TAG_BASE" "essencia-$alvo:latest"
done

echo "[5/8] Construindo landing-mae do Compose..."
if [[ -z "$TAG_BASE" ]] || eh_alvo_build landing-mae; then
  "${COMPOSE[@]}" build landing-mae
else
  echo "landing-mae sem alterações; reaproveitando imagem de $TAG_BASE."
fi

if [[ "$RUN_MIGRATIONS" -eq 1 ]]; then
  echo "[6/8] Preparando infraestrutura para migration..."
  "${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 180 postgres redis minio
  criar_backup
  echo "Executando migration da imagem $RELEASE_TAG..."
  "${COMPOSE[@]}" run --rm --no-deps --pull never api node /app/packages/db/dist/migrate.js
else
  echo "[6/8] Pulando migration (nenhuma solicitada)..."
fi

echo "[7/8] Subindo serviços da imagem $RELEASE_TAG..."
"${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 180

echo "[8/8] Verificando saúde dos serviços..."
"$HEALTH_CHECK_SCRIPT"

echo "Limpando versões antigas e cache de build..."
registrar_e_limpar
echo "Deploy concluído: $RELEASE_TAG"
