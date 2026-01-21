# Portal Digital Colégio Essência Feliz

> **Documento de contexto para agentes de IA**
> Sistema em **PRODUÇÃO** em https://www.portalcef.com.br

---

### 🚨 Regras Invioláveis
1. Comunicação em Português (BR)
OBRIGATÓRIO: Toda comunicação, código de domínio, commits, documentação e comentários devem ser em Português do Brasil.

# Exceções permitidas em inglês:

Palavras técnicas universais (API, HTTP, GET, POST, etc.)
Nomes de bibliotecas e frameworks
Tipos do TypeScript (string, boolean, interface, etc.)
Convenções de código (useState, useEffect, onClick, etc.)

---

## 🎯 TL;DR - Comandos Essenciais

```bash
# ⚠️ OBRIGATÓRIO antes de qualquer commit/PR
pnpm turbo lint && pnpm turbo typecheck 

# Desenvolvimento local
pnpm turbo dev                                    # Todos os apps
pnpm turbo dev --filter=planejamento        # App específico

# Banco de dados
pnpm db:generate                            # Gerar migration
pnpm db:migrate                             # Aplicar migrations (dev)
pnpm db:studio                              # Interface visual (:4983)

# Produção (no servidor) - Build Otimizado ⚡
docker compose -f docker-compose.prod.yml build --parallel  # 40% mais rápido
docker compose -f docker-compose.prod.yml up -d
./scripts/migrate.sh                        # Migrations em produção
./scripts/health-check.sh                   # Verificar saúde

# Build Inteligente (recomendado para desenvolvimento)
./scripts/build-optimized.sh full           # Build completo otimizado
./scripts/build-optimized.sh incremental    # Apenas serviços alterados
./scripts/build-optimized.sh login          # Serviço específico
```

**Regra de Ouro:** Apps NUNCA acessam banco diretamente → sempre via API HTTP.

---

## 📋 Índice

