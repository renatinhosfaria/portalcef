# Otimização do Sistema Docker - Plano de Implementação

> **Para Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar este plano task-by-task.

**Objetivo:** Consolidar 5 Dockerfiles em 2 (dev + prod) com BuildKit, reduzindo tempo de build de 5-15 min para 1-4 min.

**Arquitetura:** Multi-stage Dockerfile consolidado com cache mounts persistentes (pnpm + turbo), build único compartilhado entre 11 services (9 apps Next.js + API + Worker).

**Tech Stack:** Docker BuildKit, pnpm 9.15.1, Turborepo, Node.js 22 Alpine, YAML anchors.

**Design:** [docs/plans/2026-01-27-otimizacao-docker-design.md](./2026-01-27-otimizacao-docker-design.md)

---

## Task 1: Backup dos Arquivos Atuais

**Files:**
- Create: `Dockerfile.nextjs.backup`
- Create: `Dockerfile.worker.backup`
- Create: `Dockerfile.prod.backup`
- Create: `services/api/Dockerfile.backup`
- Create: `docker-compose.prod.yml.backup`

**Step 1: Criar backups dos Dockerfiles**

```bash
cp Dockerfile.nextjs Dockerfile.nextjs.backup
cp Dockerfile.worker Dockerfile.worker.backup
cp Dockerfile.prod Dockerfile.prod.backup
cp services/api/Dockerfile services/api/Dockerfile.backup
cp docker-compose.prod.yml docker-compose.prod.yml.backup
```

**Step 2: Verificar backups criados**

Run: `ls -lh *.backup services/api/*.backup`
Expected: 5 arquivos .backup listados

**Step 3: Commit dos backups**

```bash
git add *.backup services/api/*.backup
git commit -m "backup: salvar Dockerfiles antes de consolidação

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Configurar BuildKit Permanentemente

**Files:**
- Create: `scripts/enable-buildkit.sh`

**Step 1: Criar script de habilitação do BuildKit**

```bash
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
```

**Step 2: Tornar script executável**

Run: `chmod +x scripts/enable-buildkit.sh`
Expected: Permissão de execução adicionada

**Step 3: Commit do script**

```bash
git add scripts/enable-buildkit.sh
git commit -m "feat(docker): adicionar script de habilitação do BuildKit

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Criar Dockerfile.prod Consolidado

**Files:**
- Create: `Dockerfile.prod.new` (temporário, depois renomeia)

**Step 1: Criar Dockerfile.prod consolidado**

```dockerfile
# =============================================================================
# Dockerfile.prod - CONSOLIDADO
# Portal Essencia Feliz - Produção
# =============================================================================
# Builda TODOS os services (9 apps Next.js + API + Worker) em 1 imagem
# BuildKit OBRIGATÓRIO: DOCKER_BUILDKIT=1
#
# Services usam a mesma imagem mas com comandos diferentes:
#   - Apps Next.js: node apps/{APP}/server.js
#   - API: pnpm --filter @essencia/api start:prod
#   - Worker: node services/worker/dist/index.js
# =============================================================================

# ========================================
# Stage 1: Base
# ========================================
FROM node:22-alpine AS base

# Ferramentas do sistema
RUN apk add --no-cache dumb-init curl

# Habilitar e fixar pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

# ========================================
# Stage 2: Dependencies
# ========================================
FROM base AS dependencies

# Manifestos raiz (muda raramente)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Todos os package.json do monorepo
COPY apps/home/package.json ./apps/home/
COPY apps/login/package.json ./apps/login/
COPY apps/usuarios/package.json ./apps/usuarios/
COPY apps/escolas/package.json ./apps/escolas/
COPY apps/turmas/package.json ./apps/turmas/
COPY apps/planejamento/package.json ./apps/planejamento/
COPY apps/calendario/package.json ./apps/calendario/
COPY apps/loja/package.json ./apps/loja/
COPY apps/loja-admin/package.json ./apps/loja-admin/
COPY apps/tarefas/package.json ./apps/tarefas/

COPY services/api/package.json ./services/api/
COPY services/worker/package.json ./services/worker/

COPY packages/ui/package.json ./packages/ui/
COPY packages/components/package.json ./packages/components/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tailwind-config/package.json ./packages/tailwind-config/
COPY packages/config/package.json ./packages/config/
COPY packages/lib/package.json ./packages/lib/
COPY packages/db/package.json ./packages/db/

# Instalar TODAS as dependências com cache mount
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ========================================
# Stage 3: Builder
# ========================================
FROM base AS builder

# Copiar node_modules da stage anterior
COPY --from=dependencies /app/node_modules ./node_modules

# Manifestos (necessário para Turborepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/*/package.json ./apps/
COPY services/*/package.json ./services/
COPY packages/*/package.json ./packages/

# Copiar TODO o código fonte
COPY apps ./apps
COPY services ./services
COPY packages ./packages

# Build TUDO via Turborepo com cache mount
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=cache,target=/app/.turbo \
    pnpm turbo build

# ========================================
# Stage 4: Production
# ========================================
FROM base AS production

# Copiar TUDO buildado
COPY --from=builder --chown=node:node /app ./

# Remover devDependencies para economizar espaço
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm prune --prod

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Permissões corretas
RUN chown -R nodejs:nodejs /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

USER nodejs

# Expor todas as portas
EXPOSE 3000 3001 3002 3003 3004 3005 3006 3007 3008 3010 3011 3100

ENTRYPOINT ["dumb-init", "--"]

# Comando padrão (sobrescrito pelo docker-compose)
CMD ["node", "--version"]
```

