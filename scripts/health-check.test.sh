#!/usr/bin/env bash
# Testa uma cópia isolada; todos os acessos a Docker e HTTP são simulados.
set -euo pipefail
DIRETORIO_RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIRETORIO_TESTE="$(mktemp -d)"
trap 'rm -rf "$DIRETORIO_TESTE"' EXIT
mkdir -p "$DIRETORIO_TESTE/scripts" "$DIRETORIO_TESTE/bin"
cp "$DIRETORIO_RAIZ/scripts/health-check.sh" "$DIRETORIO_TESTE/scripts/"
printf 'CONFIGURACAO_FICTICIA=teste\n' > "$DIRETORIO_TESTE/.env.docker"
cat > "$DIRETORIO_TESTE/bin/docker" <<'SIMULADOR'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$REGISTRO_TESTE"
case "$*" in
  compose*)
    [[ "$*" == *'--env-file .env.docker'* ]] || exit 2
    if [[ "$*" != *'{{.State}}'* ]]; then
      printf 'essencia-api\t%s\n' "${CENARIO_TESTE:-healthy}"
      exit 0
    fi
    case "${CENARIO_TESTE:-saudavel}" in
      vazio) exit 0 ;;
      parado) printf 'essencia-api\texited\thealthy\n' ;;
      unhealthy|starting) printf 'essencia-api\trunning\t%s\n' "$CENARIO_TESTE" ;;
      *) printf 'essencia-api\trunning\thealthy\nessencia-certbot\trunning\t\n' ;;
    esac
    ;;
  stats*) exit 0 ;;
  *) echo 0 ;;
esac
SIMULADOR
cat > "$DIRETORIO_TESTE/bin/curl" <<'SIMULADOR'
#!/usr/bin/env bash
[[ "${CENARIO_TESTE:-}" != externo-indisponivel ]]
SIMULADOR
chmod +x "$DIRETORIO_TESTE/bin/"*
export PATH="$DIRETORIO_TESTE/bin:$PATH"
export REGISTRO_TESTE="$DIRETORIO_TESTE/comandos.log"

bash "$DIRETORIO_TESTE/scripts/health-check.sh" > "$DIRETORIO_TESTE/saida.log"
grep -Fq -- '--env-file .env.docker ps' "$REGISTRO_TESTE"
echo 'Ambiente explícito e containers saudáveis passaram.'

for cenario in unhealthy starting parado vazio; do
  if CENARIO_TESTE="$cenario" bash "$DIRETORIO_TESTE/scripts/health-check.sh" > "$DIRETORIO_TESTE/saida.log"; then
    echo "Falha: health check declarou sucesso no cenário $cenario." >&2
    exit 1
  fi
  echo "Detecção de $cenario passou."
done
CENARIO_TESTE=externo-indisponivel bash "$DIRETORIO_TESTE/scripts/health-check.sh" > "$DIRETORIO_TESTE/saida.log"
grep -Fq 'Endpoints externos não acessíveis' "$DIRETORIO_TESTE/saida.log"
[[ "$(cat "$DIRETORIO_TESTE/.env.docker")" == CONFIGURACAO_FICTICIA=teste ]]
echo 'Testes de saúde concluídos sem acessar produção.'
