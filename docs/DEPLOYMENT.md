# Deployment Documentation

Guia completo de deployment do Portal Digital Colégio Essência Feliz.

---

## Visão Geral

O Portal Essência Feliz utiliza uma arquitetura containerizada baseada em **Docker Compose** com as seguintes características:

- **Reverse Proxy**: Nginx + Certbot (Let's Encrypt SSL automático)
- **Frontend**: 10 apps Next.js independentes
- **Backend**: API NestJS + Fastify
- **Database**: PostgreSQL 16 com volumes persistentes
- **Cache**: Redis 7
- **Storage**: MinIO (S3-compatible) - opcional
- **SSL**: Certificados Let's Encrypt com renovação automática

---

## Arquitetura de Produção

```
Internet
   │
   ▼
┌────────────────────────────────────────────────────────────┐
│                    Nginx + SSL (443/80)                    │
│          (www.portalcef.com.br + Certbot)                  │
└────────────────────────────────────────────────────────────┘
   │
   ├──→ /api/*          →  essencia-api:3002       (NestJS)
   ├──→ /login/*        →  essencia-login:3003     (Next.js)
   ├──→ /usuarios/*     →  essencia-usuarios:3004  (Next.js)
   ├──→ /escolas/*      →  essencia-escolas:3005   (Next.js)
   ├──→ /turmas/*       →  essencia-turmas:3006    (Next.js)
   ├──→ /planejamento/* →  essencia-planejamento:3007 (Next.js)
   ├──→ /calendario/*   →  essencia-calendario:3008 (Next.js)
   ├──→ /loja/*         →  essencia-loja:3010      (Next.js)
   ├──→ /loja-admin/*   →  essencia-loja-admin:3011 (Next.js)
   ├──→ /tarefas/*      →  essencia-tarefas:3012   (Next.js)
   └──→ /*              →  essencia-home:3000      (Next.js)
   │
   ▼
┌────────────────────────────────────────────────────────────┐
│              essencia-prod (Docker Network)                │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ PostgreSQL  │  │   Redis     │  │   MinIO     │      │
│  │    :5432    │  │   :6379     │  │  :9000/9001 │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└────────────────────────────────────────────────────────────┘
```

---

## Infraestrutura

### Serviços

| Serviço          | Container Name           | Porta Interna | Porta Externa | Health Check |
| ---------------- | ------------------------ | ------------- | ------------- | ------------ |
| **Nginx**        | essencia-nginx           | 80, 443       | 80, 443       | —            |
| **Certbot**      | essencia-certbot         | —             | —             | —            |
| **API**          | essencia-api             | 3002          | —             | /health      |
| **Home**         | essencia-home            | 3000          | —             | —            |
| **Login**        | essencia-login           | 3003          | —             | —            |
| **Usuarios**     | essencia-usuarios        | 3004          | —             | —            |
| **Escolas**      | essencia-escolas         | 3005          | —             | —            |
| **Turmas**       | essencia-turmas          | 3006          | —             | —            |
| **Planejamento** | essencia-planejamento    | 3007          | —             | —            |
| **Calendario**   | essencia-calendario      | 3008          | —             | —            |
| **Loja**         | essencia-loja            | 3010          | —             | —            |
| **Loja Admin**   | essencia-loja-admin      | 3011          | —             | —            |
| **Tarefas**      | essencia-tarefas         | 3012          | —             | —            |
| **Worker**       | essencia-worker          | 3100          | —             | —            |
| **PostgreSQL**   | essencia-postgres        | 5432          | —             | pg_isready   |
| **Redis**        | essencia-redis           | 6379          | —             | redis-cli    |
| **MinIO**        | essencia-minio           | 9000, 9001    | —             | /health/live |

### Volumes Persistentes

| Volume                   | Descrição                      | Path no Container         |
| ------------------------ | ------------------------------ | ------------------------- |
| `essencia-postgres-data` | Dados do PostgreSQL            | `/var/lib/postgresql/data` |
| `essencia-redis-data`    | Dados do Redis                 | `/data`                   |
| `essencia-minio-data`    | Storage de arquivos (MinIO)    | `/data`                   |
| `essencia-nginx-certs`   | Certificados SSL (Let's Encrypt) | `/etc/letsencrypt`        |
| `essencia-nginx-webroot` | Webroot para validação ACME    | `/var/www/certbot`        |

---

## Configuração do Nginx

### Estrutura do nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    resolver 127.0.0.11 valid=10s ipv6=off;  # Docker DNS resolver

    # Redirect: portalcef.com.br → www.portalcef.com.br (HTTP)
    # Redirect: HTTP → HTTPS
    # Redirect: portalcef.com.br → www.portalcef.com.br (HTTPS)

    # Main server: www.portalcef.com.br (HTTPS)
    server {
        listen 443 ssl;
        server_name www.portalcef.com.br;

        ssl_certificate /etc/letsencrypt/live/portalcef.com.br/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/portalcef.com.br/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # API Proxy
        location /api {
            set $upstream_api essencia-api:3002;
            proxy_pass http://$upstream_api;
            # Headers omitidos para brevidade
        }

        # Apps Proxy (login, usuarios, escolas, turmas, planejamento, calendario, loja, loja-admin)
        # Home como fallback (location /)
    }
}
```

**Características:**

- **DNS Dinâmico**: `resolver 127.0.0.11` resolve IPs de containers a cada 10s
- **SSL/TLS**: TLS 1.2 e 1.3 com ciphers seguros
- **Redirect Chain**: Força `www` + HTTPS
- **Proxy Headers**: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`
- **ACME Challenge**: `/.well-known/acme-challenge/` para validação Let's Encrypt

---

## Dockerfile.prod

### Multi-Stage Build

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
COPY pnpm-*.yaml package.json ./
COPY apps/ packages/ services/ ./
RUN pnpm install --frozen-lockfile --production=false

# Stage 2: Builder
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm turbo build

# Stage 3: Production
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
CMD ["pnpm", "start"]
```

**Otimizações:**

- **Multi-stage**: Reduz tamanho final da imagem
- **Layer Caching**: Dependencies separadas do código-fonte
- **Turbo Cache**: Aproveita cache do Turborepo
- **Production Build**: Apenas node_modules de produção

---

## Variáveis de Ambiente de Produção

### Arquivo `.env.docker`

```env
# Database (URL-encoded password!)
DATABASE_URL=postgresql://user:password%40123@postgres:5432/essencia_db

# Redis
REDIS_URL=redis://redis:6379

# Session & Auth
SESSION_SECRET=<strong-random-secret-256-bits>
SESSION_TTL_HOURS=24
SESSION_RENEWAL_THRESHOLD=0.25

# Cookie
COOKIE_DOMAIN=.portalcef.com.br
COOKIE_SECURE=true

# MinIO (Storage)
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=<strong-access-key>
MINIO_SECRET_KEY=<strong-secret-key>
MINIO_BUCKET=essencia-uploads
MINIO_USE_SSL=false

# PostgreSQL (para container)
POSTGRES_USER=essencia
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=essencia_db

# Stripe (opcional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Node
NODE_ENV=production
```

> **⚠️ ATENÇÃO**: Nunca commitar `.env.docker` no repositório. Use secrets management ou `.gitignore`.

---

## Workflow de Deploy

### Pré-requisitos

- VPS/Servidor Linux (Ubuntu 22.04+ recomendado)
- Docker 24+ e Docker Compose v2+
- Domínio DNS apontando para o servidor (`www.portalcef.com.br`)
- Portas 80 e 443 abertas no firewall

### 1. Preparação Inicial (First Deploy)

```bash
# 1. Clonar repositório
cd /opt
git clone https://github.com/renatinhosfaria/portalessencia.git essencia
cd essencia

# 2. Configurar variáveis de ambiente
cp .env.example .env.docker
nano .env.docker  # Editar com valores de produção

# 3. Gerar certificado SSL (primeira vez)
# Certifique-se de que o DNS aponta para o servidor
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@essencia.edu.br \
  --agree-tos \
  --no-eff-email \
  -d portalcef.com.br \
  -d www.portalcef.com.br

# 4. Iniciar serviços
docker compose -f docker-compose.prod.yml up -d

# 5. Executar migrations
./scripts/migrate.sh

# 6. Setup inicial (criar escola, unidade, usuário master)
curl -X POST https://www.portalcef.com.br/api/setup/init \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "Colégio Essência Feliz",
    "unitName": "Unidade Centro",
    "masterEmail": "admin@essencia.edu.br",
    "masterPassword": "SenhaForte123!",
    "masterName": "Administrador"
  }'