**Step 2: Verificar sintaxe do Dockerfile**

Run: `docker buildx build -f Dockerfile.prod.new --check .`
Expected: Sem erros de sintaxe

**Step 3: Commit do Dockerfile.prod consolidado**

```bash
git add Dockerfile.prod.new
git commit -m "feat(docker): criar Dockerfile.prod consolidado

- Multi-stage com 4 stages (base, dependencies, builder, production)
- Cache mounts para pnpm store e turbo
- Builda todos os services em 1 imagem (~2.5GB)
- Pronto para uso com docker-compose.prod.yml

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Criar docker-compose.prod.yml Simplificado

**Files:**
- Create: `docker-compose.prod.yml.new` (temporário)

**Step 1: Criar docker-compose.prod.yml consolidado**

```yaml
# =============================================================================
# Docker Compose for PRODUCTION - OPTIMIZED
# Portal Essencia Feliz
# =============================================================================
# BuildKit habilitado permanentemente em /etc/docker/daemon.json
#
# Build:   docker compose -f docker-compose.prod.yml build
# Deploy:  docker compose -f docker-compose.prod.yml up -d
# Logs:    docker compose -f docker-compose.prod.yml logs -f [service]
# Stop:    docker compose -f docker-compose.prod.yml down
# =============================================================================

# ===========================================================================
# Configuração Compartilhada (DRY)
# ===========================================================================
x-build-config: &build-config
  context: .
  dockerfile: Dockerfile.prod.new
  args:
    BUILDKIT_INLINE_CACHE: 1
  cache_from:
    - essencia-prod:latest

x-common-config: &common-config
  restart: unless-stopped
  networks:
    - essencia-prod
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"

x-nextjs-env: &nextjs-env
  NODE_ENV: production
  API_INTERNAL_URL: http://api:3002
  NEXT_PUBLIC_API_URL: https://www.portalcef.com.br/api

