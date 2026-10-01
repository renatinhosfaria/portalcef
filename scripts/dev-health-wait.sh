#!/usr/bin/env bash

aguardar_servico_healthy() {
    local comando_verificacao="$1"
    local timeout_segundos="${2:-60}"
    local intervalo_segundos="${3:-2}"
    shift 3
    local decorrido=0

    while (( decorrido < timeout_segundos )); do
        if "$comando_verificacao" "$@"; then
            return 0
        fi

        sleep "$intervalo_segundos"
        decorrido=$((decorrido + intervalo_segundos))
    done

    return 1
}
