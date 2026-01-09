# Portal Digital - Colegio Essencia Feliz

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-green.svg)
![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange.svg)
![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)

**Plataforma de Gestao Escolar Completa**

[Inicio Rapido](#-inicio-rapido) |
[Arquitetura](#-arquitetura) |
[Documentacao](#-documentacao) |
[Desenvolvimento](#-desenvolvimento)

</div>

---

## Sobre o Projeto

O **Portal Digital Colegio Essencia Feliz** e uma plataforma web moderna para gestao escolar, construida com arquitetura de monorepo usando Turborepo. O sistema oferece modulos especializados para diferentes aspectos da administracao escolar.

### Modulos Disponiveis

| Modulo           | Porta | Descricao                           |
| ---------------- | ----- | ----------------------------------- |
| **Home**         | 3006  | Portal publico e landing page       |
| **Login**        | 3003  | Autenticacao centralizada           |
| **Usuarios**     | 3004  | Gestao de usuarios e permissoes     |
| **Escolas**      | 3005  | Administracao de escolas e unidades |
| **Planejamento** | 3007  | Planejamento pedagogico quinzenal   |
| **API**          | 3001  | Backend REST centralizado           |

### Principais Funcionalidades

- **Autenticacao Segura**: Sessoes com Redis, cookies HttpOnly, sliding window
- **RBAC Hierarquico**: 11 niveis de permissao com isolamento multi-tenant
- **Planejamento Pedagogico**: Wizard de criacao com auto-save e fluxo de aprovacao
- **Dashboard Analitico**: Metricas, indicadores semaforicos, KPIs de First Pass Yield
- **Design System**: Componentes consistentes com shadcn/ui e Tailwind CSS

---

## Inicio Rapido

### Pre-requisitos

```bash
Node.js >= 22.0.0
pnpm >= 9.0.0
Docker e Docker Compose
Git
```

### Instalacao

```bash
# Clone o repositorio
git clone https://github.com/renatinhosfaria/portalessencia.git
cd portalessencia

# Instale as dependencias
pnpm install

# Configure variaveis de ambiente
cp .env.example .env

# Inicie infraestrutura (PostgreSQL + Redis)
docker compose up -d

# Execute migracoes
pnpm db:migrate

# Inicie o desenvolvimento
pnpm dev
```

### URLs de Desenvolvimento

| Servico        | URL                   |
| -------------- | --------------------- |
| Home           | http://localhost:3006 |
| Login          | http://localhost:3003 |
| Usuarios       | http://localhost:3004 |
| Escolas        | http://localhost:3005 |
| Planejamento   | http://localhost:3007 |
| API            | http://localhost:3001 |
| Drizzle Studio | http://localhost:4983 |

---

## Arquitetura

### Stack Tecnologica

| Camada             | Tecnologia               | Versao       |
| ------------------ | ------------------------ | ------------ |
| **Monorepo**       | Turborepo + pnpm         | 2.3+ / 9.15+ |
| **Frontend**       | Next.js (App Router)     | 15.1.0       |
| **Backend**        | NestJS + Fastify         | 10.4+        |
| **Database**       | PostgreSQL + Drizzle ORM | 16 / 0.38+   |
| **Cache/Sessions** | Redis                    | 7            |
| **UI**             | Tailwind CSS + shadcn/ui | 3.4+         |
| **Runtime**        | Node.js                  | 22+          |
| **Language**       | TypeScript               | 5.7+         |

### Estrutura do Projeto

```
portalessencia/
├── apps/                          # Aplicacoes Next.js
│   ├── home/              :3006   # Portal publico
│   ├── login/             :3003   # Autenticacao
│   ├── usuarios/          :3004   # Gestao de usuarios
│   ├── escolas/           :3005   # Gestao de escolas
│   └── planejamento/      :3007   # Planejamento pedagogico
│
├── services/
│   └── api/               :3001   # Backend NestJS
│
├── packages/
│   ├── ui/                        # Design System (shadcn/ui)
│   ├── db/                        # Drizzle ORM & Migrations
│   ├── shared/                    # Tipos, Schemas, Fetchers
│   ├── components/                # Componentes React compartilhados
│   ├── lib/                       # Utilitarios compartilhados
│   ├── config/                    # ESLint, TSConfig
│   └── tailwind-config/           # Preset Tailwind
│
├── scripts/                       # Scripts de deploy
├── docs/                          # Documentacao
├── docker-compose.yml             # Desenvolvimento
└── turbo.json                     # Configuracao Turborepo
```

### Principios Arquiteturais

1. **Governanca de Dados**: Apps nunca acessam banco diretamente - sempre via API
2. **Type-Safety E2E**: Tipos compartilhados via `@essencia/shared`
3. **Multi-Tenant**: Hierarquia Escola → Unidade → Usuario
4. **RBAC Hierarquico**: Guards encadeados (Auth → Roles → Tenant)

---

## Documentacao

| Documento                            | Descricao                              |
| ------------------------------------ | -------------------------------------- |
| [API.md](./API.md)                   | Endpoints REST, autenticacao, exemplos |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Decisoes arquiteturais e padroes       |
| [CHANGELOG.md](./CHANGELOG.md)       | Historico de versoes                   |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guia de contribuicao                   |
| [DATABASE.md](./DATABASE.md)         | Schema, migracoes, relacionamentos     |
| [DEPLOYMENT.md](./DEPLOYMENT.md)     | Deploy, Docker, producao               |
| [SECURITY.md](./SECURITY.md)         | Autenticacao, RBAC, seguranca          |

---

## Desenvolvimento

### Scripts Principais

```bash
# Desenvolvimento
pnpm dev                    # Inicia todos os apps
pnpm dev --filter=planejamento  # App especifico

# Qualidade de Codigo
pnpm format                 # Prettier
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript
pnpm test                   # Vitest/Jest
pnpm build                  # Build producao

# Banco de Dados
pnpm db:generate            # Gerar migracao
pnpm db:migrate             # Aplicar migracoes
pnpm db:studio              # Drizzle Studio

# Limpeza
pnpm clean                  # Remove builds e node_modules
```

### Workflow Pre-Commit

```bash
# Execute antes de cada commit
pnpm format && pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

### Convencoes de Codigo

| Item        | Convencao                             |
| ----------- | ------------------------------------- |
| Dominio     | PT-BR (turma, quinzena, planejamento) |
| Componentes | PascalCase                            |
| Arquivos    | kebab-case                            |
| Commits     | Conventional Commits                  |

### Conventional Commits

```
feat(planejamento): adiciona auto-save no wizard
fix(api): corrige validacao de sessao expirada
chore(deps): atualiza dependencias
docs(readme): atualiza instrucoes de instalacao
refactor(auth): simplifica logica de guards
test(users): adiciona testes de CRUD
```

---

## Variaveis de Ambiente

```env
# Database
DATABASE_URL=postgresql://essencia:essencia_dev@localhost:5432/essencia_db

# Redis
REDIS_URL=redis://localhost:6379

# API
API_PORT=3001
API_HOST=0.0.0.0

# Auth
COOKIE_SECRET=your-secret-key-here
COOKIE_DOMAIN=localhost
SESSION_TTL_HOURS=24

# Node
NODE_ENV=development
```

---

## Suporte

- **Issues**: [GitHub Issues](https://github.com/renatinhosfaria/portalessencia/issues)
- **Email**: admin@essencia.edu.br

---

## Licenca

Este projeto e **UNLICENSED** - uso restrito ao Colegio Essencia Feliz.

---

<div align="center">

**Portal Digital Colegio Essencia Feliz** - v0.1.0

</div>
