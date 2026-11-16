#!/usr/bin/env bash
# Os cenários rodam em uma cópia temporária, sem acessar arquivos de produção.
set -euo pipefail
DIRETORIO_RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIRETORIO_TESTE="$(mktemp -d)"
trap 'rm -rf "$DIRETORIO_TESTE"' EXIT
mkdir -p "$DIRETORIO_TESTE/scripts" "$DIRETORIO_TESTE/bin"
cp "$DIRETORIO_RAIZ/scripts/deploy.sh" "$DIRETORIO_TESTE/scripts/"
printf 'CONFIGURACAO_FICTICIA=teste\n' > "$DIRETORIO_TESTE/.env.docker"

cat > "$DIRETORIO_TESTE/bin/git" <<'SIMULADOR'
#!/usr/bin/env bash
case "$1" in
  rev-parse) echo abc1234 ;;
  status) printf '%s' "${ARVORE_SUJA:-}" ;;
  cat-file) [[ -z "${COMMIT_AUSENTE:-}" ]] ;;
  diff) printf '%b' "${ARQUIVOS_ALTERADOS:-}" ;;
  *) exit 2 ;;
esac
SIMULADOR
cat > "$DIRETORIO_TESTE/bin/pnpm" <<'SIMULADOR'
#!/usr/bin/env bash
printf 'pnpm %s\n' "$*" >> "$REGISTRO_TESTE"
[[ "$*" != "${FALHA_TESTE:-}" ]]
SIMULADOR
cat > "$DIRETORIO_TESTE/bin/docker" <<'SIMULADOR'
#!/usr/bin/env bash
printf 'docker IMAGE_TAG=%s TAG=%s %s\n' "${IMAGE_TAG:-}" "${TAG:-}" "$*" >> "$REGISTRO_TESTE"
if [[ "$1" == inspect ]]; then
  [[ -n "${TAG_PRODUCAO:-}" ]] || exit 1
  echo "essencia-api:$TAG_PRODUCAO"
  exit 0
fi
if [[ "$1 ${2:-}" == 'image inspect' ]]; then
  [[ -z "${IMAGEM_AUSENTE:-}" || "$*" != *"$IMAGEM_AUSENTE"* ]]
  exit
fi
if [[ "$1" == images ]]; then
  printf '%b' "${IMAGENS_EXISTENTES:-}"
  exit 0
fi
if [[ "$*" == *"pg_dump"* ]]; then
  [[ "${FALHA_TESTE:-}" == backup-vazio ]] && exit 0
  printf '%s\n' '-- backup de teste'
  [[ "${FALHA_TESTE:-}" == backup-parcial ]] && exit 1
fi
[[ -z "${FALHA_TESTE:-}" || "$*" != *"$FALHA_TESTE"* ]]
SIMULADOR
cat > "$DIRETORIO_TESTE/scripts/health-check.sh" <<'SIMULADOR'
#!/usr/bin/env bash
printf 'health IMAGE_TAG=%s\n' "${IMAGE_TAG:-}" >> "$REGISTRO_TESTE"
[[ "${FALHA_TESTE:-}" != health ]]
SIMULADOR
chmod +x "$DIRETORIO_TESTE/bin/"* "$DIRETORIO_TESTE/scripts/health-check.sh"
export PATH="$DIRETORIO_TESTE/bin:$PATH"
export REGISTRO_TESTE="$DIRETORIO_TESTE/comandos.log"
unset TAG IMAGE_TAG HEALTH_CHECK_SCRIPT DOCKER_BIN PNPM_BIN TAG_PRODUCAO ARQUIVOS_ALTERADOS IMAGEM_AUSENTE COMMIT_AUSENTE IMAGENS_EXISTENTES

