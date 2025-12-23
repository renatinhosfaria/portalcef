# Portal Digital - Colégio Essência Feliz

<div align="center">

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-green.svg)
![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)

**Portal Digital Escolar**

[Início Rápido](#-início-rápido) •
[Documentação](#-documentação) •
[Estrutura](#-estrutura-do-projeto) •
[Scripts](#-scripts-disponíveis)

</div>

---

## 📋 Sobre o Projeto

O **Portal Digital Colégio Essência Feliz** é uma plataforma web completa para gestão escolar, composta por:

- **Portal Público (Home)**: Interface para pais, alunos e visitantes
- **Login**: Autenticação e sessões
- **Usuários**: Módulo de usuários
- **Escolas**: Módulo administrativo de escolas e unidades
- **API Backend**: Serviços RESTful seguros e escaláveis

### ✨ Principais Funcionalidades

- 🔐 Sistema de autenticação seguro com sessões Redis
- 👥 Controle de acesso baseado em roles (RBAC)
- 🎨 Design system modular com shadcn/ui
- 🚀 Deploy automatizado com Docker e CI/CD

---

## 🚀 Início Rápido

### Pré-requisitos

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0
- **Docker** e **Docker Compose**
- **Git**

### Instalação

```bash
# Clone o repositório
git clone https://github.com/renatinhosfaria/portalessencia.git
cd portalessencia

# Instale as dependências
pnpm install

# Configure as variáveis de ambiente
cp .env.example .env

# Inicie os serviços de infraestrutura
docker compose up -d

# Execute as migrações do banco
pnpm db:migrate

# Inicie o ambiente de desenvolvimento
pnpm dev
```

### URLs de Desenvolvimento

| Serviço        | URL                   |
| -------------- | --------------------- |
| Home           | http://localhost:3000 |
| Login          | http://localhost:3003 |
| Usuários       | http://localhost:3004 |
| Escolas        | http://localhost:3005 |
| API            | http://localhost:3001 |
| Drizzle Studio | http://localhost:4983 |

---

## 📚 Documentação

| Documento                            | Descrição                                  |
| ------------------------------------ | ------------------------------------------ |
| [API.md](./API.md)                   | Documentação completa da API REST          |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura do sistema e decisões técnicas |
| [CHANGELOG.md](./CHANGELOG.md)       | Histórico de mudanças e versões            |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guia para contribuidores                   |
| [DATABASE.md](./DATABASE.md)         | Schema do banco de dados e migrações       |
| [DEPLOYMENT.md](./DEPLOYMENT.md)     | Guia de deploy e infraestrutura            |
| [SECURITY.md](./SECURITY.md)         | Políticas e práticas de segurança          |

---

## 🏗 Estrutura do Projeto

```
.
├── apps/
│   ├── home/                # Portal Público (Next.js)
│   ├── login/               # App de login (Next.js)
│   ├── escolas/             # Módulo de escolas (Next.js)
│   └── usuarios/            # Módulo de usuários (Next.js)
├── services/
│   └── api/                 # Backend Principal (NestJS)
├── packages/
│   ├── ui/                  # Design System (shadcn/ui)
│   ├── db/                  # Drizzle ORM & Migrações
│   ├── shared/              # Tipos, Schemas Zod, Fetchers
│   ├── config/              # ESLint, TSConfig, Env
│   └── tailwind-config/     # Preset Tailwind compartilhado
├── scripts/                 # Scripts de deploy e manutenção
├── docker-compose.yml       # Desenvolvimento local
└── docker-compose.prod.yml  # Produção
```

---

## 📜 Scripts Disponíveis

### Desenvolvimento

```bash
pnpm dev          # Inicia todos os apps em modo dev
pnpm build        # Build de produção
pnpm lint         # Executa linting
pnpm test         # Executa testes
pnpm typecheck    # Verifica tipos TypeScript
pnpm format       # Formata código com Prettier
```

### Banco de Dados

```bash
pnpm db:generate  # Gera migrações Drizzle
pnpm db:migrate   # Aplica migrações pendentes
pnpm db:studio    # Abre Drizzle Studio
```

### Utilitários

```bash
pnpm clean        # Limpa builds e node_modules
```

---

## 🛠 Stack Tecnológica

| Categoria          | Tecnologia                  |
| ------------------ | --------------------------- |
| **Monorepo**       | Turborepo + pnpm            |
| **Backend**        | NestJS + Fastify            |
| **Frontend**       | Next.js 14 (App Router)     |
| **Database**       | PostgreSQL 16 + Drizzle ORM |
| **Cache/Sessions** | Redis 7                     |
| **Styling**        | Tailwind CSS + shadcn/ui    |
| **Deploy**         | Docker + Traefik            |
| **CI/CD**          | GitHub Actions              |

---

## 📄 Licença

Este projeto é **UNLICENSED** - uso restrito ao Colégio Essência Feliz.

---

## 👥 Time

- **Desenvolvimento**: Colégio Essência Feliz
- **Contato**: admin@essencia.edu.br

---

<div align="center">

**[⬆ Voltar ao topo](#portal-digital---colégio-essência-feliz)**

</div>
