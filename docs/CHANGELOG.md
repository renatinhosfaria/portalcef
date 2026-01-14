# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### ⚠️ Pendências Conhecidas

- **CORS incompleto**: Faltam origens para `calendario` (3008), `loja` (3010), `loja-admin` (3011) em `services/api/src/main.ts`
- **docker-compose.dev.yml**: Mapeamento incorreto de portas (home na 3006 ao invés de 3000)
- **shop_interest_requests.status**: Campo `status` usado em `shop-interest.service.ts` mas não existe no schema

---

## [0.1.0] - 2026-01-14

### 🎉 Versão Inicial

Primeira versão funcional do Portal Digital Colégio Essência Feliz com sistema completo de gestão escolar.

### ✨ Adicionado

#### Infraestrutura

- **Monorepo Turborepo** com pnpm workspaces
- **Docker Compose** para desenvolvimento e produção
- **Nginx + Certbot** como reverse proxy com SSL automático
- **PostgreSQL 16** com Drizzle ORM
- **Redis 7** para sessões e cache
- **MinIO** (opcional) para storage de arquivos

#### Módulos Frontend (Next.js 15 + React 19)

- **Home** (:3000) - Portal público e landing page
- **Login** (:3003) - Autenticação centralizada
- **Usuários** (:3004) - Gestão de usuários e permissões (CRUD completo)
- **Escolas** (:3005) - Administração de escolas e unidades
- **Turmas** (:3006) - Gestão de turmas e atribuição de professoras
- **Planejamento** (:3007) - Planejamento pedagógico quinzenal com wizard
- **Calendario** (:3008) - Gestão de calendário escolar
- **Loja** (:3010) - Loja pública para uniformes (sistema de voucher)
- **Loja Admin** (:3011) - Administração de produtos, estoque e pedidos

#### Backend (NestJS + Fastify)

- **API REST** (:3001) com 15+ módulos
  - Auth (login, logout, sessões com Redis)
  - Users (CRUD com RBAC)
  - Schools & Units (multi-tenant)
  - Stages (etapas educacionais)
  - Turmas (CRUD + professoras disponíveis)
  - Plannings (wizard, dashboard, aprovação, ajustes)
  - Calendar (eventos com filtros)
  - Shop (catálogo público + admin)
    - Produtos com variantes (tamanhos)
    - Estoque por unidade
    - Pedidos com voucher presencial
    - Lista de interesse
    - Configurações por unidade
  - Stats (dashboard analítico)
  - Health (health check endpoint)
  - Setup (bootstrap inicial)
  - Storage (upload para MinIO - opcional)
  - Payments (webhook Stripe - preparado para futuro)

#### Segurança

- **Autenticação**: Cookie-based sessions (HttpOnly, Secure, SameSite: Lax)
- **RBAC**: 14 roles hierárquicas com guards encadeados
  - AuthGuard → RolesGuard → TenantGuard
- **Multi-Tenancy**: Isolamento por escola → unidade → etapa
- **Rate Limiting**: Proteção de endpoints críticos (/stats/dashboard, /shop/orders)
- **Input Validation**: Zod (frontend) + class-validator (backend)
- **Prepared Statements**: Drizzle ORM para prevenir SQL injection

#### Database

- **Schema completo** com 20+ tabelas
  - Core: schools, units, education_stages, unit_stages, users, sessions, role_groups
  - Turmas: turmas (com professora titular)
  - Planejamento: plannings, planning_contents, planning_reviews
  - Calendario: calendar_events
  - Shop: 9 tabelas (produtos, variantes, estoque, pedidos, interesse, configurações)
- **Migrations**: Sistema de migrations com Drizzle Kit
- **Drizzle Studio**: Interface visual para explorar dados (:4983)

#### Features de Planejamento

- **Wizard Multi-Etapa** com 7 etapas (Dados, Objetivos, Metodologia, Recursos, Atividades, Avaliação, Revisão)
- **Auto-save** local (localStorage) e servidor (rascunhos)
- **Fluxo de Aprovação**: Rascunho → Pendente → Aprovado/Em Ajuste
- **First Pass Yield**: Métrica de qualidade (aprovação sem ajustes)
- **Dashboard**: Visualização por segmento/etapa com semáforos
- **Quinzenas**: Configuração de períodos quinzenais para 2026
- **Anexos**: Upload de arquivos (quando MinIO habilitado)
- **PDF Export**: Geração de PDF com @react-pdf/renderer

#### Features da Loja (CEF Shop)

- **Catálogo Público**: Produtos organizados por categoria (uniforme diário, educação física, acessórios)
- **Voucher Presencial**: Sistema de pedido online com pagamento presencial na escola
- **Gestão de Estoque**: Controle por unidade + variante (tamanho)
- **Reserva de Estoque**: Reserva automática em pedidos online (liberada na expiração/cancelamento)
- **Lista de Interesse**: Registro de interesse em produtos sem estoque
- **Dashboard Admin**: Métricas, alertas de estoque baixo, produtos mais vendidos
- **Multi-Tenant**: Isolamento completo de produtos, estoque e pedidos por escola/unidade
- **Preparado para Stripe**: Estrutura pronta para integração futura de pagamento online

