# Changelog

Todas as mudancas notaveis do projeto serao documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o projeto adhere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### Documentacao

- Sincroniza docs com o estado atual do codigo (API, DATABASE, SECURITY, DEPLOYMENT, MODULO_LOJA, ANALYSIS_REPORT, Agents AI).

### Em Desenvolvimento

- Sistema completo de gestao de turmas
- Modulo de comunicados
- Painel de responsaveis
- Geracao automatica de PDFs para planejamentos
- Workflow completo de revisao e aprovacao de planejamentos
- Metricas avancadas de dashboard com graficos
- Notificacoes em tempo real

### Adicionado

#### Sistema de Voucher para Pagamento Presencial (12/01/2026)

- **Backend - Desabilitação Temporária do Stripe** (`services/api/src/modules/shop`)
  - Integração com Stripe comentada/desabilitada para futura reintegração
  - Validade de pedidos alterada de 15 minutos para 7 dias
  - Novo endpoint `PATCH /shop/admin/orders/:id/confirm-payment` para confirmação de pagamento presencial
  - Job de expiração atualizado para refletir prazo de 7 dias
  - DTO `ConfirmPaymentDto` adicionado com validação de método de pagamento

- **Frontend Loja - Checkout Simplificado** (`apps/loja/app/checkout`)
  - Stripe Elements removidos do checkout
  - Novo fluxo: cliente preenche dados → gera voucher → paga presencialmente
  - Informações claras sobre o sistema de voucher e prazo de 7 dias
  - Rota `/api/shop/checkout/init` desabilitada (retorna 503)

- **Frontend Loja - Página do Voucher Melhorada** (`apps/loja/app/pedido/[orderNumber]`)
  - Status "Aguardando Pagamento" mais visível
  - Alerta de pagamento pendente com instruções claras
  - Label "Total a Pagar" para pedidos aguardando pagamento
  - Formas de pagamento aceitas exibidas

- **Frontend Admin - Confirmação de Pagamento** (`apps/loja-admin/app/pedidos`)
  - Botão "Confirmar Pagamento" para pedidos aguardando pagamento
  - Modal com seleção de método de pagamento (Dinheiro, PIX, Cartão Crédito/Débito)
  - Filtro de status atualizado para incluir "Aguardando Pagamento"
  - Nova rota API `/api/shop/admin/orders/:id/confirm-payment`

- **Fluxo de Pedido Atualizado**
  - Cliente: Catálogo → Carrinho → Checkout → Voucher (7 dias de validade)
  - Admin: Recebe cliente → Confirma pagamento (escolhe método) → Marca retirada
  - Estoque: Reservado na criação → Confirmado no pagamento → Liberado se expirar

#### Carrosséis de Imagens de Produtos (12/01/2026)

- **Frontend - Componentes de Carrossel** (`apps/loja/components`)
  - `ProductCardCarousel.tsx` - Carrossel para cards do catálogo com navegação por setas e dots
  - `ProductDetailCarousel.tsx` - Carrossel para página de detalhes com imagem principal + thumbnails
  - Suporte a swipe gestures no mobile para navegação intuitiva
  - Animações smooth com Framer Motion (fade + slide)
  - Fallback automático: `images[]` → `imageUrl` → placeholder
  - Navegação escondida automaticamente para produtos com uma única imagem
  - Acessibilidade: aria-labels, screen reader announcements, navegação por teclado

- **Backend - Suporte a Múltiplas Imagens no Catálogo** (`services/api/src/modules/shop`)
  - Endpoint `GET /shop/catalog/:schoolId/:unitId` agora retorna array `images[]` para cada produto
  - Imagens ordenadas por `displayOrder` via Drizzle ORM
  - `imageUrl` mantido para compatibilidade retroativa
  - Fallback para array vazio se produto não tiver imagens

- **Types - Tipos Compartilhados** (`packages/shared/src/types/shop.ts`)
  - Nova interface `ShopProductImage` com campos `imageUrl` e `displayOrder`
  - Nova interface `ShopProductWithImages` estendendo `ShopProduct` com `images: string[]`
  - Novo tipo `ProductCatalogItem` com variantes e imagens

