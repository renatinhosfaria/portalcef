# Arquitetura do Sistema

Este documento descreve a arquitetura tecnica do Portal Digital Colegio Essencia Feliz.

---

## Visao Geral

O sistema segue uma arquitetura de **monorepo** com separacao clara entre frontend (Next.js apps), backend (NestJS API) e pacotes compartilhados. A comunicacao entre camadas e feita exclusivamente via HTTP/REST.

```
Frontend (Next.js)
  - home :3000
  - calendario :3002
  - login :3003
  - usuarios :3004
  - escolas :3005
  - turmas :3006
  - planejamento :3007
  - loja :3010
  - loja-admin :3011

        |
        |  HTTP/REST
        v

Backend (NestJS API) :3001
  - auth, users, schools, units, stages, turmas, plannings
  - calendar, shop, payments, stats, setup, health, storage

        |
        v

Data Layer
  - PostgreSQL :5432
  - Redis :6379
  - MinIO (opcional) :9000/9001
```

---

## Stack Tecnologica

### Core

| Tecnologia     | Versao | Proposito                  |
| -------------- | ------ | -------------------------- |
| **Node.js**    | 22+    | Runtime JavaScript         |
| **TypeScript** | 5.7.2  | Tipagem estatica           |
| **pnpm**       | 9.15.1 | Gerenciador de pacotes     |
| **Turborepo**  | 2.3.3  | Build system para monorepo |

### Frontend

| Tecnologia          | Versao | Proposito                    |
| ------------------- | ------ | ---------------------------- |
| **Next.js**         | 15.1.0 | Framework React (App Router) |
| **React**           | 19.0.0 | Biblioteca UI                |
| **Tailwind CSS**    | 3.4.17 | Estilizacao utility-first    |
| **shadcn/ui**       | -      | Componentes UI               |
| **React Hook Form** | 7.54+  | Gerenciamento de formularios |
| **Zod**             | 3.23+  | Validacao de schemas         |
| **Framer Motion**   | 12.23+ | Animacoes                    |

### Backend

| Tecnologia      | Versao | Proposito         |
| --------------- | ------ | ----------------- |
| **NestJS**      | 10.4.15 | Framework backend |
| **Fastify**     | 4.28.1  | HTTP server       |
| **Drizzle ORM** | 0.38.2  | ORM type-safe     |
| **ioredis**     | 5.4.2   | Cliente Redis     |
| **bcrypt**      | 5.1.1   | Hashing de senhas |
| **Stripe**      | 20.1.2  | Pagamentos (Shop) |

### Infraestrutura

| Tecnologia     | Versao | Proposito                 |
| -------------- | ------ | ------------------------- |
| **PostgreSQL** | 16     | Banco de dados relacional |
| **Redis**      | 7      | Cache e sessoes           |
| **Docker**     | -      | Containerizacao           |
| **MinIO**      | -      | Storage de arquivos (opcional) |
| **Traefik**    | -      | Reverse proxy (producao, nao versionado no repo) |

---

## Estrutura do Monorepo

### Apps (apps/)

Aplicacoes Next.js independentes, cada uma servindo um modulo especifico do sistema.

```
apps/
+-- home/               # Portal publico (:3000)
|   +-- app/
|   +-- components/
|   +-- package.json
+-- calendario/         # Calendario escolar (:3002)
|   +-- app/
|   +-- features/
|   +-- lib/
|   +-- package.json
+-- login/              # Autenticacao (:3003)
|   +-- app/
|   +-- package.json
+-- usuarios/           # Gestao de usuarios (:3004)
|   +-- app/
|   +-- package.json
+-- escolas/            # Gestao de escolas/unidades (:3005)
|   +-- app/
|   +-- components/
|   +-- package.json
+-- turmas/             # Gestao de turmas (:3006)
|   +-- app/
|   +-- components/
|   +-- lib/
|   +-- package.json
+-- planejamento/       # Planejamento pedagogico (:3007)
|   +-- app/
|   +-- features/
|   +-- package.json
+-- loja/               # Loja publica (:3010)
|   +-- app/
|   +-- components/
|   +-- lib/
|   +-- package.json
+-- loja-admin/         # Admin da loja (:3011)
    +-- app/
    +-- components/
    +-- package.json
```