falhar() { echo "Falha: $*" >&2; cat "$DIRETORIO_TESTE/saida.log" >&2; exit 1; }
executar() {
  : > "$REGISTRO_TESTE"
  bash "$DIRETORIO_TESTE/scripts/deploy.sh" "$@" > "$DIRETORIO_TESTE/saida.log" 2>&1
}
contem() { grep -Fq -- "$1" "$REGISTRO_TESTE" || falhar "comando esperado: $1"; }
nao_contem() { if grep -Fq -- "$1" "$REGISTRO_TESTE"; then falhar "comando indevido: $1"; fi; }
contem_linha() { grep -Fxq -- "$1" "$REGISTRO_TESTE" || falhar "linha esperada: $1"; }
BAKE_COMPLETO='docker IMAGE_TAG=abc1234 TAG=abc1234 buildx bake -f docker-bake.hcl --load'

executar || falhar 'deploy sem migration deveria passar'
nao_contem 'migrate.js'
nao_contem 'pg_dump'
nao_contem ' pull'
nao_contem ' rmi '
nao_contem ' tag essencia-'
contem_linha "$BAKE_COMPLETO"
contem '--env-file .env.docker build landing-mae'
contem '--env-file .env.docker up -d --no-build --pull never --wait --wait-timeout 180'
contem 'health IMAGE_TAG=abc1234'
[[ "$(cat "$DIRETORIO_TESTE/.env.docker")" == CONFIGURACAO_FICTICIA=teste ]] || falhar 'ambiente alterado'
echo 'Cenário sem migration passou.'

executar --migrar || falhar 'deploy com migration deveria passar'
contem 'docker IMAGE_TAG=abc1234 TAG= compose -f docker-compose.prod.yml --env-file .env.docker run --rm --no-deps --pull never api node /app/packages/db/dist/migrate.js'
python3 - "$REGISTRO_TESTE" "$DIRETORIO_TESTE" <<'PY'
import pathlib,sys
linhas=pathlib.Path(sys.argv[1]).read_text().splitlines()
etapas=['pnpm turbo lint','pnpm turbo typecheck','pnpm turbo test --concurrency=1','buildx bake','build landing-mae','pg_dump','migrate.js','health IMAGE_TAG']
indices=[next(i for i,l in enumerate(linhas) if etapa in l) for etapa in etapas]
indices.insert(-1, max(i for i,l in enumerate(linhas) if ' up -d --no-build --pull never --wait --wait-timeout 180' in l))
assert indices==sorted(indices), 'Ordem incorreta de operações'
limpeza=next(i for i,l in enumerate(linhas) if 'builder prune' in l)
assert limpeza > indices[-1], 'Limpeza do cache antes do health check'
assert all('--env-file .env.docker' in l for l in linhas if ' compose ' in l)
backups=list((pathlib.Path(sys.argv[2])/'backup').glob('*.sql'))
assert len(backups)==1 and backups[0].stat().st_size>0, 'Backup ausente/vazio'
assert backups[0].stat().st_mode & 0o077 == 0, 'Backup acessível por outros usuários'
assert (pathlib.Path(sys.argv[2])/'backup').stat().st_mode & 0o077 == 0, 'Diretório de backup acessível por outros usuários'
PY
echo 'Cenário com migration, backup e mesma tag passou.'

for etapa in 'turbo lint' 'turbo typecheck' 'turbo test --concurrency=1' 'buildx bake' 'build landing-mae' backup-vazio backup-parcial migrate.js 'up -d' health; do
  rm -rf "$DIRETORIO_TESTE/backup"
  export FALHA_TESTE="$etapa"
  if executar --migrar; then falhar "deveria abortar em $etapa"; fi
  case "$etapa" in
    'turbo lint'|'turbo typecheck'|'turbo test --concurrency=1') nao_contem 'buildx bake' ;;
    'buildx bake'|'build landing-mae') nao_contem 'pg_dump' ;;
    backup-*)
      nao_contem 'migrate.js'
      if compgen -G "$DIRETORIO_TESTE/backup/*.sql" > /dev/null; then falhar 'backup inválido preservado'; fi
      ;;
    migrate.js)
      if grep -Eq 'up -d --no-build --pull never --wait --wait-timeout 180$' "$REGISTRO_TESTE"; then falhar 'subida final ocorreu apesar da migration falhar'; fi
      ;;
    'up -d') nao_contem 'health IMAGE_TAG' ;;
  esac
  if grep -q 'Deploy concluído' "$DIRETORIO_TESTE/saida.log"; then falhar 'sucesso anunciado apesar de falha'; fi
  nao_contem 'prune'
  nao_contem ' rmi '
  echo "Interrupção por falha em $etapa passou."
