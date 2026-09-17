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
unset TAG IMAGE_TAG HEALTH_CHECK_SCRIPT DOCKER_BIN PNPM_BIN

falhar() { echo "Falha: $*" >&2; cat "$DIRETORIO_TESTE/saida.log" >&2; exit 1; }
executar() {
  : > "$REGISTRO_TESTE"
  bash "$DIRETORIO_TESTE/scripts/deploy.sh" "$@" > "$DIRETORIO_TESTE/saida.log" 2>&1
}
contem() { grep -Fq -- "$1" "$REGISTRO_TESTE" || falhar "comando esperado: $1"; }
nao_contem() { if grep -Fq -- "$1" "$REGISTRO_TESTE"; then falhar "comando indevido: $1"; fi; }

executar || falhar 'deploy sem migration deveria passar'
nao_contem 'migrate.js'
nao_contem 'pg_dump'
nao_contem ' pull'
nao_contem 'prune'
contem 'docker IMAGE_TAG=abc1234 TAG=abc1234 buildx bake -f docker-bake.hcl --load'
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
etapas=['pnpm turbo lint','pnpm turbo typecheck','buildx bake','build landing-mae','pg_dump','migrate.js','health IMAGE_TAG']
indices=[next(i for i,l in enumerate(linhas) if etapa in l) for etapa in etapas]
indices.insert(-1, max(i for i,l in enumerate(linhas) if ' up -d --no-build --pull never --wait --wait-timeout 180' in l))
assert indices==sorted(indices), 'Ordem incorreta de operações'
assert all('--env-file .env.docker' in l for l in linhas if ' compose ' in l)
backups=list((pathlib.Path(sys.argv[2])/'backup').glob('*.sql'))
assert len(backups)==1 and backups[0].stat().st_size>0, 'Backup ausente/vazio'
assert backups[0].stat().st_mode & 0o077 == 0, 'Backup acessível por outros usuários'
assert (pathlib.Path(sys.argv[2])/'backup').stat().st_mode & 0o077 == 0, 'Diretório de backup acessível por outros usuários'
PY
echo 'Cenário com migration, backup e mesma tag passou.'

for etapa in 'turbo lint' 'turbo typecheck' 'buildx bake' 'build landing-mae' backup-vazio backup-parcial migrate.js 'up -d' health; do
  rm -rf "$DIRETORIO_TESTE/backup"
  export FALHA_TESTE="$etapa"
  if executar --migrar; then falhar "deveria abortar em $etapa"; fi
  case "$etapa" in
    'turbo lint'|'turbo typecheck') nao_contem 'buildx bake' ;;
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
  echo "Interrupção por falha em $etapa passou."
done
unset FALHA_TESTE

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