- **Testes** (`apps/loja/components/__tests__`)
  - Testes unitários para `ProductCardCarousel` (navegação, swipe, dots, fallback)
  - Testes unitários para `ProductDetailCarousel` (thumbnails, navegação, aria)
  - Configuração Vitest + RTL com tipos de jest-dom

- **Zero Breaking Changes**
  - Campo `images[]` é novo, campo `imageUrl` mantido
  - Clientes antigos continuam funcionando com `imageUrl` apenas
  - Todas as imagens estão ordenadas por `displayOrder` (consistente)

#### APIs Administrativas do Shop (11/01/2026)

- **Backend - Endpoints Administrativos Completos** (`services/api/src/modules/shop`)
  - GET /shop/admin/dashboard - Dashboard com estatísticas (pendingPickups, lowStockAlerts, pendingInterest)
  - GET /shop/admin/products - Listar todos os produtos da escola
  - GET /shop/admin/products/:id - Detalhes de produto com variantes e inventário por unidade
  - GET /shop/admin/inventory - Listar todo inventário com status (quantity, reserved, available, needsRestock)
  - GET /shop/admin/orders - Listar pedidos com paginação, filtros (status, orderSource) e busca
  - GET /shop/admin/orders/:id - Detalhes completos de um pedido
  - Integração completa com services existentes (ShopProductsService, ShopInventoryService, ShopOrdersService)
  - Queries otimizadas com joins e agregações SQL
  - Filtros por tenant (schoolId/unitId) respeitando RBAC
  - Formatação de resposta padronizada com meta.pagination
  - ~150 linhas de código adicionadas ao controller
  - Documentação completa em docs/API.md

- **Frontend - Integração com APIs Reais**
  - Removidos todos os mocks de loja-admin (produtos, estoque, pedidos, interesse, dashboard)
  - Removidos todos os mocks de loja pública (detalhes de produto)
  - Removidos todos os mocks de planejamento (quinzenas)
  - Apps agora consomem APIs do backend via fetch
  - Graceful error handling: console.warn em vez de erro fatal
  - Estados vazios exibidos quando APIs retornam 404
  - 12+ arquivos modificados para remover dados mock

### Corrigido

- Loja: endpoint publico de escolas/unidades para o catalogo e payloads de pedidos/interesse alinhados com a API

### Adicionado

#### Módulo CEF SHOP - FASE 4 Concluída (09/01/2026)

- **Backend - Lista de Interesse** (`services/api/src/modules/shop`)
  - ShopInterestService com 4 métodos (createInterestRequest, getInterestRequests, markAsContacted, getInterestSummary)
  - CreateInterestRequestDto e InterestFiltersDto para validação
  - Endpoint público POST /shop/interest para registro de interesse
  - Endpoints admin: GET /shop/admin/interest (list), GET /shop/admin/interest/summary (analytics), PATCH /shop/admin/interest/:id/contacted
  - Validação de variantes por unidade
  - Paginação com meta response
  - Busca case-insensitive (customerName, customerPhone, studentName)
  - Filtro por status (PENDENTE, CONTATADO, TODOS)
  - Analytics: top 10 variantes mais procuradas (últimos 30 dias), contagem por status
  - Integração com ShopModule (service registrado)
  - Export de `ilike` em packages/db/src/index.ts
  - ~300 linhas de código backend

#### Módulo CEF SHOP - FASE 1 Concluída (09/01/2026)

- **Database & Infrastructure** (`packages/db`)
  - Schema completo com 9 tabelas shop: products, variants, inventory, ledger, orders, order_items, interest_requests, interest_items, settings
  - 117 colunas totais com tipos apropriados (UUID, timestamps, enums, constraints)
  - 38 índices para otimização (25 planejados + 13 adicionais do Drizzle)
  - 17 foreign keys com cascades/restrições
  - 5 enums: ProductCategory, OrderStatus, OrderSource, PaymentMethod, MovementType
  - Isolamento multi-tenant por unit_id validado
  - Constraint UNIQUE (variant_id, unit_id) para estoque por unidade

- **Migration Customizada** (`packages/db/apply-shop-migration.js`)
  - Script de 305 linhas com DDL direto (CREATE TABLE IF NOT EXISTS)
  - Workaround para conflito do Drizzle Kit (0005_lazy_cassandra_nova.sql continha todas as tabelas)
  - Execução bem-sucedida: 9 tabelas + 17 FKs + 25 índices
  - Idempotente (pode re-executar sem erros)