done
unset FALHA_TESTE

# -----------------------------------------------------------------------------
# Build seletivo: reconstrói só o que mudou desde a versão em produção
# -----------------------------------------------------------------------------
rm -rf "$DIRETORIO_TESTE/.deploy"
export TAG_PRODUCAO=def5678

export ARQUIVOS_ALTERADOS='apps/eventos-admin/src/pagina.tsx\nservices/api/src/servico.ts\ndocs/DEPLOYMENT.md\nREADME.md\nscripts/deploy.sh\n.superpowers/sdd/plano.md\n'
executar || falhar 'deploy seletivo deveria passar'
contem_linha "$BAKE_COMPLETO eventos-admin api"
contem 'pnpm turbo lint --filter=...[def5678]'
contem 'pnpm turbo typecheck --filter=...[def5678]'
contem 'pnpm turbo test --concurrency=1 --filter=...[def5678]'
contem 'tag essencia-home:def5678 essencia-home:abc1234'
contem 'tag essencia-landing-mae:def5678 essencia-landing-mae:abc1234'
nao_contem 'tag essencia-eventos-admin:def5678'
nao_contem 'tag essencia-api:def5678'
nao_contem 'build landing-mae'
contem 'health IMAGE_TAG=abc1234'
grep -q 'Deploy concluído' "$DIRETORIO_TESTE/saida.log" || falhar 'deploy seletivo não concluiu'
echo 'Cenário de build seletivo passou.'

export ARQUIVOS_ALTERADOS='landing-mae-por-inteiro/index.html\n'
executar || falhar 'deploy só da landing deveria passar'
contem_linha "$BAKE_COMPLETO landing-mae"
contem 'build landing-mae'
echo 'Cenário só da landing passou.'

export ARQUIVOS_ALTERADOS='docs/API.md\n'
executar || falhar 'deploy só de documentação deveria passar'
nao_contem 'buildx bake'
contem 'tag essencia-api:def5678 essencia-api:abc1234'
contem '--env-file .env.docker up -d --no-build --pull never --wait --wait-timeout 180'
echo 'Cenário só de documentação passou.'

for arquivo in 'packages/shared/src/x.ts' 'pnpm-lock.yaml' 'docker/Dockerfile.nextjs' 'docker-bake.hcl' 'apps/app-desconhecido/x.ts' 'services/worker/x.ts' 'package.json'; do
  export ARQUIVOS_ALTERADOS="apps/home/a.tsx\n$arquivo\n"
  executar || falhar "deploy com $arquivo deveria passar"
  contem_linha "$BAKE_COMPLETO"
  contem 'build landing-mae'
  nao_contem ' tag essencia-'
  nao_contem '--filter='
  echo "Alteração em $arquivo força build completo: passou."
done

export ARQUIVOS_ALTERADOS='apps/home/a.tsx\n'
export IMAGEM_AUSENTE='essencia-loja:def5678'
executar || falhar 'deploy com imagem base ausente deveria passar'
contem_linha "$BAKE_COMPLETO"
nao_contem ' tag essencia-'
unset IMAGEM_AUSENTE
echo 'Imagem base ausente força build completo: passou.'

export COMMIT_AUSENTE=1
executar || falhar 'deploy com commit base desconhecido deveria passar'
contem_linha "$BAKE_COMPLETO"
unset COMMIT_AUSENTE
echo 'Commit base desconhecido força build completo: passou.'

