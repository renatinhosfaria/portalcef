#!/usr/bin/env bash
set -euo pipefail
raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporario="$(mktemp -d)"
trap 'rm -rf "$temporario"' EXIT
mkdir -p "$temporario/scripts" "$temporario/bin"
cp "$raiz/scripts/dev-setup.sh" "$raiz/scripts/dev-health-wait.sh" "$temporario/scripts/"
cat > "$temporario/bin/docker" <<'SIMULADOR'
#!/usr/bin/env bash
echo "$*" >> "$REGISTRO_TESTE"
if [[ "$*" == *" ps "* ]]; then
  echo "${ESTADO_TESTE:-healthy}"
fi
SIMULADOR
cat > "$temporario/bin/sleep" <<'SIMULADOR'
#!/usr/bin/env bash
exit 0
SIMULADOR
chmod +x "$temporario/bin/"*
export PATH="$temporario/bin:$PATH" REGISTRO_TESTE="$temporario/comandos"
export DEV_HEALTH_TIMEOUT=2 DEV_HEALTH_INTERVAL=1
for estado in unhealthy starting; do
  : > "$REGISTRO_TESTE"
  if ESTADO_TESTE="$estado" bash "$temporario/scripts/dev-setup.sh" > "$temporario/saida"; then
    echo "Falha: setup aceitou $estado" >&2; exit 1
  fi
  if grep -Eq 'build dev|db:migrate' "$REGISTRO_TESTE"; then exit 1; fi
done
bash "$temporario/scripts/dev-setup.sh" > "$temporario/saida"
grep -Fq 'db:migrate' "$REGISTRO_TESTE"
echo 'Setup só prossegue com infraestrutura saudável.'
