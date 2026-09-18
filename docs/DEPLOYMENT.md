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
   ├──→ /eventos/*      →  essencia-eventos:3014    (Next.js)
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
| **Eventos**      | essencia-eventos         | 3014          | —             | —            |
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
LOJA_PUBLIC_URL=https://loja.portalcef.com.br
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
docker compose -f docker-compose.prod.yml --env-file .env.docker run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@essencia.edu.br \
  --agree-tos \
  --no-eff-email \
  -d portalcef.com.br \
  -d www.portalcef.com.br

# 4. Iniciar serviços
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d

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

### 2. Deploys Subsequentes com Build Local

```bash
cd /var/www/essencia
git pull --ff-only origin main

# Escolha um comando:
./scripts/deploy.sh           # Sem migration nova
# OU
./scripts/deploy.sh --migrar  # Com backup e migration
```

O script deriva a tag do SHA curto do commit, constrói as imagens com
`docker buildx bake --load`, reconstrói a `landing-mae`, usa `IMAGE_TAG` em
migration e Compose e executa o health check no final. A árvore de trabalho
precisa estar limpa para evitar que alterações não commitadas sejam publicadas
com a tag errada.

### 3. Modos de deploy

Use `./scripts/deploy.sh` para o fluxo local: ele constrói e carrega as imagens
no próprio servidor. O `deploy-rolling.sh` recebe uma tag imutável explícita e
faz a atualização sequencial com health gate; ele não aceita `latest` implícito
e preserva as imagens anteriores para rollback.

Não há zero downtime: os serviços possuem uma instância com `container_name`
fixo e ficam temporariamente indisponíveis durante a recriação.

### 4. Rollback

O rollback local usa somente uma imagem já presente no host e não faz `pull`:

```bash
ROLLBACK_ASSUME_YES=1 ./scripts/rollback.sh --local <sha-anterior>
```

Quando a release estiver no registry, use o modo explícito que baixa a tag:

```bash
ROLLBACK_ASSUME_YES=1 ./scripts/rollback.sh --registry <sha-anterior>
```

Os dois modos passam `IMAGE_TAG` e `--env-file .env.docker` ao Compose. Uma
imagem local ausente interrompe o modo local antes de recriar containers.

Versões disponíveis localmente: `docker images essencia-api`.

---

## Scripts de Deploy

### deploy.sh

Orquestra o deploy quando as imagens são construídas no próprio servidor:

```bash
./scripts/deploy.sh           # Sem migration nova
# OU
./scripts/deploy.sh --migrar  # Com backup e migration
```

O primeiro comando executa lint, typecheck, Buildx Bake com a tag SHA, build da
`landing-mae`, subida dos serviços e health check. A opção `--migrar` também
inicia a infraestrutura necessária, cria um backup com permissão restrita e
aplica a migration da mesma imagem versionada antes de iniciar os serviços da
aplicação. Se alguma etapa falhar, o script retorna erro e interrompe as próximas
etapas. O `up` aguarda até 180 segundos pela saúde dos containers. Não há
rollback automático de código ou banco; migrations devem ser compatíveis com
a versão ainda em execução. A `landing-mae` também recebe `IMAGE_TAG`, portanto
acompanha a versão escolhida no rollback.

### migrate.sh

Aplica migrations no container da API, criando backup antes e abortando se o
backup sair vazio ou parcial. O dump é escrito em arquivo temporário com
permissão `600` e só recebe o nome final depois de terminar com sucesso. A
imagem de produção **não tem `pnpm`** — as migrations rodam
via `node /app/packages/db/dist/migrate.js`, e o script já trata isso.

Como usa `exec` no container em execução, ele aplica as migrations presentes na
imagem que está no ar. Durante um deploy com migration nova, rode-a antes de
subir o código novo, num container descartável da imagem recém-construída:

```bash
IMAGE_TAG=TAG_DA_IMAGEM docker compose -f docker-compose.prod.yml --env-file .env.docker \
  run --rm --no-deps --pull never api node /app/packages/db/dist/migrate.js
```

**Uso:**

```bash
./scripts/migrate.sh
```

### health-check.sh

Script completo de verificação de saúde:

- Status de containers Docker
- Health check da API (/health e /api/health)
- Health check do frontend (Home)
- PostgreSQL (pg_isready e `SELECT 1` no endpoint da API)
- Redis (redis-cli ping e verificação no endpoint da API)
- Uso de disco
- Uso de memória

**Uso:**

```bash
./scripts/health-check.sh
```

O endpoint retorna `status: ok` somente quando banco e Redis respondem. Se uma
dependência falhar, retorna `degraded` e HTTP 503; se as duas falharem, retorna
`unhealthy` e HTTP 503. A resposta não contém URL, host, senha ou detalhes de
conexão.

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
docker compose -f docker-compose.prod.yml --env-file .env.docker logs -f

# Serviço específico
docker compose -f docker-compose.prod.yml --env-file .env.docker logs -f api

# Últimas 100 linhas
docker compose -f docker-compose.prod.yml --env-file .env.docker logs --tail=100 api

# Com timestamps
docker compose -f docker-compose.prod.yml --env-file .env.docker logs -f -t api
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

### Logs de Observabilidade do Planejamento

Os logs estruturados do planejamento ficam no host em `./logs/planejamento` e são montados no container da API em `/var/log/essencia/planejamento`.

Variáveis de produção:

```env
PLANEJAMENTO_OBSERVABILIDADE_SLOW_MS=2000
PLANEJAMENTO_OBSERVABILIDADE_RETENCAO_DIAS=30
```

Antes do deploy, crie o diretório no host com permissão de escrita para o usuário `nestjs` da imagem da API, que usa UID/GID `1001:1001`:

```bash
install -d -m 0750 -o 1001 -g 1001 logs/planejamento
```

Se o diretório já existir com outro dono, ajuste a permissão antes de subir os containers:

```bash
chown 1001:1001 logs/planejamento
chmod 0750 logs/planejamento
```

Para consultar eventos por usuário, evento ou documento:

```bash
# Por usuário
grep -R '"usuario":{"id":"<usuario-id>"' logs/planejamento

# Por evento
grep -R '"evento":"<nome-do-evento>"' logs/planejamento

# Por documento
grep -R '"documentoId":"<documento-id>"' logs/planejamento
```

A API remove arquivos antigos ao iniciar e diariamente às 03:00. A limpeza manual continua disponível se for necessário:

```bash
find logs/planejamento -type f -mtime +30 -delete
```

Esses arquivos podem conter dados pessoais e identificadores de documentos. Restrinja acesso ao diretório, não compartilhe os logs fora dos canais autorizados e nunca anexe trechos com dados sensíveis em chamados públicos.

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
docker compose -f docker-compose.prod.yml --env-file .env.docker logs

# Verificar recursos
docker stats

# Remover containers órfãos
docker compose -f docker-compose.prod.yml --env-file .env.docker down --remove-orphans
```

### Erro de DNS no Nginx

**Sintoma:** `nginx: host not found in upstream "essencia-api:3002"`

**Solução:**

```bash
# Verificar se containers estão na mesma rede
docker network inspect essencia-prod

# Restart do nginx
docker compose -f docker-compose.prod.yml --env-file .env.docker restart nginx
```

### Certificado SSL expirado

```bash
# Renovar manualmente
docker compose -f docker-compose.prod.yml --env-file .env.docker run --rm certbot renew

# Restart do nginx
docker compose -f docker-compose.prod.yml --env-file .env.docker restart nginx
```

### Banco de dados não responde

```bash
# Verificar conexões
docker exec essencia-postgres psql -U essencia -c "SELECT count(*) FROM pg_stat_activity;"

# Reiniciar PostgreSQL
docker compose -f docker-compose.prod.yml --env-file .env.docker restart postgres
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
cd /var/www/essencia
git pull --ff-only origin main
docker buildx bake -f docker-bake.hcl --no-cache
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d

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
docker buildx bake -f docker-bake.hcl --no-cache
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d
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
docker compose -f docker-compose.prod.yml --env-file .env.docker pull postgres redis nginx

# Rebuild após pull
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d
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

Os workflows ficam versionados em `.github/workflows/` e usam a mesma tag em
todos os serviços de uma release:

- `quality.yml` roda em pull requests e em pushes para `main`, executando lint,
  typecheck, testes, build e `pnpm audit --prod --audit-level=high`.
- `deploy.yml` é manual (`workflow_dispatch`). Primeiro repete a validação
  completa, depois publica API, aplicações e `landing-mae` no GHCR com a tag
  informada ou com o SHA completo do commit.
- O job de deploy só é ativado quando solicitado e exige runner self-hosted com
  o ambiente `production` protegido. Ele chama `deploy-rolling.sh`, que faz
  pull explícito de cada imagem, aplica a mesma tag no Compose e preserva as
  versões anteriores.

O fluxo local continua separado: `deploy.sh` constrói com Buildx Bake, cria o
backup/migration opcional e carrega as imagens no próprio host. Nenhum caminho
de produção usa Compose sem `--env-file .env.docker`.

---

## Referências

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [PostgreSQL Official Images](https://hub.docker.com/_/postgres)
- [Redis Official Images](https://hub.docker.com/_/redis)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
