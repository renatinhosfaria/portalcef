# Guia de Deploy - Portal Essência Feliz
> **Domínio**: `portalcef.com.br` | **VPS**: Contabo (144.126.134.23)

Este documento descreve o processo de deploy em produção utilizando Docker Compose, Traefik (Reverse Proxy com SSL) e GitHub Actions (manual).

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração de DNS](#configuração-de-dns)
3. [Setup Inicial do VPS](#setup-inicial-do-vps)
4. [Deploy e Atualizações](#deploy-e-atualizações)
5. [Manutenção](#manutenção)
6. [Estrutura de Produção](#estrutura-de-produção)

---

## Pré-requisitos

- **VPS**: Ubuntu 24.04, 6 Cores, 16GB RAM.
- **Domínio**: Acesso ao Registro.br.
- **Git**: Repositório `renatinhosfaria/portalcef` acessível (público ou com token).

---

## Configuração de DNS

No **Registro.br**, configure a Zona de DNS (Modo Avançado) com os seguintes registros Tipo **A**:

| Nome | Tipo | Valor (IP do VPS) |
|------|------|-------------------|
| `@` | A | `144.126.134.23` |
| `api` | A | `144.126.134.23` |
| `storage`| A | `144.126.134.23` |
| `traefik`| A | `144.126.134.23` |

> ⏳ A propagação pode levar de 5 a 60 minutos.

---

## Setup Inicial do VPS

1. **Acesse o VPS via SSH:**
   ```bash
   ssh root@144.126.134.23
   ```

2. **Copie e execute o script de setup:**
   *(Do seu computador local para o VPS)*
   ```bash
   scp scripts/setup-vps.sh root@144.126.134.23:/root/
   ```
   *(No VPS)*
   ```bash
   chmod +x setup-vps.sh
   ./setup-vps.sh
   ```

3. **Verifique o arquivo .env gerado:**
   O script gera senhas seguras automaticamente em `/opt/essencia/.env`.
   ```bash
   cat /opt/essencia/.env
   ```

---

## Deploy e Atualizações

Para atualizar a aplicação (após push no GitHub):

1. **Acesse o VPS:**
   ```bash
   ssh root@144.126.134.23
   ```

2. **Execute o script de deploy:**
   ```bash
   cd /opt/essencia
   ./scripts/deploy.sh
   ```

Este script irá:
1. Baixar o código mais recente (`git pull`).
2. Reconstruir as imagens Docker alteradas.
3. Reiniciar os serviços.
4. Executar migrations de banco de dados.
5. Verificar a saúde da API.

---

## Manutenção

### 📦 Backup do Banco de Dados
O script mantém backups dos últimos 7 dias em `/opt/essencia/backups/`.
```bash
/opt/essencia/scripts/backup.sh
```
*Recomendação: Configure no CRON para rodar diariamente.*

### 🔍 Logs em Tempo Real
```bash
cd /opt/essencia
docker compose -f docker-compose.prod.yml logs -f [service_name]
# Exemplo: docker compose -f docker-compose.prod.yml logs -f api
```

### 🛑 Parar/Reiniciar Tudo
```bash
# Reiniciar
docker compose -f docker-compose.prod.yml restart

# Parar tudo
docker compose -f docker-compose.prod.yml down
```

### 🛠 Acesso ao Shell do Container
```bash
# Acessar API
docker compose -f docker-compose.prod.yml exec api /bin/sh

# Acessar Banco de Dados
docker compose -f docker-compose.prod.yml exec postgres psql -U essencia -d essencia_db
```

---

## Estrutura de Produção

| URL | Serviço | Descrição |
|-----|---------|-----------|
| `https://portalcef.com.br` | **home** | Dashboard Principal |
| `https://portalcef.com.br/login` | **login** | Autenticação |
| `https://api.portalcef.com.br` | **api** | Backend NestJS |
| `https://storage.portalcef.com.br` | **minio** | Uploads/Arquivos |

**Infraestrutura Docker:**
- **Proxy**: Traefik v3 (SSL automático Let's Encrypt).
- **Apps**: Next.js em modo Standalone (otimizado).
- **DB**: PostgreSQL 16.
- **Cache**: Redis 7.