services:
  # ===========================================================================
  # Nginx - Reverse Proxy (INALTERADO)
  # ===========================================================================
  nginx:
    image: nginx:alpine
    container_name: essencia-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - nginx_certs:/etc/letsencrypt
      - nginx_webroot:/var/www/certbot
    depends_on:
      - api
    networks:
      - essencia-prod
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  certbot:
    image: certbot/certbot
    container_name: essencia-certbot
    volumes:
      - nginx_certs:/etc/letsencrypt
      - nginx_webroot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - essencia-prod

  # ===========================================================================
  # Infraestrutura (INALTERADOS)
  # ===========================================================================
  postgres:
    image: postgres:16-alpine
    container_name: essencia-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - essencia-prod
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: essencia-redis
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - essencia-prod
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  minio:
    image: minio/minio:latest
    container_name: essencia-minio
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks:
      - essencia-prod
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  createbuckets:
    image: minio/mc
    depends_on:
      minio:
        condition: service_healthy
    networks:
      - essencia-prod
    entrypoint: >
      /bin/sh -c "
      /usr/bin/mc config host add myminio http://minio:9000 ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY};
      /usr/bin/mc mb myminio/${MINIO_BUCKET} || true;
      /usr/bin/mc anonymous set public myminio/${MINIO_BUCKET};
      exit 0;
      "

  carbone:
    image: carbone/carbone-ee:latest
    container_name: essencia-carbone
    environment:
      CARBONE_WORKERS: 4
    networks:
      - essencia-prod
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ===========================================================================
  # Frontend Apps - Next.js (CONSOLIDADOS)
  # ===========================================================================
  home:
    <<: *common-config
    build: *build-config
    container_name: essencia-home
    command: node apps/home/server.js
    environment:
      <<: *nextjs-env
      PORT: 3000

  login:
    <<: *common-config
    build: *build-config
    container_name: essencia-login
    command: node apps/login/server.js
    environment:
      <<: *nextjs-env
      PORT: 3003

  usuarios:
    <<: *common-config
    build: *build-config
    container_name: essencia-usuarios
    command: node apps/usuarios/server.js
    environment:
      <<: *nextjs-env
      PORT: 3004

  escolas:
    <<: *common-config
    build: *build-config
    container_name: essencia-escolas
    command: node apps/escolas/server.js
    environment:
      <<: *nextjs-env
      PORT: 3005

  turmas:
    <<: *common-config
    build: *build-config
    container_name: essencia-turmas
    command: node apps/turmas/server.js
    environment:
      <<: *nextjs-env
      PORT: 3006

  planejamento:
    <<: *common-config
    build: *build-config
    container_name: essencia-planejamento
    command: node apps/planejamento/server.js
    environment:
      <<: *nextjs-env
      PORT: 3007

  calendario:
    <<: *common-config
    build: *build-config
    container_name: essencia-calendario
    command: node apps/calendario/server.js
    environment:
      <<: *nextjs-env
      PORT: 3008

  loja:
    <<: *common-config
    build: *build-config
    container_name: essencia-loja
    command: node apps/loja/server.js
    environment:
      <<: *nextjs-env
      PORT: 3010
      NEXT_PUBLIC_API_URL: https://loja.portalcef.com.br/api

  loja-admin:
    <<: *common-config
    build: *build-config
    container_name: essencia-loja-admin
    command: node apps/loja-admin/server.js
    environment:
      <<: *nextjs-env
      PORT: 3011

  tarefas:
    <<: *common-config
    build: *build-config
    container_name: essencia-tarefas
    command: node apps/tarefas/server.js
    environment:
      <<: *nextjs-env
      PORT: 3009

  # ===========================================================================
  # API - NestJS (CONSOLIDADO)
  # ===========================================================================
  api:
    <<: *common-config
    build: *build-config
    container_name: essencia-api
    command: pnpm --filter @essencia/api start:prod
    env_file:
      - .env.docker
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_PUBLIC_ENDPOINT: https://www.portalcef.com.br/storage
      MINIO_BUCKET: ${MINIO_BUCKET}
      API_PORT: 3002
      API_HOST: 0.0.0.0
      SESSION_SECRET: ${SESSION_SECRET}
      SESSION_TTL_HOURS: ${SESSION_TTL_HOURS:-24}
      SESSION_RENEWAL_THRESHOLD: ${SESSION_RENEWAL_THRESHOLD:-0.25}
      COOKIE_DOMAIN: ${COOKIE_DOMAIN}
      COOKIE_SECURE: "true"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M

  # ===========================================================================
  # Worker - Conversão de Documentos (CONSOLIDADO)
  # ===========================================================================
  worker:
    <<: *common-config
    build: *build-config
    container_name: essencia-worker
    command: node services/worker/dist/index.js
    env_file:
      - .env.docker
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_PUBLIC_ENDPOINT: https://www.portalcef.com.br/storage
      MINIO_BUCKET: ${MINIO_BUCKET}
      HEALTH_PORT: 3100
      WORKER_CONCURRENCY: ${WORKER_CONCURRENCY:-2}
      CARBONE_URL: http://carbone:4000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
      carbone:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3100/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

networks:
  essencia-prod:
    driver: bridge
    name: essencia-prod

volumes:
  postgres_data:
    name: essencia-postgres-data
    external: true
  redis_data:
    name: essencia-redis-data
    external: true
  minio_data:
    name: essencia-minio-data
    external: true
  nginx_certs:
    name: essencia-nginx-certs
  nginx_webroot:
    name: essencia-nginx-webroot
