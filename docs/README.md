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

| Modulo            | Porta | Descricao                                   |
| ----------------- | ----- | ------------------------------------------- |
| **Home**          | 3000  | Portal publico e landing page               |
| **Calendario**    | 3008  | Calendario escolar                          |
| **Login**         | 3003  | Autenticacao centralizada                   |
| **Usuarios**      | 3004  | Gestao de usuarios e permissoes             |
| **Escolas**       | 3005  | Administracao de escolas e unidades         |
| **Turmas**        | 3006  | Gestao de turmas                            |
| **Planejamento**  | 3007  | Planejamento pedagogico quinzenal           |
| **Loja**          | 3010  | Loja publica (uniformes)                    |
| **Loja Admin**    | 3011  | Administracao de produtos, estoque, pedidos |
| **Tarefas**       | 3012  | Gerenciamento de tarefas                    |
| **API**           | 3001/3002 | Backend REST centralizado (18 modulos)  |

### Principais Funcionalidades

- **Autenticacao Segura**: Sessoes com Redis, cookies HttpOnly, sliding window
- **RBAC Hierarquico**: 14 roles com isolamento multi-tenant
- **Planejamento Pedagogico**: Wizard de criacao com auto-save e fluxo de aprovacao
- **CEF Shop**: Catalogo, pedidos com voucher presencial, estoque e lista de interesse
- **Calendario Escolar**: Eventos letivos com filtros por unidade e permissao
- **Dashboard Analitico**: Metricas, indicadores semaforicos, KPIs de First Pass Yield
- **Design System**: Componentes consistentes com shadcn/ui e Tailwind CSS
- **Conversao de Documentos**: Worker assincrono para DOCX->PDF via BullMQ

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

# Inicie infraestrutura (Docker dev)
pnpm docker:up

# Execute migracoes
pnpm db:migrate

# Inicie o desenvolvimento
pnpm dev
```

### URLs de Desenvolvimento

| Servico        | URL                   |
| -------------- | --------------------- |
| Home           | http://localhost:3000 |
| Calendario     | http://localhost:3008 |
| Login          | http://localhost:3003 |
| Usuarios       | http://localhost:3004 |
| Escolas        | http://localhost:3005 |
| Turmas         | http://localhost:3006 |
| Planejamento   | http://localhost:3007 |
| Loja           | http://localhost:3010 |
| Loja Admin     | http://localhost:3011 |
| Tarefas        | http://localhost:3012 |
| API            | http://localhost:3001 |
| Drizzle Studio | http://localhost:4983 |

---

## Arquitetura

### Stack Tecnologica

| Camada             | Tecnologia               | Versao       |
| ------------------ | ------------------------ | ------------ |
| **Monorepo**       | Turborepo + pnpm         | 2.3.3 / 9.15 |
| **Frontend**       | Next.js (App Router)     | 15.1.0       |
| **UI Runtime**     | React                    | 19.0.0       |
| **Backend**        | NestJS + Fastify         | 10.4.15      |
| **Database**       | PostgreSQL + Drizzle ORM | 16 / 0.38.2  |
| **Cache/Sessions** | Redis                    | 7            |
| **UI**             | Tailwind CSS + shadcn/ui | 3.4.17       |
| **Runtime**        | Node.js                  | 22+          |
| **Language**       | TypeScript               | 5.7.2        |

### Estrutura do Projeto

```portalessencia/
+-- apps/                           # 10 Aplicacoes Next.js
|   +-- home/             :3000     # Portal publico
|   +-- calendario/       :3008     # Calendario escolar
|   +-- login/            :3003     # Autenticacao
|   +-- usuarios/         :3004     # Gestao de usuarios
|   +-- escolas/          :3005     # Gestao de escolas
|   +-- turmas/           :3006     # Gestao de turmas
|   +-- planejamento/     :3007     # Planejamento pedagogico
|   +-- loja/             :3010     # Loja publica
|   +-- loja-admin/       :3011     # Admin da loja
|
+-- services/
|   +-- api/              :3001     # Backend NestJS (18 modulos)
|   +-- worker/           :3100     # Worker de conversao de documentos
|
+-- packages/
|   +-- ui/                        # Design System (shadcn/ui)
|   +-- db/                        # Drizzle ORM & Migrations
|   +-- shared/                    # Tipos, Schemas, Fetchers
|   +-- components/                # Componentes React compartilhados
|   +-- lib/                       # Utilitarios compartilhados
|   +-- config/                    # ESLint, TSConfig
|   +-- tailwind-config/           # Preset Tailwind
|
+-- scripts/                       # Scripts de deploy
+-- docs/                          # Documentacao
+-- docker-compose.dev.yml         # Desenvolvimento (Docker)
+-- turbo.json                     # Configuracao Turborepo
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
| [MODULO_LOJA.md](./MODULO_LOJA.md)   | Documentacao do modulo de loja         |
| [SECURITY.md](./SECURITY.md)         | Autenticacao, RBAC, seguranca          |

---

## Desenvolvimento

### Scripts Principais

```bash
# Desenvolvimento
pnpm dev                         # Inicia todos os apps
pnpm turbo dev --filter=planejamento  # App especifico

# Qualidade de Codigo
pnpm turbo format               # Prettier
pnpm turbo lint                 # ESLint
pnpm turbo typecheck            # TypeScript
pnpm turbo test                 # Vitest/Jest
pnpm turbo build                # Build producao

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
pnpm turbo format && pnpm turbo lint && pnpm turbo typecheck && pnpm turbo build && pnpm turbo test
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
API_INTERNAL_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Auth/Sessao
SESSION_TTL_HOURS=24
SESSION_RENEWAL_THRESHOLD=0.25
COOKIE_SECRET=your-cookie-secret-here
COOKIE_DOMAIN=localhost

# Storage (MinIO/S3 - opcional)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=essencia-uploads

# Shop (Stripe - opcional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

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