1. [Ciclo de Qualidade](#-ciclo-de-qualidade)
2. [Deploy em Produção](#-deploy-em-produção)
3. [Monitoramento e Saúde](#-monitoramento-e-saúde)
4. [Rollback e Recuperação](#-rollback-e-recuperação)
5. [Regras Invioláveis](#-regras-invioláveis)
6. [Arquitetura do Sistema](#-arquitetura-do-sistema)
7. [Contexto de Domínio (PT-BR)](#-contexto-de-domínio-pt-br)
8. [Convenções de Código](#-convenções-de-código)
9. [Troubleshooting Produção](#-troubleshooting-produção)
10. [Pendências Conhecidas](#-pendências-conhecidas)

---

## ✅ Ciclo de Qualidade

### Pipeline Obrigatório (Pré-Commit)

**Executar SEMPRE antes de qualquer commit ou PR:**

```bash
pnpm turbo lint && pnpm turbo typecheck
```
---

# 1. Rebuild e restart
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

### Variáveis de Ambiente Críticas

```env
# Produção - .env.docker
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_DOMAIN=.portalcef.com.br
DATABASE_URL=postgresql://user:password@postgres:5432/essencia_db
REDIS_URL=redis://redis:6379
```

---

## 📊 Monitoramento e Saúde

### Health Check da API

```bash
# Via curl
curl https://www.portalcef.com.br/api/health

# Resposta esperada
{
  "status": "ok",
  "timestamp": "2026-01-14T10:30:00Z",
  "uptime": 7200,
  "database": "connected",
  "redis": "connected"
}
```

### Verificar Status dos Containers

```bash
# Status geral
docker compose -f docker-compose.prod.yml ps

# Uso de recursos
docker stats

# Health check completo
./scripts/health-check.sh
```

### Logs

```bash
# Todos os serviços
docker compose -f docker-compose.prod.yml logs -f

# Serviço específico
docker compose -f docker-compose.prod.yml logs -f api

# Últimas 100 linhas com timestamp
docker compose -f docker-compose.prod.yml logs --tail=100 -t api

# Filtrar erros
docker compose -f docker-compose.prod.yml logs api 2>&1 | grep -i error
```

### Verificar Sessões Redis

```bash
# Conectar ao Redis
docker exec -it essencia-redis redis-cli

# Comandos úteis
KEYS session:*                    # Listar sessões
GET session:UUID                  # Ver sessão específica
TTL session:UUID                  # Tempo restante
INFO memory                       # Uso de memória
```

### Verificar Conexões PostgreSQL

```bash
# Conectar ao PostgreSQL
docker exec -it essencia-postgres psql -U essencia -d essencia_db

# Comandos úteis
SELECT count(*) FROM pg_stat_activity;    # Conexões ativas
SELECT pg_database_size('essencia_db');   # Tamanho do banco
\dt                                        # Listar tabelas
```

### Backup do Banco

```bash
# Backup manual
docker exec essencia-postgres pg_dump -U essencia -d essencia_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup antes de migration crítica
docker exec essencia-postgres pg_dump -U essencia -d essencia_db > backup_pre_migration.sql
```

### Restaurar Backup

```bash
# Restaurar
cat backup_20260114_020000.sql | docker exec -i essencia-postgres psql -U essencia -d essencia_db
```

### Rollback de Migration

```bash
# 1. Restaurar backup do banco
cat backup_pre_migration.sql | docker exec -i essencia-postgres psql -U essencia -d essencia_db

# 2. Voltar código para versão anterior
git checkout <commit-anterior>

# 3. Rebuild
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Renovar Certificado SSL

```bash
# Renovar manualmente
docker compose -f docker-compose.prod.yml run --rm certbot renew

# Restart do nginx
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 🚨 Regras Invioláveis

### 1. Governança de Dados

```typescript
// ❌ PROIBIDO - App acessando banco
import { db } from "@essencia/db";

// ✅ CORRETO - App via API
import { serverFetch } from "@essencia/shared/fetchers/server";
const users = await serverFetch("/users");
```

### 2. Tenant Context da Sessão

```typescript
// ❌ ERRADO - schoolId do payload
async create(@Body() dto) {
  return this.service.create(dto.schoolId, dto);
}

// ✅ CORRETO - schoolId da sessão
async create(@CurrentUser() session, @Body() dto) {
  return this.service.create(session.schoolId, dto);
}
```

### 3. Guards na Ordem Correta

```typescript
// ✅ CORRETO
@UseGuards(AuthGuard, RolesGuard, TenantGuard)

// ❌ ERRADO
@UseGuards(TenantGuard, AuthGuard, RolesGuard)
```

### 4. Ciclo de Qualidade Antes de Commit

```bash
# Sempre executar
pnpm turbo lint && pnpm turbo typecheck
```

---

## 🏗 Arquitetura do Sistema

### Stack

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Monorepo | Turborepo + pnpm | 2.3.3 / 9.15.1 |
| Frontend | Next.js (App Router) | 15.1.0 |
| Backend | NestJS + Fastify | 10.4.15 |
| Database | PostgreSQL + Drizzle | 16 / 0.38.2 |
| Cache | Redis | 7 |
| UI | shadcn/ui + Tailwind | 3.4.17 |

### Módulos

| Módulo | Porta | Produção |
|--------|-------|----------|
| home | 3000 | `/` |
| login | 3003 | `/login` |
| usuarios | 3004 | `/usuarios` |
| escolas | 3005 | `/escolas` |
| turmas | 3006 | `/turmas` |
| planejamento | 3007 | `/planejamento` |
| calendario | 3008 | `/calendario` |
| loja | 3010 | `/loja` |
| loja-admin | 3011 | `/loja-admin` |
| api | 3001/3002 | `/api` |

### Pipeline de Guards

```
Request → AuthGuard → RolesGuard → TenantGuard → Controller
```

---

## 🇧🇷 Contexto de Domínio (PT-BR)

### Glossário

| Termo | Significado |
|-------|-------------|
| **Turma** | Classe/sala de aula |
| **Quinzena** | Período de 2 semanas (ciclo de planejamento) |
| **Planejamento** | Plano pedagógico quinzenal |
| **Professora** | Professora titular (feminino no sistema) |
| **Coordenadora** | Coordenadora pedagógica (aprova planejamentos) |
| **Etapa** | Nível educacional (BERCARIO, INFANTIL, FUNDAMENTAL_I, etc.) |
| **First Pass Yield** | Aprovação sem ajustes |
| **Voucher** | Reserva de pedido (loja) |

### Hierarquia de Roles

| Role | Nível | Escopo |
|------|-------|--------|
| `master` | 0 | Global |
| `diretora_geral` | 1 | Escola |
| `gerente_unidade` | 2 | Unidade |
| `gerente_financeiro` | 3 | Unidade |
| `coordenadora_geral` | 4 | Unidade |
| `coordenadora_*` | 5-9 | Unidade (por etapa) |
| `analista_pedagogico` | 10 | Unidade |
| `professora` | 11 | Unidade |
| `auxiliar_*` | 12-13 | Unidade |

---

## 📝 Convenções de Código

### Nomenclatura

| Item | Convenção | Exemplo |
|------|-----------|---------|
| Variáveis/Funções | camelCase | `userData`, `fetchUsers()` |
| Componentes/Classes | PascalCase | `UserCard`, `UsersService` |
| Arquivos/Pastas | kebab-case | `user-card.tsx` |
| Domínio | PT-BR | `turma`, `quinzena` |

### Imports

```typescript
// 1. External
import { useState } from 'react';

// 2. Internal packages
import { Button } from '@essencia/ui';

// 3. Relative
import { UserCard } from './user-card';
```

---

## 🔧 Troubleshooting Produção

### Container não Inicia

```bash
# Ver logs
docker compose -f docker-compose.prod.yml logs

# Verificar recursos
docker stats

# Remover órfãos
docker compose -f docker-compose.prod.yml down --remove-orphans
docker compose -f docker-compose.prod.yml up -d
```

### Erro de DNS no Nginx

```bash
# Verificar rede
docker network inspect essencia-prod

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Banco não Responde

```bash
# Verificar conexões
docker exec essencia-postgres psql -U essencia -c "SELECT count(*) FROM pg_stat_activity;"

# Restart
docker compose -f docker-compose.prod.yml restart postgres
```

### Sessão Expirada (Usuários Reclamando)

```bash
# Verificar Redis
docker exec -it essencia-redis redis-cli PING

# Ver sessões ativas
docker exec -it essencia-redis redis-cli KEYS "session:*"
```

### Limpeza de Recursos

```bash
# Containers parados
docker container prune -f

# Images não usadas
docker image prune -a -f

# CUIDADO - Limpeza completa
docker system prune -a --volumes -f
```

## 📚 Documentação

### Documentação Técnica

| Documento | Descrição |
|-----------|-----------|
| [API.md](./docs/API.md) | Endpoints REST |
| [DATABASE.md](./docs/DATABASE.md) | Schema, migrations |
| [SECURITY.md](./docs/SECURITY.md) | Auth, RBAC |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Docker, produção |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Decisões arquiteturais |

### Otimizações de Build ⚡

| Documento | Propósito |
|-----------|-----------|
| [OTIMIZACOES_RESUMO.md](./OTIMIZACOES_RESUMO.md) | **Começar aqui** - Resumo executivo |
| [QUICK_BUILD_GUIDE.md](./QUICK_BUILD_GUIDE.md) | Guia rápido de builds otimizados |
| [BUILD_CHEATSHEET.md](./BUILD_CHEATSHEET.md) | Referência rápida de comandos |
| [DOCKERFILE_MIGRATION.md](./DOCKERFILE_MIGRATION.md) | Migração para Dockerfile otimizado |
| [docs/OTIMIZACOES_BUILD.md](./docs/OTIMIZACOES_BUILD.md) | Documentação completa de otimizações |
| [docs/DOCKERFILE_OPTIMIZATIONS.md](./docs/DOCKERFILE_OPTIMIZATIONS.md) | Detalhes técnicos do Dockerfile |

---

## 🔗 Links

- **Produção:** https://www.portalcef.com.br
- **Health:** https://www.portalcef.com.br/api/health
- **Repositório:** https://github.com/renatinhosfaria/portalcef

---

<div align="center">

**Portal Digital Colégio Essência Feliz** 

</div>