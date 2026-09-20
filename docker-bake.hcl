# =============================================================================
# DOCKER BAKE CONFIGURATION - Builds Paralelos para Monorepo
# Portal Essência Feliz - Docker Strategy 2025/2026
# =============================================================================
#
# Uso:
#   docker buildx bake                    # Build todas as imagens
#   docker buildx bake apps               # Build apenas apps Next.js
#   docker buildx bake api                # Build específicos
#   PUBLISH=true TAG=sha REGISTRY=ghcr.io/org/portalcef docker buildx bake --push
#                                      # Build e push imutável para registry
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

variable "PUBLISH" {
  default = false
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
    "eventos",
    "loja",
    "loja-admin",
    "tarefas",
    "suporte",
    "workflows",
    "landing-mae"
  ]
}

# Apenas serviços backend
group "services" {
  targets = ["api"]
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
  tags = PUBLISH ? [
    "${REGISTRY}/home:${TAG}"
  ] : [
    "essencia-home:${TAG}",
    "essencia-home:latest"
  ]
}

target "login" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "login"
    APP_PORT = "3003"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/login:${TAG}"
  ] : [
    "essencia-login:${TAG}",
    "essencia-login:latest"
  ]
}

target "usuarios" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "usuarios"
    APP_PORT = "3004"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/usuarios:${TAG}"
  ] : [
    "essencia-usuarios:${TAG}",
    "essencia-usuarios:latest"
  ]
}

target "escolas" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "escolas"
    APP_PORT = "3005"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/escolas:${TAG}"
  ] : [
    "essencia-escolas:${TAG}",
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
  tags = PUBLISH ? [
    "${REGISTRY}/turmas:${TAG}"
  ] : [
    "essencia-turmas:${TAG}",
    "essencia-turmas:latest"
  ]
}

target "planejamento" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "planejamento"
    APP_PORT = "3007"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/planejamento:${TAG}"
  ] : [
    "essencia-planejamento:${TAG}",
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
  tags = PUBLISH ? [
    "${REGISTRY}/calendario:${TAG}"
  ] : [
    "essencia-calendario:${TAG}",
    "essencia-calendario:latest"
  ]
}

target "eventos" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME     = "eventos"
    PACKAGE_NAME = "eventos"
    APP_PORT     = "3014"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/eventos:${TAG}"
  ] : [
    "essencia-eventos:${TAG}",
    "essencia-eventos:latest"
  ]
}

target "loja" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME     = "loja"
    PACKAGE_NAME = "@essencia/loja"
    APP_PORT     = "3010"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/loja:${TAG}"
  ] : [
    "essencia-loja:${TAG}",
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
  tags = PUBLISH ? [
    "${REGISTRY}/loja-admin:${TAG}"
  ] : [
    "essencia-loja-admin:${TAG}",
    "essencia-loja-admin:latest"
  ]
}

target "tarefas" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "tarefas"
    APP_PORT = "3012"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/tarefas:${TAG}"
  ] : [
    "essencia-tarefas:${TAG}",
    "essencia-tarefas:latest"
  ]
}

target "suporte" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME = "suporte"
    APP_PORT = "3013"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/suporte:${TAG}"
  ] : [
    "essencia-suporte:${TAG}",
    "essencia-suporte:latest"
  ]
}

target "workflows" {
  inherits = ["_nextjs"]
  args = {
    APP_NAME     = "workflows"
    PACKAGE_NAME = "workflows"
    APP_PORT     = "3015"
  }
  tags = PUBLISH ? [
    "${REGISTRY}/workflows:${TAG}"
  ] : [
    "essencia-workflows:${TAG}",
    "essencia-workflows:latest"
  ]
}

target "landing-mae" {
  context   = "landing-mae-por-inteiro"
  dockerfile = "Dockerfile"
  tags = PUBLISH ? [
    "${REGISTRY}/landing-mae:${TAG}"
  ] : [
    "essencia-landing-mae:${TAG}",
    "essencia-landing-mae:latest"
  ]
}

# -----------------------------------------------------------------------------
# SERVIÇOS BACKEND
# -----------------------------------------------------------------------------

target "api" {
  inherits   = ["_common"]
  dockerfile = "docker/Dockerfile.api"
  tags = PUBLISH ? [
    "${REGISTRY}/api:${TAG}"
  ] : [
    "essencia-api:${TAG}",
    "essencia-api:latest"
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
