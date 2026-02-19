# =============================================================================
# DOCKER BAKE CONFIGURATION - Builds Paralelos para Monorepo
# Portal Essência Feliz - Docker Strategy 2025/2026
# =============================================================================
#
# Uso:
#   docker buildx bake                    # Build todas as imagens
#   docker buildx bake apps               # Build apenas apps Next.js
#   docker buildx bake api worker         # Build específicos
#   docker buildx bake --push             # Build e push para registry
#
# Com cache remoto:
#   docker buildx bake --set "*.cache-from=type=registry,ref=ghcr.io/user/repo/cache"
# =============================================================================

# -----------------------------------------------------------------------------
# VARIÁVEIS
# -----------------------------------------------------------------------------

variable "REGISTRY" {
  default = "ghcr.io/renatinhosfaria/portalcef"
}

variable "TAG" {
  default = "latest"
}

variable "NEXT_PUBLIC_API_URL" {
  default = "https://www.portalcef.com.br/api"
}

variable "API_INTERNAL_URL" {
  default = "http://api:3002"
}

# -----------------------------------------------------------------------------
# GRUPOS - Permite build de múltiplos targets de uma vez
# -----------------------------------------------------------------------------

# Build completo (padrão)
group "default" {
  targets = ["apps", "services"]
}

# Apenas apps Next.js
group "apps" {
  targets = [
    "home",
    "login",
    "usuarios",
    "escolas",
    "turmas",
    "planejamento",
    "calendario",
    "loja",
    "loja-admin",
    "tarefas"
  ]
}

# Apenas serviços backend
group "services" {
  targets = ["api", "worker"]
}

# Infra para desenvolvimento
group "infra" {
  targets = ["dev"]
}

# -----------------------------------------------------------------------------
# TARGET BASE - Configurações compartilhadas
# -----------------------------------------------------------------------------

target "_common" {
  context = "."
}

# Template para apps Next.js
target "_nextjs" {
  inherits = ["_common"]
  dockerfile = "docker/Dockerfile.nextjs"
  args = {
    NEXT_PUBLIC_API_URL = "${NEXT_PUBLIC_API_URL}"
    API_INTERNAL_URL    = "${API_INTERNAL_URL}"
  }
}

# -----------------------------------------------------------------------------
# APPS NEXT.JS
# -----------------------------------------------------------------------------

target "home" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "home"
    APP_PORT = "3000"
  }
  tags = [
    "${REGISTRY}/home:${TAG}",
    "${REGISTRY}/home:latest",
    "essencia-home:latest"
  ]
}

target "login" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "login"
    APP_PORT = "3003"
  }
  tags = [
    "${REGISTRY}/login:${TAG}",
    "${REGISTRY}/login:latest",
    "essencia-login:latest"
  ]
}

target "usuarios" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "usuarios"
    APP_PORT = "3004"
  }
  tags = [
    "${REGISTRY}/usuarios:${TAG}",
    "${REGISTRY}/usuarios:latest",
    "essencia-usuarios:latest"
  ]
}

target "escolas" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "escolas"
    APP_PORT = "3005"
  }
  tags = [
    "${REGISTRY}/escolas:${TAG}",
    "${REGISTRY}/escolas:latest",
    "essencia-escolas:latest"
  ]
}

target "turmas" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME     = "turmas"
    PACKAGE_NAME = "@essencia/turmas"
    APP_PORT     = "3006"
  }
  tags = [
    "${REGISTRY}/turmas:${TAG}",
    "${REGISTRY}/turmas:latest",
    "essencia-turmas:latest"
  ]
}

target "planejamento" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "planejamento"
    APP_PORT = "3007"
  }
  tags = [
    "${REGISTRY}/planejamento:${TAG}",
    "${REGISTRY}/planejamento:latest",
    "essencia-planejamento:latest"
  ]
}

target "calendario" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME     = "calendario"
    PACKAGE_NAME = "@essencia/calendario"
    APP_PORT     = "3008"
  }
  tags = [
    "${REGISTRY}/calendario:${TAG}",
    "${REGISTRY}/calendario:latest",
    "essencia-calendario:latest"
  ]
}

target "loja" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME     = "loja"
    PACKAGE_NAME = "@essencia/loja"
    APP_PORT     = "3010"
  }
  tags = [
    "${REGISTRY}/loja:${TAG}",
    "${REGISTRY}/loja:latest",
    "essencia-loja:latest"
  ]
}

target "loja-admin" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME     = "loja-admin"
    PACKAGE_NAME = "@essencia/loja-admin"
    APP_PORT     = "3011"
  }
  tags = [
    "${REGISTRY}/loja-admin:${TAG}",
    "${REGISTRY}/loja-admin:latest",
    "essencia-loja-admin:latest"
  ]
}

target "tarefas" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "tarefas"
    APP_PORT = "3012"
  }
  tags = [
    "${REGISTRY}/tarefas:${TAG}",
    "${REGISTRY}/tarefas:latest",
    "essencia-tarefas:latest"
  ]
}

# -----------------------------------------------------------------------------
# SERVIÇOS BACKEND
# -----------------------------------------------------------------------------

target "api" {
  inherits   = ["_common"]
  dockerfile = "docker/Dockerfile.api"
  tags = [
    "${REGISTRY}/api:${TAG}",
    "${REGISTRY}/api:latest",
    "essencia-api:latest"
  ]
}

target "worker" {
  inherits   = ["_common"]
  dockerfile = "docker/Dockerfile.worker"
  tags = [
    "${REGISTRY}/worker:${TAG}",
    "${REGISTRY}/worker:latest",
    "essencia-worker:latest"
  ]
}

# -----------------------------------------------------------------------------
# DESENVOLVIMENTO
# -----------------------------------------------------------------------------

target "dev" {
  inherits   = ["_common"]
  dockerfile = "docker/Dockerfile.dev"
  tags       = ["essencia-dev:latest"]
  # Não fazer push da imagem de dev
  output     = ["type=docker"]
}
