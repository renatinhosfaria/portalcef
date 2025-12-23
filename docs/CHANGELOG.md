# Changelog

Todas as mudanças notáveis do projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### 🚧 Em Desenvolvimento

- Sistema completo de gestão de turmas
- Módulo de comunicados
- Painel de responsáveis
- Dashboard administrativo

---

## [0.0.1] - 2025-12-19

### ✨ Added

#### Infraestrutura

- Inicialização do monorepo com Turborepo + pnpm
- Configuração de ESLint e Prettier compartilhados
- Setup de TypeScript com strict mode
- Docker Compose para desenvolvimento
- Docker Compose para produção com Traefik

#### Backend (services/api)

- Scaffold NestJS com Fastify
- Módulo de autenticação com sessões Redis
- AuthGuard e RolesGuard
- Sistema de RBAC (Roles-Based Access Control)
- Health check endpoint

#### Frontend (apps/home, apps/login, apps/usuarios)

- Scaffold Next.js 14 com App Router
- Configuração de Tailwind CSS + shadcn/ui
- Layout responsivo
- Páginas de login

#### Database (packages/db)

- Schema inicial com Drizzle ORM
- Tabela `users` com soft delete
- Enum de roles
- Connection factory

#### Shared Packages

- `@essencia/ui` - Design system
- `@essencia/shared` - Tipos e utilitários
- `@essencia/config` - Configurações compartilhadas
- `@essencia/tailwind-config` - Preset Tailwind

#### DevOps

- Scripts de setup VPS
- Scripts de deploy
- Health check automation
- GitHub Actions workflow

### 🔒 Security

- Autenticação com cookies HttpOnly
- Sessões com sliding window
- Password hashing com bcrypt
- Rate limiting básico

---

## Legenda

- ✨ **Added** - Novas funcionalidades
- 🔄 **Changed** - Mudanças em funcionalidades existentes
- 🗑️ **Deprecated** - Funcionalidades marcadas para remoção
- ❌ **Removed** - Funcionalidades removidas
- 🐛 **Fixed** - Correções de bugs
- 🔒 **Security** - Correções de segurança

---

[Unreleased]: https://github.com/renatinhosfaria/portalessencia/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/renatinhosfaria/portalessencia/releases/tag/v0.0.1