- **Seed de Produtos** (`packages/db/seeds/shop-seed.ts`)
  - 6 produtos de teste: 2 UNIFORME_DIARIO, 2 UNIFORME_EDUCACAO_FISICA, 2 ACESSORIO
  - 34 variantes (8 tamanhos para uniformes: 2,4,6,8,10,12,14,16; ÚNICO para acessórios)
  - 34 entradas de estoque (random 5-50 unidades por variante)
  - 1 configuração de loja (max 3x parcelas, instruções retirada)
  - SKUs automáticos (padrão: `{PRODUCT}-{SIZE}`)
  - Script reusável para reset de ambiente dev

- **Testes de Isolamento** (`packages/db/test-shop-isolation.ts`)
  - Validação de queries filtradas por unit_id
  - Teste de constraint UNIQUE funcionando
  - Verificação de 38 índices criados nas tabelas shop
  - Nenhum vazamento cross-tenant detectado
  - Script de 186 linhas com testes automatizados

- **Documentação**
  - MODULO_LOJA.md atualizado com FASE 1 completa
  - Estatísticas de migration, seed e testes documentadas
  - Notas técnicas sobre workaround Drizzle Kit
  - Próxima fase: FASE 2 (Backend API Core) - shop.service.ts + controllers

#### Modulo de Calendario Escolar

- **App Calendario** (`apps/calendario` - porta 3002)
  - Visualizacao de calendario mensal com navegacao entre meses/anos
  - Eventos coloridos por tipo (feriados, recessos, sabados letivos, etc)
  - Legenda interativa para tipos de eventos
  - Formulario para criacao/edicao de eventos com validacao Zod
  - Estatisticas mensais (dias letivos, total de eventos)
  - Resumo anual com contagem de dias letivos por mes
  - Controle de permissoes por role (visualizacao, edicao, exclusao)

- **Backend Calendar Module** (`services/api/src/modules/calendar`)
  - CalendarController com endpoints REST completos
  - CalendarService com logica de negocios
  - DTOs com validacao class-validator
  - Guards: AuthGuard + RolesGuard + TenantGuard
  - Filtros por unidade, ano, mes e tipo de evento
  - Endpoint de estatisticas `/calendar/stats`

- **Schema calendar_events** (`packages/db`)
  - Tabela para eventos do calendario
  - Suporte a 10 tipos de evento (FERIADO, RECESSO, SABADO_LETIVO, etc)
  - Campos para recorrencia anual e marcacao de dia letivo
  - Indices para otimizacao de queries

- **Tipos Compartilhados** (`packages/shared`)
  - Schemas Zod para validacao (createCalendarEventSchema, updateCalendarEventSchema)
  - Types TypeScript (CalendarEvent, CreateCalendarEventInput, etc)
  - Enum CalendarEventType com 10 tipos de evento

- **Testes**
  - 29 testes unitarios frontend (Vitest)
  - 29 testes unitarios backend (Jest)
  - Cobertura de cenarios: 401, 403, 400, 404, 200/201

#### Reestruturacao do RBAC e Multi-Tenant

- **Grupos de Roles** - Organizacao de roles em 4 grupos (ADMIN, CLIENTES, ESCOLA_ADMINISTRATIVO, ESCOLA_PEDAGOGICO)
  - Tabela `role_groups` com definicoes de grupos
  - Tabela `role_group_mappings` mapeando cada role para seu grupo
  - Helper functions em `packages/shared/src/role-groups.ts`

- **Etapas por Unidade** - Cada unidade agora define suas proprias etapas de ensino
  - Tabela `unit_stages` com relacionamento many-to-many entre unidades e etapas
  - Migration automatica atribui todas as etapas a unidades existentes
  - Endpoints REST para gerenciamento de etapas por unidade:
    - `GET /units/:unitId/stages` - Lista etapas da unidade
    - `POST /units/:unitId/stages` - Atribui etapas (Master only)
    - `PUT /units/:unitId/stages` - Substitui etapas (Master only)
    - `DELETE /units/:unitId/stages/:stageId` - Remove etapa (Master only)