### Services (services/)

Backend API centralizado.

```
services/
+-- api/
    +-- src/
    |   +-- app.module.ts           # Modulo raiz
    |   +-- main.ts                 # Bootstrap Fastify
    |   +-- common/
    |   |   +-- decorators/
    |   |   +-- filters/
    |   |   +-- guards/
    |   |   +-- interceptors/
    |   |   +-- middleware/
    |   |   +-- storage/            # Upload (MinIO)
    |   +-- modules/
    |       +-- auth/               # Login, logout, sessoes
    |       +-- calendar/           # Calendario escolar
    |       +-- health/             # Health check
    |       +-- payments/           # Webhooks Stripe
    |       +-- plannings/          # Planejamentos
    |       +-- schools/            # Escolas
    |       +-- setup/              # Bootstrap inicial
    |       +-- shop/               # CEF Shop
    |       +-- stages/             # Etapas
    |       +-- stats/              # Dashboard stats
    |       +-- turmas/             # Turmas
    |       +-- units/              # Unidades
    |       +-- users/              # Usuarios
    +-- package.json
```

### Packages (packages/)

Codigo compartilhado entre apps e services.

```
packages/
+-- ui/                 # Design System (@essencia/ui)
+-- db/                 # Drizzle ORM + migrations
+-- shared/             # Tipos, schemas, fetchers
+-- components/         # Componentes React compartilhados
+-- lib/                # Utilitarios compartilhados
+-- config/             # ESLint/TSConfig compartilhado
+-- tailwind-config/    # Preset Tailwind
```

---

## Principios Arquiteturais

### 1. Governanca de Dados

**Regra Principal**: Apps NUNCA acessam o banco de dados diretamente.

```
┌──────────────┐     HTTP      ┌──────────────┐     SQL      ┌──────────────┐
│   Next.js    │ ───────────▶  │   NestJS     │ ───────────▶ │  PostgreSQL  │
│     App      │               │     API      │              │              │
└──────────────┘               └──────────────┘              └──────────────┘
       │                              │
       │                              │
       ▼                              ▼
  @essencia/shared              @essencia/db
  (tipos, schemas)              (Drizzle ORM)
```

**Proibido**:

```typescript
// apps/usuarios/page.tsx
import { db } from "@essencia/db"; // PROIBIDO!
```

**Correto**:

```typescript
// apps/usuarios/page.tsx
import { serverFetch } from "@essencia/shared/fetchers/server";

const users = await serverFetch("/users");
```

### 2. Pipeline de Guards

Cadeia de guards obrigatoria para endpoints protegidos:

```
Request
   │
   ▼
┌──────────────┐
│  AuthGuard   │──── Verifica cookie de sessao
└──────┬───────┘     Valida token no Redis
       │             Anexa user ao request
       ▼
┌──────────────┐
│  RolesGuard  │──── Verifica role do usuario
└──────┬───────┘     Aplica hierarquia de roles
       │
       ▼
┌──────────────┐
│ TenantGuard  │──── Valida acesso ao tenant
└──────┬───────┘     (escola/unidade/etapa)
       │
       ▼
  Controller
```

| Guard         | Responsabilidade                           | Falha |
| ------------- | ------------------------------------------ | ----- |
| `AuthGuard`   | Valida sessao e extrai tenant context      | 401   |
| `RolesGuard`  | Verifica se role tem permissao minima      | 403   |
| `TenantGuard` | Garante acesso a escola/unidade/etapa      | 403   |

### 3. Multi-Tenancy

Modelo hierarquico de isolamento:

```
┌─────────────────────────────────────────────────┐
│                    MASTER                        │
│              (Acesso Global)                     │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│   Escola A    │           │   Escola B    │
│(diretora_geral│           │               │
│ acessa tudo)  │           │               │
└───────┬───────┘           └───────────────┘
        │
   ┌────┴────┐
   ▼         ▼
┌──────┐  ┌──────┐
│Unit 1│  │Unit 2│
│      │  │      │
│Users │  │Users │
│Plan. │  │Plan. │
└──────┘  └──────┘
```

