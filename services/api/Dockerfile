# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./

# Copy package.json files for all packages needed by api
COPY services/api/package.json ./services/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/api/node_modules ./services/api/node_modules
COPY --from=deps /app/packages ./packages

# Copy source files
COPY services/api ./services/api
COPY packages ./packages
COPY package.json pnpm-workspace.yaml turbo.json ./

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

# Build the app using Turbo to ensure dependencies are built
RUN pnpm turbo build --filter=@essencia/api

# =============================================================================
# Stage 3: Runner
# =============================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built app and dependencies
COPY --from=builder --chown=nestjs:nodejs /app/services/api/dist ./dist
COPY --from=builder /app/services/api/node_modules ./node_modules
COPY --from=builder /app/services/api/package.json ./

USER nestjs

EXPOSE 3002

ENV PORT=3002

CMD ["node", "dist/main.js"]