- **Permissoes Elevadas para Gerentes** no modulo de planejamento
  - `gerente_unidade` e `gerente_financeiro` agora tem acesso total ao planejamento
  - Podem visualizar todos os planejamentos da unidade (todas as etapas)
  - Podem aprovar/rejeitar planejamentos como revisores
  - `TenantGuard` atualizado com `FULL_UNIT_ACCESS_ROLES`

- **Formulario de Estrutura de Escola** (app escolas)
  - Master pode selecionar etapas de ensino ao criar unidade
  - Checkboxes para selecao multipla de etapas
  - Integracao com API de etapas

#### Modulo de Gerenciamento de Turmas

- **Banco de Dados**
  - Nova tabela `turmas` com relacionamento a `units` e `education_stages`
  - Campos: id, unit_id, stage_id, name, code, year, shift, capacity, is_active
  - Constraint UNIQUE(unit_id, code, year) - impede codigo duplicado por unidade/ano
  - Migration 0000_init_turmas.sql aplicada com sucesso

- **API Backend (NestJS)**
  - Modulo completo: TurmasModule, TurmasService, TurmasController
  - Endpoints REST para CRUD de turmas:
    - `GET /turmas` - Lista turmas com filtros (unitId, stageId, year)
    - `GET /turmas/:id` - Busca turma por ID
    - `GET /units/:unitId/turmas` - Lista turmas de uma unidade
    - `POST /turmas` - Cria nova turma
    - `PUT /turmas/:id` - Atualiza turma
    - `DELETE /turmas/:id` - Desativa turma (soft delete)
  - Validacao Zod com safeParse em todos os endpoints
  - Guards aplicados: AuthGuard + RolesGuard + TenantGuard
  - Roles permitidas:
    - Leitura: master, diretora_geral, gerente_unidade, gerente_financeiro
    - Escrita: master, diretora_geral, gerente_unidade
    - Delete: master, diretora_geral
  - CORS atualizado para incluir porta 3006 (app turmas)

- **Frontend App (Next.js)**
  - Novo app `@essencia/turmas` na porta 3006
  - Componentes:
    - `TurmasList` - Lista de turmas em formato de cards
    - `TurmaCard` - Card individual de turma com acoes
    - `TurmaForm` - Formulario de criacao/edicao com validacao
  - Integracao completa com API via proxy /api/[...path]
  - Estados: loading, empty, error, success
  - API fetchers dedicados em lib/api.ts
  - Build bem-sucedido no Turborepo

- **Tipos Compartilhados**
  - Schemas Zod: `createTurmaSchema`, `updateTurmaSchema`
  - Interfaces TypeScript: `Turma`, `TurmaWithStage`
  - DTOs tipados: `CreateTurmaInput`, `UpdateTurmaInput`

- **Documentacao**
  - API.md atualizado com todos os 6 endpoints de turmas
  - DATABASE.md atualizado com tabela turmas no diagrama ER
  - CHANGELOG.md atualizado (este arquivo)

#### Etapas Educacionais e Segmentacao

- **Tabela `education_stages`** com codigos padronizados (BERCARIO, INFANTIL, FUNDAMENTAL_I, FUNDAMENTAL_II, MEDIO)
- **Novos campos `stage_id`** em `users` e `plannings` com relacionamento por etapa
- **Endpoint `GET /stages`** para listar etapas educacionais no frontend
- **Roles de coordenacao por etapa** (bercario, infantil, fundamental I/II, medio) com backfill de fundamental para FUNDAMENTAL_I

#### Ambiente de Desenvolvimento Docker

- **Docker Compose para desenvolvimento completo** (`docker-compose.dev.yml`)
  - Container unico de desenvolvimento com todos os apps via Turborepo
  - Hot-reload configurado com bind mounts para apps, packages e services
  - Anonymous volumes para preservar node_modules do container
  - Healthchecks para PostgreSQL e Redis
  - Environment variables pre-configuradas

- **Dockerfile de desenvolvimento** (`Dockerfile.dev`)
  - Multi-stage build otimizado para monorepo pnpm
  - Stage deps: instalacao de dependencias
  - Stage dev: runtime com suporte a hot-reload

- **Scripts de conveniencia**
  - `pnpm docker:dev` - Inicia ambiente completo
  - `pnpm docker:down` - Para ambiente
  - `pnpm docker:logs` - Visualiza logs
  - `pnpm docker:shell` - Abre shell no container
  - `pnpm docker:rebuild` - Reconstroi container
  - `pnpm docker:clean` - Limpa containers e volumes
  - PowerShell helper script (`scripts/docker-dev.ps1`)