**Escopo de Acesso por Role**:

| Role                       | Nivel | Escopo                     |
| -------------------------- | ----- | -------------------------- |
| `master`                   | 0     | Global (todas as escolas)  |
| `diretora_geral`           | 1     | Escola (todas as unidades) |
| `gerente_unidade`          | 2     | Unidade                    |
| `gerente_financeiro`       | 3     | Unidade                    |
| `coordenadora_geral`       | 4     | Unidade                    |
| `coordenadora_bercario`    | 5     | Unidade                    |
| `coordenadora_infantil`    | 6     | Unidade                    |
| `coordenadora_fundamental_i` | 7   | Unidade                    |
| `coordenadora_fundamental_ii` | 8  | Unidade                    |
| `coordenadora_medio`       | 9     | Unidade                    |
| `analista_pedagogico`      | 10    | Unidade                    |
| `professora`               | 11    | Unidade                    |
| `auxiliar_administrativo`  | 12    | Unidade                    |
| `auxiliar_sala`            | 13    | Unidade                    |

### 4. Feature-Based Architecture

O app de planejamento usa arquitetura baseada em features:

```
apps/planejamento/
├── app/                    # Routes (Next.js App Router)
│   ├── page.tsx            # Dashboard
│   └── planejamentos/
│       └── novo/
│           └── page.tsx    # Wizard
│
├── features/               # Feature modules
│   ├── wizard/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom hooks
│   │   ├── schemas.ts      # Zod schemas
│   │   ├── constants.ts    # Constants
│   │   └── actions.ts      # Server actions
│   │
│   ├── dashboard/
│   │   ├── components/
│   │   └── utils/
│   │
│   └── preview/
│       └── components/
│
└── components/             # Shared app components
```

---

## Fluxos de Dados

### Autenticacao

```
1. Login
   POST /auth/login
   └─▶ Valida credenciais (bcrypt)
       └─▶ Cria sessao no Redis (24h TTL)
           └─▶ Define cookie HttpOnly
               └─▶ Retorna dados do usuario

2. Requisicao autenticada
   GET /users (com cookie)
   └─▶ AuthGuard extrai token do cookie
       └─▶ Busca sessao no Redis
           └─▶ Renova se TTL < 25% (sliding window)
               └─▶ RolesGuard verifica permissao
                   └─▶ TenantGuard valida escopo
                       └─▶ Controller processa

3. Logout
   POST /auth/logout
   └─▶ Remove sessao do Redis
       └─▶ Limpa cookie
```

### Wizard de Planejamento

```
1. Criacao
   └─▶ Preenche etapa 1 (Dados: turma, quinzena)
       └─▶ Auto-save localStorage (debounce 2s)
           └─▶ Avanca para etapa 2 (Objetivos)
               └─▶ ...

2. Auto-save servidor
   └─▶ POST /plannings/draft (a cada 30s)
       └─▶ Upsert rascunho (RASCUNHO)

3. Submissao
   └─▶ Valida checklist obrigatorio
       └─▶ POST /plannings/submit
           └─▶ Status = PENDENTE
               └─▶ submittedAt = now()

4. Revisao (Coordenacao)
   └─▶ Aprovar: POST /plannings/:id/approve
       └─▶ Status = APROVADO, approvedAt = now()
       └─▶ firstPassYield = (reviewCycles == 0)

   └─▶ Solicitar ajustes: POST /plannings/:id/request-changes
       └─▶ Status = EM_AJUSTE
       └─▶ reviewCycles++
       └─▶ Cria planning_review com comentario
```

---


### Fluxo de Pedido (CEF Shop)