```

**Step 2: Validar sintaxe do docker-compose**

Run: `docker compose -f docker-compose.prod.yml.new config > /dev/null`
Expected: Sem erros de sintaxe

**Step 3: Commit do docker-compose.prod.yml consolidado**

```bash
git add docker-compose.prod.yml.new
git commit -m "feat(docker): simplificar docker-compose.prod.yml

- Build único compartilhado (x-build-config anchor)
- Configuração DRY com YAML anchors
- ~37% menor (476 → 300 linhas)
- Mesma imagem, comandos específicos por service

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Criar Scripts de Build e Medição

**Files:**
- Create: `scripts/build-prod.sh`
- Create: `scripts/compare-builds.sh`
- Create: `logs/.gitkeep`

**Step 1: Criar script de build com medição**

```bash
#!/bin/bash
# =============================================================================
# Build de Produção com Medição de Performance
# =============================================================================

set -e

echo "🚀 Iniciando build de produção..."
echo "📊 Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Medir tempo total
START_TIME=$(date +%s)

# Build (BuildKit já habilitado no daemon)
docker compose -f docker-compose.prod.yml.new build "$@"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Converter para minutos:segundos
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "✅ Build completo!"
echo "⏱️  Tempo total: ${MINUTES}m ${SECONDS}s"
echo ""

# Criar diretório de logs se não existir
mkdir -p logs

# Salvar histórico
echo "$(date '+%Y-%m-%d %H:%M:%S'),${DURATION}s,${MINUTES}m${SECONDS}s" >> logs/build-performance.log

# Mostrar tamanhos das imagens
echo "📦 Tamanho das imagens:"
docker images | grep "essencia-" | awk '{print $1 "\t\t" $7 " " $8}' || echo "Nenhuma imagem encontrada"

echo ""
echo "📈 Últimos 5 builds:"
tail -5 logs/build-performance.log 2>/dev/null || echo "Primeiro build registrado"
```

**Step 2: Criar script de comparação de builds**

```bash
#!/bin/bash
# =============================================================================
# Comparar Performance de Builds
# =============================================================================

if [ ! -f logs/build-performance.log ]; then
    echo "❌ Nenhum histórico encontrado. Execute ./scripts/build-prod.sh primeiro."
    exit 1
fi

echo "📊 Histórico de Performance (últimos 10 builds):"
echo "================================================="
echo ""
printf "%-20s %-15s %-15s\n" "Data/Hora" "Segundos" "Tempo"
echo "-----------------------------------------------------------"

tail -10 logs/build-performance.log | while IFS=',' read -r timestamp seconds formatted; do
    printf "%-20s %-15s %-15s\n" "$timestamp" "$seconds" "$formatted"
done

echo ""
echo "📈 Estatísticas:"

# Calcular média (últimos 10 builds)
AVG=$(tail -10 logs/build-performance.log | cut -d',' -f2 | sed 's/s//' | awk '{sum+=$1; count++} END {if(count>0) print int(sum/count); else print 0}')
AVG_MIN=$((AVG / 60))
AVG_SEC=$((AVG % 60))

echo "Média (últimos 10): ${AVG_MIN}m ${AVG_SEC}s"

# Build mais rápido
FASTEST=$(cat logs/build-performance.log | cut -d',' -f2 | sed 's/s//' | sort -n | head -1)
FASTEST_MIN=$((FASTEST / 60))
FASTEST_SEC=$((FASTEST % 60))

echo "Mais rápido: ${FASTEST_MIN}m ${FASTEST_SEC}s"

# Build mais lento
SLOWEST=$(cat logs/build-performance.log | cut -d',' -f2 | sed 's/s//' | sort -n | tail -1)
SLOWEST_MIN=$((SLOWEST / 60))
SLOWEST_SEC=$((SLOWEST % 60))

echo "Mais lento: ${SLOWEST_MIN}m ${SLOWEST_SEC}s"
```