# 7. Verificar saúde
./scripts/health-check.sh
```

### 2. Deploys Subsequentes

```bash
# 1. Navegar para diretório
cd /opt/essencia

# 2. Pull das mudanças
git pull origin main

# 3. Rebuild e restart
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# 4. Executar migrations (se houver)
./scripts/migrate.sh

# 5. Verificar saúde
./scripts/health-check.sh
```

### 3. Deploy com Zero Downtime (Avançado)

```bash
# 1. Build nova versão
docker compose -f docker-compose.prod.yml build

# 2. Scale up (criar instâncias duplicadas)
docker compose -f docker-compose.prod.yml up -d --scale api=2

# 3. Aguardar health checks

# 4. Parar instâncias antigas
docker stop essencia-api-old

# 5. Scale down
docker compose -f docker-compose.prod.yml up -d --scale api=1
```

---

## Scripts de Deploy

### migrate.sh

```bash
#!/bin/bash
# Executa migrations do Drizzle dentro do container da API

set -e
echo "Running database migrations..."
docker exec essencia-api pnpm --filter @essencia/db db:migrate
echo "Done!"
```

**Uso:**

```bash
./scripts/migrate.sh
```

### health-check.sh

Script completo de verificação de saúde:

- Status de containers Docker
- Health check da API (/health)
- Health check do frontend (Home)
- PostgreSQL (pg_isready)
- Redis (redis-cli ping)
- Uso de disco
- Uso de memória

**Uso:**

```bash
./scripts/health-check.sh
```

**Saída esperada:**

```
==============================================
  Portal Essência Feliz - Health Check
