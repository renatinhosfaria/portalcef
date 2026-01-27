#!/bin/bash
# =============================================================================
# Script: Habilitar BuildKit Permanentemente
# =============================================================================

set -e

echo "🔧 Configurando BuildKit permanentemente..."

# Verificar se daemon.json existe
if [ ! -f /etc/docker/daemon.json ]; then
    echo "📝 Criando /etc/docker/daemon.json..."
    sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "features": {
    "buildkit": true
  }
}
EOF
else
    echo "⚠️  /etc/docker/daemon.json já existe"
    echo "📄 Conteúdo atual:"
    sudo cat /etc/docker/daemon.json
    echo ""
    read -p "Deseja sobrescrever? (s/N): " resposta

    if [ "$resposta" = "s" ] || [ "$resposta" = "S" ]; then
        sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "features": {
    "buildkit": true
  }
}
EOF
        echo "✅ Arquivo atualizado"
    else
        echo "❌ Cancelado pelo usuário"
        exit 1
    fi
fi

echo ""
echo "🔄 Reiniciando Docker daemon..."
sudo systemctl restart docker

echo ""
echo "⏳ Aguardando Docker inicializar..."
sleep 5

echo ""
echo "✅ BuildKit habilitado permanentemente!"
echo "📊 Verificando:"
docker version | grep -A 3 "Server:"