**Step 3: Criar .gitkeep para logs/**

```bash
# Este diretório armazena logs de performance de build
```

**Step 4: Tornar scripts executáveis**

Run: `chmod +x scripts/build-prod.sh scripts/compare-builds.sh`
Expected: Permissões de execução adicionadas

**Step 5: Commit dos scripts**

```bash
git add scripts/build-prod.sh scripts/compare-builds.sh logs/.gitkeep
git commit -m "feat(docker): adicionar scripts de build e medição

- build-prod.sh: build com timer e histórico
- compare-builds.sh: estatísticas de performance
- logs/build-performance.log: registro automático

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Executar BuildKit Setup

**Files:**
- Modify: `/etc/docker/daemon.json` (sistema)

**Step 1: Executar script de habilitação (MANUAL - requer sudo)**

⚠️ **ATENÇÃO:** Este passo requer acesso sudo e reinicia o Docker (~5-10s downtime).

Run: `./scripts/enable-buildkit.sh`

Expected output:
```
🔧 Configurando BuildKit permanentemente...
📝 Criando /etc/docker/daemon.json...
🔄 Reiniciando Docker daemon...
⏳ Aguardando Docker inicializar...
✅ BuildKit habilitado permanentemente!
```

**Step 2: Verificar BuildKit ativo**

Run: `docker buildx version`
Expected: Versão do buildx exibida (ex: `github.com/docker/buildx v0.12.0`)

**Step 3: Testar build com BuildKit**

Run: `docker build --help | grep buildkit`
Expected: Output mostra opções do BuildKit

---

## Task 7: Primeiro Build de Teste (Cache Frio)

**Files:**
- Nenhum arquivo modificado (apenas build)

**Step 1: Limpar imagens antigas (opcional)**

Run: `docker images | grep essencia- | awk '{print $3}' | xargs -r docker rmi -f`
Expected: Imagens antigas removidas

**Step 2: Executar primeiro build completo**

Run: `./scripts/build-prod.sh`

Expected:
- Output mostra stages do BuildKit: `[internal] load build definition`
- Tempo: ~8-12 minutos (cache frio)
- Log salvo em `logs/build-performance.log`

**Step 3: Verificar imagem criada**

Run: `docker images | grep essencia`
Expected: Imagens tagueadas para cada service (~2.5GB)

**Step 4: Anotar tempo do primeiro build**

Run: `cat logs/build-performance.log`
Expected: 1 linha com timestamp e duração

---

## Task 8: Segundo Build de Teste (Cache Quente)

**Files:**
- Nenhum arquivo modificado

**Step 1: Executar rebuild sem mudanças**

Run: `./scripts/build-prod.sh`

Expected:
- Output mostra `CACHED` em várias layers
- Tempo: ~30-60s (muito mais rápido que primeiro build)

**Step 2: Comparar performance**

Run: `./scripts/compare-builds.sh`

Expected:
```
📊 Histórico de Performance (últimos 10 builds):
=================================================

Data/Hora            Segundos        Tempo
-----------------------------------------------------------
2026-01-27 10:30:00  540s            9m0s
2026-01-27 10:45:00  45s             0m45s

📈 Estatísticas:
Média (últimos 10): 4m52s
Mais rápido: 0m45s
Mais lento: 9m0s
```

**Step 3: Documentar ganho de performance**

Anotar:
- Primeiro build: ___min ___s
- Segundo build: ___min ___s
- Ganho: ____%

---

## Task 9: Validar Funcionamento em Produção

**Files:**
- Nenhum arquivo modificado

**Step 1: Substituir arquivos antigos pelos novos**

```bash
# Renomear novos arquivos
mv Dockerfile.prod.new Dockerfile.prod
mv docker-compose.prod.yml.new docker-compose.prod.yml

# Atualizar script para usar arquivo final
sed -i 's/docker-compose.prod.yml.new/docker-compose.prod.yml/g' scripts/build-prod.sh
```

**Step 2: Rebuild com arquivos finais**

Run: `./scripts/build-prod.sh`
Expected: Build completa com sucesso usando novos arquivos

**Step 3: Iniciar containers**

Run: `docker compose -f docker-compose.prod.yml up -d`

Expected:
- Todos os 11 services (apps + api + worker) iniciam
- Infraestrutura (postgres, redis, etc) iniciam

**Step 4: Verificar health dos services**

Run: `docker compose -f docker-compose.prod.yml ps`

Expected: Todos os services com status `Up` ou `Up (healthy)`

**Step 5: Testar API**

Run: `curl -s http://localhost:3002/health | jq`

Expected:
```json
{
  "status": "ok",
  "timestamp": "2026-01-27T...",
  "uptime": 123,
  "database": "connected",
  "redis": "connected"
}
```

**Step 6: Testar um app Next.js**

Run: `curl -s -I http://localhost:3000 | head -1`
Expected: `HTTP/1.1 200 OK`

**Step 7: Parar containers**

Run: `docker compose -f docker-compose.prod.yml down`
Expected: Todos os containers param gracefully

---

## Task 10: Limpeza e Documentação Final

**Files:**
- Delete: `Dockerfile.nextjs`
- Delete: `Dockerfile.worker`
- Delete: `Dockerfile.prod.backup` (já temos .backup)
- Delete: `services/api/Dockerfile`
- Modify: `CLAUDE.md`

**Step 1: Remover Dockerfiles antigos**

```bash
git rm Dockerfile.nextjs
git rm Dockerfile.worker
git rm services/api/Dockerfile
```

**Step 2: Atualizar CLAUDE.md com novos comandos**

Adicionar seção após linha com "Build (incremental - uses cache)":

```markdown
## 🚀 Build Otimizado (Consolidado)

### Comandos Atualizados

```bash
# Build com medição de performance
./scripts/build-prod.sh

# Build tradicional (sem medição)
docker compose -f docker-compose.prod.yml build

# Deploy
docker compose -f docker-compose.prod.yml up -d

# Ver histórico de performance
./scripts/compare-builds.sh
```

### Arquitetura

- **1 Dockerfile.prod** - Consolidado para todos os services
- **BuildKit habilitado** - Permanentemente em `/etc/docker/daemon.json`
- **Cache mounts** - pnpm store + turbo
- **Performance** - 70-90% mais rápido em rebuilds

### Estrutura

```
Dockerfile.prod (multi-stage)
├─ Stage 1: base       → Node.js + ferramentas
├─ Stage 2: dependencies → Instalação única (cache mount)
├─ Stage 3: builder    → Build via Turborepo (cache mount)
└─ Stage 4: production → Imagem final (~2.5GB)
```

Services usam mesma imagem mas comandos diferentes:
- Apps Next.js: `node apps/{APP}/server.js`
- API: `pnpm --filter @essencia/api start:prod`
- Worker: `node services/worker/dist/index.js`
```

**Step 3: Commit final**

```bash
git add -A
git commit -m "feat(docker): consolidar sistema Docker completo

BREAKING CHANGE: Dockerfiles consolidados em Dockerfile.prod

Mudanças:
- Remover Dockerfiles antigos (nextjs, worker, api)
- Dockerfile.prod: multi-stage consolidado
- docker-compose.prod.yml: build único compartilhado
- BuildKit: habilitado permanentemente
- Scripts: build-prod.sh e compare-builds.sh

Performance:
- Primeiro build (cache frio): ~8-10 min
- Rebuild (cache quente): ~30-60s
- Ganho: 70-90% em rebuilds

Documentação atualizada em CLAUDE.md

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 4: Criar tag de versão**

```bash
git tag -a v2.0.0-docker-optimized -m "Docker consolidado com BuildKit

- Redução de 5 Dockerfiles para 1
- Build 70-90% mais rápido
- Sistema de medição de performance"

git push origin v2.0.0-docker-optimized
```

---

## ✅ Checklist Final

- [ ] Backups criados
- [ ] BuildKit habilitado no daemon
- [ ] Dockerfile.prod consolidado criado
- [ ] docker-compose.prod.yml simplificado
- [ ] Scripts de build e medição funcionando
- [ ] Primeiro build testado (cache frio)
- [ ] Segundo build testado (cache quente)
- [ ] Containers iniciados e testados em produção
- [ ] Dockerfiles antigos removidos
- [ ] CLAUDE.md atualizado
- [ ] Commit e tag criados

---

## 🎯 Validação de Sucesso

**Critérios:**
1. ✅ Build completo (cache frio) < 12 minutos
2. ✅ Rebuild (cache quente) < 2 minutos
3. ✅ Rebuild (mudança pequena) < 1 minuto
4. ✅ Todos os 11 services iniciam corretamente
5. ✅ API responde em `/health`
6. ✅ Apps Next.js respondem HTTP 200
7. ✅ Logs de performance salvos automaticamente
8. ✅ Dockerfile.prod < 150 linhas
9. ✅ docker-compose.prod.yml < 350 linhas

---

## 📚 Referências

- Design: [2026-01-27-otimizacao-docker-design.md](./2026-01-27-otimizacao-docker-design.md)
- BuildKit docs: https://docs.docker.com/build/buildkit/
- Cache mounts: https://docs.docker.com/build/cache/mounts/
- YAML anchors: https://yaml.org/spec/1.2/spec.html#id2765878