- **Documentacao**
- Guia completo em `docs/DOCKER-DEVELOPMENT.md`
  - Instrucoes de setup para Windows/WSL2
  - Troubleshooting para problemas comuns

### Alterado

- Atualiza o header para usar o logo da escola no lugar do sino.
- Aumenta o tamanho do logo no header.
- Renomeia o titulo do sidebar para Portal CEF em todos os apps.

### Corrigido

- Corrige warning de images.domains no app loja-admin e adiciona logo.png no public.
- Corrige erro 500 no proxy do planejamento ao definir `x-correlation-id` quando o middleware recebe resposta raw.
- Alinha `GET /plannings/turmas` ao schema de turmas do banco para remover warning de Select sem `key`.
- Ajusta ordem de imports e remove variáveis não usadas para eliminar warnings de lint.
- Remove warnings de lint no modulo CEF Shop (API + apps loja/loja-admin/home) com ajustes de imports, hooks e tipagens.
- Corrige erros de typecheck no modulo CEF Shop e payments (tipagens de Stripe e Drizzle).
- Evita redirect para /login no app turmas quando unitId e nulo, usando /turmas como fallback.
- **CRITICO**: Corrige permissoes de TODOS os endpoints de usuarios (GET, POST, PUT, DELETE) - agora `diretora_geral`, `gerente_unidade` e `gerente_financeiro` podem gerenciar usuarios (antes apenas `gerente_financeiro` conseguia)
- Mostra diretora geral e gerente da unidade separadamente na lista de unidades (app escolas)
- Corrige passagem de variaveis de ambiente para processos Turborepo no Docker (adiciona `passThroughEnv` no turbo.json)
- Corrige falha de build nos apps Next ao importar `@essencia/shared` (exports ESM para src + transpilePackages)
- Corrige typo no titulo do formulario de novo usuario: "Novo Úsuário" → "Novo Usuário"
- Corrige permissao do endpoint GET /schools/:id para permitir acesso de `diretora_geral` (apenas sua propria escola)
- Melhora feedback de carregamento no campo Escola do formulario de usuario
- Adiciona tratamento de erro quando escola nao carrega no formulario de usuario
- Corrige PlanningsModule para importar AuthModule e evitar falha de boot do AuthGuard
- Ajusta setup de testes do planejamento (jest-dom, cleanup e mocks) para estabilizar o Vitest
- Corrige falha de boot do container dev quando o Corepack nao valida assinatura do pnpm
- Corrige permissao do volume `/app/.turbo` para evitar falha do Turbo no container dev
- Elimina warning de ESM/CJS no NestJS ao compilar `@essencia/db` e `@essencia/shared` como CommonJS
- Reduz carga do Watchpack ao remover pacotes nao usados de `transpilePackages` nos apps login e escolas
- Suprime deprecation warnings ruidosos (ex: punycode) no Docker dev e documenta variaveis de polling
- Corrige tipagem de queries Drizzle no `@essencia/api` para evitar erros de `implicit any`
- Corrige erro 500 ao listar usuarios quando o backend tentava importar `roles.ts` via ESM
- Permite que `gerente_financeiro` acesse `GET /schools/:id` (apenas sua propria escola)
- Corrige erros de typecheck no app turmas alinhando dependencias e configuracao TypeScript ao padrao do monorepo
- Alinha configuracoes de ESLint, PostCSS e Next do app turmas ao padrao dos demais modulos
- Corrige chamadas do app turmas para evitar /api duplicado no clientFetch e alinhar wrappers de API

- Remove `shell: true` do helper `packages/db/apply-schema.js` para eliminar o warning DEP0190 no Node.
- Normaliza logs do webhook de pagamentos e do job de expiracao para ASCII, evitando caracteres corrompidos no console.
- Ajusta setup do Vitest para registrar matchers do Testing Library e estabilizar localStorage nos testes.
- Move configuracao do ts-jest para o transform e silencia o warning TS151002 sem usar globals.

---

## [0.1.0] - 2025-12-24

### Adicionado

#### Modulo de Planejamento Pedagogico (apps/planejamento)

