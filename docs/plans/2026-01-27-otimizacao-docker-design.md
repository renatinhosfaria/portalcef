# Design: Otimização do Sistema Docker para Produção

**Data:** 2026-01-27
**Objetivo:** Reduzir tempo de build de produção de 5-15 minutos para 1-4 minutos
**Abordagem:** Otimização Incremental com BuildKit + Consolidação Total
**Status:** Design aprovado, aguardando implementação

---

## 🎯 Problema

O processo atual de build para produção é lento:
- **Tempo atual:** 5-15 minutos por deploy
- **Complexidade:** 4-5 Dockerfiles diferentes para gerenciar
- **Cache ineficiente:** BuildKit não habilitado, múltiplas instalações de dependências
- **Manutenção difícil:** Repetição de código entre Dockerfiles

## 🎨 Solução Proposta

### Visão Geral

Consolidar todos os Dockerfiles em 2 arquivos (dev + prod) com BuildKit permanentemente habilitado, compartilhamento máximo de cache e build único para todos os services.

### Pilares da Otimização

1. **BuildKit Permanente** - Cache inteligente e builds paralelos
2. **Consolidação Total** - 1 Dockerfile para todos os services
3. **Otimização de Layers** - Ordem estratégica das operações
4. **Medição de Performance** - Visibilidade contínua

---

## 🏗️ Arquitetura

### Estrutura de Arquivos

```
/var/www/essencia/
├── Dockerfile.dev              # ✨ Desenvolvimento (consolidado)
├── Dockerfile.prod             # ✨ Produção (consolidado)
├── docker-compose.dev.yml      # Orquestração dev
├── docker-compose.prod.yml     # ✨ Orquestração prod (simplificado)
├── .dockerignore               # ✨ Otimizado
└── scripts/
    ├── build-prod.sh           # ✨ NOVO: Build com medição
    ├── compare-builds.sh       # ✨ NOVO: Histórico performance
    └── enable-buildkit.sh      # ✨ NOVO: Configurar daemon
```

### Arquivos Removidos

- ❌ `Dockerfile.nextjs`
- ❌ `Dockerfile.worker`
- ❌ `Dockerfile.prod.optimized`
- ❌ `services/api/Dockerfile`

---

## 🔧 Dockerfile.prod - Estratégia Multi-Stage

### Stage 1: Base (Fundação Comum)

```dockerfile
FROM node:22-alpine AS base

RUN apk add --no-cache dumb-init curl
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app
```

**Cache:** Reutilizado em ~99% dos builds.

### Stage 2: Dependencies (Instalação Única)

```dockerfile
FROM base AS dependencies

# Manifestos raiz (muda raramente)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Todos os package.json do monorepo
COPY apps/*/package.json ./apps/
COPY services/*/package.json ./services/
COPY packages/*/package.json ./packages/

# Instalar TODAS as dependências 1 vez com cache mount
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
```

**Cache:** Se `pnpm-lock.yaml` não mudou → 100% reutilizado (~2-3 min economizados).

**BuildKit necessário:** ✅ Sim (cache mount)

### Stage 3: Builder (Build Paralelo via Turborepo)

```dockerfile
FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules

# Manifestos
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/*/package.json ./apps/
COPY services/*/package.json ./services/
COPY packages/*/package.json ./packages/

# Todo o código fonte
COPY apps ./apps
COPY services ./services
COPY packages ./packages

# Build paralelo via Turborepo com cache mount
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=cache,target=/app/.turbo \
    pnpm turbo build
```

**Cache:** Turborepo reusa builds anteriores (~5-7 min economizados).

**BuildKit necessário:** ✅ Sim (cache mount)

**Builda em paralelo:**
- 9 apps Next.js
- 1 API NestJS
- 1 Worker
- Todos os packages compartilhados

### Stage 4: Production (Imagem Final)

```dockerfile
FROM base AS production

COPY --from=builder --chown=nodejs:nodejs /app ./

RUN pnpm prune --prod

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000 3001 3002 3003 3004 3005 3006 3007 3008 3010 3011 3100

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--version"]
```

**Resultado:** Imagem única (~2.5GB) contendo tudo buildado.

---

## 🐳 docker-compose.prod.yml - Consolidação

### Configuração DRY

```yaml
x-build-config: &build-config
  context: .
  dockerfile: Dockerfile.prod
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
```

### Services (Mesma Imagem, Comandos Diferentes)

```yaml
services:
  home:
    <<: *common-config
    build: *build-config
    command: node apps/home/server.js
    environment:
      NODE_ENV: production
      PORT: 3000
      # ...

  api:
    <<: *common-config
    build: *build-config
    command: pnpm --filter @essencia/api start:prod
    environment:
      NODE_ENV: production
      API_PORT: 3002
      # ...

  worker:
    <<: *common-config
    build: *build-config
    command: node services/worker/dist/index.js
    environment:
      NODE_ENV: production
      # ...
```

**Benefícios:**
- Build 1 vez, reutiliza para 11 services
- Configuração ~37% menor (476 → 300 linhas)
- Cache compartilhado máximo