#### Design System

- **@essencia/ui**: Componentes com shadcn/ui + Radix UI
- **Tailwind CSS 3.4**: Utility-first styling
- **Lucide Icons**: Biblioteca de ícones
- **Framer Motion**: Animações fluidas
- **Sonner**: Toast notifications
- **Theme**: Sistema de temas (light/dark preparado)

#### Developer Experience

- **Turborepo**: Build cache inteligente
- **TypeScript 5.7**: Type-safety end-to-end
- **ESLint + Prettier**: Code quality automatizado
- **Vitest + Jest**: Testing framework (frontend + backend)
- **Playwright**: E2E testing (preparado)
- **Hot Reload**: Dev server com fast refresh

#### Documentação

- **ARCHITECTURE.md**: Decisões arquiteturais e padrões
- **API.md**: Endpoints REST completos com exemplos
- **DATABASE.md**: Schema, migrations, relacionamentos
- **SECURITY.md**: Autenticação, RBAC, segurança
- **DEPLOYMENT.md**: Guia completo de deploy com Docker
- **MODULO_LOJA.md**: Documentação detalhada do módulo de loja
- **AGENTS.md** (raiz): Instruções para agentes de IA
- **README.md**: Setup, estrutura, comandos

### 🔒 Segurança

- Sessões seguras com Redis (sliding window, renovação automática)
- Cookies com flags de segurança (HttpOnly, Secure, SameSite)
- Guards hierárquicos (Auth → Roles → Tenant)
- Isolamento multi-tenant rigoroso
- Rate limiting em endpoints críticos
- Input validation em ambas as camadas (frontend e backend)
- Prepared statements para todas as queries
- Secrets management via .env

### 🚀 Performance

- Turborepo com cache inteligente
- Next.js App Router com Server Components
- Redis para cache e sessões
- PostgreSQL com connection pooling
- Docker com multi-stage builds
- Nginx com proxy eficiente
- Image optimization (Next.js)

### 🏗 Arquitetura

- **Governança de dados**: Apps nunca acessam DB diretamente
- **Type-safety E2E**: Tipos compartilhados via @essencia/shared
- **Multi-Tenant**: Hierarquia Escola → Unidade → Usuário
- **RBAC Hierárquico**: 14 roles com isolamento por escopo
- **Feature-Based**: Organização por features no planejamento
- **Monorepo**: 9 apps + 1 service + 7 packages

---

## [Histórico de Desenvolvimento]

### 2025-01 - Infraestrutura e Deploy

#### [f7eeb01] feat(docker): optimize Dockerfile with multi-stage build and improved caching

- Implementação de multi-stage build
- Otimização de cache de dependências
- Redução do tamanho final da imagem

#### [0b72bfe] feat(proxy): replace Traefik with Nginx + Certbot for better compatibility

- Substituição do Traefik por Nginx + Certbot
- Configuração de SSL automático com Let's Encrypt
- Melhor compatibilidade com Docker

#### [9b808f8] fix(docker): simplify Dockerfile to support pnpm workspace

- Simplificação do Dockerfile
- Suporte correto para pnpm workspaces

#### [3b43a37] feat: add production Docker configuration with Traefik and HTTPS

- Configuração inicial de produção
- docker-compose.prod.yml
- Suporte a HTTPS

### 2024-12 - Features Core

#### [824adad] feat(shop): add store apps, api, db, docs, tests

- Implementação completa do módulo de loja
- Apps loja e loja-admin
- Endpoints públicos e administrativos
- Schema de banco completo (9 tabelas)
- Documentação e testes

#### [9763755] feat: major system expansion with new modules and features

- Expansão massiva do sistema
- Implementação de múltiplos módulos (usuarios, escolas, turmas, calendario)
- Estruturação do monorepo
- Setup de infraestrutura básica

#### [8e16afa] feat(planejamento): implement wizard form fields with validation (Story 2.2)

- Wizard de planejamento com 7 etapas
- Validação com Zod
- Auto-save local e servidor
- Fluxo de aprovação completo

---

## Tipos de Mudanças

- `✨ Adicionado` (Added): Novas features
- `🔄 Modificado` (Changed): Mudanças em features existentes
- `🗑️ Removido` (Removed): Features removidas
- `🐛 Corrigido` (Fixed): Bug fixes
- `🔒 Segurança` (Security): Vulnerabilidades corrigidas
- `⚠️ Descontinuado` (Deprecated): Features que serão removidas

---

## Versionamento

O projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/):

- **MAJOR** (x.0.0): Mudanças incompatíveis de API
- **MINOR** (0.x.0): Novas funcionalidades compatíveis
- **PATCH** (0.0.x): Correções de bugs compatíveis

---

## Contribuindo

Para sugestões de mudanças no CHANGELOG:

1. Siga o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
2. Classifique mudanças corretamente (Added, Changed, etc.)
3. Seja claro e conciso nas descrições
4. Inclua links para issues/PRs quando relevante
5. Use Conventional Commits nas mensagens de commit

---

[Unreleased]: https://github.com/renatinhosfaria/portalessencia/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/renatinhosfaria/portalessencia/releases/tag/v0.1.0