executar --completo || falhar 'deploy --completo deveria passar'
contem_linha "$BAKE_COMPLETO"
nao_contem ' tag essencia-'
echo 'Opção --completo passou.'

export TAG_PRODUCAO=latest
executar || falhar 'deploy com produção em latest deveria passar'
contem_linha "$BAKE_COMPLETO"
export TAG_PRODUCAO=def5678
echo 'Produção sem tag versionada força build completo: passou.'

# -----------------------------------------------------------------------------
# Limpeza: mantém as 3 últimas versões publicadas e remove as demais
# -----------------------------------------------------------------------------
mkdir -p "$DIRETORIO_TESTE/.deploy"
printf 't1\nt2\ndef5678\n' > "$DIRETORIO_TESTE/.deploy/historico"
export IMAGENS_EXISTENTES='essencia-home:t1\nessencia-api:t1\nessencia-home:t2\nessencia-home:def5678\nessencia-home:abc1234\nessencia-home:latest\nessencia-dev:latest\nessencia-dev:t1\noutra-imagem:t1\nessencia-home:<none>\n'
executar || falhar 'deploy com limpeza deveria passar'
REMOVIDAS=" $(grep ' rmi ' "$REGISTRO_TESTE" | sed 's/.* rmi //') "
for imagem in essencia-home:t1 essencia-api:t1; do
  [[ "$REMOVIDAS" == *" $imagem "* ]] || falhar "imagem antiga não removida: $imagem"
done
for imagem in essencia-home:t2 essencia-home:def5678 essencia-home:abc1234 essencia-home:latest essencia-dev:latest essencia-dev:t1 outra-imagem:t1 'essencia-home:<none>'; do
  [[ "$REMOVIDAS" != *" $imagem "* ]] || falhar "imagem preservada foi removida: $imagem"
done
contem 'builder prune'
[[ "$(tail -1 "$DIRETORIO_TESTE/.deploy/historico")" == abc1234 ]] || falhar 'histórico não registrou a versão nova'
echo 'Limpeza das versões antigas passou.'

executar || falhar 'redeploy da mesma versão deveria passar'
[[ "$(grep -c '^abc1234$' "$DIRETORIO_TESTE/.deploy/historico")" == 1 ]] || falhar 'histórico duplicou a versão'
echo 'Redeploy não duplica histórico: passou.'

printf 'def5678\n' > "$DIRETORIO_TESTE/.deploy/historico"
executar || falhar 'deploy com histórico curto deveria passar'
nao_contem ' rmi '
echo 'Histórico curto preserva imagens: passou.'

printf 't1\nt2\ndef5678\n' > "$DIRETORIO_TESTE/.deploy/historico"
export FALHA_TESTE='rmi'
executar || falhar 'falha na limpeza não pode derrubar o deploy'
grep -q 'Deploy concluído' "$DIRETORIO_TESTE/saida.log" || falhar 'deploy não concluiu após falha na limpeza'
unset FALHA_TESTE
echo 'Falha na limpeza apenas avisa: passou.'
unset TAG_PRODUCAO ARQUIVOS_ALTERADOS IMAGENS_EXISTENTES

if executar --opcao-invalida; then falhar 'opção inválida foi aceita'; fi
[[ ! -s "$REGISTRO_TESTE" ]] || falhar 'opção inválida executou comandos'
export ARVORE_SUJA=' M arquivo.ts'
if executar; then falhar 'árvore de trabalho alterada foi aceita'; fi
[[ ! -s "$REGISTRO_TESTE" ]] || falhar 'árvore alterada iniciou deploy'
unset ARVORE_SUJA
rm "$DIRETORIO_TESTE/.env.docker"
if executar; then falhar 'ambiente ausente foi aceito'; fi
[[ ! -s "$REGISTRO_TESTE" ]] || falhar 'ambiente ausente executou comandos'
echo 'Validações de entrada passaram.'
echo 'Testes de deploy concluídos sem acessar produção.'