==============================================

[Docker Containers]
NAME                 STATUS
essencia-nginx       Up 2 hours
essencia-api         Up 2 hours (healthy)
...

[API Health]
✓ API is healthy

[PostgreSQL]
✓ PostgreSQL is healthy
...
```

---

## Monitoramento e Logs

### Visualizar Logs

```bash
# Todos os serviços
docker compose -f docker-compose.prod.yml logs -f

# Serviço específico
docker compose -f docker-compose.prod.yml logs -f api

# Últimas 100 linhas
docker compose -f docker-compose.prod.yml logs --tail=100 api

# Com timestamps
docker compose -f docker-compose.prod.yml logs -f -t api
```

### Log Rotation

Os logs estão configurados com rotação automática:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"    # API: 50m
    max-file: "3"      # API: 5
```

### Métricas de Health

**API Health Endpoint:**

```bash
curl https://www.portalcef.com.br/health
```

**Resposta esperada:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-14T10:30:00Z",
  "uptime": 7200,
  "database": "connected",
  "redis": "connected"
}
```

---

## Backup e Recuperação

### Backup do PostgreSQL

```bash
# Backup manual
docker exec essencia-postgres pg_dump -U essencia -d essencia_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup agendado (cron)
0 2 * * * /opt/essencia/scripts/backup-db.sh
```

### Restauração

```bash
# Restaurar backup
cat backup_20260114_020000.sql | docker exec -i essencia-postgres psql -U essencia -d essencia_db
```

### Backup de Volumes

```bash
# Backup de todos os volumes
docker run --rm \
  -v essencia-postgres-data:/source \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /source .
```

---

## Troubleshooting

### Containers não iniciam

```bash
# Ver logs de erro
docker compose -f docker-compose.prod.yml logs

# Verificar recursos
docker stats

# Remover containers órfãos
docker compose -f docker-compose.prod.yml down --remove-orphans
```

### Erro de DNS no Nginx

**Sintoma:** `nginx: host not found in upstream "essencia-api:3002"`

**Solução:**

```bash
# Verificar se containers estão na mesma rede
docker network inspect essencia-prod

# Restart do nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Certificado SSL expirado

