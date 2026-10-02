#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT_DIR/scripts/dev-health-wait.sh"

healthy_once() {
  if [[ "${HEALTH_CALLS:-0}" -eq 0 ]]; then
    HEALTH_CALLS=1
    return 1
  fi
  return 0
}

HEALTH_CALLS=0
aguardar_servico_healthy healthy_once 2 1

never_healthy() { return 1; }
if aguardar_servico_healthy never_healthy 2 1; then
  echo "Serviço unhealthy foi aceito" >&2
  exit 1
fi

echo 'Espera de health check passou.'

for valor in 0 -1 invalido; do
  if aguardar_servico_healthy true "$valor" 1; then
    echo "Timeout inválido aceito: $valor" >&2; exit 1
  fi
  if aguardar_servico_healthy true 2 "$valor"; then
    echo "Intervalo inválido aceito: $valor" >&2; exit 1
  fi
done
