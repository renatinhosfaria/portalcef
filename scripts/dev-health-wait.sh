#!/usr/bin/env bash

aguardar_servico_healthy() {
    local comando_verificacao="$1"
    local timeout_segundos="${2:-60}"
    local intervalo_segundos="${3:-2}"
    shift 3
    local decorrido=0

    if [[ ! "$timeout_segundos" =~ ^[1-9][0-9]*$ || ! "$intervalo_segundos" =~ ^[1-9][0-9]*$ ]]; then
        echo "Timeout e intervalo devem ser inteiros positivos." >&2
        return 1
    fi

    while (( decorrido < timeout_segundos )); do
        if "$comando_verificacao" "$@"; then
            return 0
        fi

        sleep "$intervalo_segundos"
        decorrido=$((decorrido + intervalo_segundos))
    done

    return 1
}