```bash
# Renovar manualmente
docker compose -f docker-compose.prod.yml run --rm certbot renew

# Restart do nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Banco de dados não responde

```bash
# Verificar conexões
docker exec essencia-postgres psql -U essencia -c "SELECT count(*) FROM pg_stat_activity;"

# Reiniciar PostgreSQL
docker compose -f docker-compose.prod.yml restart postgres
```

---

## Segurança em Produção

### Checklist de Segurança

- [ ] **Secrets**: `.env.docker` com secrets fortes (256-bit)
- [ ] **SSL/TLS**: Certificado válido e renovação automática
- [ ] **Firewall**: Apenas portas 80, 443, 22 abertas
- [ ] **Database**: Senha forte com caracteres especiais URL-encoded
- [ ] **COOKIE_SECURE**: `true` em produção
- [ ] **COOKIE_DOMAIN**: `.portalcef.com.br`
- [ ] **CORS**: Configurado apenas para domínio de produção
- [ ] **Backups**: Agendados diariamente
- [ ] **Updates**: Docker images atualizadas mensalmente
- [ ] **Monitoring**: Health checks configurados
- [ ] **Logs**: Rotação configurada para evitar estouro de disco

### Hardening do Nginx

```nginx
# Adicionar headers de segurança
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

### Rate Limiting (Nginx)

```nginx
# Limitar requisições por IP
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api {
    limit_req zone=api_limit burst=20 nodelay;
    # ... resto da config
}
```

---

## Rollback

### Rollback Rápido

```bash
# 1. Voltar para commit anterior
git revert HEAD
git push origin main

# 2. Pull e rebuild
cd /opt/essencia
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# 3. Health check
./scripts/health-check.sh
```

### Rollback de Migrations

```bash
# Se migration quebrou o sistema
# 1. Restaurar backup do banco
cat backup_pre_migration.sql | docker exec -i essencia-postgres psql -U essencia -d essencia_db

# 2. Rebuild containers com versão anterior
git checkout <commit-anterior>
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## Manutenção

### Limpeza de Recursos

```bash
# Remover containers parados
docker container prune -f

# Remover images não usadas
docker image prune -a -f

# Remover volumes órfãos
docker volume prune -f

# Limpeza completa (CUIDADO!)
docker system prune -a --volumes -f
```

### Atualização de Images

```bash
# Pull de novas versões das images base
docker compose -f docker-compose.prod.yml pull postgres redis nginx

# Rebuild após pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Performance

### Resource Limits (API)

```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

### Connection Pooling

**PostgreSQL**:

```env
DATABASE_URL=postgresql://user:pass@postgres:5432/essencia_db?pool_timeout=10&pool_max_conns=20
```

**Redis**:

```typescript
// ioredis auto-pool
```

---

## CI/CD (GitHub Actions)

O pipeline de CI/CD está configurado em `.github/workflows/deploy.yml` com os seguintes estágios:

### 1. Quality Check
- **Trigger**: Todo push para `main` e pull requests
- **Tasks**: `pnpm turbo lint` e `pnpm turbo typecheck`
- Node 22, pnpm 9.15.1, Turbo cache

### 2. Build de Imagens Docker (Matrix)
- 10 apps Next.js + API + Worker (12 serviços)
- Build paralelo com matrix strategy
- Cache otimizado com GitHub Actions cache
- Imagens publicadas no GHCR (GitHub Container Registry)

### 3. Deploy em Produção
- **Condição**: Apenas branch `main` (não PRs)
- Acesso via SSH (`appleboy/ssh-action`)
- Etapas:
  1. `git pull` do código mais recente
  2. `docker compose pull` das novas imagens
  3. `./scripts/deploy-rolling.sh` (zero downtime)
  4. `./scripts/health-check.sh` (verificação)
  5. Limpeza de imagens antigas (24h+)

### 4. E2E Tests (Opcional)
- Executados após deploy em produção
- Playwright contra `https://www.portalcef.com.br`
- Reports de testes salvos como artifacts

---

## Referências

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [PostgreSQL Official Images](https://hub.docker.com/_/postgres)
- [Redis Official Images](https://hub.docker.com/_/redis)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