- **Wizard de Criacao de Planejamento** (Story 2.1, 2.2)
  - Interface wizard com 4 etapas (Dados, Objetivos, Metodologia, Recursos)
  - Navegacao entre etapas com validacao progressiva
  - Formularios estruturados com validacao Zod e React Hook Form
  - Placeholders pedagogicos orientativos para professoras
  - Auto-resize em campos textarea para melhor UX
  - Lista dinamica de recursos com adicionar/remover
  - Preservacao de dados entre etapas do wizard

- **Sistema de Auto-Save** (Story 2.3, 2.4)
  - Auto-save local com localStorage (protecao contra perda de dados)
  - Auto-save no servidor via API (rascunhos)
  - Recuperacao automatica de rascunhos ao recarregar pagina
  - Indicadores visuais de estado de salvamento

- **Dashboard de Planejamentos** (Story 5.1, 5.2, 5.3)
  - Metricas de planejamentos (total, aprovados, pendentes, em ajuste)
  - Indicadores semaforicos por status de entrega
  - KPI de First Pass Yield (aprovacao na primeira tentativa)
  - Filtros por segmento (Infantil, Fundamental)
  - Empty states ilustrados para melhor UX

#### Backend - Modulo de Planejamentos (services/api)

- **API REST de Planejamentos**
  - `POST /plannings/draft` - Salvar rascunho
  - `POST /plannings/submit` - Submeter para coordenacao
  - `GET /plannings/dashboard` - Dados do dashboard
  - `GET /plannings/segment/:segment` - Listar por segmento
  - `GET /plannings/:id` - Detalhes de planejamento
  - `POST /plannings/:id/approve` - Aprovar planejamento
  - `POST /plannings/:id/request-changes` - Solicitar ajustes

- **Rate Limiting**
  - Limite de 5 requests/15s para `/stats/dashboard`
  - Protecao contra abuso de endpoints criticos

#### Database Schema (packages/db)

- **Tabelas de Planejamento**
  - `plannings` - Dados principais do planejamento
  - `planning_contents` - Conteudo pedagogico (relacao 1:1)
  - `planning_reviews` - Historico de revisoes (relacao 1:N)
  - Enum `planning_status` (RASCUNHO, PENDENTE, EM_AJUSTE, APROVADO)
  - Enum `review_status` (APROVADO, EM_AJUSTE)
  - Indices otimizados para queries de dashboard
  - Constraint unico por professora/turma/quinzena

#### Design System (packages/ui)

- **Novos Componentes Shadcn**
  - Form components (Form, FormField, FormLabel, FormControl, FormMessage)
  - Select component (dropdown com React Hook Form)
  - Textarea component com auto-resize
  - Checkbox component
  - Dialog component
  - Skeleton component (loading states)
  - Toaster component (notificacoes)

#### Shared Packages

- `@essencia/components` - Componentes React compartilhados entre apps

### Alterado

- Atualizado React Hook Form para v7.69.0
- Melhorias de acessibilidade em componentes de formulario
- Otimizacao de validacao inline (mode: onBlur)

### Testes

- 34 testes unitarios para componentes de formulario do wizard
- Cobertura de testes para validacao Zod
- Testes de integracao para auto-save

### Documentacao

- Documentacao completa de endpoints de planejamento em API.md
- Schema de banco de dados atualizado em DATABASE.md
- Arquitetura atualizada com modulo de planejamento
- Guia de deployment atualizado com novo app

### Seguranca

- Validacao de permissoes por role em endpoints de planejamento
- Isolamento multi-tenant para planejamentos
- Rate limiting em endpoints de criacao

---

## [0.0.1] - 2025-12-19

### Adicionado

#### Infraestrutura

- Inicializacao do monorepo com Turborepo + pnpm
- Configuracao de ESLint e Prettier compartilhados
- Setup de TypeScript com strict mode
- Docker Compose para desenvolvimento (PostgreSQL + Redis)
- Docker Compose para producao com Traefik

#### Backend (services/api)

- Scaffold NestJS 10.4+ com Fastify
- Modulo de autenticacao com sessoes Redis
- AuthGuard para protecao de rotas
- RolesGuard para controle de acesso baseado em roles
- TenantGuard para isolamento multi-tenant
- Health check endpoint (`GET /health`)