---

## ⚙️ BuildKit - Configuração Permanente

### Opção Escolhida: Daemon Config

**Arquivo:** `/etc/docker/daemon.json`

```json
{
  "features": {
    "buildkit": true
  }
}
```

**Ativar:**
```bash
sudo systemctl restart docker
```

**Por quê permanente:**
- ✅ Set and forget - configura 1 vez
- ✅ Sem erro humano - sempre ativo
- ✅ Beneficia todos os projetos
- ✅ BuildKit é o futuro do Docker
- ⚠️ Requer 1 restart do Docker (~5-10s downtime)

---

## 📊 Sistema de Medição

### Script de Build (`scripts/build-prod.sh`)

```bash
#!/bin/bash
set -e

echo "🚀 Iniciando build de produção..."
START_TIME=$(date +%s)

docker compose -f docker-compose.prod.yml build "$@"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo "✅ Build completo!"
echo "⏱️  Tempo total: ${MINUTES}m ${SECONDS}s"

# Log histórico
echo "$(date '+%Y-%m-%d %H:%M:%S'),${DURATION}s" >> logs/build-performance.log

# Tamanhos
docker images | grep "essencia-"
```

### Métricas a Monitorar

1. **Tempo total de build**
2. **Cache hits** (output do BuildKit)
3. **Tamanho da imagem final**
4. **Histórico de performance** (logs/)

---

## 📈 Resultados Esperados

### Performance

| Cenário | Antes | Depois | Ganho |
|---------|-------|--------|-------|
| **Build completo (cache frio)** | 12-15 min | 8-10 min | ~30% |
| **Rebuild completo (cache quente)** | 10-12 min | 2-4 min | ~70% |
| **Mudança em 1 app** | 8-10 min | 1-2 min | ~85% |
| **Mudança só em código** | 6-8 min | 30-60s | ~90% |

### Fluxo de Cache em Rebuilds

| Mudança | Layers Reutilizadas | Tempo Estimado |
|---------|---------------------|----------------|
| Nenhuma mudança | Base + Dependencies + Builder | ~30s |
| 1 arquivo .tsx | Base + Dependencies | ~1-2 min |
| package.json | Base | ~3-4 min |
| Primeira vez | Nenhuma | ~8-10 min |

### Simplificação

- **Dockerfiles:** 5 arquivos → 2 arquivos (60% redução)
- **Linhas de config:** ~600 linhas → ~400 linhas (33% redução)
- **Instalações de dependências:** 11 vezes → 1 vez (91% redução)

---

## ✅ Trade-offs Aceitos

### Vantagens

✅ **70-90% mais rápido** em rebuilds
✅ **Muito mais simples** de manter (2 arquivos vs 5)
✅ **Cache máximo** compartilhado
✅ **Economiza espaço** (2.5GB vs 11×600MB = 6.6GB)
✅ **BuildKit permanente** (beneficia futuros projetos)

### Desvantagens

⚠️ **Imagem única maior** (~2.5GB) - mas economiza no total
⚠️ **Menos isolamento** entre builds - todos usam mesma imagem
⚠️ **Requer restart do Docker** - 1 vez, 5-10s downtime

**Decisão:** Vantagens superam amplamente as desvantagens.

---

## 🚀 Comandos de Deploy

### Inalterados

```bash
# Build
docker compose -f docker-compose.prod.yml build

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

### Com Medição (Novo)

```bash
# Build com timer
./scripts/build-prod.sh

# Ver histórico
./scripts/compare-builds.sh
```

---

## 🔄 Plano de Implementação (Próximo Passo)

Se aprovado para implementação, os passos serão:

1. **Backup:** Salvar Dockerfiles atuais
2. **BuildKit:** Configurar daemon com `/etc/docker/daemon.json`
3. **Dockerfile.prod:** Criar novo consolidado
4. **docker-compose.prod.yml:** Simplificar com anchors
5. **Scripts:** Criar build-prod.sh e compare-builds.sh
6. **Teste:** Build completo e validar funcionamento
7. **Deploy:** Aplicar em produção
8. **Monitorar:** Verificar performance real vs esperada
9. **Documentar:** Atualizar CLAUDE.md com novos comandos
10. **Limpar:** Remover Dockerfiles antigos

---

## 📚 Referências

- [Docker BuildKit](https://docs.docker.com/build/buildkit/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Cache mounts](https://docs.docker.com/build/cache/mounts/)
- [Turborepo caching](https://turbo.build/repo/docs/core-concepts/caching)

---

## 🏁 Conclusão

Este design propõe uma modernização completa do sistema Docker do projeto, priorizando:

- **Performance:** 70-90% mais rápido
- **Simplicidade:** 2 arquivos vs 5
- **Manutenibilidade:** Configuração DRY
- **Observabilidade:** Medição contínua

A abordagem é **incremental** (mantém arquitetura atual) mas com **otimização agressiva** (consolidação + BuildKit), balanceando perfeitamente ganho rápido com baixo risco.

**Status:** ✅ Design aprovado, pronto para implementação.
