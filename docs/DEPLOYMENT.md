# Deployment Guide

Guia completo de deploy do Portal Digital Colegio Essencia Feliz.

---

## Indice

1. [Visao Geral](#visao-geral)
2. [Infraestrutura](#infraestrutura)
3. [Ambientes](#ambientes)
4. [Setup Inicial](#setup-inicial)
5. [Docker Services](#docker-services)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [SSL/TLS](#ssltls)
8. [Monitoramento](#monitoramento)
9. [Backup e Recovery](#backup-e-recovery)
10. [Troubleshooting](#troubleshooting)

---

## Visao Geral

### Arquitetura de Deploy

```
                    Internet
                        |
                   [Firewall]
                        |
                   [Traefik]
                   (80/443)
                        |
        +---------------+---------------+
        |       |       |       |       |
      [home] [login] [usuarios] [escolas] [planejamento]
      :3000   :3003    :3004     :3005      :3007
        |       |       |       |       |
        +-------+-------+-------+-------+
                        |
                      [API]
                      :3001
                        |
            +-----------+-----------+
            |                       |
       [PostgreSQL]             [Redis]
         :5432                   :6379
```

---

## Infraestrutura

### Stack de Producao

| Componente        | Tecnologia                | Versao |
| ----------------- | ------------------------- | ------ |
| **Host**          | Contabo VPS               | -      |
| **OS**            | Ubuntu 24.04 LTS          | 24.04  |
| **Orquestrador**  | Docker Compose            | >= 2.x |
| **Reverse Proxy** | Traefik                   | v3.2   |
| **SSL**           | Let's Encrypt             | -      |
| **Registry**      | GitHub Container Registry | -      |
| **CI/CD**         | GitHub Actions            | -      |

### Requisitos Minimos do Servidor

| Recurso | Minimo           | Recomendado      |
| ------- | ---------------- | ---------------- |
| **CPU** | 2 vCPU           | 4 vCPU           |
| **RAM** | 4 GB             | 8 GB             |
| **SSD** | 40 GB            | 80 GB            |
| **SO**  | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

---

## Ambientes

### Desenvolvimento Local

| Servico      | Porta | URL                   |
| ------------ | ----- | --------------------- |
| home         | 3000  | http://localhost:3000 |
| api          | 3001  | http://localhost:3001 |
| login        | 3003  | http://localhost:3003 |
| usuarios     | 3004  | http://localhost:3004 |
| escolas      | 3005  | http://localhost:3005 |
| turmas       | 3006  | http://localhost:3006 |
| planejamento | 3007  | http://localhost:3007 |
| PostgreSQL   | 5432  | localhost:5432        |
| Redis        | 6379  | localhost:6379        |

### Producao

| Servico      | URL                                  |
| ------------ | ------------------------------------ |
| home         | https://essencia.edu.br              |
| login        | https://essencia.edu.br/login        |
| usuarios     | https://essencia.edu.br/usuarios     |
| escolas      | https://essencia.edu.br/escolas      |
| turmas       | https://essencia.edu.br/turmas       |
| planejamento | https://essencia.edu.br/planejamento |
| api          | Interno (nao exposto)                |

---

## Setup Inicial

### 1. Preparar VPS

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuario ao grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Verificar instalacao
docker --version
docker compose version
```

### 2. Clonar Repositorio

```bash
# Criar diretorio
sudo mkdir -p /opt/essencia
sudo chown $USER:$USER /opt/essencia
cd /opt/essencia

# Clonar
git clone https://github.com/renatinhosfaria/portalessencia.git .
```

### 3. Configurar Variaveis de Ambiente

```bash
cp .env.example .env
nano .env
```

**Variaveis Obrigatorias:**

```bash
# Database
DATABASE_URL=postgresql://essencia:SENHA_SEGURA@postgres:5432/essencia_db
POSTGRES_USER=essencia
POSTGRES_PASSWORD=SENHA_SEGURA
POSTGRES_DB=essencia_db

# Redis
REDIS_URL=redis://redis:6379

# Seguranca
SESSION_SECRET=GERAR_COM_openssl_rand_hex_32
COOKIE_SECRET=GERAR_COM_openssl_rand_hex_32
COOKIE_DOMAIN=essencia.edu.br

# API
API_URL=http://api:3001

# Node
NODE_ENV=production
```

**Gerar secrets:**

```bash
# Session secret
openssl rand -hex 32

# Cookie secret
openssl rand -hex 32
```

### 4. Iniciar Servicos

```bash
# Build e start
docker compose -f docker-compose.prod.yml up -d

# Verificar status
docker compose ps

# Ver logs
docker compose logs -f
```

### 5. Executar Migracoes

```bash
docker compose exec api pnpm db:migrate
```

---

## Docker Services

### Containers

| Container    | Imagem                   | Porta Interna | Memoria |
| ------------ | ------------------------ | ------------- | ------- |
| traefik      | traefik:v3.2             | 80, 443       | 128MB   |
| home         | ghcr.io/.../home         | 3000          | 512MB   |
| login        | ghcr.io/.../login        | 3003          | 256MB   |
| usuarios     | ghcr.io/.../usuarios     | 3004          | 256MB   |
| escolas      | ghcr.io/.../escolas      | 3005          | 256MB   |
| planejamento | ghcr.io/.../planejamento | 3007          | 512MB   |
| api          | ghcr.io/.../api          | 3001          | 512MB   |
| postgres     | postgres:16-alpine       | 5432          | 1GB     |
| redis        | redis:7-alpine           | 6379          | 256MB   |

### docker-compose.prod.yml

```yaml
version: "3.8"

services:
  traefik:
    image: traefik:v3.2
    command:
      - "--api.dashboard=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@essencia.edu.br"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
    networks:
      - essencia-network

  home:
    image: ghcr.io/renatinhosfaria/portalessencia-home:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.home.rule=Host(`essencia.edu.br`) && PathPrefix(`/`)"
      - "traefik.http.routers.home.entrypoints=websecure"
      - "traefik.http.routers.home.tls.certresolver=letsencrypt"
    environment:
      - NODE_ENV=production
    networks:
      - essencia-network

  api:
    image: ghcr.io/renatinhosfaria/portalessencia-api:latest
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    networks:
      - essencia-network

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - essencia-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - essencia-network

networks:
  essencia-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
```

### Health Checks

```yaml
# Adicionar a cada servico
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

## CI/CD Pipeline

### Fluxo

```
Push to main → GitHub Actions → Build → Test → Push to GHCR → Deploy to VPS
```

### Workflow (.github/workflows/deploy.yml)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck
      - run: pnpm turbo test

  build:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [home, login, usuarios, escolas, planejamento, api]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}-${{ matrix.app }}:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/essencia
            docker compose pull
            docker compose up -d
            docker system prune -f
```

### Deploy Manual

```bash
# No servidor
cd /opt/essencia

# Pull das imagens
docker compose pull

# Restart dos servicos
docker compose up -d

# Limpeza
docker system prune -f
```

---

## SSL/TLS

### Let's Encrypt (Automatico)

Traefik gerencia certificados automaticamente:

```yaml
# Labels do servico
labels:
  - "traefik.http.routers.home.tls.certresolver=letsencrypt"
```

### Renovacao

Certificados sao renovados automaticamente 30 dias antes da expiracao.

### Verificar Certificado

```bash
# Ver data de expiracao
echo | openssl s_client -servername essencia.edu.br -connect essencia.edu.br:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Monitoramento

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

SERVICES=("home" "login" "usuarios" "escolas" "planejamento" "api")
FAILED=0

for service in "${SERVICES[@]}"; do
  if ! docker compose ps $service | grep -q "Up"; then
    echo "ERRO: $service esta down"
    FAILED=1
  fi
done

if [ $FAILED -eq 0 ]; then
  echo "Todos os servicos estao saudaveis"
fi
```

### Logs

```bash
# Todos os servicos
docker compose logs -f

# Servico especifico
docker compose logs -f api

# Ultimas 100 linhas
docker compose logs --tail 100 api

# Com timestamp
docker compose logs -f -t api
```

### Metricas

```bash
# Uso de recursos
docker stats

# Espaco em disco
df -h

# Memoria
free -h
```

### Alertas Recomendados

| Metrica        | Threshold | Acao               |
| -------------- | --------- | ------------------ |
| CPU            | > 80%     | Escalar            |
| Memoria        | > 85%     | Investigar         |
| Disco          | > 90%     | Limpar/expandir    |
| Container down | > 0       | Restart automatico |
| SSL expirando  | < 7 dias  | Verificar Traefik  |

---

## Backup e Recovery

### Database Backup

```bash
# Backup manual
docker compose exec postgres pg_dump -U essencia essencia_db > backup_$(date +%Y%m%d).sql

# Backup automatizado (cron)
0 3 * * * /opt/essencia/scripts/backup.sh
```

### Script de Backup

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/opt/essencia/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database
docker compose exec -T postgres pg_dump -U essencia essencia_db | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Redis
docker compose exec -T redis redis-cli BGSAVE

# Manter apenas ultimos 7 dias
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup concluido: $DATE"
```

### Restore

```bash
# Parar API
docker compose stop api

# Restore database
gunzip < backup_20250101.sql.gz | docker compose exec -T postgres psql -U essencia essencia_db

# Reiniciar
docker compose up -d
```

### Retencao

| Frequencia | Retencao  |
| ---------- | --------- |
| Diario     | 7 dias    |
| Semanal    | 4 semanas |
| Mensal     | 12 meses  |

---

## Troubleshooting

### Container nao inicia

```bash
# Ver logs detalhados
docker compose logs [service]

# Verificar status
docker compose ps

# Restart do servico
docker compose restart [service]
```

### Problemas de rede

```bash
# Listar redes
docker network ls

# Inspecionar rede
docker network inspect essencia-network

# Recrear rede
docker compose down
docker network prune
docker compose up -d
```

### Database inacessivel

```bash
# Verificar se postgres esta rodando
docker compose ps postgres

# Conectar ao banco
docker compose exec postgres psql -U essencia -d essencia_db

# Ver conexoes ativas
docker compose exec postgres psql -U essencia -c "SELECT * FROM pg_stat_activity;"
```

### Redis sem conexao

```bash
# Verificar redis
docker compose exec redis redis-cli ping

# Ver info
docker compose exec redis redis-cli info
```

### Porta ocupada

```bash
# Ver o que esta usando a porta
sudo lsof -i :80
sudo netstat -tlnp | grep :80

# Matar processo
sudo kill -9 [PID]
```

### SSL nao funciona

```bash
# Ver logs do Traefik
docker compose logs traefik

# Verificar arquivo acme.json
ls -la /opt/essencia/letsencrypt/acme.json

# Permissoes corretas
chmod 600 /opt/essencia/letsencrypt/acme.json
```

### Memoria alta

```bash
# Ver uso por container
docker stats --no-stream

# Limpar imagens nao usadas
docker system prune -a

# Limpar volumes orfaos
docker volume prune
```

---

## Scripts Disponiveis

| Script            | Descricao                     |
| ----------------- | ----------------------------- |
| `setup-vps.sh`    | Setup inicial do servidor     |
| `deploy.sh`       | Deploy/update da aplicacao    |
| `health-check.sh` | Verificacao de saude          |
| `backup.sh`       | Backup de database e redis    |
| `migrate.sh`      | Executar migracoes            |
| `rollback.sh`     | Rollback para versao anterior |

---

## Rollback

### Rollback Rapido

```bash
# Ver tags disponiveis
docker images | grep essencia

# Voltar para versao anterior
docker compose down
docker tag ghcr.io/.../api:previous ghcr.io/.../api:latest
docker compose up -d
```

### Rollback de Database

```bash
# Listar backups
ls -la /opt/essencia/backups/

# Restore
docker compose stop api
gunzip < backup_YYYYMMDD.sql.gz | docker compose exec -T postgres psql -U essencia essencia_db
docker compose up -d
```

---

## Contatos de Emergencia

| Situacao       | Contato               |
| -------------- | --------------------- |
| Infraestrutura | infra@essencia.edu.br |
| Aplicacao      | dev@essencia.edu.br   |
| Seguranca      | admin@essencia.edu.br |
