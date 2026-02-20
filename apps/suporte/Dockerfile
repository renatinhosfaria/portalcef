# =============================================================================
# DOCKERFILE - App Suporte (Next.js standalone)
# Portal Essencia Feliz
# =============================================================================
# Usa o template compartilhado docker/Dockerfile.nextjs com build args
#
# Build:
#   docker build -f apps/suporte/Dockerfile \
#     --build-arg APP_NAME=suporte \
#     --build-arg APP_PORT=3013 \
#     -t essencia-suporte:latest .
#
# Ou via docker/Dockerfile.nextjs diretamente:
#   docker build -f docker/Dockerfile.nextjs \
#     --build-arg APP_NAME=suporte \
#     --build-arg APP_PORT=3013 \
#     -t essencia-suporte:latest .
# =============================================================================
# syntax=docker/dockerfile:1.4

# =============================================================================
# STAGE 1: BASE
# =============================================================================
FROM node:22-alpine AS base

RUN apk add --no-cache dumb-init curl && \
    corepack enable && \
    corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

# =============================================================================
# STAGE 2: PRUNER - Extrair dependencias minimas com Turbo prune
# =============================================================================
FROM base AS pruner

COPY . .

RUN pnpm dlx turbo prune --scope=suporte --docker

# =============================================================================
# STAGE 3: DEPS - Instalar dependencias com cache mount
# =============================================================================
FROM base AS deps

# Copiar apenas manifestos (raramente mudam)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Cache mount para pnpm store - CRITICO para performance
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# =============================================================================
# STAGE 4: BUILDER - Compilar com Turborepo cache
# =============================================================================
FROM deps AS builder

ARG NEXT_PUBLIC_API_URL
ARG API_INTERNAL_URL

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

# Copiar codigo fonte
COPY --from=pruner /app/out/full/ .

# Copiar tsconfig.json raiz (necessario para apps que usam extends)
COPY --from=pruner /app/tsconfig.json ./tsconfig.json

# Build com cache mount do Turborepo
RUN --mount=type=cache,id=turbo-cache,target=/app/.turbo \
    pnpm turbo build --filter=suporte

# =============================================================================
# STAGE 5: RUNNER - Imagem final minima (standalone output)
# =============================================================================
FROM node:22-alpine AS runner

# Apenas runtime essencial
RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Usuario nao-root para seguranca
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV PORT=3013
ENV HOSTNAME="0.0.0.0"
ENV APP_NAME=suporte

# Copiar apenas o output standalone (muito menor que node_modules completo)
COPY --from=builder --chown=nextjs:nodejs /app/apps/suporte/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/suporte/.next/static ./apps/suporte/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/suporte/public ./apps/suporte/public

USER nextjs

EXPOSE 3013

# Healthcheck integrado
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3013/suporte || exit 1

# dumb-init como PID 1 para signal handling correto
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/suporte/server.js"]
