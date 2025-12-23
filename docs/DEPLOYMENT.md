# Deployment Guide

Guia completo de deploy do Portal Digital Colégio Essência Feliz.

---

## 🏗 Infraestrutura

| Componente        | Tecnologia                |
| ----------------- | ------------------------- |
| **Host**          | Contabo VPS               |
| **OS**            | Ubuntu 24.04 LTS          |
| **Orquestrador**  | Docker Compose            |
| **Reverse Proxy** | Traefik v3                |
| **SSL**           | Let's Encrypt             |
| **Registry**      | GitHub Container Registry |
| **CI/CD**         | GitHub Actions            |

---

## 📋 Pré-requisitos VPS

- Ubuntu 24.04 LTS
- Docker + Docker Compose
- Git
- 4GB+ RAM
- 40GB+ SSD

---

## 🚀 Setup Inicial

### 1. Executar Script de Setup

```bash
# No servidor VPS
curl -sSL https://raw.githubusercontent.com/renatinhosfaria/portalessencia/main/scripts/setup-vps.sh | bash
```

### 2. Configurar Variáveis

```bash
cd /opt/essencia
cp .env.example .env
nano .env
```

**Variáveis obrigatórias:**

```bash
DATABASE_URL=postgresql://essencia:SENHA_FORTE@postgres:5432/essencia_db
REDIS_URL=redis://redis:6379
POSTGRES_PASSWORD=SENHA_FORTE
SESSION_SECRET=GERAR_COM_openssl_rand_hex_32
COOKIE_DOMAIN=seu-dominio.com.br
```

### 3. Iniciar Serviços

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 🔄 CI/CD Pipeline

### Fluxo Automático

```
Push → GitHub Actions → Build → GHCR → Deploy → VPS
```

### Workflow (`.github/workflows/deploy.yml`)

1. **Test**: Lint, Typecheck, Unit Tests
2. **Build**: Docker images para web e api
3. **Push**: Tags para GHCR
4. **Deploy**: SSH + docker compose pull + up

### Deploy Manual

```bash
# No servidor
cd /opt/essencia
./scripts/deploy.sh
```

---

## 🌐 Arquitetura de Rede

```
Internet → Traefik (80/443) → Containers
                ├── home:3000      (/)
                ├── login:3003     (/login)
                ├── usuarios:3004  (/usuarios)
                ├── escolas:3005   (/escolas)
                └── api:3002       (interno)
```

### Portas Expostas

| Porta | Serviço         |
| ----- | --------------- |
| 80    | HTTP (redirect) |
| 443   | HTTPS           |
| 22    | SSH             |

---

## 🐳 Docker Services

| Container | Imagem               | Porta Interna |
| --------- | -------------------- | ------------- |
| traefik   | traefik:v3.2         | 80, 443       |
| home      | ghcr.io/.../home     | 3000          |
| login     | ghcr.io/.../login    | 3003          |
| usuarios  | ghcr.io/.../usuarios | 3004          |
| escolas   | ghcr.io/.../escolas  | 3005          |
| api       | ghcr.io/.../api      | 3002          |
| postgres  | postgres:16-alpine   | 5432          |
| redis     | redis:7-alpine       | 6379          |

---

## 🔐 SSL/TLS

### Certificados Let's Encrypt

```yaml
# docker-compose.prod.yml (descomente)
- "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
- "--certificatesresolvers.letsencrypt.acme.email=admin@essencia.edu.br"
- "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
```

---

## 📊 Monitoramento

### Health Check

```bash
./scripts/health-check.sh
```

### Logs

```bash
# Todos os serviços
docker compose logs -f

# Serviço específico
docker compose logs -f api
```

### Status

```bash
docker compose ps
```

---

## 🔄 Updates

### Atualização Automática (CI/CD)

Push para `main` → Deploy automático

### Atualização Manual

```bash
cd /opt/essencia
docker compose pull
docker compose up -d
docker system prune -f
```

---

## 🆘 Rollback

```bash
# Ver imagens disponíveis
docker images | grep essencia

# Rollback para versão anterior
docker compose down
docker tag ghcr.io/.../api:previous ghcr.io/.../api:latest
docker compose up -d
```

---

## 📁 Estrutura de Diretórios

```
/opt/essencia/
├── docker-compose.prod.yml
├── .env
├── scripts/
│   ├── deploy.sh
│   ├── health-check.sh
│   └── migrate.sh
└── data/
    ├── postgres/
    └── redis/
```

---

## 🔧 Troubleshooting

### Container não inicia

```bash
docker compose logs [service]
docker compose ps
```

### Problemas de rede

```bash
docker network ls
docker network inspect essencia-network
```

### Banco de dados

```bash
docker compose exec postgres psql -U essencia -d essencia_db
```

---

## 📚 Scripts Disponíveis

| Script            | Descrição                  |
| ----------------- | -------------------------- |
| `setup-vps.sh`    | Setup inicial do servidor  |
| `deploy.sh`       | Deploy/update da aplicação |
| `health-check.sh` | Verificação de saúde       |
| `migrate.sh`      | Executar migrações         |