- **Endpoints de Auth**
  - `POST /auth/login` - Login com email/senha
  - `POST /auth/logout` - Logout (invalida sessao)
  - `GET /auth/session` - Dados da sessao atual

- **Endpoints de Escolas**
  - `GET /schools` - Listar escolas
  - `GET /schools/:id` - Detalhes de escola
  - `POST /schools` - Criar escola
  - `PUT /schools/:id` - Atualizar escola

- **Endpoints de Unidades**
  - `GET /units` - Listar unidades
  - `GET /units/:id` - Detalhes de unidade
  - `POST /units` - Criar unidade
  - `PUT /units/:id` - Atualizar unidade

- **Endpoints de Usuarios**
  - `GET /users` - Listar usuarios
  - `GET /users/:id` - Detalhes de usuario
  - `POST /users` - Criar usuario
  - `PUT /users/:id` - Atualizar usuario
  - `DELETE /users/:id` - Soft delete de usuario

#### Frontend (apps)

- **apps/home** (:3006)
  - Scaffold Next.js 15 com App Router
  - Configuracao de Tailwind CSS + shadcn/ui
  - Landing page responsiva

- **apps/login** (:3003)
  - Pagina de login com validacao Zod
  - Integracao com API de autenticacao
  - Redirect apos login bem-sucedido

- **apps/usuarios** (:3004)
  - Layout com sidebar responsiva
  - Listagem de usuarios
  - Formulario de criacao/edicao

- **apps/escolas** (:3005)
  - Gestao de escolas e unidades
  - Hierarquia escola > unidades

#### Database (packages/db)

- Schema inicial com Drizzle ORM 0.38+
- **Tabela `schools`**
  - id, name, slug, createdAt, updatedAt, deletedAt
- **Tabela `units`**
  - id, name, schoolId (FK), createdAt, updatedAt, deletedAt
- **Tabela `users`**
  - id, name, email, passwordHash, role, schoolId, unitId
  - createdAt, updatedAt, deletedAt (soft delete)
- **Tabela `sessions`**
  - id, userId, data (JSON), expiresAt
- Enum de roles com 11 niveis hierarquicos
- Connection factory com pool de conexoes

#### Shared Packages

- **@essencia/ui** - Design System
  - Button, Card, Input, Label, Sheet, StatsCard
  - Tema consistente com Tailwind

- **@essencia/shared** - Tipos e Utilitarios
  - Tipos compartilhados (User, School, Unit, Session)
  - Schemas Zod para validacao
  - Fetchers para client e server

- **@essencia/config** - Configuracoes
  - ESLint config compartilhado
  - TypeScript config compartilhado

- **@essencia/tailwind-config** - Preset Tailwind
  - Cores, fontes e espacamento padronizados

#### DevOps

- Scripts de setup VPS (`scripts/setup-vps.sh`)
- Scripts de deploy (`scripts/deploy.sh`)
- Health check automation (`scripts/health-check.sh`)
- GitHub Actions workflow (CI/CD)

### Seguranca

- Autenticacao com cookies HttpOnly
- Sessoes armazenadas em Redis com TTL de 24h
- Sliding window para renovacao de sessao (25% threshold)
- Password hashing com bcrypt (12 salt rounds)
- Rate limiting basico
- CORS configurado para dominios especificos
- Headers de seguranca (X-Content-Type-Options, X-Frame-Options, etc.)

---

## Legenda

| Icone            | Categoria                              |
| ---------------- | -------------------------------------- |
| **Adicionado**   | Novas funcionalidades                  |
| **Alterado**     | Mudancas em funcionalidades existentes |
| **Obsoleto**     | Funcionalidades marcadas para remocao  |
| **Removido**     | Funcionalidades removidas              |
| **Corrigido**    | Correcoes de bugs                      |
| **Seguranca**    | Correcoes de seguranca                 |
| **Testes**       | Adicao ou correcao de testes           |
| **Documentacao** | Atualizacoes de documentacao           |

---

## Links

- [Unreleased](https://github.com/renatinhosfaria/portalessencia/compare/v0.1.0...HEAD)
- [0.1.0](https://github.com/renatinhosfaria/portalessencia/compare/v0.0.1...v0.1.0)
- [0.0.1](https://github.com/renatinhosfaria/portalessencia/releases/tag/v0.0.1)