```
1. Catalogo publico
   GET /shop/locations
   GET /shop/catalog/:schoolId/:unitId

2. Pedido online (voucher)
   POST /shop/orders
   -> Reserva estoque por unidade
   -> Status AGUARDANDO_PAGAMENTO
   -> expiresAt = now + 7 dias

3. Pagamento presencial (admin)
   PATCH /shop/admin/orders/:id/confirm-payment
   -> Converte reserva em venda
   -> Status PAGO

4. Retirada (admin)
   PATCH /shop/admin/orders/:id/pickup
   -> Status RETIRADO
```

## Padroes de Resposta API

### Sucesso

```json
{
  "success": true,
  "data": { ... }
}
```

### Erro

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados invalidos",
    "details": { ... }
  }
}
```

### Codigos HTTP

| Codigo | Significado       | Quando                |
| ------ | ----------------- | --------------------- |
| 200    | OK                | Operacao bem sucedida |
| 201    | Created           | Recurso criado        |
| 400    | Bad Request       | Validacao falhou      |
| 401    | Unauthorized      | Nao autenticado       |
| 403    | Forbidden         | Sem permissao         |
| 404    | Not Found         | Recurso nao existe    |
| 429    | Too Many Requests | Rate limit excedido   |

---

## Sessoes e Cache

### Configuracao de Sessao

```typescript
interface SessionData {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
  createdAt: number;
}
```

| Parametro         | Valor         | Descricao                |
| ----------------- | ------------- | ------------------------ |
| TTL               | 24 horas      | Expiracao da sessao      |
| Renewal Threshold | 25%           | Renova se < 6h restantes |
| Cookie Name       | `cef_session` | Nome do cookie           |

### Atributos do Cookie

```
HttpOnly: true      # Previne acesso via JavaScript
Secure: true        # Somente HTTPS (producao)
SameSite: Lax       # CSRF protection
Path: /             # Disponivel em todas as rotas
Max-Age: 86400      # 24 horas
```

### Rate Limiting

| Endpoint           | Limite     | Janela      |
| ------------------ | ---------- | ----------- |
| `/stats/dashboard` | 5 requests | 15 segundos |
| `/shop/orders`     | 5 requests | 1 hora      |

---

## Testes

### Backend (Jest)

```bash
pnpm --filter @essencia/api test
```

Estrutura de testes:

- Testes unitarios para services
- Testes e2e para controllers
- Mocks para Redis e PostgreSQL

### Frontend (Vitest)

```bash
pnpm --filter planejamento test
```

Estrutura de testes:

- Testes de componentes com Testing Library
- Testes de hooks customizados
- Testes de validacao de schemas

---

## Performance

### Caching

| Camada  | Estrategia                 |
| ------- | -------------------------- |
| Redis   | Sessions, cache de queries |
| Next.js | ISR para paginas publicas  |
| Browser | Static assets              |

### Otimizacoes

- **Turborepo**: Cache inteligente de builds
- **Tree Shaking**: Bundles otimizados
- **Server Components**: Renderizacao no servidor
- **Connection Pooling**: Reutilizacao de conexoes DB

---

## Decisoes Tecnicas

### Por que Next.js 15 com App Router?

- Server Components para melhor performance
- Streaming e Suspense nativos
- Route Handlers para proxy de API
- Layouts aninhados
- React 19 com melhorias de performance

### Por que NestJS com Fastify?

- TypeScript nativo com decorators
- Arquitetura modular escalavel
- Fastify 2x mais rapido que Express
- Suporte nativo a plugins
- Dependency Injection robusto

### Por que Drizzle ORM?

- Type-safe queries em tempo de compilacao
- Migrations automaticas
- Zero overhead em runtime
- API simples e declarativa
- Suporte completo a PostgreSQL

### Por que Redis para Sessoes?

- Performance superior (in-memory)
- TTL nativo para expiracao
- Suporte a sliding window
- Escalabilidade horizontal
- Operacoes atomicas

### Por que Monorepo com Turborepo?

- Cache inteligente de builds
- Execucao paralela de tasks
- Compartilhamento de codigo
- Dependencias bem definidas
- Developer experience superior

---

## Referencias

- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Drizzle ORM](https://orm.drizzle.team)
- [Turborepo](https://turbo.build/repo)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
